/* composer.js — d'un GPX et d'un tas de photos, un carnet.
 *
 * Le problème central : poser chaque photo au bon kilomètre.
 *
 * Une photo qui porte sa position GPS se pose seule. Mais la plupart n'en
 * ont plus : WhatsApp, Signal ou un partage d'album l'effacent. Il reste
 * l'HEURE, et l'heure ne suffit que si le GPX porte la vraie. Un parcours
 * Komoot porte une heure PLANIFIÉE — souvent compressée sur une seule
 * journée même quand le voyage en a duré deux.
 *
 * On n'utilise donc pas l'heure du GPX comme une heure, mais comme un
 * MODÈLE D'ALLURE : elle dit où l'on va vite et où l'on peine. Chaque étape
 * reçoit une fenêtre réelle (départ, arrivée), et une photo prise à 40 % de
 * cette fenêtre se pose à 40 % du temps modélisé de l'étape — pas à 40 % de
 * sa distance. Une photo prise au milieu d'une montée de deux heures reste
 * dans la montée.
 *
 * Les CALAGES corrigent le reste : une photo dont on connaît le lieu (le
 * panneau d'un col, l'arrivée à l'hôtel) devient une ancre, et les photos
 * voisines se replacent entre les ancres. Deux ou trois suffisent.
 *
 * Ce qui sort ne contient aucune coordonnée — voir lecteur.js.
 */
