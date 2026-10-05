/* relief.js — le vrai relief autour d'un parcours, depuis swisstopo.
 *
 * Un GPX ne connaît que l'altitude SUR le chemin. Les courbes de niveau
 * demandent le terrain autour : on le demande au service de profils de
 * geo.admin.ch (api3.geo.admin.ch/rest/services/profile.json), modèle
 * « COMB » — swissALTI3D, complété par DHM25, qui déborde sur les pays
 * voisins le long de la frontière. On balaie la zone par lignes est-ouest,
 * quelques requêtes à la fois, pour rester poli.
 *
 * LE MÊME FICHIER SERT LE NAVIGATEUR ET NODE. La page du carnet l'appelle
 * depuis un bouton (le service répond aux navigateurs : CORS ouvert), et
 * tools/relief.js depuis la ligne de commande. Une seule écriture du calcul,
 * sinon deux reliefs finiraient par ne pas dire la même chose.
 *
 * CE QUI PART SUR LE RÉSEAU : les coordonnées suisses (LV95) d'un rectangle
 * autour du parcours, ligne par ligne. Pas la trace, pas les photos — mais
 * le rectangle situe le parcours, et la page le dit AVANT de le demander.
 *
 * LE CONTRÔLE. Avant de rendre quoi que ce soit, on compare l'altitude
 * swisstopo à celle du GPX le long du parcours. Un écart médian de quelques
 * mètres dit que la grille est juste ; un écart de centaines dit qu'elle ne
 * couvre pas l'endroit — et on le dit au lieu de dessiner des courbes fausses.
 */
