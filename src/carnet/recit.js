/* recit.js — le carrousel court : un moment par image.
 *
 * Horizon faisait défiler des KILOMÈTRES : la longueur du panorama dictait
 * le nombre d'images, et les photos rapetissaient pour garder leur place.
 * Ici c'est l'histoire qui décide. Les photos se regroupent en MOMENTS, et
 * chaque image en porte un, sous l'une de trois formes :
 *   - grande     une photo, en grand, pour un moment fort ;
 *   - séquence   deux ou trois photos qui se suivent ;
 *   - passage    pas de photo : le profil du tronçon et ce qu'il contient,
 *                pour dire les longs kilomètres entre deux moments.
 * Une couverture ouvre, un bilan ferme. Huit à dix images en tout.
 *
 * LE FIL. En bas de chaque image, le profil ENTIER du voyage, toujours à la
 * même échelle : la part parcourue à l'encre, le moment surligné, chaque
 * photo reliée à son kilomètre par un trait. Glisser fait avancer l'encre.
 * Aucune échelle n'est étirée ; un passage qui agrandit son tronçon le dit.
 *
 * LA PRÉCISION DITE. Une photo calée (GPS ou main) donne son kilomètre au
 * dixième ; une photo placée par son heure donne « ≈ km 18 ». On n'affiche
 * pas une précision qu'on n'a pas.
 */
