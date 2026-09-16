/* historique.js — la mémoire des chemins déjà parcourus.
 *
 * Sert au mode « Exploration » : savoir si un tronçon est nouveau DANS
 * L'HISTORIQUE CHARGÉ. Pas dans ta vie sportive — le studio n'en sait rien,
 * et c'est précisément la phrase qu'il ne doit jamais laisser croire.
 *
 * ── Ce qui est stocké ────────────────────────────────────────────────
 * Pas les traces : une EMPREINTE. Chaque sortie devient un ensemble de
 * cases d'une grille d'une cinquantaine de mètres. Trois conséquences, et
 * ce sont les trois exigences du mode :
 *
 *   - LE SENS DISPARAÎT. Un ensemble de cases n'a pas d'ordre : le même
 *     chemin parcouru en sens inverse donne exactement les mêmes cases. La
 *     comparaison de deux polylignes, elle, aurait demandé un appariement
 *     coûteux et fragile sur ce point précis.
 *   - LE BRUIT GPS EST ABSORBÉ. On compare une case ET ses huit voisines :
 *     une trace qui zigzague de trente mètres reste « connue ».
 *   - C'EST LÉGER. Une sortie de 60 km tient dans ~1 200 clés courtes, soit
 *     quelques dizaines de kilo-octets. Mille sorties restent gérables ;
 *     garder les traces entières ne l'aurait pas été.
 *
 * ── Où c'est stocké ──────────────────────────────────────────────────
 * IndexedDB, pas localStorage : localStorage est synchrone, plafonné à
 * quelques mégaoctets, et bloque le fil d'affichage à chaque écriture. Rien
 * n'est envoyé nulle part. `vider()` efface vraiment.
 *
 * ── Ce que ça ne sait pas faire ──────────────────────────────────────
 * Une grille fixe se recale sur des bandes d'un degré de latitude. Une
 * sortie qui franchit un degré entier (46,000000) perd la tolérance de
 * voisinage sur ce trait-là. C'est un cas par mille sorties, et le prix à
 * payer pour que deux personnes calculent les mêmes clés.
 */
(function (global) {
  'use strict';

  var BASE = 'strava-studio-exploration';
  var STORE = 'sorties';
  var TAILLE = 50;                    // côté d'une case, en mètres

  /* ---------- la grille ---------- */
  function cle(lat, lon) {
    var bande = Math.floor(lat);
    var cosB = Math.cos((bande + 0.5) * Math.PI / 180);
    var y = Math.round(lat * 110540 / TAILLE);
    var x = Math.round(lon * 111320 * cosB / TAILLE);
    return bande + ':' + x + ':' + y;
  }

  /* Les cases d'une trace. On échantillonne aussi ENTRE deux points : à
   * 30 km/h avec un point toutes les cinq secondes, deux points voisins sont
   * à quarante mètres et sauteraient une case sur deux. */
  function cases(track) {
    var set = Object.create(null);
    for (var i = 0; i < track.length; i++) {
      var p = track[i];
      if (p.lat == null) continue;
      set[cle(p.lat, p.lon)] = 1;
      var q = track[i + 1];
      if (!q || q.lat == null) continue;
      var d = (q.d != null && p.d != null) ? q.d - p.d : 0;
      var n = Math.min(40, Math.floor(d / (TAILLE * 0.6)));
      for (var k = 1; k < n; k++) {
        var t = k / n;
        set[cle(p.lat + (q.lat - p.lat) * t, p.lon + (q.lon - p.lon) * t)] = 1;
      }
    }
    return Object.keys(set);
  }

  /* Une case est « connue » si elle, ou l'une de ses huit voisines, est dans
   * l'ensemble. C'est là que vit la tolérance au bruit GPS. */
  function connue(set, lat, lon) {
    var bande = Math.floor(lat);
    var cosB = Math.cos((bande + 0.5) * Math.PI / 180);
    var y = Math.round(lat * 110540 / TAILLE);
    var x = Math.round(lon * 111320 * cosB / TAILLE);
    for (var dx = -1; dx <= 1; dx++) {
      for (var dy = -1; dy <= 1; dy++) {
        if (set[bande + ':' + (x + dx) + ':' + (y + dy)]) return true;
      }
    }
    return false;
  }

  /* ---------- IndexedDB ---------- */
  var db = null;

  function ouvre() {
    if (db) return Promise.resolve(db);
    return new Promise(function (ok, ko) {
      if (!global.indexedDB) return ko(new Error('Ce navigateur ne sait pas stocker d’historique.'));
      var req = indexedDB.open(BASE, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { db = req.result; ok(db); };
      req.onerror = function () { ko(new Error('Historique inaccessible.')); };
    });
  }

  function transaction(mode, fn) {
    return ouvre().then(function (d) {
      return new Promise(function (ok, ko) {
        var tx = d.transaction(STORE, mode);
        var st = tx.objectStore(STORE);
        var res = fn(st);
        tx.oncomplete = function () { ok(res && res.__valeur !== undefined ? res.__valeur : res); };
        tx.onerror = function () { ko(new Error('Écriture impossible.')); };
      });
    });
  }

  /* Une empreinte par sortie, identifiée par nom + date + distance : réimporter
   * le même GPX deux fois ne doit pas doubler la référence. */
  function identifiant(a) {
    return [a.name || '?', a.date ? a.date.toISOString().slice(0, 16) : '?',
            Math.round(a.distance_m || 0)].join('|');
  }

  function ajouter(activites) {
    var lot = activites.map(function (a) {
      return {
        id: identifiant(a),
        nom: a.name || 'Sortie',
        date: a.date ? a.date.toISOString() : null,
        km: a.distance_km || 0,
        cases: cases(a.track || [])
      };
    }).filter(function (x) { return x.cases.length; });
    return transaction('readwrite', function (st) {
      lot.forEach(function (x) { st.put(x); });
      return { __valeur: lot.length };
    });
  }

  function lister() {
    return transaction('readonly', function (st) {
      var out = [];
      st.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (!c) return;
        out.push(c.value);
        c.continue();
      };
      return { __valeur: out };
    });
  }

  function vider() {
    return transaction('readwrite', function (st) { st.clear(); return { __valeur: true }; });
  }

  /* L'ensemble plat des cases connues, prêt pour `connue()`. On le calcule
   * une fois et le moteur le passe aux templates : refaire l'union à chaque
   * image de rendu coûterait cher pour un résultat identique. */
  function empreinte(entrees) {
    var set = Object.create(null);
    var km = 0;
    (entrees || []).forEach(function (e) {
      km += e.km || 0;
      (e.cases || []).forEach(function (c) { set[c] = 1; });
    });
    return { set: set, sorties: (entrees || []).length, km: km,
             cases: Object.keys(set).length };
  }

  global.Historique = {
    ajouter: ajouter, lister: lister, vider: vider,
    empreinte: empreinte, connue: connue, cases: cases, cle: cle, TAILLE: TAILLE
  };
}(window));