(function (global) {
  'use strict';

  var MARGE = 2500;            // m autour du parcours
  var EQUIDISTANCE = 100;      // m entre deux courbes (defaut)
  var MAITRESSE = 500;         // une courbe sur cinq, plus appuyée (defaut)
  var ECART_MAX = 60;          // m : au-delà, la grille ne couvre pas le parcours
  var PARALLELE = 3;           // requêtes simultanées

  /* ---------- WGS84 <-> LV95 (formules approchées de swisstopo, ~1 m) ---------- */
  function versLV95(lat, lon) {
    var p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
    return {
      e: 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l,
      n: 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p
    };
  }
  function versWGS(e, n) {
    var y = (e - 2600000) / 1e6, x = (n - 1200000) / 1e6;
    var l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
    var p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
    return { lat: p * 100 / 36, lon: l * 100 / 36 };
  }

  function pause(ms) { return new Promise(function (ok) { setTimeout(ok, ms); }); }

  function ligne(e0, e1, n, points, essai) {
    essai = essai || 0;
    var geom = JSON.stringify({ type: 'LineString', coordinates: [[e0, n], [e1, n]] });
    var url = 'https://api3.geo.admin.ch/rest/services/profile.json?sr=2056&distinct_points=true' +
      '&nb_points=' + points + '&geom=' + encodeURIComponent(geom);
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('swisstopo répond ' + r.status);
      return r.json();
    }).then(function (d) {
      return d.map(function (p) { return p.alts ? (p.alts.COMB != null ? p.alts.COMB : (p.alts.DTM25 != null ? p.alts.DTM25 : null)) : null; });
    }).catch(function (err) {
      if (essai >= 3) throw err;
      return pause(1500 * (essai + 1)).then(function () { return ligne(e0, e1, n, points, essai + 1); });   // une limite de rythme ne se force pas
    });
  }

  /* ---------- courbes de niveau : les carrés qui marchent ---------- */
  function courbes(grille, larg, haut, niveau) {
    var segs = [];
    function v(i, j) { return grille[j * larg + i]; }
    function interp(a, b, va, vb) { var t = (niveau - va) / ((vb - va) || 1e-9); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
    for (var j = 0; j < haut - 1; j++) {
      for (var i = 0; i < larg - 1; i++) {
        var a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
        if (a == null || b == null || c == null || d == null) continue;
        var k = (a > niveau ? 8 : 0) | (b > niveau ? 4 : 0) | (c > niveau ? 2 : 0) | (d > niveau ? 1 : 0);
        if (k === 0 || k === 15) continue;
        var H = interp([i, j], [i + 1, j], a, b), D = interp([i + 1, j], [i + 1, j + 1], b, c);
        var B = interp([i, j + 1], [i + 1, j + 1], d, c), G = interp([i, j], [i, j + 1], a, d);
        var table = { 1: [[G, B]], 2: [[B, D]], 3: [[G, D]], 4: [[H, D]], 5: [[G, H], [B, D]], 6: [[H, B]], 7: [[G, H]],
          8: [[G, H]], 9: [[H, B]], 10: [[G, B], [H, D]], 11: [[H, D]], 12: [[G, D]], 13: [[B, D]], 14: [[G, B]] };
        table[k].forEach(function (s) { segs.push(s); });
      }
    }
    // les segments se recousent en lignes, par leurs extrémités communes
    function cle(p) { return p[0].toFixed(3) + ',' + p[1].toFixed(3); }
    var parBout = new Map();
    segs.forEach(function (s, idx) {
      [0, 1].forEach(function (bt) { var kk = cle(s[bt]); if (!parBout.has(kk)) parBout.set(kk, []); parBout.get(kk).push(idx); });
    });
    var pris = new Uint8Array(segs.length), lignes = [];
    for (var s0 = 0; s0 < segs.length; s0++) {
      if (pris[s0]) continue;
      pris[s0] = 1;
      var l = [segs[s0][0], segs[s0][1]];
      [1, 0].forEach(function (sens) {
        for (;;) {
          var bout = sens ? l[l.length - 1] : l[0];
          var suite = (parBout.get(cle(bout)) || []).filter(function (x) { return !pris[x]; })[0];
          if (suite === undefined) break;
          pris[suite] = 1;
          var sg = segs[suite], autre = cle(sg[0]) === cle(bout) ? sg[1] : sg[0];
          if (sens) l.push(autre); else l.unshift(autre);
        }
      });
      if (l.length > 4) lignes.push(l);
    }
    return lignes;
  }

  // Douglas-Peucker : on garde la forme, on jette les points qui ne la changent pas
  function simplifier(l, tol) {
    if (l.length < 3) return l;
    var dmax = 0, idx = 0, ax = l[0][0], ay = l[0][1], bx = l[l.length - 1][0], by = l[l.length - 1][1];
    var dx = bx - ax, dy = by - ay, n = Math.hypot(dx, dy) || 1;
    for (var i = 1; i < l.length - 1; i++) {
      var d = Math.abs(dy * l[i][0] - dx * l[i][1] + bx * ay - by * ax) / n;
      if (d > dmax) { dmax = d; idx = i; }
    }
    if (dmax <= tol) return [l[0], l[l.length - 1]];
    return simplifier(l.slice(0, idx + 1), tol).slice(0, -1).concat(simplifier(l.slice(idx), tol));
  }

  /* préparer(points, opts) → Promise<relief>
   *   points : [{ lat, lon, ele }] — la trace
   *   opts   : { pas = 150, format = 1.3, equidistance, progres(k),
   *              versPng(gris, larg, haut) → dataURL,
   *              altitude(e, n) → m — D'OÙ VIENT LE TERRAIN }
   * Rend l'objet que le carnet attend (courbes et ombrage en lat/lon).
   *
   * L'OPTION `altitude` EXISTE POUR L'EXEMPLE EMBARQUÉ, et elle est écrite
   * ici plutôt qu'ailleurs pour une raison : le relief d'exemple doit
   * passer par LE MÊME calcul que le vrai — mêmes courbes, même
   * simplification, même contrôle. Un second générateur aurait produit
   * des données de forme voisine, et la planche aurait fini par ne bien
   * dessiner que l'un des deux.
   *
   * Quand elle est fournie, RIEN ne part sur le réseau. Ce que le relief
   * rend porte alors sa `source`, et c'est elle qui doit être affichée —
   * écrire « swisstopo » sous un terrain inventé serait un mensonge. */
  function preparer(pts, opts) {
    opts = opts || {};
    var PAS = Math.max(60, opts.pas || 150), FORMAT = opts.format || 1.3;
    /* L'EQUIDISTANCE SUIT LA GRILLE, elle ne la depasse pas.
     * Tracer une courbe tous les 25 m sur une grille echantillonnee tous
     * les 150 m ne revele rien : cela DESSINE du detail que la mesure ne
     * contient pas, et une carte fausse ne se denonce pas. On refuse donc
     * plus fin que le tiers du pas, en metres d'altitude. */
    var EQUI = Math.max(Math.round(PAS / 3), opts.equidistance || EQUIDISTANCE);
    var MAIT = opts.maitresse || Math.max(EQUI * 5, MAITRESSE);
    if (!pts || !pts.length) return Promise.reject(new Error('aucun point dans la trace'));
    var lv = pts.map(function (p) { return versLV95(p.lat, p.lon); });
    var es = lv.map(function (p) { return p.e; }), ns = lv.map(function (p) { return p.n; });
    var eMin = Math.floor((Math.min.apply(null, es) - MARGE) / PAS) * PAS;
    var eMax = Math.ceil((Math.max.apply(null, es) + MARGE) / PAS) * PAS;
    var nMin = Math.floor((Math.min.apply(null, ns) - MARGE) / PAS) * PAS;
    var nMax = Math.ceil((Math.max.apply(null, ns) + MARGE) / PAS) * PAS;
    /* une feuille de carte n'a pas la forme du parcours : on élargit la zone
     * jusqu'au format demandé, pour que le relief remplisse le cadre */
    var w0 = eMax - eMin, h0 = nMax - nMin, dd;
    if (w0 / h0 < FORMAT) { dd = Math.ceil((FORMAT * h0 - w0) / 2 / PAS) * PAS; eMin -= dd; eMax += dd; }
    else { dd = Math.ceil((w0 / FORMAT - h0) / 2 / PAS) * PAS; nMin -= dd; nMax += dd; }
    var larg = Math.round((eMax - eMin) / PAS) + 1, haut = Math.round((nMax - nMin) / PAS) + 1;
    if (larg * haut > 400000) return Promise.reject(new Error('parcours trop étendu pour un relief à ' + PAS + ' m'));

    // la grille : ligne 0 au NORD, pour qu'elle se lise comme une image
    var grille = new Array(larg * haut).fill(null), suivante = 0, faites = 0;
    if (typeof opts.altitude === 'function') {
      for (var jj = 0; jj < haut; jj++) {
        for (var ii = 0; ii < larg; ii++) {
          grille[jj * larg + ii] = opts.altitude(eMin + ii * PAS, nMax - jj * PAS);
        }
        if (opts.progres) opts.progres((jj + 1) / haut);
      }
    }
    function travailleur() {
      if (typeof opts.altitude === 'function') return Promise.resolve();
      if (suivante >= haut) return Promise.resolve();
      var j = suivante++;
      return ligne(eMin, eMax, nMax - j * PAS, larg).then(function (alts) {
        for (var i = 0; i < Math.min(larg, alts.length); i++) grille[j * larg + i] = alts[i];
        faites++;
        if (opts.progres) opts.progres(faites / haut);
        return pause(80).then(travailleur);
      });
    }
    var equipe = [];
    for (var t = 0; t < PARALLELE; t++) equipe.push(travailleur());

    return Promise.all(equipe).then(function () {
      var vides = grille.filter(function (v) { return v == null; }).length;
      // le contrôle : la grille dit-elle la même altitude que le GPX ?
      function alt(e, n) {
        var fi = (e - eMin) / PAS, fj = (nMax - n) / PAS, i = Math.floor(fi), j = Math.floor(fj);
        if (i < 0 || j < 0 || i >= larg - 1 || j >= haut - 1) return null;
        var a = grille[j * larg + i], b = grille[j * larg + i + 1], c = grille[(j + 1) * larg + i], d = grille[(j + 1) * larg + i + 1];
        if (a == null || b == null || c == null || d == null) return null;
        var u = fi - i, w = fj - j;
        return a * (1 - u) * (1 - w) + b * u * (1 - w) + c * (1 - u) * w + d * u * w;
      }
      var ecarts = [];
      pts.forEach(function (p, k) { if (p.ele != null && k % 5 === 0) { var a = alt(lv[k].e, lv[k].n); if (a != null) ecarts.push(Math.abs(a - p.ele)); } });
      ecarts.sort(function (a, b) { return a - b; });
      function q(f) { return ecarts.length ? Math.round(ecarts[Math.floor(ecarts.length * f)]) : null; }
      var controle = { points: ecarts.length, ecartMedian: q(0.5), ecartP90: q(0.9), cellulesVides: vides };
      if (controle.ecartMedian == null || controle.ecartMedian > ECART_MAX) {
        var err = new Error(typeof opts.altitude === 'function'
          ? 'le relief fourni ne correspond pas à ce parcours (écart médian ' + controle.ecartMedian + ' m)'
          : 'le relief swisstopo ne correspond pas à ce parcours (écart médian ' + controle.ecartMedian +
            ' m) — il ne couvre que la Suisse et ses abords');
        err.controle = controle;
        throw err;
      }

      var zmin = Infinity, zmax = -Infinity;
      grille.forEach(function (v) { if (v != null) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); } });
      var sortieCourbes = [];
      for (var z = Math.ceil(zmin / EQUI) * EQUI; z <= zmax; z += EQUI) {
        courbes(grille, larg, haut, z).forEach(function (l) {
          var s = simplifier(l, 0.18);   // en cellules : ~27 m au pas de 150 m
          sortieCourbes.push({
            alt: z, maitresse: z % MAIT === 0,
            pts: s.map(function (c) { var wg = versWGS(eMin + c[0] * PAS, nMax - c[1] * PAS); return [+wg.lat.toFixed(5), +wg.lon.toFixed(5)]; })
          });
        });
      }

      // l'ombrage : lumière du nord-ouest, à 45°, comme sur les cartes suisses
      var gris = new Uint8Array(larg * haut).fill(255);
      var az = 315 * Math.PI / 180, el = 45 * Math.PI / 180;
      function g(a, b) { return grille[b * larg + a]; }
      for (var j = 1; j < haut - 1; j++) {
        for (var i = 1; i < larg - 1; i++) {
          if (g(i - 1, j) == null || g(i + 1, j) == null || g(i, j - 1) == null || g(i, j + 1) == null) continue;
          var dzdx = (g(i + 1, j) - g(i - 1, j)) / (2 * PAS), dzdy = (g(i, j - 1) - g(i, j + 1)) / (2 * PAS);
          var pente = Math.atan(Math.hypot(dzdx, dzdy)), aspect = Math.atan2(dzdy, -dzdx);
          var lum = Math.cos(el) * Math.cos(pente) + Math.sin(el) * Math.sin(pente) * Math.cos(az - Math.PI / 2 - aspect);
          gris[j * larg + i] = Math.max(0, Math.min(255, Math.round(255 * lum)));
        }
      }
      var no = versWGS(eMin, nMax), se = versWGS(eMax, nMin);
      return Promise.resolve(opts.versPng ? opts.versPng(gris, larg, haut) : versPngNavigateur(gris, larg, haut)).then(function (png) {
        return {
          source: opts.source ||
            (typeof opts.altitude === 'function'
              ? 'terrain fourni — ni mesuré ni swisstopo'
              : 'swisstopo · geo.admin.ch profile.json (COMB : swissALTI3D + DHM25)'),
          pas: PAS, equidistance: EQUI, maitresse: MAIT,
          altMin: Math.round(zmin), altMax: Math.round(zmax),
          controle: controle,
          courbes: sortieCourbes,
          ombre: { png: png, nord: no.lat, ouest: no.lon, sud: se.lat, est: se.lon, larg: larg, haut: haut }
        };
      });
    });
  }

  // dans le navigateur, un canvas sait déjà écrire un PNG
  function versPngNavigateur(gris, larg, haut) {
    var c = document.createElement('canvas'); c.width = larg; c.height = haut;
    var x = c.getContext('2d'), im = x.createImageData(larg, haut);
    for (var i = 0; i < gris.length; i++) { im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = gris[i]; im.data[i * 4 + 3] = 255; }
    x.putImageData(im, 0, 0);
    return c.toDataURL('image/png');
  }

  // le nombre de requêtes qu'un parcours demandera — la page l'annonce avant
  function estimer(pts, pas) {
    pas = pas || 150;
    var lv = pts.map(function (p) { return versLV95(p.lat, p.lon); });
    var ns = lv.map(function (p) { return p.n; }), es = lv.map(function (p) { return p.e; });
    var h = (Math.max.apply(null, ns) - Math.min.apply(null, ns) + 2 * MARGE), w = (Math.max.apply(null, es) - Math.min.apply(null, es) + 2 * MARGE);
    if (w / h > 1.3) h = w / 1.3; else w = h * 1.3;   // le même format que preparer()
    return { requetes: Math.round(h / pas) + 1, kmLarge: w / 1000, kmHaut: h / 1000 };
  }

  var Relief = { preparer: preparer, estimer: estimer, versLV95: versLV95, versWGS: versWGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = Relief;
  else global.Relief = Relief;
})(this);