(function (global) {
  'use strict';

  var W = 1080, H = 1350;
  var FUSION_KM = 5;         // deux moments à moins de 5 km l'un de l'autre n'en font qu'un
  var PASSAGE_KM = 18;       // un trou de plus de 18 km sans photo mérite son image

  function O() { return global.Horizon.outils; }

  /* ---------- composer le récit ---------- */
  function composer(data, opts) {
    var medias = data.medias.filter(function (m) { return !(opts.exclus && opts.exclus[m.id]); })
      .slice().sort(function (a, b) { return a.km - b.km; });
    var cible = Math.max(6, Math.min(10, opts.nbImages || 10));
    function etapeDe(km) { for (var i = data.etapes.length - 1; i >= 0; i--) if (km >= data.etapes[i].kmDebut - 1e-9) return i; return 0; }

    // 1. les moments : des photos proches, d'une même étape
    var moments = [];
    medias.forEach(function (m) {
      var der = moments[moments.length - 1];
      if (der && m.km - der.photos[der.photos.length - 1].km < FUSION_KM && etapeDe(m.km) === der.etape) der.photos.push(m);
      else moments.push({ type: 'moment', etape: etapeDe(m.km), photos: [m] });
    });
    // trop de moments pour la place : on réunit les deux plus proches, dans une même étape
    while (moments.length + 2 > cible) {
      var best = -1, ecart = Infinity;
      for (var i = 0; i < moments.length - 1; i++) {
        if (moments[i].etape !== moments[i + 1].etape) continue;
        var g = moments[i + 1].photos[0].km - moments[i].photos[moments[i].photos.length - 1].km;
        if (g < ecart) { ecart = g; best = i; }
      }
      if (best < 0) break;
      moments[best].photos = moments[best].photos.concat(moments[best + 1].photos);
      moments.splice(best + 1, 1);
    }

    // 2. les passages : les plus longs trous, tant qu'il reste de la place
    var trous = [];
    for (i = 0; i < moments.length - 1; i++) {
      var a = moments[i].photos[moments[i].photos.length - 1].km, b = moments[i + 1].photos[0].km;
      if (b - a >= PASSAGE_KM) trous.push({ apres: i, a: a, b: b });
    }
    trous.sort(function (x, y) { return (y.b - y.a) - (x.b - x.a); });
    var place = cible - 2 - moments.length, retenus = trous.slice(0, Math.max(0, place));

    var suite = [];
    moments.forEach(function (mo, k) {
      suite.push(mo);
      retenus.filter(function (t) { return t.apres === k; }).forEach(function (t) {
        suite.push({ type: 'passage', a: t.a, b: t.b, etape: etapeDe((t.a + t.b) / 2) });
      });
    });

    // 3. chaque moment : sa forme, ses photos (trois au plus), son nom
    suite.forEach(function (s) {
      if (s.type !== 'moment') return;
      s.a = s.photos[0].km; s.b = s.photos[s.photos.length - 1].km;
      s.choix = choisir(s.photos, data);
      s.forme = s.choix.length === 1 ? 'grande' : 'sequence';
      s.cle = s.photos[0].id;   // la clé du moment : sa première photo
      s.titre = (opts.titres && opts.titres[s.cle]) || nommer(data, s);
      s.estime = s.choix.some(function (m) { return !m.ancre; });
    });

    var images = [{ type: 'couverture' }].concat(suite, [{ type: 'bilan' }]);
    images.forEach(function (im, k) { im.n = k + 1; im.total = images.length; });
    return images;
  }

  /* trois photos au plus : la première, la dernière, et entre les deux celle
   * qui monte le plus haut — le début, la fin, le sommet du moment */
  function choisir(photos, data) {
    if (photos.length <= 3) return photos.slice();
    var alt = function (p) { return O().eleAuKm(data, p.km); };
    var mid = photos.slice(1, -1).reduce(function (m, p) { return alt(p) > alt(m) ? p : m; }, photos[1]);
    return [photos[0], mid, photos[photos.length - 1]];
  }

  /* le nom d'un moment : une fin d'étape s'il en contient une, sinon le
   * repère le plus proche de son centre, sinon son kilomètre */
  function nommer(data, s) {
    var propre = s.choix.filter(function (m) { return m.legende; })[0];
    if (propre) return propre.legende;
    var fin = data.etapes.filter(function (et, i) { return i < data.etapes.length - 1 && Math.abs(et.kmFin - s.b) < 2; })[0];
    if (fin) return fin.a;
    var c = (s.a + s.b) / 2, best = null;
    (data.reperes || []).forEach(function (r) {
      var d = Math.abs(r.km - c);
      if (d < Math.max(3, (s.b - s.a) / 2 + 2) && (!best || d < best.d)) best = { d: d, r: r };
    });
    if (best) return best.r.nom;
    // loin de tout repère : on se situe par rapport à la ville d'étape la plus proche
    var villes = [];
    data.etapes.forEach(function (et, i) { if (i) villes.push({ nom: et.de, km: et.kmDebut }); });
    var v = villes.filter(function (x) { return Math.abs(x.km - c) < 15; }).sort(function (x, y) { return Math.abs(x.km - c) - Math.abs(y.km - c); })[0];
    if (v) return (c < v.km ? 'Vers ' : 'Après ') + v.nom;
    return 'Kilomètre ' + Math.round(c);
  }

  /* ---------- dessiner ---------- */
  function fond(ctx, th) {
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
    var graine = 11;
    function alea() { graine = (graine * 16807) % 2147483647; return graine / 2147483647; }
    ctx.fillStyle = th.ink; ctx.globalAlpha = 0.035;
    for (var i = 0; i < 3500; i++) ctx.fillRect(alea() * W, alea() * H, 1.4, 1.4);
    ctx.globalAlpha = 1;
  }

  function kmTexte(km, estime) {
    return estime ? '≈ km ' + Math.round(km) : 'km ' + km.toFixed(1).replace('.', ',');
  }
  function plage(a, b, estime) {
    if (Math.abs(b - a) < 0.3) return kmTexte(a, estime);
    return estime ? '≈ km ' + Math.round(a) + '–' + Math.round(b)
                  : 'km ' + a.toFixed(1).replace('.', ',') + '–' + b.toFixed(1).replace('.', ',');
  }

  function entete(ctx, data, im, th) {
    ctx.textBaseline = 'alphabetic';
    var et = data.etapes[im.etape] || data.etapes[0];
    ctx.fillStyle = th.acc; ctx.font = '22px ' + O().MONO; ctx.textAlign = 'left';
    ctx.fillText(('Étape ' + (im.etape + 1) + ' · ' + et.de + ' → ' + et.a).toUpperCase(), 60, 84);
    ctx.fillStyle = th.mut; ctx.textAlign = 'right';
    ctx.fillText(String(im.n).padStart(2, '0') + ' / ' + String(im.total).padStart(2, '0'), W - 60, 84);
    ctx.textAlign = 'left';
  }

  /* le fil : le voyage entier, à échelle constante, en bas de chaque image.
   * Rend les fonctions qui placent un kilomètre sur ce fil. */
  var FX0 = 60, FX1 = W - 60, FY0 = 1112, FY1 = 1236;
  function fil(ctx, data, a, b, points, th) {
    var T = data.trace, total = data.total.km, E = O().eleAuKm;
    function X(km) { return FX0 + km / total * (FX1 - FX0); }
    function Y(ele) { return FY1 - (ele - T.eleMin) / Math.max(1, T.eleMax - T.eleMin) * (FY1 - FY0); }
    var pas = total / 400;
    // le moment, surligné
    if (b != null) {
      ctx.fillStyle = th.acc; ctx.globalAlpha = 0.14;
      ctx.fillRect(X(a) - 4, FY0 - 20, Math.max(8, X(b) - X(a) + 8), FY1 - FY0 + 20);
      ctx.globalAlpha = 1;
    }
    // la part à venir, en gris ; la part parcourue, à l'encre
    function trace(k0, k1) { ctx.beginPath(); for (var k = k0; k <= k1 + 1e-9; k += pas) ctx[k === k0 ? 'moveTo' : 'lineTo'](X(k), Y(E(data, k))); ctx.stroke(); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = th.mut; ctx.globalAlpha = 0.45; ctx.lineWidth = 2; trace(0, total); ctx.globalAlpha = 1;
    var fait = b == null ? total : b;
    if (fait > 0) {
      ctx.fillStyle = th.ink; ctx.globalAlpha = 0.08;
      ctx.beginPath(); ctx.moveTo(X(0), FY1);
      for (var k = 0; k <= fait; k += pas) ctx.lineTo(X(k), Y(E(data, k)));
      ctx.lineTo(X(fait), FY1); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3; trace(0, fait);
    }
    // les nuits, et les bornes
    ctx.fillStyle = th.mut; ctx.font = '18px ' + O().MONO; ctx.textAlign = 'center';
    data.etapes.slice(1).forEach(function (et) {
      ctx.setLineDash([3, 6]); ctx.strokeStyle = th.mut; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(X(et.kmDebut), FY0 - 26); ctx.lineTo(X(et.kmDebut), FY1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillText('NUIT', X(et.kmDebut), FY0 - 32);
    });
    ctx.strokeStyle = th.mut; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(FX0, FY1 + 10); ctx.lineTo(FX1, FY1 + 10); ctx.stroke();
    [0, 50, 100, 150, 200, 250].forEach(function (t) { if (t <= total - 15) ctx.fillText(t + ' km', X(t), FY1 + 38); });
    ctx.textAlign = 'right'; ctx.fillText(Math.round(total) + ' km', FX1, FY1 + 38);
    ctx.textAlign = 'left';
    // les points des photos
    (points || []).forEach(function (km) {
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(X(km), Y(E(data, km)), 7, 0, 7); ctx.fill();
      ctx.strokeStyle = th.bg; ctx.lineWidth = 2.5; ctx.stroke();
    });
    return { X: X, Y: function (km) { return Y(E(data, km)); } };
  }

  // un tirage : un cadre, une ombre, la photo recadrée
  function tirage(ctx, im, x, y, w, h, th, opts) {
    ctx.save();
    ctx.shadowColor = th.ombre; ctx.shadowBlur = 26; ctx.shadowOffsetY = 8;
    ctx.fillStyle = th.cadre; ctx.fillRect(x - 10, y - 10, w + 20, h + 20);
    ctx.restore();
    if (im && im.complete && im.naturalWidth) O().peindrePhoto(ctx, im, x, y, w, h, opts, th);
  }

  // le trait qui relie une photo à son kilomètre sur le fil
  function relier(ctx, x, y, F, km, th) {
    ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(F.X(km), F.Y(km) - 9); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function ecrire(ctx, txt, x, y, larg, police, hl, couleur, max) {
    ctx.font = police; ctx.fillStyle = couleur; ctx.textAlign = 'left';
    O().titreEnLignes(ctx, txt, larg).slice(0, max || 9).forEach(function (l, i) { ctx.fillText(l, x, y + i * hl); });
    return y + Math.min(max || 9, O().titreEnLignes(ctx, txt, larg).length) * hl;
  }

  // le titre d'un moment : une ligne à 66 px, ou deux à 52 px ; rend la hauteur prise
  function titreMoment(ctx, txt, x, y) {
    ctx.font = '800 66px ' + O().SANS;
    if (ctx.measureText(txt).width <= 960) { ctx.fillStyle = arguments[4]; ctx.fillText(txt, x, y); return 0; }
    ecrire(ctx, txt, x, y - 40, 960, '800 52px ' + O().SANS, 54, arguments[4], 2);
    return 14;
  }

  function metaMoment(data, s) {
    var E = O().eleAuKm, alts = s.choix.map(function (m) { return E(data, m.km); });
    var lo = Math.min.apply(null, alts), hi = Math.max.apply(null, alts);
    var alt = Math.abs(hi - lo) < 40 ? O().fM(hi) : O().fM(lo) + ' → ' + O().fM(hi);
    return plage(s.a, s.b, s.estime) + '  ·  ' + alt + (s.photos.length > s.choix.length ? '  ·  ' + s.photos.length + ' photos' : '');
  }

  function dessinerMoment(ctx, data, s, images, th, opts) {
    entete(ctx, data, s, th);
    var F = fil(ctx, data, s.a, s.b, s.choix.map(function (m) { return m.km; }), th);
    var texte = (opts.textes && opts.textes[s.cle]) || '';
    var c = s.choix, P = function (m) { return images[m.id]; };
    var hA = texte ? 76 : 0;   // une anecdote prend deux lignes sous les photos
    function anecdote(y) {
      if (!texte) return;
      ctx.font = '400 27px ' + O().SANS;
      var l = O().titreEnLignes(ctx, texte, 950).slice(0, 2);
      ctx.fillStyle = th.bg; ctx.globalAlpha = 0.92; ctx.fillRect(56, y - 30, 968, l.length * 36 + 10); ctx.globalAlpha = 1;
      ctx.fillStyle = th.ink; l.forEach(function (x, i) { ctx.fillText(x, 62, y + i * 36); });
    }

    if (s.forme === 'grande') {
      var m = c[0], portrait = m.h > m.w;
      if (portrait) {
        // la photo à gauche, le texte en colonne à droite
        tirage(ctx, P(m), 60, 140, 600, 800, th, opts);
        relier(ctx, 360, 950, F, m.km, th);
        var y = ecrire(ctx, s.titre, 700, 210, 330, '800 58px ' + O().SANS, 60, th.ink, 4);
        ctx.fillStyle = th.mut; ctx.font = '22px ' + O().MONO;
        O().titreEnLignes(ctx, metaMoment(data, s), 330).forEach(function (l, i) { ctx.fillText(l, 702, y + 16 + i * 30); });
        if (texte) ecrire(ctx, texte, 700, y + 120, 330, '400 30px ' + O().SANS, 40, th.ink, 8);
      } else {
        tirage(ctx, P(m), 60, 300, 960, 690 - hA, th, opts);
        relier(ctx, 540, 1000 - hA, F, m.km, th);
        var d1 = titreMoment(ctx, s.titre, 60, 196, th.ink);
        ctx.fillStyle = th.mut; ctx.font = '22px ' + O().MONO; ctx.fillText(metaMoment(data, s), 62, 246 + d1);
        anecdote(1044 - hA);
      }
      return;
    }

    // séquence
    var d2 = titreMoment(ctx, s.titre, 60, 196, th.ink);
    ctx.fillStyle = th.mut; ctx.font = '22px ' + O().MONO; ctx.fillText(metaMoment(data, s), 62, 246 + d2);
    var cases;
    if (c.length === 2) cases = [[60, 300, 465, 690 - hA], [555, 300, 465, 690 - hA]];
    else cases = [[60, 300, 560, 690 - hA], [650, 300, 370, 330 - hA / 2], [650, 660 - hA / 2, 370, 330 - hA / 2]];
    // l'ordre du voyage : la première photo prend la grande case
    var ordre = c.slice();
    ordre.forEach(function (ph, i) {
      var r = cases[i];
      tirage(ctx, P(ph), r[0], r[1], r[2], r[3], th, opts);
      // l'étiquette de la photo : son kilomètre, dans un coin
      ctx.fillStyle = th.bg; ctx.globalAlpha = 0.9;
      var lab = kmTexte(ph.km, !ph.ancre);
      ctx.font = '20px ' + O().MONO;
      var lw = ctx.measureText(lab).width;
      ctx.fillRect(r[0] + 12, r[1] + r[3] - 44, lw + 20, 32); ctx.globalAlpha = 1;
      ctx.fillStyle = th.ink; ctx.fillText(lab, r[0] + 22, r[1] + r[3] - 21);
    });
    // les traits : du bas de chaque case vers son kilomètre
    ordre.forEach(function (ph, i) {
      var r = cases[i], yb = c.length === 3 && i === 1 ? cases[2][1] + cases[2][3] : r[1] + r[3];
      var xb = c.length === 3 && i === 1 ? r[0] + r[2] * 0.25 : r[0] + r[2] / 2;
      if (c.length === 3 && i === 2) xb = r[0] + r[2] * 0.75;
      relier(ctx, xb, yb + 10, F, ph.km, th);
    });
    anecdote(1044 - hA);
  }

  /* un passage : pas de photo, mais les kilomètres qu'on a vécus quand même.
   * Le tronçon est agrandi — sa propre échelle, et la page le dit. */
  function dessinerPassage(ctx, data, s, th) {
    entete(ctx, data, s, th);
    var F = fil(ctx, data, s.a, s.b, [], th), E = O().eleAuKm;
    var mont = 0, desc = 0, haut = -Infinity, prev = E(data, s.a), pas = 0.1;
    for (var k = s.a; k <= s.b; k += pas) {
      var e = E(data, k); if (e > prev) mont += e - prev; else desc += prev - e; prev = e; haut = Math.max(haut, e);
    }
    ctx.fillStyle = th.acc; ctx.font = '24px ' + O().MONO;
    ctx.fillText('PASSAGE', 60, 170);
    ecrire(ctx, Math.round(s.b - s.a) + ' km sans photo', 60, 250, 960, '800 76px ' + O().SANS, 76, th.ink, 1);
    var reps = (data.reperes || []).filter(function (r) { return !r.fort && r.km > s.a && r.km < s.b; });
    ctx.fillStyle = th.ink; ctx.font = '400 34px ' + O().SANS;
    var par = reps.length ? 'Repères : ' + reps.map(function (r) { return r.nom; }).join(' · ') : '';
    ecrire(ctx, par, 62, 316, 940, '400 34px ' + O().SANS, 44, th.ink, 3);
    ctx.fillStyle = th.mut; ctx.font = '26px ' + O().MONO;
    ctx.fillText('↑ ' + O().fM(mont) + '   ↓ ' + O().fM(desc) + '   au plus haut ' + O().fM(haut), 62, 470);

    // le tronçon, agrandi
    var x0 = 60, x1 = W - 60, y0 = 560, y1 = 960;
    var lo = Infinity, hi = -Infinity;
    for (k = s.a; k <= s.b; k += pas) { e = E(data, k); lo = Math.min(lo, e); hi = Math.max(hi, e); }
    function X(km) { return x0 + (km - s.a) / (s.b - s.a) * (x1 - x0); }
    function Y(el) { return y1 - (el - lo) / Math.max(1, hi - lo) * (y1 - y0); }
    ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (var x = x0; x <= x1; x += 6) { k = s.a + (x - x0) / (x1 - x0) * (s.b - s.a); ctx.moveTo(x, Y(E(data, k)) + 6); ctx.lineTo(x, y1); }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = th.ink; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    for (x = x0; x <= x1; x += 3) { k = s.a + (x - x0) / (x1 - x0) * (s.b - s.a); ctx[x === x0 ? 'moveTo' : 'lineTo'](x, Y(E(data, k))); }
    ctx.stroke();
    var finEt = [-1e9, -1e9];
    reps.forEach(function (r) {
      var xr = X(r.km), yr = Y(E(data, r.km));
      ctx.fillStyle = th.ink; ctx.beginPath(); ctx.arc(xr, yr, 6, 0, 7); ctx.fill();
      ctx.font = '22px ' + O().MONO;
      var tw = ctx.measureText(r.nom).width, xl = Math.min(xr - 8, x1 - tw), et = finEt[0] < xl - 10 ? 0 : 1;
      var yl = Math.min(y1 - 20, yr + 58 + et * 38);
      finEt[et] = xl + tw;
      ctx.fillStyle = th.bg; ctx.fillRect(xl - 6, yl - 24, tw + 12, 32);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xr, yr + 7); ctx.lineTo(xr, yl - 24); ctx.stroke();
      ctx.fillStyle = th.ink; ctx.fillText(r.nom, xl, yl);
    });
    ctx.fillStyle = th.mut; ctx.font = '20px ' + O().MONO;
    ctx.fillText('km ' + Math.round(s.a), x0, y1 + 34);
    ctx.textAlign = 'right'; ctx.fillText('km ' + Math.round(s.b), x1, y1 + 34);
    ctx.fillText('ÉCHELLE PROPRE À CETTE PAGE · DE ' + O().fM(lo).toUpperCase() + ' À ' + O().fM(hi).toUpperCase(), x1, y1 + 64);
    ctx.textAlign = 'left';
    // le tronçon agrandi, rattaché au fil par ses deux bouts
    [s.a, s.b].forEach(function (km, i) {
      ctx.setLineDash([2, 6]); ctx.strokeStyle = th.mut; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(i ? x1 : x0, y1 + 74); ctx.lineTo(F.X(km), F.Y(km) - 8); ctx.stroke(); ctx.setLineDash([]);
    });
  }

  function dessinerBilan(ctx, data, im, th, opts, images) {
    var T = data.trace, O_ = O();
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = th.acc; ctx.font = '22px ' + O_.MONO; ctx.textAlign = 'left';
    ctx.fillText('ARRIVÉE', 60, 84);
    ctx.fillStyle = th.mut; ctx.textAlign = 'right';
    ctx.fillText(String(im.n).padStart(2, '0') + ' / ' + String(im.total).padStart(2, '0'), W - 60, 84);
    ctx.textAlign = 'left';
    var boucle = Math.hypot(T.x[0] - T.x[T.x.length - 1], T.y[0] - T.y[T.y.length - 1]) * T.kmParUnite < 1.5;
    var fin = data.etapes[data.etapes.length - 1].a;
    // « Le Locle » → « Retour au Locle » : la contraction ne vaut que pour un nom en « Le »
    var titre = boucle ? (/^Le /.test(fin) ? 'Retour au ' + fin.slice(3) : 'Retour à ' + fin) : fin;
    ecrire(ctx, titre, 60, 200, 960, '800 76px ' + O_.SANS, 76, th.ink, 2);
    // les deux chiffres
    [[O_.fKm(data.total.km).replace(' km', ''), 'KILOMÈTRES'], ['+' + O_.fM(data.total.dplus).replace(' m', ''), 'MÈTRES DE MONTÉE']].forEach(function (c, j) {
      ctx.fillStyle = th.ink; ctx.font = '800 84px ' + O_.SANS; ctx.fillText(c[0], 60 + j * 400, 330);
      ctx.fillStyle = th.acc; ctx.font = '22px ' + O_.MONO; ctx.fillText(c[1], 64 + j * 400, 364);
    });
    // les étapes
    var y = 450;
    data.etapes.forEach(function (et, j) {
      ctx.strokeStyle = th.line || th.mut; ctx.globalAlpha = 0.5; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(60, y - 34); ctx.lineTo(500, y - 34); ctx.stroke(); ctx.globalAlpha = 1;
      ctx.fillStyle = th.acc; ctx.font = '20px ' + O_.MONO; ctx.fillText('ÉTAPE ' + (j + 1), 60, y);
      ctx.fillStyle = th.ink; ctx.font = '700 32px ' + O_.SANS; ctx.fillText(et.de + ' → ' + et.a, 60, y + 40);
      ctx.fillStyle = th.mut; ctx.font = '21px ' + O_.MONO;
      ctx.fillText(O_.fKm(et.kmFin - et.kmDebut) + ' · +' + O_.fM(et.dplus) + ' · ↑ ' + O_.fM(et.altMax), 60, y + 74);
      y += 132;
    });
    // la boucle, sur le vrai relief
    var bx = 540, by = 410, bw = 480, bh = 600;
    var cad = O_.cadreCarte(T, bx, by, bw, bh), enCadre = (opts.fondu || 'halo') === 'cadre';
    var clip = enCadre ? [bx, by, bw, bh] : [bx - 40, by - 10, W - bx + 40, bh + 70];
    if (O_.dessinerRelief(ctx, data, cad, clip, th, opts, O_.centreFondu(T, cad))) {
      if (enCadre) { ctx.strokeStyle = th.mut; ctx.lineWidth = 1; ctx.strokeRect(bx, by, bw, bh); }
      ctx.fillStyle = th.mut; ctx.font = '16px ' + O_.MONO; ctx.textAlign = 'right';
      ctx.fillText('RELIEF © SWISSTOPO', W - 60, by + bh + 50); ctx.textAlign = 'left';
    }
    O_.carte(ctx, T, { places: [] }, data, bx + 20, by + 20, bw - 40, bh - 40, th, 5, false);
    if (opts.signature) {
      O_.signer(ctx, 440, 900, opts.signature, th, 0.75, opts.signatureSobre);
      if (opts.lienSignature) { ctx.fillStyle = th.mut; ctx.font = '19px ' + O_.MONO; ctx.textAlign = 'right'; ctx.fillText(opts.lienSignature, 440, 980); ctx.textAlign = 'left'; }
    }
    fil(ctx, data, null, null, [], th);
  }

  function dessiner(ctx, data, im, images, opts) {
    var th = global.Horizon.THEMES[opts.theme] || global.Horizon.THEMES.papier;
    ctx.save();
    fond(ctx, th);
    if (im.type === 'couverture') {
      O().couvertureCoupe(ctx, data, { places: [] }, th, Object.assign({}, opts, { nbChiffres: 3 }));
    } else if (im.type === 'moment') dessinerMoment(ctx, data, im, images, th, opts);
    else if (im.type === 'passage') dessinerPassage(ctx, data, im, th);
    else dessinerBilan(ctx, data, im, th, opts, images);
    ctx.restore();
  }

  global.Recit = { composer: composer, dessiner: dessiner, W: W, H: H };
})(this);
