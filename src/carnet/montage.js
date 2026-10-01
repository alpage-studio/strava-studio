/* montage.js — le Reel monté : un récit en trente secondes.
 *
 * Le premier Reel filmait le panorama en travelling. Regardé en vrai, il
 * montrait surtout des kilomètres : la bande de relief occupait l'écran et
 * les photos y restaient petites. Ici le Reel a son propre montage, tiré des
 * MOMENTS du récit court :
 *
 *   0–3 s     une image forte, le titre ;
 *   3–7 s     la boucle qui se trace sur le vrai relief, deux chiffres ;
 *   7–24 s    trois moments en plein cadre, reliés par le profil : entre deux
 *             moments, le point glisse sur le fil jusqu'au suivant ;
 *   24–30 s   l'arrivée, le bilan, la signature.
 *
 * Même interface que reel.js — { duree, dessiner(ctx, t), preparer(t) } —
 * pour que l'aperçu et l'export MP4 image par image s'en servent tels quels.
 */
(function (global) {
  'use strict';

  /* LES MOTS DES IMAGES, en anglais. La clé est la phrase française ; une
   * clé absente s'écrit en français. Les titres, les lieux et les textes du
   * récit sont des DONNÉES : ils ne passent pas par ici. */
  if (global.Langue) global.Langue.declarer('en', {
    'CARNET DE ROUTE': 'TRAVEL JOURNAL',
    'KILOMÈTRES': 'KILOMETRES',
    'MÈTRES DE MONTÉE': 'METRES OF CLIMBING',
    'ARRIVÉE': 'FINISH',
    'Étape {n} · {de} → {a}': 'Stage {n} · {de} → {a}',
    'ÉTAPE {n} · {de} → {a} · {km}': 'STAGE {n} · {de} → {a} · {km}',
    // « Le Locle » : le français contracte (« Retour au Locle »), l'anglais garde le nom entier
    'Retour au {lieu}': 'Back to {nom}',
    'Retour à {lieu}': 'Back to {lieu}'
  });
  // un mot des images ; sans Langue, le français avec ses emplacements remplis
  function remplir(k, v) {
    return v ? k.replace(/\{(\w+)\}/g, function (tout, c) { return v[c] != null ? String(v[c]) : tout; }) : k;
  }
  function M(k, v) { return global.Langue ? global.Langue.mot(k, v) : remplir(k, v); }
  // un nombre sans unité, aux séparateurs de la langue des images (sans Langue : le français)
  function N(x, dec) {
    if (global.Langue) return global.Langue.nombre(x, dec);
    var t = Math.abs(x).toFixed(dec || 0).split('.');
    return (x < 0 ? '−' : '') + t[0].replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + (t[1] ? ',' + t[1] : '');
  }

  var W = 1080, H = 1920;
  var T_TITRE = 3.2, T_BOUCLE = 4.0, T_MOMENT = 4.8, T_PASSE = 0.9, T_BILAN = 6.0;

  function O() { return global.Horizon.outils; }
  function lisse(t) { t = Math.max(0, Math.min(1, t)); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function fondu(t, a, b) { return Math.max(0, Math.min(1, (t - a) / (b - a))); }

  /* les trois moments du Reel : les plus forts, pas trop proches l'un de
   * l'autre. Un moment pèse par ses photos, son altitude, une Live Photo, et
   * une position confirmée — on préfère montrer ce qu'on sait. */
  function choisirMoments(data, recit, n) {
    var E = O().eleAuKm, T = data.trace;
    var moments = recit.filter(function (im) { return im.type === 'moment'; });
    moments.forEach(function (m) {
      var alt = Math.max.apply(null, m.choix.map(function (p) { return E(data, p.km); }));
      m.poids = Math.min(3, m.photos.length) + (m.choix.some(function (p) { return p.video; }) ? 2 : 0) +
        2 * (alt - T.eleMin) / Math.max(1, T.eleMax - T.eleMin) + (m.estime ? 0 : 1);
    });
    var retenus = [];
    moments.slice().sort(function (a, b) { return b.poids - a.poids; }).forEach(function (m) {
      if (retenus.length >= n) return;
      if (retenus.some(function (r) { return Math.abs(r.a - m.a) < data.total.km / 6; })) return;
      retenus.push(m);
    });
    return retenus.sort(function (a, b) { return a.a - b.a; });
  }

  function monter(data, recit, images, videos, opts) {
    var th = global.Horizon.THEMES[opts.theme] || global.Horizon.THEMES.papier;
    /* les moments : ceux qu'on a choisis à la main, sinon les trois plus forts.
     * Un choix dont plus aucun moment n'existe (photos regroupées autrement)
     * retombe sur l'automatique plutôt que de livrer un Reel sans moment. */
    var tous = recit.filter(function (im) { return im.type === 'moment'; });
    var auto = choisirMoments(data, recit, 3);
    var main = (opts.reelMoments || []).length
      ? tous.filter(function (m) { return opts.reelMoments.indexOf(m.cle) >= 0; }) : [];
    var moments = main.length ? main : auto;
    var couv = data.medias.filter(function (m) { return m.id === data.couverture; })[0] || data.medias[0];

    // la chronologie
    var scenes = [], t = 0;
    function scene(type, d, extra) { scenes.push(Object.assign({ type: type, t0: t, t1: t + d }, extra || {})); t += d; }
    scene('titre', T_TITRE);
    scene('boucle', T_BOUCLE);
    /* en promotion : les moments s'enchaînent sans écran de compteur (« 44 km »
     * demande de comprendre un compteur), et le Reel finit sur l'invitation,
     * assez longtemps pour la lire */
    var promo = opts.format === 'promo';
    var kmPrec = 0;
    moments.forEach(function (m) {
      if (!promo) scene('passe', T_PASSE, { de: kmPrec, a: m.a });
      scene('moment', promo ? 4.2 : T_MOMENT, { m: m });
      kmPrec = m.b;
    });
    if (promo) scene('invitation', 5.5); else scene('bilan', T_BILAN, { de: kmPrec });
    var duree = t;

    function sceneA(t) {
      for (var i = 0; i < scenes.length; i++) if (t < scenes[i].t1) return scenes[i];
      return scenes[scenes.length - 1];
    }
    // dans un moment : quelle photo, depuis quand
    function photoA(s, t) {
      var c = s.m.choix, part = (s.t1 - s.t0) / c.length, i = Math.min(c.length - 1, Math.floor((t - s.t0) / part));
      return { p: c[i], i: i, t0: s.t0 + i * part, t1: s.t0 + (i + 1) * part, prec: i ? c[i - 1] : null };
    }

    /* une photo en plein cadre. Portrait : un zoom lent. Paysage : on la
     * parcourt d'un bord à l'autre — recadrée en 9:16, elle ne montrerait
     * sinon qu'un tiers d'elle-même. */
    function pleinCadre(ctx, src, k, sens) {
      if (!src) return;
      var iw = src.videoWidth || src.naturalWidth || src.width, ih = src.videoHeight || src.naturalHeight || src.height;
      if (!iw || !ih) return;
      var echelle = Math.max(W / iw, H / ih), z = 1.04 + 0.05 * k;
      var w = iw * echelle * z, h = ih * echelle * z;
      var x = (W - w) / 2, y = (H - h) / 2;
      if (w > W * 1.15) x = sens ? -(w - W) * k : -(w - W) * (1 - k);   // le panoramique
      ctx.save();
      if (th.duo) ctx.filter = 'grayscale(1) contrast(1.18) brightness(1.04)';
      else if (opts.nb) ctx.filter = 'grayscale(1) contrast(1.08)';
      ctx.drawImage(src, x, y, w, h);
      ctx.restore();
      if (th.duo) {
        ctx.save(); ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = th.duo; ctx.fillRect(0, 0, W, H); ctx.restore();
      }
    }

    function degrade(ctx, y0, y1, a0, a1) {
      var g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, 'rgba(12,12,10,' + a0 + ')'); g.addColorStop(1, 'rgba(12,12,10,' + a1 + ')');
      ctx.fillStyle = g; ctx.fillRect(0, y0, W, y1 - y0);
    }

    /* le fil : le profil entier, l'encre jusqu'au kilomètre donné */
    function fil(ctx, x0, x1, y0, y1, km, encre, trait, reste) {
      var E = O().eleAuKm, T = data.trace, total = data.total.km, pas = total / 300;
      function X(k) { return x0 + k / total * (x1 - x0); }
      function Y(e) { return y1 - (e - T.eleMin) / Math.max(1, T.eleMax - T.eleMin) * (y1 - y0); }
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = reste; ctx.lineWidth = trait * 0.6;
      ctx.beginPath(); for (var k = 0; k <= total; k += pas) ctx[k ? 'lineTo' : 'moveTo'](X(k), Y(E(data, k))); ctx.stroke();
      ctx.strokeStyle = encre; ctx.lineWidth = trait;
      ctx.beginPath(); for (k = 0; k <= km; k += pas) ctx[k ? 'lineTo' : 'moveTo'](X(k), Y(E(data, k))); ctx.lineTo(X(km), Y(E(data, km))); ctx.stroke();
      data.etapes.slice(1).forEach(function (et) {
        ctx.setLineDash([4, 8]); ctx.strokeStyle = reste; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(X(et.kmDebut), y0 - 10); ctx.lineTo(X(et.kmDebut), y1); ctx.stroke(); ctx.setLineDash([]);
      });
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(X(km), Y(E(data, km)), trait * 2.4, 0, 7); ctx.fill();
      return { X: X, Y: function (k) { return Y(E(data, k)); } };
    }

    function kmLu(m, a, b) {
      // « km » s'écrit pareil dans les deux langues ; seuls les séparateurs changent
      if (m.estime) return Math.abs(b - a) < 0.5 ? '≈ km ' + N(Math.round(a), 0) : '≈ km ' + N(Math.round(a), 0) + '–' + N(Math.round(b), 0);
      return 'km ' + N(a, 1);
    }

    /* ---------- les scènes ---------- */
    function titre(ctx, s, t) {
      var k = (t - s.t0) / (s.t1 - s.t0);
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
      pleinCadre(ctx, images[couv.id], k, true);
      degrade(ctx, H * 0.45, H, 0, 0.78);
      degrade(ctx, 0, 300, 0.45, 0);
      var a = lisse(fondu(t, s.t0 + 0.25, s.t0 + 1.0));
      ctx.globalAlpha = a; ctx.fillStyle = '#FFFFFF'; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.font = '28px ' + O().MONO; ctx.fillText(M('CARNET DE ROUTE'), 70, 150);
      ctx.font = '800 136px ' + O().SANS;
      var lignes = O().titreEnLignes(ctx, opts.titre || data.titre, 940);
      var y = H - 330 - (lignes.length - 1) * 128;
      lignes.forEach(function (l, i) { ctx.fillText(l, 64, y + i * 128); });
      var sous = opts.sousTitre != null ? opts.sousTitre : data.sousTitre;
      if (sous) { ctx.font = '400 40px ' + O().SANS; O().titreEnLignes(ctx, sous, 900).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, 68, H - 230 + i * 52); }); }
      ctx.globalAlpha = 1;
    }

    function boucle(ctx, s, t) {
      var k = lisse(fondu(t, s.t0 + 0.2, s.t1 - 0.8));
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      var T = data.trace, bx = 60, by = 300, bw = W - 120, bh = 1180;
      var cad = O().cadreCarte(T, bx, by, bw, bh);
      O().dessinerRelief(ctx, data, cad, [0, 160, W, 1460], th, Object.assign({}, opts, { fondu: opts.fondu || 'halo' }), O().centreFondu(T, cad));
      // la boucle se trace
      var n = Math.max(2, Math.round(T.x.length * k));
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = 7;
      ctx.beginPath();
      for (var i = 0; i < n; i++) ctx[i ? 'lineTo' : 'moveTo'](cad.ox + T.x[i] * cad.sc, cad.oy + T.y[i] * cad.sc);
      ctx.stroke();
      var q = [cad.ox + T.x[n - 1] * cad.sc, cad.oy + T.y[n - 1] * cad.sc];
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(q[0], q[1], 14, 0, 7); ctx.fill();
      ctx.strokeStyle = th.bg; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = th.bg; ctx.strokeStyle = th.ink; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(cad.ox + T.x[0] * cad.sc, cad.oy + T.y[0] * cad.sc, 16, 0, 7); ctx.fill(); ctx.stroke();
      // deux chiffres, qui arrivent l'un après l'autre
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      // en promotion, la convention unique : « 158 km », « 5 545 m D+ »
      var chiffres = opts.format === 'promo' && global.Promo
        ? [[global.Promo.F.km(data.total.km), '', 0.3], [global.Promo.F.dplus(data.total.dplus), '', 0.9]]
        : [[N(data.total.km, 1), M('KILOMÈTRES'), 0.3], ['+' + N(Math.round(data.total.dplus), 0), M('MÈTRES DE MONTÉE'), 0.9]];
      chiffres.forEach(function (c, j) {
        var a = lisse(fondu(t, s.t0 + c[2], s.t0 + c[2] + 0.6));
        ctx.globalAlpha = a;
        ctx.fillStyle = th.ink; ctx.font = '800 ' + (c[1] ? 118 : 92) + 'px ' + O().SANS; ctx.fillText(c[0], 64 + j * 500, 1640 + (1 - a) * 30);
        ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO; ctx.fillText(c[1], 70 + j * 500, 1690 + (1 - a) * 30);
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO; ctx.fillText((opts.titre || data.titre).toUpperCase(), 64, 150);
      ctx.fillStyle = th.mut; ctx.font = '22px ' + O().MONO; ctx.textAlign = 'right';
      if (data.relief) ctx.fillText('RELIEF © SWISSTOPO', W - 60, 1500);
      ctx.textAlign = 'left';
    }

    // la transition : le point glisse sur le fil, du moment précédent au suivant
    function passe(ctx, s, t) {
      var k = lisse((t - s.t0) / (s.t1 - s.t0));
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      var km = s.de + (s.a - s.de) * k;
      fil(ctx, 60, W - 60, 760, 1160, km, th.ink, 7, th.mut);
      ctx.fillStyle = th.ink; ctx.font = '800 140px ' + O().SANS; ctx.textAlign = 'left';
      ctx.fillText(N(Math.round(km), 0) + ' km', 60, 660);
      var et = data.etapes.filter(function (e) { return km >= e.kmDebut - 1e-9; }).pop() || data.etapes[0];
      ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO;
      ctx.fillText(M('Étape {n} · {de} → {a}', { n: data.etapes.indexOf(et) + 1, de: et.de, a: et.a }).toUpperCase(), 64, 1260);
    }

    function moment(ctx, s, t) {
      var ph = photoA(s, t), k = (t - ph.t0) / (ph.t1 - ph.t0), m = s.m;
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, W, H);
      var v = videos[ph.p.id], im = images[ph.p.id];
      var src = v && !v.__erreur && v.readyState >= 2 && k > 0.06 ? v : im;
      pleinCadre(ctx, src, k, ph.i % 2 === 0);
      // le fondu enchaîné avec la photo d'avant
      if (ph.prec && t - ph.t0 < 0.35) {
        ctx.globalAlpha = 1 - (t - ph.t0) / 0.35;
        pleinCadre(ctx, images[ph.prec.id], 1, (ph.i - 1) % 2 === 0);
        ctx.globalAlpha = 1;
      }
      degrade(ctx, 0, 360, 0.55, 0);
      degrade(ctx, H - 760, H, 0, 0.82);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#FFFFFF';
      ctx.font = '26px ' + O().MONO;
      var et = data.etapes[m.etape] || data.etapes[0];
      ctx.fillText(M('Étape {n} · {de} → {a}', { n: m.etape + 1, de: et.de, a: et.a }).toUpperCase(), 64, 130);
      var a = lisse(fondu(t, s.t0, s.t0 + 0.5));
      ctx.globalAlpha = a;
      ctx.font = '800 88px ' + O().SANS;
      var lignes = O().titreEnLignes(ctx, m.titre, 950).slice(0, 2);
      var yT = H - 360 - (lignes.length - 1) * 88;
      lignes.forEach(function (l, i) { ctx.fillText(l, 60, yT + i * 88); });
      var E = O().eleAuKm;
      ctx.font = '30px ' + O().MONO; ctx.fillStyle = 'rgba(255,255,255,.85)';
      // en promotion : la position seule — l'altitude d'une photo n'est pas celle du lieu
      ctx.fillText(opts.format === 'promo' && global.Promo ? global.Promo.F.position(m.a, m.b) : kmLu(m, m.a, m.b) + '  ·  ' + O().fM(E(data, ph.p.km)), 64, H - 290);
      var texte = opts.textes && opts.textes[m.cle];
      if (texte) { ctx.font = '400 34px ' + O().SANS; ctx.fillStyle = '#FFFFFF'; O().titreEnLignes(ctx, texte, 950).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, 62, H - 230 + i * 44); }); }
      ctx.globalAlpha = 1;
      // le fil, en bas : où l'on en est du voyage
      fil(ctx, 60, W - 60, H - 150, H - 70, ph.p.km, '#FFFFFF', 4, 'rgba(255,255,255,.35)');
      // les photos du moment : autant de traits que de photos, le courant plein
      if (m.choix.length > 1) m.choix.forEach(function (p, i) {
        ctx.fillStyle = i === ph.i ? '#FFFFFF' : 'rgba(255,255,255,.35)';
        ctx.fillRect(W - 60 - (m.choix.length - i) * 58, 108, 46, 6);
      });
    }

    function bilan(ctx, s, t) {
      var k = lisse(fondu(t, s.t0 + 0.1, s.t0 + 2.2));
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      var T = data.trace;
      var boucleF = Math.hypot(T.x[0] - T.x[T.x.length - 1], T.y[0] - T.y[T.y.length - 1]) * T.kmParUnite < 1.5;
      var fin = data.etapes[data.etapes.length - 1].a;
      var titreF = boucleF ? (/^Le /.test(fin) ? M('Retour au {lieu}', { lieu: fin.slice(3), nom: fin }) : M('Retour à {lieu}', { lieu: fin, nom: fin })) : fin;
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO; ctx.fillText(M('ARRIVÉE'), 64, 200);
      ctx.fillStyle = th.ink; ctx.font = '800 110px ' + O().SANS;
      O().titreEnLignes(ctx, titreF, 950).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, 60, 330 + i * 110); });
      var km = s.de + (data.total.km - s.de) * k;
      fil(ctx, 60, W - 60, 620, 980, km, th.ink, 7, th.mut);
      var a = lisse(fondu(t, s.t0 + 1.8, s.t0 + 2.6));
      ctx.globalAlpha = a;
      [[N(data.total.km, 1), M('KILOMÈTRES')], ['+' + N(Math.round(data.total.dplus), 0), M('MÈTRES DE MONTÉE')]].forEach(function (c, j) {
        ctx.fillStyle = th.ink; ctx.font = '800 104px ' + O().SANS; ctx.fillText(c[0], 64 + j * 500, 1190);
        ctx.fillStyle = th.acc; ctx.font = '26px ' + O().MONO; ctx.fillText(c[1], 70 + j * 500, 1236);
      });
      var y = 1360;
      data.etapes.forEach(function (et, j) {
        ctx.fillStyle = th.mut; ctx.font = '26px ' + O().MONO;
        ctx.fillText(M('ÉTAPE {n} · {de} → {a} · {km}', { n: j + 1, de: et.de, a: et.a, km: O().fKm(et.kmFin - et.kmDebut) }), 66, y); y += 52;
      });
      if (opts.signature) {
        O().signer(ctx, W - 64, 1700, opts.signature, th, 1.1, opts.signatureSobre);
        if (opts.lienSignature) { ctx.fillStyle = th.mut; ctx.font = '24px ' + O().MONO; ctx.textAlign = 'right'; ctx.fillText(opts.lienSignature, W - 64, 1810); ctx.textAlign = 'left'; }
      }
      ctx.globalAlpha = 1;
    }

    function dessiner(ctx, t) {
      t = Math.max(0, Math.min(duree - 1e-3, t));
      var s = sceneA(t);
      ctx.save();
      if (s.type === 'titre') titre(ctx, s, t);
      else if (s.type === 'boucle') boucle(ctx, s, t);
      else if (s.type === 'passe') passe(ctx, s, t);
      else if (s.type === 'moment') moment(ctx, s, t);
      else if (s.type === 'invitation') {
        var a = lisse(fondu(t, s.t0, s.t0 + 0.6));
        global.Promo.invitation(ctx, data, images, th, opts, W, H, 'story');
        if (a < 1) { ctx.fillStyle = 'rgba(12,12,10,' + (1 - a) + ')'; ctx.fillRect(0, 0, W, H); }
      }
      else bilan(ctx, s, t);
      ctx.restore();
    }

    // en export image par image : caler la Live Photo sur le bon instant de sa vidéo
    function preparer(t) {
      var s = sceneA(t);
      if (s.type !== 'moment') return Promise.resolve();
      var ph = photoA(s, t), v = videos[ph.p.id];
      if (!v || v.__erreur || v.readyState < 1 || !v.duration) return Promise.resolve();
      v.pause();
      var cible = (t - ph.t0) % v.duration;
      if (Math.abs(v.currentTime - cible) < 0.01) return Promise.resolve();
      return new Promise(function (ok) {
        var fini = false, fin = function () { if (!fini) { fini = true; ok(); } };
        v.addEventListener('seeked', fin, { once: true }); setTimeout(fin, 400);
        v.currentTime = cible;
      });
    }

    return { duree: duree, dessiner: dessiner, preparer: preparer, moments: moments.map(function (m) { return m.titre; }),
             choisis: moments.map(function (m) { return m.cle; }), aLaMain: main.length > 0,
             candidats: tous.map(function (m) {
               return { cle: m.cle, titre: m.titre, n: m.photos.length, video: m.choix.some(function (p) { return p.video; }),
                        km: m.estime ? '≈ km ' + Math.round(m.a) : 'km ' + m.a.toFixed(1).replace('.', ',') };
             }),
             scenes: scenes.map(function (s) { return s.type + ' ' + s.t0.toFixed(1); }), W: W, H: H };
  }

  global.Montage = { monter: monter, W: W, H: H };
})(this);
