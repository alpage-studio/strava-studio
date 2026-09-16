/* musee.js — la collection de pièces, gardée dans ce navigateur.
 *
 * Une pièce = une trace, une date, un titre, un cartel écrit à la main. Le
 * modèle est celui d'un catalogue d'exposition, pas d'un palmarès : aucune
 * pièce n'est « mieux » qu'une autre, il n'y a ni classement ni trophée.
 *
 * Deux règles qui décident du stockage :
 *
 *   - INDEXEDDB, PAS localStorage. Une pièce porte une trace et parfois une
 *     photo ; localStorage est plafonné à quelques mégaoctets et synchrone.
 *     Y ranger une photo, c'est remplir le quota d'un site entier sans rien
 *     dire, et le découvrir quand une écriture échoue.
 *   - LA PHOTO EST UN BLOB, stocké tel quel. Pas de dataURL : l'encodage
 *     base64 grossit le fichier d'un tiers et fait passer l'image entière
 *     par une chaîne JavaScript à chaque lecture.
 *
 * Les SUGGESTIONS de premières fois vivent aussi ici, et elles obéissent à
 * une règle stricte : on ne propose que ce qui est vérifiable dans ce qui a
 * été chargé, chaque proposition porte sa raison en clair, et rien n'entre
 * dans la collection sans confirmation. Le studio ne devine ni une émotion,
 * ni un évènement de ta vie — il sait qu'il n'avait jamais vu de vélo de
 * route avant cette sortie-là, et c'est tout ce qu'il dit.
 */