(function (global) {
  'use strict';

  var MIN = 60000;

  function lireReperes(texte) {
    var doc = new DOMParser().parseFromString(texte, 'application/xml');
    var w = doc.getElementsByTagName('wpt'), out = [];
    for (var i = 0; i < w.length; i++) {
      var n = w[i].getElementsByTagName('name')[0];
      out.push({ lat: +w[i].getAttribute('lat'), lon: +w[i].getAttribute('lon'),
                 nom: n ? n.textContent.trim() : '' });
    }
    return out;
  }

  function dist(a, b) {
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  /* le temps modélisé, en secondes, cumulé point par point.
   * L'horloge du GPX quand elle est croissante ; sinon une allure de
   * montagne — 15 km/h à plat, 550 m de montée par heure en plus. */
  function modeleAllure(pts) {
    var ok = pts.length > 1 && pts[0].t && pts[pts.length - 1].t && pts[pts.length - 1].t > pts[0].t;
    for (var i = 1; ok && i < pts.length; i++) if (!pts[i].t || pts[i].t < pts[i - 1].t) ok = false;
    var m = new Float64Array(pts.length);
    if (ok) {
      for (i = 0; i < pts.length; i++) m[i] = (pts[i].t - pts[0].t) / 1000;
      // l'horloge peut s'arrêter (pause planifiée) : on garde une pente minimale
      for (i = 1; i < pts.length; i++) if (m[i] <= m[i - 1]) m[i] = m[i - 1] + 0.01;
      return { t: m, source: 'gpx' };
    }
    for (i = 1; i < pts.length; i++) {
      var dd = pts[i].d - pts[i - 1].d;
      var dz = (pts[i].ele != null && pts[i - 1].ele != null) ? Math.max(0, pts[i].ele - pts[i - 1].ele) : 0;
      m[i] = m[i - 1] + dd / 1000 / 15 * 3600 + dz / 550 * 3600 + 0.01;
    }
    return { t: m, source: 'allure' };
  }

  function indice(arr, v) {   // dernier i tel que arr[i] <= v
    var a = 0, b = arr.length - 1;
    if (v <= arr[0]) return 0;
    if (v >= arr[b]) return b;
    while (b - a > 1) { var m = (a + b) >> 1; if (arr[m] <= v) a = m; else b = m; }
    return a;
  }
  function kmVersModele(pts, M, km) {
    var ds = pts.__km, i = indice(ds, km), j = Math.min(i + 1, pts.length - 1);
    var f = ds[j] > ds[i] ? (km - ds[i]) / (ds[j] - ds[i]) : 0;
    return M[i] + (M[j] - M[i]) * f;
  }
  function modeleVersKm(pts, M, v) {
    var i = indice(M, v), j = Math.min(i + 1, pts.length - 1);
    var f = M[j] > M[i] ? (v - M[i]) / (M[j] - M[i]) : 0;
    return (pts[i].d + (pts[j].d - pts[i].d) * Math.max(0, Math.min(1, f))) / 1000;
  }

  function denivele(pts, a, b) {
    var gain = 0, ref = null, max = -Infinity, fen = [];
    for (var i = a; i <= b; i++) {
      if (pts[i].ele == null) continue;
      fen.push(pts[i].ele); if (fen.length > 9) fen.shift();
      var e = fen.reduce(function (s, x) { return s + x; }, 0) / fen.length;
      if (pts[i].ele > max) max = pts[i].ele;
      if (ref == null) ref = e;
      else if (e - ref > 1.5) { gain += e - ref; ref = e; }
      else if (ref - e > 1.5) ref = e;
    }
    return { gain: gain, max: max };
  }

  function jourLocal(t) { var d = new Date(t); return d.getFullYear() * 400 + d.getMonth() * 32 + d.getDate(); }

  /* entree = {
   *   gpx: texte, titre, sousTitre, couverture,
   *   etapes: [{ de, a, finKm, depart?, arrivee? }]   (heures en ms UTC)
   *   noms: { 'nom Komoot': 'nom affiché' | null }   (null = retiré)
   *   medias: [{ id, src, video?, t, w, h, km? (= calage), legende? }]
   *   masque: km masqués au départ et à l'arrivée (0,3 par défaut)
   * } */
  function composer(entree) {
    var act = global.Activity.parseGPX(entree.gpx);
    var pts = act.track;
    var total = pts[pts.length - 1].d / 1000;
    var M = modeleAllure(pts).t;
    var kms = pts.__km = pts.map(function (p) { return p.d / 1000; });

    /* ----- les étapes ----- */
    var photosDatees = entree.medias.filter(function (m) { return m.t; });
    var jours = [];
    photosDatees.forEach(function (m) { var j = jourLocal(m.t); if (jours.indexOf(j) < 0) jours.push(j); });
    jours.sort(function (a, b) { return a - b; });

    var defs = entree.etapes && entree.etapes.length ? entree.etapes : null;
    if (!defs) {
      /* Autant d'étapes que de jours de photos. La nuit se pose au point le
       * plus bas du tiers central de chaque tronçon : un voyage en montagne
       * dort dans la vallée. Une supposition, que le calage corrige. */
      var n = Math.max(1, jours.length), fins = [];
      for (var k = 1; k < n; k++) {
        var a0 = indice(kms, total * (k - 0.5) / n);
        var b0 = indice(kms, total * (k + 0.5) / n), bas = a0;
        for (var q = a0; q <= b0; q++) if (pts[q].ele != null && pts[q].ele < pts[bas].ele) bas = q;
        fins.push(pts[bas].d / 1000);
      }
      fins.push(total);
      defs = fins.map(function (f, i) { return { de: i ? 'Étape ' + i : 'Départ', a: i < n - 1 ? 'Étape ' + (i + 1) : 'Arrivée', finKm: f }; });
    }
    var etapes = [], debut = 0;
    defs.forEach(function (d, i) {
      var fin = i === defs.length - 1 ? total : Math.min(total, d.finKm);
      var ia = indice(kms, debut);
      var ib = indice(kms, fin);
      var dv = denivele(pts, ia, ib);
      etapes.push({ de: d.de, a: d.a, kmDebut: debut, kmFin: fin, dplus: dv.gain, altMax: dv.max,
                    depart: d.depart || null, arrivee: d.arrivee || null });
      debut = fin;
    });

    /* ----- quelle photo dans quelle étape ----- */
    function etapeDe(m) {
      if (m.km != null) {
        for (var i = 0; i < etapes.length; i++) if (m.km < etapes[i].kmFin || i === etapes.length - 1) return i;
      }
      if (!m.t) return -1;
      for (i = 0; i < etapes.length; i++) {
        if (etapes[i].depart && etapes[i].arrivee && m.t >= etapes[i].depart - 3 * 3600000 && m.t <= etapes[i].arrivee + 3 * 3600000) return i;
      }
      if (jours.length === etapes.length) return jours.indexOf(jourLocal(m.t));
      return 0;
    }
    var parEtape = etapes.map(function () { return []; });
    entree.medias.forEach(function (m) { var i = etapeDe(m); if (i >= 0) parEtape[i].push(m); });

    /* ----- les fenêtres réelles -----
     * Le facteur k (temps réel / temps modélisé) se mesure sur l'étape que
     * les photos couvrent le mieux, puis vaut pour toutes : une étape dont
     * les photos s'arrêtent à midi ne se termine pas pour autant à midi. */
    var k = null;
    etapes.forEach(function (et, i) {
      var ts = parEtape[i].filter(function (m) { return m.t; }).map(function (m) { return m.t; });
      if (ts.length < 2) return;
      var modele = (kmVersModele(pts, M, et.kmFin) - kmVersModele(pts, M, et.kmDebut)) * 1000;
      var r = (Math.max.apply(null, ts) - Math.min.apply(null, ts) + 30 * MIN) / modele;
      if (k == null || r > k) k = r;
    });
    k = Math.max(0.6, Math.min(3, k || 1.2));

    var medias = [];
    etapes.forEach(function (et, i) {
      var liste = parEtape[i];
      var ts = liste.filter(function (m) { return m.t; }).map(function (m) { return m.t; });
      var m0 = kmVersModele(pts, M, et.kmDebut), m1 = kmVersModele(pts, M, et.kmFin);
      var dep = et.depart || (ts.length ? Math.min.apply(null, ts) - 20 * MIN : 0);
      var arr = et.arrivee || Math.max(dep + k * (m1 - m0) * 1000, ts.length ? Math.max.apply(null, ts) + 10 * MIN : 0);
      et.fenetre = [dep, arr];

      var ancres = [{ t: dep, v: m0 }];
      liste.forEach(function (m) { if (m.km != null && m.t) ancres.push({ t: m.t, v: kmVersModele(pts, M, m.km) }); });
      ancres.push({ t: arr, v: m1 });
      ancres.sort(function (a, b) { return a.t - b.t; });
      // une ancre qui ferait reculer le modèle est ignorée plutôt que de tout tordre
      var propres = [ancres[0]];
      for (var j = 1; j < ancres.length; j++) if (ancres[j].v >= propres[propres.length - 1].v) propres.push(ancres[j]);

      liste.forEach(function (m) {
        var km = m.km, estime = false;
        if (km == null) {
          estime = true;
          if (!m.t) km = (et.kmDebut + et.kmFin) / 2;
          else {
            var v;
            if (m.t <= propres[0].t) v = propres[0].v;
            else if (m.t >= propres[propres.length - 1].t) v = propres[propres.length - 1].v;
            else for (j = 1; j < propres.length; j++) {
              if (m.t <= propres[j].t) {
                var f = (m.t - propres[j - 1].t) / Math.max(1, propres[j].t - propres[j - 1].t);
                v = propres[j - 1].v + (propres[j].v - propres[j - 1].v) * f;
                break;
              }
            }
            km = modeleVersKm(pts, M, v);
          }
          km = Math.max(et.kmDebut + 0.15, Math.min(et.kmFin - 0.15, km));
        }
        /* le statut dit d'où vient le kilomètre, et donc ce qu'on peut en afficher :
         *   gps       la photo portait sa position — localisée ;
         *   confirmee quelqu'un l'a posée à la main — confirmée ;
         *   estimee   placée par son heure, entre les ancres — à valider. */
        var statut = estime ? 'estimee' : (m.source === 'gps' ? 'gps' : 'confirmee');
        medias.push({ id: m.id, src: m.src, video: m.video || null, w: m.w, h: m.h, t: m.t || null,
                      km: km, ancre: !estime, statut: statut, legende: m.legende || '' });
      });
    });
    medias.sort(function (a, b) { return a.km - b.km || (a.t || 0) - (b.t || 0); });

    /* ----- les repères ----- */
    var reperes = [];
    var noms = entree.noms || {};
    lireReperes(entree.gpx).forEach(function (w) {
      if (noms[w.nom] === null) return;
      var best = 0, bd = Infinity;
      for (var i = 0; i < pts.length; i += 2) { var dd = dist(w, pts[i]); if (dd < bd) { bd = dd; best = i; } }
      if (bd > 400) return;   // un point d'intérêt à l'écart du chemin ne se pose pas dessus
      /* « PASSAGE À ». L'altitude qu'on écrit à côté d'un nom est celle du
       * CHEMIN là où il passe le plus près — brute, prise au GPX, pas au
       * profil lissé. Ce n'est pas l'altitude du lieu : le parcours longe un
       * sommet à 2 521 m quand le sommet culmine plus haut. On le dit. */
      reperes.push({ nom: noms[w.nom] || w.nom, km: pts[best].d / 1000,
                     alt: pts[best].ele != null ? Math.round(pts[best].ele) : null, ecart: Math.round(bd) });
    });
    function altBrute(km) { var p = pts[indice(kms, km)]; return p && p.ele != null ? Math.round(p.ele) : null; }
    etapes.forEach(function (et, i) {
      if (i === 0) reperes.push({ nom: et.de, km: 0, fort: true, alt: altBrute(0) });
      reperes.push({ nom: et.a, km: et.kmFin, fort: true, alt: altBrute(et.kmFin) });
    });
    // une boucle : le départ et l'arrivée portent le même nom, un seul suffit
    reperes = reperes.filter(function (r, i) {
      return !reperes.some(function (s, j) { return j < i && s.nom === r.nom && Math.abs(s.km - r.km) > total * 0.9; });
    });
    reperes.sort(function (a, b) { return a.km - b.km; });

    /* ----- la trace, projetée et allégée ----- */
    var masque = entree.masque != null ? entree.masque : 0.3;
    var lat0 = pts.reduce(function (s, p) { return s + p.lat; }, 0) / pts.length;
    var cx = 111.32 * Math.cos(lat0 * Math.PI / 180), cy = 110.57;
    var garde = [], dern = -1;
    pts.forEach(function (p, i) {
      var km = p.d / 1000;
      if (km < masque || km > total - masque) return;
      if (dern >= 0 && km - pts[dern].d / 1000 < 0.06 && i !== pts.length - 1) return;
      garde.push(p); dern = i;
    });
    var xs = garde.map(function (p) { return p.lon * cx; }), ys = garde.map(function (p) { return -p.lat * cy; });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var span = Math.max(maxX - minX, maxY - minY) || 1;
    // l'altitude, lissée sur ~500 m pour que le profil ne tremble pas
    var eles = garde.map(function (p) { return p.ele == null ? 0 : p.ele; }), lisse = [];
    for (var i2 = 0; i2 < eles.length; i2++) {
      var s = 0, c = 0;
      for (var j2 = Math.max(0, i2 - 4); j2 <= Math.min(eles.length - 1, i2 + 4); j2++) { s += eles[j2]; c++; }
      lisse.push(Math.round(s / c));
    }
    var trace = {
      x: xs.map(function (x) { return +((x - minX) / span).toFixed(5); }),
      y: ys.map(function (y) { return +((y - minY) / span).toFixed(5); }),
      km: garde.map(function (p) { return +(p.d / 1000).toFixed(3); }),
      ele: lisse,
      largeur: (maxX - minX) / span, hauteur: (maxY - minY) / span,
      kmParUnite: span,
      eleMin: Math.min.apply(null, lisse), eleMax: Math.max.apply(null, lisse)
    };

    /* ----- le relief réel, s'il a été préparé (tools/relief.js) -----
     * Il arrive en latitude/longitude et repart projeté exactement comme la
     * trace : même origine, même échelle. Les courbes débordent du cadre de
     * la trace (la marge de 2,5 km) — c'est au dessin de les couper. */
    var relief = null;
    if (entree.relief && entree.relief.courbes) {
      var R = entree.relief;
      var px = function (lon) { return +((lon * cx - minX) / span).toFixed(5); };
      var py = function (lat) { return +((-lat * cy - minY) / span).toFixed(5); };
      relief = {
        source: R.source, equidistance: R.equidistance, controle: R.controle,
        courbes: R.courbes.map(function (c) {
          return { alt: c.alt, m: c.maitresse ? 1 : 0, x: c.pts.map(function (p) { return px(p[1]); }), y: c.pts.map(function (p) { return py(p[0]); }) };
        }),
        ombre: R.ombre ? { src: R.ombre.png, x0: px(R.ombre.ouest), y0: py(R.ombre.nord), x1: px(R.ombre.est), y1: py(R.ombre.sud) } : null
      };
    }

    var dplus = etapes.reduce(function (s, e) { return s + e.dplus; }, 0);
    return {
      relief: relief,
      komoot: entree.komoot || null,
      v: 1,
      titre: entree.titre || act.name || 'Carnet de route',
      sousTitre: entree.sousTitre || '',
      couverture: entree.couverture || (medias[0] && medias[0].id),
      total: { km: total, dplus: dplus },
      trace: trace,
      etapes: etapes.map(function (e) {
        return { de: e.de, a: e.a, kmDebut: e.kmDebut, kmFin: e.kmFin, dplus: e.dplus, altMax: e.altMax, fenetre: e.fenetre };
      }),
      reperes: reperes,
      medias: medias,
      facteur: k
    };
  }

  global.Composer = { composer: composer, lireReperes: lireReperes };
})(this);
