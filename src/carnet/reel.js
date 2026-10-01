/* reel.js — Horizon en Reel : un travelling le long de la crête.
 *
 * Le Reel ne refait rien : il FILME le panorama d'Horizon. Le cadre 9:16
 * fait exactement une planche de large — la bande du milieu, 1080 × 1350,
 * EST le carrousel — et la caméra glisse de la première à la dernière.
 * Au-dessus, le compteur ; au-dessous, la boucle et la progression. Ce
 * qu'on voit défiler dans le Reel est donc, image pour image, ce que le
 * carrousel montre au doigt.
 *
 * Le rythme : la caméra ralentit sur chaque photo et accélère entre elles.
 * Sur quelques photos choisies — les Live Photos, la couverture — elle
 * PLONGE : le tirage grandit jusqu'à remplir la bande, s'anime s'il porte
 * une vidéo, puis reprend sa place sur la crête.
 */
(function (global) {
  'use strict';

  /* LES MOTS DES IMAGES : ici presque aucun — le titre, les lieux et les
   * légendes sont des DONNÉES. Seuls les nombres changent de séparateurs. */
  if (global.Langue) global.Langue.declarer('en', {
    'KM': 'KM'
  });
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

  var W = 1080, H = 1920, BANDE = 1350, HAUT = (H - BANDE) / 2;
  var VITESSE = 1500;          // px de panorama par seconde, entre deux photos
  var HALTE = 0.75, PLONGEE = 3.0, DEBUT = 2.4, FIN = 3.0;

  // remplir un cadre sans déformer — image OU vidéo, qui ne nomment pas leur taille pareil
  function couvrir(ctx, src, x, y, w, h) {
    // une vidéo, une image et un canvas ne nomment pas leur taille pareil
    var iw = src.videoWidth || src.naturalWidth || src.width, ih = src.videoHeight || src.naturalHeight || src.height;
    if (!iw || !ih) return;
    var ar = iw / ih, ab = w / h, sx, sy, sw, sh;
    if (ar > ab) { sh = ih; sw = sh * ab; sx = (iw - sw) / 2; sy = 0; }
    else { sw = iw; sh = sw / ab; sx = 0; sy = (ih - sh) / 2; }
    ctx.drawImage(src, sx, sy, sw, sh, x, y, w, h);
  }

  function lisse(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }

  /* la chronologie : une suite de haltes et de glissements */
  function chronologie(L, data, opts) {
    var O = global.Horizon.outils, max = L.largeur - W, seq = [], t = 0, x = 0;
    function halte(d, extra) { seq.push({ t0: t, t1: t + d, x0: x, x1: x, halte: true, plonge: extra || null }); t += d; }
    function aller(nx) {
      nx = Math.max(0, Math.min(max, nx));
      if (Math.abs(nx - x) < 4) return;
      var d = Math.max(0.45, Math.abs(nx - x) / VITESSE);
      seq.push({ t0: t, t1: t + d, x0: x, x1: nx }); t += d; x = nx;
    }
    var plongees = choisirPlongees(L, data, opts);
    halte(DEBUT);
    // les photos d'une même planche se regardent d'une seule halte
    var parPlanche = {};
    L.places.forEach(function (p) { var k = Math.floor((p.x + p.w / 2) / W); (parPlanche[k] = parPlanche[k] || []).push(p); });
    Object.keys(parPlanche).map(Number).sort(function (a, b) { return a - b; }).forEach(function (k) {
      aller(k * W);
      var liste = parPlanche[k];
      var aPlonger = liste.filter(function (p) { return plongees[p.m.id]; });
      halte(HALTE);
      aPlonger.forEach(function (p) { halte(PLONGEE, p); });
    });
    aller(max);
    halte(FIN);
    return { seq: seq, duree: t };
  }

  function choisirPlongees(L, data, opts) {
    var ids = {}, n = 0;
    L.places.forEach(function (p) { if (p.m.video && n < 4) { ids[p.m.id] = true; n++; } });
    L.places.forEach(function (p) { if (p.m.id === data.couverture && n < 4 && !ids[p.m.id]) { ids[p.m.id] = true; n++; } });
    return ids;
  }

  function etatA(ch, t) {
    var s = ch.seq, i;
    for (i = 0; i < s.length; i++) if (t < s[i].t1) break;
    var g = s[Math.min(i, s.length - 1)];
    var f = Math.max(0, Math.min(1, (t - g.t0) / Math.max(1e-6, g.t1 - g.t0)));
    return { x: g.x0 + (g.x1 - g.x0) * lisse(f), plonge: g.plonge, f: f, t0: g.t0 };
  }

  /* Monte un Reel sur le panorama déjà dessiné (`grand`).
   * Rend { duree, dessiner(ctx, t) } — t en secondes. */
  function monter(grand, L, data, images, videos, opts) {
    var O = global.Horizon.outils, th = global.Horizon.THEMES[opts.theme] || global.Horizon.THEMES.papier;
    var ch = chronologie(L, data, opts);
    var gravures = {};

    /* la photo en gravure : les contours (Sobel) et des hachures
     * horizontales dans les ombres, à l'encre du thème sur son papier.
     * Calculée une seule fois par photo, à la taille de la bande. */
    function gravure(id, im) {
      if (gravures[id] !== undefined) return gravures[id];
      if (!im || !im.naturalWidth) return null;
      var c = document.createElement('canvas'); c.width = W; c.height = BANDE;
      var x = c.getContext('2d');
      x.filter = 'grayscale(1)'; couvrir(x, im, 0, 0, W, BANDE); x.filter = 'none';
      var src = x.getImageData(0, 0, W, BANDE), d = src.data, n = W * BANDE, lum = new Float32Array(n), i;
      for (i = 0; i < n; i++) lum[i] = d[i * 4] / 255;
      var ink = hex(th.ink), bg = hex(th.bg), out = x.createImageData(W, BANDE), o = out.data;
      for (var yy = 0; yy < BANDE; yy++) {
        for (var xx = 0; xx < W; xx++) {
          i = yy * W + xx;
          var a = 0;
          if (xx > 0 && yy > 0 && xx < W - 1 && yy < BANDE - 1) {
            var gx = lum[i - W + 1] + 2 * lum[i + 1] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - 1] - lum[i + W - 1];
            var gy = lum[i + W - 1] + 2 * lum[i + W] + lum[i + W + 1] - lum[i - W - 1] - 2 * lum[i - W] - lum[i - W + 1];
            a = Math.min(1, Math.max(0, (Math.sqrt(gx * gx + gy * gy) - 0.3) * 2.4));   // seuil haut : l'herbe ne devient pas du bruit
          }
          var l = lum[i];
          if (l < 0.4 && yy % 9 < 2) a = Math.max(a, 0.5);          // ombre : une hachure, légère
          if (l < 0.2 && (yy + 4) % 9 < 2) a = Math.max(a, 0.8);    // ombre profonde : une seconde
          o[i * 4] = bg[0] + (ink[0] - bg[0]) * a;
          o[i * 4 + 1] = bg[1] + (ink[1] - bg[1]) * a;
          o[i * 4 + 2] = bg[2] + (ink[2] - bg[2]) * a;
          o[i * 4 + 3] = 255;
        }
      }
      x.putImageData(out, 0, 0);
      gravures[id] = c;
      return c;
    }
    function hex(h) { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }

    function dessiner(ctx, t) {
      var e = etatA(ch, t), cam = e.x;
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, H);
      ctx.drawImage(grand, cam, 0, W, BANDE, 0, HAUT, W, BANDE);

      // le kilomètre au centre de l'image, sur la crête
      // pendant une plongée, le compteur dit où la PHOTO a été prise, pas où regarde la caméra
      var km = e.plonge ? e.plonge.m.km : Math.max(0, Math.min(data.total.km, O.xVersKm(L, cam + W / 2)));
      var alt = global.CarnetLecteur.auKm(data.trace, km).ele;
      var et = data.etapes.filter(function (x) { return km >= x.kmDebut; }).pop() || data.etapes[0];

      // la plongée : le tirage grandit jusqu'à remplir la bande
      if (e.plonge) {
        var p = e.plonge, f = e.f;
        var entree = Math.min(1, f / 0.18), sortie = Math.min(1, (1 - f) / 0.18), k = lisse(Math.min(entree, sortie));
        var r0 = { x: p.x - cam, y: p.y + HAUT, w: p.w, h: p.h }, r1 = { x: 0, y: HAUT, w: W, h: BANDE };
        var r = { x: r0.x + (r1.x - r0.x) * k, y: r0.y + (r1.y - r0.y) * k, w: r0.w + (r1.w - r0.w) * k, h: r0.h + (r1.h - r0.h) * k };
        ctx.fillStyle = 'rgba(0,0,0,' + (0.55 * k) + ')'; ctx.fillRect(0, HAUT, W, BANDE);
        var v = videos[p.m.id], im = images[p.m.id];
        var src = v && v.readyState >= 2 && !v.__erreur ? v : im;
        /* la photo se DESSINE : elle arrive en gravure — les mêmes traits
         * que la crête —, puis un volet la développe de gauche à droite, et
         * seulement alors elle s'anime si c'est une Live Photo. */
        var volet = lisse(Math.max(0, Math.min(1, (f - 0.26) / 0.34)));
        var z = 1 + 0.06 * f;   // un zoom lent pendant la tenue : le tirage respire
        var zx = r.x - r.w * (z - 1) / 2, zy = r.y - r.h * (z - 1) / 2, zw = r.w * z, zh = r.h * z;
        var g = gravure(p.m.id, im);
        ctx.save();
        ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip();
        if (g && volet < 1) couvrir(ctx, g, zx, zy, zw, zh);
        if (src && volet > 0) {
          ctx.save();
          ctx.beginPath(); ctx.rect(r.x, r.y, r.w * volet, r.h); ctx.clip();
          O.peindrePhoto(ctx, volet < 1 ? im : src, zx, zy, zw, zh, opts, th);
          ctx.restore();
          if (volet < 1) {
            ctx.fillStyle = th.crete || th.acc;
            ctx.fillRect(r.x + r.w * volet - 3, r.y, 6, r.h);
          }
        }
        ctx.restore();
        // la légende seule : le kilomètre et l'altitude sont déjà au compteur
        var leg = p.m.legende || (data.__legendes && data.__legendes[p.m.id]) || '';
        if (k > 0.9 && leg) {
          ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(0, HAUT + BANDE - 120, W, 120);
          ctx.fillStyle = '#FFFFFF'; ctx.font = '600 46px ' + O.SANS; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
          ctx.fillText(leg, 56, HAUT + BANDE - 44);
        }
      }

      /* le haut : le compteur. Le chiffre qui défile est le cœur du Reel. */
      ctx.fillStyle = th.bg; ctx.fillRect(0, 0, W, HAUT);
      ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
      ctx.fillStyle = th.acc; ctx.font = '26px ' + O.MONO;
      ctx.fillText((opts.titre || data.titre).toUpperCase(), 56, 96);
      ctx.fillStyle = th.ink; ctx.font = '800 120px ' + O.SANS;
      var lu = N(km, 1);
      ctx.fillText(lu, 50, 236);
      var wkm = ctx.measureText(lu).width;
      ctx.font = '30px ' + O.MONO; ctx.fillStyle = th.mut;
      ctx.fillText(M('KM'), 66 + wkm, 236);
      ctx.textAlign = 'right'; ctx.fillStyle = th.ink; ctx.font = '800 72px ' + O.SANS;
      ctx.fillText(O.fM(alt), W - 56, 236);
      ctx.font = '26px ' + O.MONO; ctx.fillStyle = th.mut;
      ctx.fillText((et.de + ' → ' + et.a).toUpperCase(), W - 56, 150);

      /* le bas : la boucle et la progression */
      var yb = HAUT + BANDE;
      ctx.fillStyle = th.bg; ctx.fillRect(0, yb, W, H - yb);
      var T = data.trace, bx = 56, by = yb + 40, bs = 200;
      var sc = Math.min(bs / T.largeur, bs / T.hauteur);
      var ox = bx + (bs - T.largeur * sc) / 2, oy = by + (bs - T.hauteur * sc) / 2;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = th.mut; ctx.globalAlpha = 0.35; ctx.lineWidth = 3;
      ctx.beginPath();
      for (var i = 0; i < T.x.length; i++) ctx[i ? 'lineTo' : 'moveTo'](ox + T.x[i] * sc, oy + T.y[i] * sc);
      ctx.stroke(); ctx.globalAlpha = 1;
      ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = 4;
      ctx.beginPath();
      for (i = 0; i < T.x.length && T.km[i] <= km; i++) ctx[i ? 'lineTo' : 'moveTo'](ox + T.x[i] * sc, oy + T.y[i] * sc);
      ctx.stroke();
      var q = global.CarnetLecteur.auKm(T, km);
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(ox + q.x * sc, oy + q.y * sc, 9, 0, 7); ctx.fill();

      // la barre : la part du voyage déjà faite, les nuits en coches
      var px = 320, pw = W - 56 - px, py = yb + 150;
      ctx.fillStyle = th.mut; ctx.globalAlpha = 0.3; ctx.fillRect(px, py, pw, 6); ctx.globalAlpha = 1;
      ctx.fillStyle = th.crete || th.acc; ctx.fillRect(px, py, pw * km / data.total.km, 6);
      data.etapes.slice(1).forEach(function (x) { ctx.fillStyle = th.ink; ctx.fillRect(px + pw * x.kmDebut / data.total.km - 1, py - 10, 3, 26); });
      ctx.textAlign = 'left'; ctx.fillStyle = th.mut; ctx.font = '26px ' + O.MONO;
      ctx.fillText(O.fKm(data.total.km) + '  ·  +' + O.fM(data.total.dplus), px, py + 60);
      // sur la planche de titre, la signature est déjà dans l'image
      if (opts.signature && cam > W / 2) O.signer(ctx, W - 56, yb + 70, opts.signature, th, 0.8);
    }

    // les plongées exposées : pour les contrôles, et pour un futur montage à la main
    var plongees = ch.seq.filter(function (g) { return g.plonge; }).map(function (g) { return { t0: g.t0, t1: g.t1, id: g.plonge.m.id }; });
    /* avant de dessiner l'instant t en export : caler la Live Photo en cours
     * sur le bon moment de sa vidéo. En lecture, elle tourne seule ; image par
     * image, il faut la placer, sinon elle resterait figée ou décalée. */
    function preparer(t) {
      var e = etatA(ch, t), v = e.plonge && videos[e.plonge.m.id];
      if (!v || v.__erreur || v.readyState < 1 || !v.duration) return Promise.resolve();
      v.pause();
      var cible = ((t - e.t0) % v.duration + v.duration) % v.duration;
      if (Math.abs(v.currentTime - cible) < 0.01) return Promise.resolve();
      return new Promise(function (ok) {
        var fini = false, fin = function () { if (!fini) { fini = true; ok(); } };
        v.addEventListener('seeked', fin, { once: true });
        setTimeout(fin, 400);
        v.currentTime = cible;
      });
    }
    return { duree: ch.duree, dessiner: dessiner, preparer: preparer, plongees: plongees, W: W, H: H };
  }

  global.Reel = { monter: monter, W: W, H: H };
})(this);