(function (global) {
  'use strict';

  var BASE = 'strava-studio-musee';
  var STORE = 'pieces';
  var db = null;

  function ouvre() {
    if (db) return Promise.resolve(db);
    return new Promise(function (ok, ko) {
      if (!global.indexedDB) return ko(new Error('Ce navigateur ne sait pas garder de collection.'));
      var req = indexedDB.open(BASE, 1);
      req.onupgradeneeded = function () {
        var d = req.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      req.onsuccess = function () { db = req.result; ok(db); };
      req.onerror = function () { ko(new Error('Collection inaccessible.')); };
    });
  }

  function tx(mode, fn) {
    return ouvre().then(function (d) {
      return new Promise(function (ok, ko) {
        var t = d.transaction(STORE, mode);
        var res = fn(t.objectStore(STORE));
        t.oncomplete = function () { ok(res && res.__v !== undefined ? res.__v : res); };
        t.onerror = function () { ko(new Error('Écriture impossible.')); };
      });
    });
  }

  /* L'identité d'une pièce vient de la SORTIE, pas d'un compteur : créer deux
   * fois la pièce de la même sortie doit la remplacer, pas la dupliquer. */
  function identifiant(a) {
    return [a.name || '?', a.date ? a.date.toISOString().slice(0, 16) : '?',
            Math.round(a.distance_m || 0)].join('|');
  }

  /* Une trace allégée : une pièce de musée n'a pas besoin de vingt mille
   * points, et la collection doit rester légère sur des années. */
  function allege(track, cible) {
    var utiles = track.filter(function (p) { return p.lat != null; });
    if (utiles.length <= cible) return utiles;
    var pas = utiles.length / cible, out = [];
    for (var i = 0; i < cible; i++) out.push(utiles[Math.floor(i * pas)]);
    out.push(utiles[utiles.length - 1]);
    return out;
  }

  function creer(activity, champs, photoBlob) {
    var t = allege(activity.track || [], 600);
    if (!t.length) return Promise.reject(new Error('Cette sortie n’a pas de trace.'));
    var piece = {
      id: identifiant(activity),
      /* Le rang se calcule dans la transaction, juste après : Date.now()
       * donne la même valeur à trois pièces créées dans la même boucle, et
       * la collection se rangeait alors par identifiant — c'est-à-dire par
       * ordre alphabétique du nom de la sortie. */
      rang: champs.rang != null ? champs.rang : null,
      titre: (champs.titre || '').trim() || activity.name || 'Sans titre',
      recit: (champs.recit || '').trim(),
      couleur: champs.couleur || '#E5502D',
      nomSortie: activity.name || null,
      date: activity.date ? activity.date.toISOString() : null,
      distance_km: activity.distance_km,
      elev_gain_m: activity.elev_gain_m,
      lat: t.map(function (p) { return Math.round(p.lat * 1e6) / 1e6; }),
      lon: t.map(function (p) { return Math.round(p.lon * 1e6) / 1e6; }),
      photo: photoBlob || null,
      cree: new Date().toISOString()
    };
    return tx('readwrite', function (st) {
      if (piece.rang != null) { st.put(piece); return { __v: piece }; }
      var max = 0;
      st.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (c) {
          // une pièce recréée garde SA place : on ne la renvoie pas à la fin
          if (c.value.id === piece.id) { piece.rang = c.value.rang; }
          if ((c.value.rang || 0) > max) max = c.value.rang || 0;
          c.continue();
          return;
        }
        if (piece.rang == null) piece.rang = max + 1;
        st.put(piece);
      };
      return { __v: piece };
    });
  }

  function modifier(id, champs) {
    return tx('readwrite', function (st) {
      var req = st.get(id);
      req.onsuccess = function () {
        var p = req.result;
        if (!p) return;
        Object.keys(champs).forEach(function (k) { p[k] = champs[k]; });
        st.put(p);
      };
      return { __v: true };
    });
  }

  function supprimer(id) {
    return tx('readwrite', function (st) { st.delete(id); return { __v: true }; });
  }

  function lister() {
    return tx('readonly', function (st) {
      var out = [];
      st.openCursor().onsuccess = function (e) {
        var c = e.target.result;
        if (!c) return;
        out.push(c.value); c.continue();
      };
      return { __v: out };
    }).then(function (l) {
      return l.sort(function (a, b) { return (a.rang || 0) - (b.rang || 0); });
    });
  }

  function vider() { return tx('readwrite', function (st) { st.clear(); return { __v: true }; }); }

  /* ---------- suggestions ----------
   *
   * Deux règles, et seulement deux, parce que ce sont les seules qui se
   * vérifient sans rien inventer :
   *
   *   1. PREMIÈRE FOIS DE CE SPORT. Aucune sortie de ce type, plus ancienne,
   *      parmi celles qui sont chargées. La règle est donnée en clair, avec
   *      le nombre de sorties sur lequel elle porte : « première sortie de
   *      type vtt parmi les 8 chargées ».
   *   2. PREMIER PASSAGE DANS UNE ZONE. Plus de `seuil` % de la sortie est
   *      hors de l'historique d'exploration enregistré.
   *
   * Aucune ne conclut quoi que ce soit sur toi. Chacune renvoie son
   * `pourquoi`, que l'interface affiche AVANT de rien enregistrer.
   */
  function suggestions(entrees, empreinte, dejaIds) {
    var out = [];
    var deja = {};
    (dejaIds || []).forEach(function (i) { deja[i] = 1; });
    var liste = (entrees || []).map(function (e) { return e.activity; })
      .filter(function (a) { return a && a.track && a.track.length; });

    /* 1. première fois d'un type */
    var parType = {};
    liste.forEach(function (a) {
      var t = String(a.type || '').toLowerCase().trim() || 'sans type';
      (parType[t] = parType[t] || []).push(a);
    });
    Object.keys(parType).forEach(function (t) {
      if (t === 'sans type') return;
      var tri = parType[t].slice().sort(function (a, b) {
        return (a.date ? a.date.getTime() : 0) - (b.date ? b.date.getTime() : 0);
      });
      var prem = tri[0];
      if (!prem || deja[identifiant(prem)]) return;
      out.push({
        activity: prem,
        titre: 'Première sortie « ' + t + ' »',
        pourquoi: 'Aucune sortie de type « ' + t + ' » plus ancienne parmi les ' +
                  liste.length + ' sorties chargées. Le studio ne connaît que celles-là.'
      });
    });

    /* 2. premier passage dans une zone */
    if (empreinte && empreinte.sorties) {
      liste.forEach(function (a) {
        if (deja[identifiant(a)]) return;
        var t = a.track, dedans = 0, total = 0;
        for (var i = 0; i < t.length; i += 2) {
          if (t[i].lat == null) continue;
          total++;
          if (global.Historique.connue(empreinte.set, t[i].lat, t[i].lon)) dedans++;
        }
        if (total < 20) return;
        var neuf = 1 - dedans / total;
        if (neuf < 0.7) return;
        out.push({
          activity: a,
          titre: 'Premier passage par là',
          pourquoi: Math.round(neuf * 100) + ' % de cette sortie est hors de l’historique ' +
                    'd’exploration enregistré (' + empreinte.sorties +
                    (empreinte.sorties > 1 ? ' sorties' : ' sortie') + ' de référence).'
        });
      });
    }
    return out;
  }

  /* ---------- sauvegarde ----------
   * Les photos ne partent PAS dans la sauvegarde JSON : on le dit, plutôt que
   * de produire un fichier de quarante mégaoctets qu'on découvre en voulant
   * l'envoyer. Les traces et les cartels, eux, y sont en entier. */
  function sauvegarde(pieces) {
    return {
      format: 1, type: 'musee', cree: new Date().toISOString(),
      photos: 'non incluses',
      pieces: pieces.map(function (p) {
        var c = {};
        Object.keys(p).forEach(function (k) { if (k !== 'photo') c[k] = p[k]; });
        return c;
      })
    };
  }

  function restaurer(texte) {
    var j;
    try { j = JSON.parse(texte); } catch (e) { throw new Error('Ce fichier n’est pas une collection.'); }
    if (!j || j.type !== 'musee' || !Array.isArray(j.pieces)) {
      throw new Error('Format de collection inconnu.');
    }
    return tx('readwrite', function (st) {
      j.pieces.forEach(function (p) { st.put(p); });
      return { __v: j.pieces.length };
    });
  }

  global.Musee = {
    creer: creer, modifier: modifier, supprimer: supprimer,
    lister: lister, vider: vider, identifiant: identifiant,
    suggestions: suggestions, sauvegarde: sauvegarde, restaurer: restaurer
  };
}(window));
