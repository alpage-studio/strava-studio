/* horizon.js — le carrousel « Horizon » : glisser, c'est rouler.
 *
 * Un carrousel Instagram est d'ordinaire une pile d'images. Celui-ci est UN
 * panorama, découpé en planches de 1080 × 1350 : le profil d'altitude du
 * voyage le traverse d'un bout à l'autre comme une ligne d'horizon gravée,
 * et chaque photo est suspendue au-dessus du kilomètre où elle a été prise.
 * Le geste de l'application — faire glisser — devient la distance.
 *
 * L'ÉCHELLE HORIZONTALE N'EST PAS LINÉAIRE, et la planche le dit. Vingt
 * photos serrées sur dix kilomètres et trente kilomètres sans une image ne
 * tiennent pas sur une règle droite : chaque photo « réclame » de la place
 * autour de son kilomètre, la règle du bas s'étire là, et ses graduations
 * le montrent. L'altitude, elle, est vraie en tout point.
 *
 * Planches : la première est la couverture — « coupe & plan » (le profil
 * au-dessus de la carte, reliés par des lettres, comme une planche de
 * géographie) ou « carte & chiffres » ; la dernière est la fiche
 * d'expédition. Aucune date, aucune coordonnée, aucun type d'activité —
 * les règles de toutes les affiches du studio.
 */
(function (global) {
  'use strict';

  var W = 1080, H = 1350;
  var THEMES = {
    papier: { bg: '#F2EEE4', ink: '#22251E', mut: '#7A7D72', acc: '#A54F37', cadre: '#FBF9F4', ombre: 'rgba(34,37,30,.22)', panneau: '#E8E3D6' },
    nuit:   { bg: '#15170F', ink: '#EDEAE0', mut: '#8E8A7C', acc: '#D9835F', cadre: '#EDEAE0', ombre: 'rgba(0,0,0,.5)', panneau: '#22241B' },
    // le club : blanc, noir, et un magenta vif pour la crête — la couleur d'une signature de club
    club:   { bg: '#FAFAF7', ink: '#111111', mut: '#707070', acc: '#E600E6', cadre: '#FFFFFF', ombre: 'rgba(0,0,0,.18)', crete: '#FF00FF', panneau: '#F0EFEA' },
    /* le cyanotype : bleu de Prusse sur papier. Les photos y passent en
     * bichromie — les ombres en bleu, les lumières en blanc du papier —
     * pour que la série entière tienne dans une seule encre. */
    cyano:  { bg: '#F3F1EA', ink: '#10306B', mut: '#5A6C90', acc: '#1E4FAF', cadre: '#FAF9F4', ombre: 'rgba(16,48,107,.22)', crete: '#10306B', panneau: '#E6E6E0', duo: '#12367A' }
  };
  var SANS = '"Archivo", "Helvetica Neue", Arial, sans-serif';
  var MONO = '"IBM Plex Mono", ui-monospace, Consolas, monospace';
  /* l'écriture à la main : des polices présentes sur le système, jamais
   * téléchargées — Windows (Ink Free, Segoe Print), macOS (Bradley Hand,
   * Noteworthy). Un autre ordinateur peut donc écrire un peu autrement. */
  var MAIN = '"Ink Free", "Segoe Print", "Bradley Hand", "Noteworthy", "Comic Sans MS", cursive';

  var Y_HAUT = 560, Y_BAS = 1150, Y_HACH = 1205, Y_REGLE = 1258;
  var FIN_DANS_DERNIERE = 380;
  var RECLAME = 400;         // la place qu'une photo réclame autour de son kilomètre
  var SIGMA = 0.8;           // en km : la largeur de cette réclamation

  // la crête entre au bord droit de la couverture « carte », ou ouvre la planche 2 après « coupe »
  function depart(opts) { return opts.couverture === 'carte' ? 985 : W + 70; }

  function fKm(km) { return km.toFixed(1).replace('.', ',') + ' km'; }
  function fM(m) { return Math.round(m).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m'; }

  // fonction de répartition de la loi normale — la réclamation, lissée
  function phi(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  function xVersKm(L, x) { return xVersKmE(L.echant, x); }
  function xVersKmE(e, x) {
    var a = 0, b = e.length - 1;
    if (x <= e[0].x) return 0;
    if (x >= e[b].x) return e[b].km;
    while (b - a > 1) { var m = (a + b) >> 1; if (e[m].x <= x) a = m; else b = m; }
    var f = (x - e[a].x) / Math.max(1e-6, e[b].x - e[a].x);
    return e[a].km + (e[b].km - e[a].km) * f;
  }
  function eleAuKm(data, km) { return global.CarnetLecteur.auKm(data.trace, km).ele; }

  /* ---------- la mise en page ---------- */
  function composer(data, opts) {
    var DEPART = depart(opts);
    var medias = data.medias.filter(function (m) { return !(opts.exclus && opts.exclus[m.id]); });
    var total = data.total.km;
    var bosses = medias.length * RECLAME;
    var n = Math.round((DEPART + bosses + total * 34 - FIN_DANS_DERNIERE) / W) + 1;
    n = Math.max(3, Math.min(20, n));
    var xFin = (n - 1) * W + FIN_DANS_DERNIERE;
    var s = Math.max(4, (xFin - DEPART - bosses) / total);
    var ks = medias.map(function (m) { return m.km; });
    function X(km) {
      var x = DEPART + s * km;
      for (var i = 0; i < ks.length; i++) x += RECLAME * (phi((km - ks[i]) / SIGMA) - phi((0 - ks[i]) / SIGMA));
      return x;
    }
    // la somme n'atteint pas tout à fait xFin (les queues de la gaussienne) : on recale
    var brut = X(total), f = (xFin - DEPART) / (brut - DEPART);
    function Xf(km) { return DEPART + (X(km) - DEPART) * f; }

    var pas = 0.05, echant = [];
    for (var k = 0; k <= total + 1e-9; k += pas) echant.push({ km: k, x: Xf(k), ele: eleAuKm(data, k) });
    echant.push({ km: total, x: Xf(total), ele: eleAuKm(data, total) });
    var emin = data.trace.eleMin, emax = data.trace.eleMax;
    function Y(ele) { return Y_BAS - (ele - emin) / Math.max(1, emax - emin) * (Y_BAS - Y_HAUT); }

    /* chaque photo se pose AU-DESSUS de la montagne qui est sous elle :
     * haute sur un col, plus basse dans la vallée. La crête décide. */
    function crete(x0, x1) {
      var y = Infinity;
      for (var x = x0; x <= x1; x += 12) y = Math.min(y, Y(eleAuKm(data, xVersKmE(echant, x))));
      return y;
    }
    /* Mise en page PAR PLANCHE. Une photo reste toujours sur la planche de
     * son kilomètre — une planche se lit seule dans le fil. Quand elles s'y
     * serrent, elles rapetissent ; trop serrées, elles passent sur deux
     * rangées en quinconce. Jamais un tirage n'en cache un autre. */
    var groupes = {};
    medias.forEach(function (m) {
      var xv = Xf(m.km), k = Math.min(n - 2, Math.max(1, Math.floor(xv / W)));   // planche 1 : couverture ; dernière : la fiche
      (groupes[k] = groupes[k] || []).push({ m: m, xv: xv, portrait: m.h > m.w });
    });
    var places = [], GAP = 34;
    function ranger(liste, lo, hi, echelle) {
      liste.forEach(function (q) { q.w = (q.portrait ? 322 : 440) * echelle; q.h = (q.portrait ? 430 : 330) * echelle; q.x = q.xv - q.w / 2; });
      for (var i = 0; i < liste.length; i++) {
        var min = i ? liste[i - 1].x + liste[i - 1].w + GAP : lo;
        if (liste[i].x < min) liste[i].x = min;
      }
      for (i = liste.length - 1; i >= 0; i--) {
        var max = i < liste.length - 1 ? liste[i + 1].x - GAP - liste[i].w : hi - liste[i].w;
        if (liste[i].x > max) liste[i].x = max;
      }
    }
    Object.keys(groupes).forEach(function (k) {
      k = +k;
      var liste = groupes[k];
      var lo = k * W + 34, hi = (k + 1) * W - 34, dispo = hi - lo;
      var somme = liste.reduce(function (s0, q) { return s0 + (q.portrait ? 322 : 440); }, 0) + GAP * (liste.length - 1);
      var echelle = Math.min(1, dispo / somme);
      var rangs = [liste];
      if (echelle < 0.72 && liste.length > 2) {
        rangs = [liste.filter(function (q, i) { return i % 2 === 0; }), liste.filter(function (q, i) { return i % 2 === 1; })];
        echelle = Math.min(0.8, Math.min.apply(null, rangs.map(function (r) {
          return dispo / (r.reduce(function (s0, q) { return s0 + (q.portrait ? 322 : 440); }, 0) + GAP * (r.length - 1));
        })));
      }
      var LEG_HAUTE = 150;   // une légende sous un tirage réduit : jusqu'à trois lignes
      for (var essai = 0; essai < 6; essai++) {
        rangs.forEach(function (r) { ranger(r, lo, hi, echelle); });
        if (rangs.length === 1) break;
        var hHaut = Math.max.apply(null, rangs[1].map(function (q) { return q.h; }));
        var yBas = 60 + hHaut + LEG_HAUTE + 24;
        var tient = rangs[0].every(function (q) { return yBas + q.h + 110 <= crete(q.x - 20, q.x + q.w + 20) - 50; });
        if (tient) break;
        echelle *= 0.88;
      }
      liste.forEach(function (q, i) {
        var yv = Y(eleAuKm(data, q.m.km));
        var plafond = crete(q.x - 20, q.x + q.w + 20) - 60 - (q.w < 300 ? 150 : 100);   // la légende
        var haut;
        if (rangs.length === 1) haut = Math.min(plafond - q.h, i % 2 ? 290 : 220);
        else if (rangs[1].indexOf(q) >= 0) haut = 60;   // la rangée du haut
        else haut = 60 + Math.max.apply(null, rangs[1].map(function (r) { return r.h; })) + LEG_HAUTE + 24;
        places.push({ m: q.m, x: q.x, y: Math.max(56, haut), w: q.w, h: q.h, xv: q.xv, yv: yv });
      });
    });
    places.sort(function (p1, p2) { return p1.m.km - p2.m.km; });

    return { n: n, largeur: n * W, X: Xf, Y: Y, echant: echant, places: places, total: total, xFin: xFin };
  }

  /* ---------- peindre ---------- */
  function couvrir(ctx, im, x, y, w, h) {
    var iw = im.videoWidth || im.naturalWidth || im.width, ih = im.videoHeight || im.naturalHeight || im.height;
    if (!iw || !ih) return;
    var ar = iw / ih, ab = w / h, sx, sy, sw, sh;
    if (ar > ab) { sh = ih; sw = sh * ab; sx = (iw - sw) / 2; sy = 0; }
    else { sw = iw; sh = sw / ab; sx = 0; sy = (ih - sh) / 2; }
    ctx.drawImage(im, sx, sy, sw, sh, x, y, w, h);
  }

  /* une photo, dans l'encre du thème : telle quelle, en noir & blanc, ou
   * en bichromie (écran d'une couleur sur le gris : les ombres prennent la
   * couleur, les lumières restent blanches — le principe du cyanotype) */
  function peindrePhoto(ctx, im, x, y, w, h, opts, th) {
    if (!im) return;
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    if (th.duo) ctx.filter = 'grayscale(1) contrast(1.18) brightness(1.04)';
    else if (opts.nb) ctx.filter = 'grayscale(1) contrast(1.08)';
    couvrir(ctx, im, x, y, w, h);
    ctx.filter = 'none';
    if (th.duo) {
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = th.duo; ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = th.bg; ctx.fillRect(x, y, w, h);
    }
    ctx.restore();
  }

  function legendeDe(data, m) {
    if (m.legende) return m.legende;
    if (data.__legendes) return data.__legendes[m.id] || '';
    return '';
  }

  /* chaque repère va à LA photo la plus proche de lui, et à elle seule :
   * trois photos au même col ne s'appellent pas trois fois « Mont Brûlé ».
   * Un repère ainsi porté par une photo ne s'écrit plus sur la crête. */
  function attribuer(data, L) {
    var leg = {}, portes = {};
    (data.reperes || []).forEach(function (r) {
      if (r.fort) return;
      var best = null;
      L.places.forEach(function (p) {
        if (p.m.legende || leg[p.m.id]) return;
        var d = Math.abs(p.m.km - r.km);
        if (d < 1.6 && (!best || d < best.d)) best = { d: d, p: p };
      });
      if (best) { leg[best.p.m.id] = r.nom; portes[r.nom] = true; }
    });
    return { leg: leg, portes: portes };
  }

  /* la légende d'une photo, en lignes qui tiennent dans sa largeur. En
   * manuscrit, le nom s'écrit à la main — un peu plus grand, la main
   * prend de la place. */
  function lignesLegende(ctx, data, p, th, opts) {
    var larg = p.w + 20, out = [];
    var km = fKm(p.m.km), alt = fM(eleAuKm(data, p.m.km));
    ctx.font = '27px ' + MONO;
    if (ctx.measureText(km + '  ·  ' + alt).width <= larg) out.push({ t: km + '  ·  ' + alt, f: '27px ' + MONO, c: th.acc, h: 36 });
    else { out.push({ t: km, f: '27px ' + MONO, c: th.acc, h: 34 }); out.push({ t: alt, f: '27px ' + MONO, c: th.mut, h: 34 }); }
    var leg = legendeDe(data, p.m);
    if (leg) {
      var fonte = opts.manuscrit ? '40px ' + MAIN : '600 32px ' + SANS, hl = opts.manuscrit ? 44 : 38;
      ctx.font = fonte;
      var mots = leg.split(' '), l = '';
      mots.forEach(function (m) {
        var e = l ? l + ' ' + m : m;
        if (ctx.measureText(e).width > larg && l) { out.push({ t: l, f: fonte, c: th.ink, h: hl, main: opts.manuscrit }); l = m; } else l = e;
      });
      out.push({ t: l, f: fonte, c: th.ink, h: hl, main: opts.manuscrit });
    }
    return out;
  }

  /* une flèche tracée à la main : une courbe, une pointe, un peu de tremblé */
  function flecheMain(ctx, x0, y0, x1, y1, couleur, courbe) {
    var mx = (x0 + x1) / 2 + (courbe || 30), my = (y0 + y1) / 2;
    ctx.strokeStyle = couleur; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(mx, my, x1, y1); ctx.stroke();
    var a = Math.atan2(y1 - my, x1 - mx), l = 16;
    ctx.beginPath();
    ctx.moveTo(x1 - l * Math.cos(a - 0.45), y1 - l * Math.sin(a - 0.45)); ctx.lineTo(x1, y1);
    ctx.lineTo(x1 - l * Math.cos(a + 0.5), y1 - l * Math.sin(a + 0.5));
    ctx.stroke();
  }

  /* du texte manuscrit lisible sur les hachures : un halo de papier dessous */
  function ecrireMain(ctx, txt, x, y, taille, th, angle) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(angle || 0);
    ctx.font = taille + 'px ' + MAIN; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.lineJoin = 'round'; ctx.strokeStyle = th.bg; ctx.lineWidth = 10; ctx.strokeText(txt, 0, 0);
    ctx.fillStyle = th.ink; ctx.fillText(txt, 0, 0);
    var w = ctx.measureText(txt).width;
    ctx.restore();
    return w;
  }

  /* la boucle vue de haut, dans un cadre — sans aucune coordonnée.
   * Rend la fonction qui place un kilomètre dans ce cadre. */
  function carte(ctx, T, L, data, bx, by, bw, bh, th, epais, details) {
    var sc = Math.min(bw / T.largeur, bh / T.hauteur);
    var ox = bx + (bw - T.largeur * sc) / 2, oy = by + (bh - T.hauteur * sc) / 2;
    function P(km) { var q = global.CarnetLecteur.auKm(T, km); return [ox + q.x * sc, oy + q.y * sc]; }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = epais;
    ctx.beginPath();
    for (var i = 0; i < T.x.length; i++) ctx[i ? 'lineTo' : 'moveTo'](ox + T.x[i] * sc, oy + T.y[i] * sc);
    ctx.stroke();
    if (!details) return P;
    L.places.forEach(function (p) {
      var q = P(p.m.km);
      ctx.fillStyle = th.bg; ctx.fillRect(q[0] - 9, q[1] - 9, 18, 18);
      ctx.fillStyle = th.ink; ctx.fillRect(q[0] - 6, q[1] - 6, 12, 12);
    });
    var d = P(0);
    ctx.fillStyle = th.bg; ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(d[0], d[1], 13, 0, 7); ctx.fill(); ctx.stroke();
    ctx.font = '26px ' + MONO; ctx.textBaseline = 'middle';
    data.etapes.forEach(function (et, j) {
      var q = P(j ? et.kmDebut : 0), nom = et.de;
      var droite = q[0] < bx + bw * 0.55;
      ctx.fillStyle = th.ink;
      if (j) { ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, 7); ctx.fill(); }
      ctx.textAlign = droite ? 'left' : 'right';
      var tw = ctx.measureText(nom).width;
      ctx.fillStyle = th.bg;
      ctx.fillRect(droite ? q[0] + 18 : q[0] - 26 - tw, q[1] - 17, tw + 8, 34);
      ctx.fillStyle = th.ink; ctx.fillText(nom, q[0] + (droite ? 22 : -22), q[1]);
    });
    ctx.textBaseline = 'alphabetic';
    return P;
  }

  /* ---------- le relief réel ----------
   * Préparé une fois par tools/relief.js depuis swisstopo, projeté par le
   * compositeur comme la trace. Ici on le dessine sous elle : l'ombrage
   * (lumière du nord-ouest, comme sur les cartes suisses), puis les courbes
   * — une maîtresse tous les 500 m, cotée. Tout est coupé au cadre donné. */
  var TOPO = { papier: '#8A6446', nuit: '#9C9582', club: '#9A9A9A', cyano: '#2B5BA8' };
  function centreFondu(T, cad) {
    return { cx: cad.ox + T.largeur * cad.sc / 2, cy: cad.oy + T.hauteur * cad.sc / 2,
             rx: Math.max(T.largeur, T.hauteur * 0.8) * cad.sc * 0.78, ry: T.hauteur * cad.sc * 0.66 };
  }
  function cadreCarte(T, bx, by, bw, bh) {
    var sc = Math.min(bw / T.largeur, bh / T.hauteur);
    return { sc: sc, ox: bx + (bw - T.largeur * sc) / 2, oy: by + (bh - T.hauteur * sc) / 2 };
  }
  function peindreRelief(ctx, data, cad, clip, th, opts) {
    var R = data.relief;
    if (!R || opts.relief === false) return false;
    var sombre = hexRgb(th.bg).reduce(function (s, v) { return s + v; }, 0) < 300;
    var couleur = TOPO[opts.theme] || TOPO.papier;
    ctx.save();
    ctx.beginPath(); ctx.rect(clip[0], clip[1], clip[2], clip[3]); ctx.clip();
    if (R.ombre && R.__img && R.__img.complete && R.__img.naturalWidth) {
      ctx.globalCompositeOperation = sombre ? 'soft-light' : 'multiply';
      ctx.globalAlpha = sombre ? 0.55 : 0.32;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(R.__img, cad.ox + R.ombre.x0 * cad.sc, cad.oy + R.ombre.y0 * cad.sc,
        (R.ombre.x1 - R.ombre.x0) * cad.sc, (R.ombre.y1 - R.ombre.y0) * cad.sc);
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.strokeStyle = couleur; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    [0, 1].forEach(function (maitresse) {
      ctx.globalAlpha = maitresse ? 0.5 : 0.26;
      ctx.lineWidth = maitresse ? 1.6 : 0.9;
      ctx.beginPath();
      R.courbes.forEach(function (c) {
        if (c.m !== maitresse) return;
        for (var i = 0; i < c.x.length; i++) ctx[i ? 'lineTo' : 'moveTo'](cad.ox + c.x[i] * cad.sc, cad.oy + c.y[i] * cad.sc);
      });
      ctx.stroke();
    });
    // la cote des maîtresses, couchée le long de la courbe — quelques-unes
    ctx.globalAlpha = 0.8; ctx.fillStyle = couleur; ctx.font = '15px ' + MONO;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    var poses = 0;
    R.courbes.forEach(function (c, n) {
      if (!c.m || c.x.length < 24 || poses > 14 || n % 3) return;
      var i = Math.floor(c.x.length / 2);
      var x = cad.ox + c.x[i] * cad.sc, y = cad.oy + c.y[i] * cad.sc;
      if (x < clip[0] + 30 || x > clip[0] + clip[2] - 30 || y < clip[1] + 20 || y > clip[1] + clip[3] - 20) return;
      var a = Math.atan2(c.y[i + 1] - c.y[i - 1], c.x[i + 1] - c.x[i - 1]);
      if (a > Math.PI / 2) a -= Math.PI; else if (a < -Math.PI / 2) a += Math.PI;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.globalAlpha = 1; ctx.fillStyle = opts.__feuille || th.bg; ctx.fillRect(-20, -9, 40, 18);
      ctx.fillStyle = couleur; ctx.fillText(String(c.alt), 0, 1);
      ctx.restore();
      poses++;
    });
    ctx.restore();
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    return true;
  }

  /* le relief FONDU dans le papier plutôt que posé dessus en carré.
   * On le peint sur une feuille à part, remplie de la couleur du papier,
   * puis on efface ses bords par un masque : là où le masque s'annule, on
   * retrouve exactement le papier de la page, sans raccord visible.
   *   halo    un ovale autour de la boucle, qui s'éteint doucement ;
   *   bords   un rectangle aux quatre bords dégradés ;
   *   page    toute la zone, qui s'efface vers le haut (le titre) ;
   *   cadre   l'ancien carré, avec son filet. */
  function dessinerRelief(ctx, data, cad, clip, th, opts, fondu) {
    var mode = opts.fondu || (fondu && fondu.mode) || 'cadre';
    if (!fondu || mode === 'cadre') return peindreRelief(ctx, data, cad, clip, th, opts);
    if (!data.relief || opts.relief === false || typeof document === 'undefined') return false;
    var w = Math.ceil(clip[2]), h = Math.ceil(clip[3]);
    var c = document.createElement('canvas'); c.width = w; c.height = h;
    var x = c.getContext('2d');
    /* thème clair : la feuille est BLANCHE et on la pose en multiplication —
     * le blanc ne change rien, l'ombre fonce, et un texte déjà écrit dessous
     * reste lisible. Thème sombre : la feuille prend la couleur du fond. */
    var sombre = hexRgb(th.bg).reduce(function (s0, v0) { return s0 + v0; }, 0) < 300;
    x.fillStyle = sombre ? th.bg : '#FFFFFF'; x.fillRect(0, 0, w, h);
    x.translate(-clip[0], -clip[1]);
    peindreRelief(x, data, cad, clip, th, Object.assign({}, opts, { __feuille: sombre ? th.bg : '#FFFFFF' }));
    x.setTransform(1, 0, 0, 1, 0, 0);
    x.globalCompositeOperation = 'destination-in';
    if (mode === 'halo') {
      var cx = fondu.cx - clip[0], cy = fondu.cy - clip[1], rx = fondu.rx, ry = fondu.ry;
      x.save(); x.translate(cx, cy); x.scale(1, ry / rx);
      var g = x.createRadialGradient(0, 0, 0, 0, 0, rx);
      g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(0.55, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(-cx - 10, -(cy + 10) * rx / ry, w + 20, (h + 20) * rx / ry);
      x.restore();
    } else if (mode === 'bords') {
      var f = Math.min(130, w / 4, h / 4);
      var gh = x.createLinearGradient(0, 0, w, 0);
      gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(f / w, 'rgba(0,0,0,1)'); gh.addColorStop(1 - f / w, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gh; x.fillRect(0, 0, w, h);
      var gv = x.createLinearGradient(0, 0, 0, h);
      gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(f / h, 'rgba(0,0,0,1)'); gv.addColorStop(1 - f / h, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gv; x.fillRect(0, 0, w, h);
    } else {   // page
      var gp = x.createLinearGradient(0, 0, 0, h);
      gp.addColorStop(0, 'rgba(0,0,0,0)'); gp.addColorStop(0.3, 'rgba(0,0,0,0.85)'); gp.addColorStop(1, 'rgba(0,0,0,1)');
      x.fillStyle = gp; x.fillRect(0, 0, w, h);
    }
    ctx.save();
    if (!sombre) ctx.globalCompositeOperation = 'multiply';
    ctx.drawImage(c, clip[0], clip[1]);
    ctx.restore();
    return true;
  }

  function mentionRelief(ctx, data, x, y, th, align) {
    if (!data.relief) return;
    ctx.fillStyle = th.mut; ctx.font = '16px ' + MONO; ctx.textAlign = align || 'left';
    ctx.fillText('RELIEF © SWISSTOPO · COURBES ' + data.relief.equidistance + ' M', x, y);
    ctx.textAlign = 'left';
  }

  /* « by … » : la signature d'un club, une pastille toujours dans sa couleur,
   * quel que soit le thème — une signature ne change pas de couleur.
   * Maquette de concept : le vrai logo du club n'est pas repris. */
  function signer(ctx, xDroite, yCentre, nom, th, k, sobre) {
    var r = 58 * k, cx = xDroite - r, mots = nom.split(' ');
    if (sobre) {
      // la version sobre : un filet à l'encre du thème, sans aplat — la photo reste la vedette
      ctx.strokeStyle = th.ink; ctx.lineWidth = 2 * k;
      ctx.beginPath(); ctx.arc(cx, yCentre, r, 0, 7); ctx.stroke();
      ctx.fillStyle = th.ink;
    } else {
      ctx.fillStyle = '#FF00FF';
      ctx.beginPath(); ctx.arc(cx, yCentre, r, 0, 7); ctx.fill();
      ctx.fillStyle = '#FFFFFF';
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '800 ' + Math.round(30 * k) + 'px ' + SANS;
    if (mots.length > 1) {
      ctx.fillText(mots[0], cx, yCentre - 16 * k);
      ctx.fillText(mots.slice(1).join(' '), cx, yCentre + 17 * k);
    } else ctx.fillText(nom, cx, yCentre);
    // pas de « by » devant : la pastille signe seule
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  function titreEnLignes(ctx, txt, largeur) {
    var mots = txt.split(' '), lignes = [], ligne = '';
    mots.forEach(function (mt) {
      var essai = ligne ? ligne + ' ' + mt : mt;
      if (ctx.measureText(essai).width > largeur && ligne) { lignes.push(ligne); ligne = mt; } else ligne = essai;
    });
    lignes.push(ligne);
    return lignes;
  }

  function chiffresDe(data, n) {
    var hautMax = data.etapes.reduce(function (m, et) { return Math.max(m, et.altMax || 0); }, 0);
    if (n === 3) return [
      [fKm(data.total.km).replace(' km', ''), 'KILOMÈTRES'],
      ['+' + fM(data.total.dplus).replace(' m', ''), 'MÈTRES DE MONTÉE'],
      [String(data.etapes.length), data.etapes.length > 1 ? 'ÉTAPES' : 'ÉTAPE']
    ];
    return [
      [fKm(data.total.km).replace(' km', ''), 'KILOMÈTRES'],
      ['+' + fM(data.total.dplus).replace(' m', ''), 'MÈTRES DE MONTÉE'],
      [fM(hautMax).replace(' m', ''), 'AU PLUS HAUT'],
      [String(data.etapes.length), data.etapes.length > 1 ? 'ÉTAPES' : 'ÉTAPE']
    ];
  }

  /* les lieux qu'on nomme sur la coupe : les repères, espacés d'au moins
   * neuf kilomètres, huit au plus — plus, la planche deviendrait un index */
  function lieuxLettres(data) {
    var out = [], dernier = -1e9;
    (data.reperes || []).filter(function (r) { return !r.fort; }).forEach(function (r) {
      if (r.km - dernier >= 9 && out.length < 8) { out.push(r); dernier = r.km; }
    });
    return out.map(function (r, i) { return { r: r, lettre: String.fromCharCode(65 + i) }; });
  }

  function pastilleLettre(ctx, x, y, lettre, th, plein) {
    ctx.fillStyle = plein ? th.ink : th.bg; ctx.strokeStyle = th.ink; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = plein ? th.bg : th.ink; ctx.font = '600 20px ' + MONO;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(lettre, x, y + 1);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
  }

  /* ---------- couverture « coupe & plan » ----------
   * La planche de géographie : le profil (la coupe) au-dessus de la boucle
   * (le plan), et les mêmes lettres aux mêmes lieux sur les deux. Les fils
   * qui descendent de la coupe au plan relient deux vues d'un même point.
   * Tout y est mesuré : l'altitude pour la coupe, le tracé pour le plan. */
  function couvertureCoupe(ctx, data, L, th, opts) {
    var T = data.trace;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = th.acc; ctx.font = '26px ' + MONO;
    ctx.fillText('CARNET DE ROUTE', 64, 104);
    if (opts.signature) signer(ctx, W - 64, 88, opts.signature, th, 0.9, opts.signatureSobre);

    ctx.fillStyle = th.ink; ctx.font = '800 104px ' + SANS;
    var lignes = titreEnLignes(ctx, opts.titre || data.titre, 820);
    lignes.forEach(function (l, j) { ctx.fillText(l, 58, 222 + j * 98); });
    var yt = 222 + (lignes.length - 1) * 98 + 56;
    var sous = opts.sousTitre != null ? opts.sousTitre : data.sousTitre;
    if (sous) {
      ctx.font = '400 32px ' + SANS;
      titreEnLignes(ctx, sous, 940).forEach(function (l) { ctx.fillText(l, 62, yt); yt += 42; });
    }

    // les chiffres, en rangée
    var ys = yt + 74, nb = opts.nbChiffres || 4;
    chiffresDe(data, nb).forEach(function (c, j) {
      var x = 60 + j * (nb === 3 ? 330 : 245);
      ctx.fillStyle = th.ink; ctx.font = '800 62px ' + SANS; ctx.textAlign = 'left';
      ctx.fillText(c[0], x, ys);
      ctx.fillStyle = th.acc; ctx.font = '20px ' + MONO;
      ctx.fillText(c[1], x + 3, ys + 30);
    });

    // la coupe
    var cx0 = 80, cx1 = W - 60, cy0 = ys + 120, cy1 = cy0 + 210;
    var emin = T.eleMin, emax = T.eleMax, total = data.total.km;
    function CX(km) { return cx0 + km / total * (cx1 - cx0); }
    function CY(ele) { return cy1 - (ele - emin) / Math.max(1, emax - emin) * (cy1 - cy0); }
    ctx.fillStyle = th.mut; ctx.font = '20px ' + MONO;
    var toit = data.etapes.reduce(function (m, et) { return Math.max(m, et.altMax || 0); }, 0);
    ctx.fillText('COUPE · DE ' + fM(emin).toUpperCase() + ' À ' + fM(toit).toUpperCase(), 60, cy0 - 26);
    ctx.strokeStyle = th.ink; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (var x = cx0; x <= cx1; x += 5) { var k = (x - cx0) / (cx1 - cx0) * total; ctx.moveTo(x, CY(eleAuKm(data, k)) + 4); ctx.lineTo(x, cy1); }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = 3.5;
    ctx.beginPath();
    for (x = cx0; x <= cx1; x += 2) { k = (x - cx0) / (cx1 - cx0) * total; ctx[x === cx0 ? 'moveTo' : 'lineTo'](x, CY(eleAuKm(data, k))); }
    ctx.stroke();
    ctx.strokeStyle = th.mut; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx0, cy1 + 10); ctx.lineTo(cx1, cy1 + 10); ctx.stroke();
    ctx.fillStyle = th.mut; ctx.font = '18px ' + MONO; ctx.textAlign = 'center';
    for (var t = 0; t <= total; t += 50) { ctx.fillRect(CX(t) - 0.75, cy1 + 10, 1.5, 8); ctx.fillText(t + ' km', CX(t), cy1 + 38); }
    // la nuit
    data.etapes.slice(1).forEach(function (et) {
      ctx.setLineDash([3, 6]); ctx.strokeStyle = th.mut; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(CX(et.kmDebut), cy0 - 10); ctx.lineTo(CX(et.kmDebut), cy1); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = th.mut; ctx.font = '18px ' + MONO; ctx.textAlign = 'center';
      ctx.fillText('NUIT', CX(et.kmDebut), cy0 - 18);
    });

    // le plan
    var py0 = cy1 + 110, py1 = H - 50, pxL = 520, pxR = W - 60;
    ctx.fillStyle = th.mut; ctx.font = '20px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('PLAN', 60, py0 - 18);
    var cadP = cadreCarte(T, pxL, py0, pxR - pxL, py1 - py0), fonduP = centreFondu(T, cadP);
    var enCadre = (opts.fondu || 'halo') === 'cadre';
    var clipP = enCadre ? [pxL - 30, py0 - 14, pxR - pxL + 60, py1 - py0 + 28] : [pxL - 170, py0 - 40, W - pxL + 170, H - py0 + 40];
    if (dessinerRelief(ctx, data, cadP, clipP, th, opts, fonduP)) {
      if (enCadre) ctx.strokeRect(clipP[0], clipP[1], clipP[2], clipP[3]);
      mentionRelief(ctx, data, W - 60, py0 - 18, th, 'right');
    }
    var P = carte(ctx, T, L, data, pxL, py0, pxR - pxL, py1 - py0, th, 4.5, false);
    var d0 = P(0);
    ctx.fillStyle = th.bg; ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(d0[0], d0[1], 11, 0, 7); ctx.fill(); ctx.stroke();

    // les lettres, et les fils de projection
    var lieux = lieuxLettres(data);
    lieux.forEach(function (l) {
      var xa = CX(l.r.km), ya = CY(eleAuKm(data, l.r.km)), q = P(l.r.km);
      ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.4; ctx.lineWidth = 1.2; ctx.setLineDash([2, 5]);
      ctx.beginPath(); ctx.moveTo(xa, ya + 18); ctx.lineTo(xa, cy1 + 58); ctx.lineTo(q[0], q[1] - 18); ctx.stroke();
      ctx.setLineDash([]); ctx.globalAlpha = 1;
    });
    lieux.forEach(function (l) {
      var xa = CX(l.r.km), ya = CY(eleAuKm(data, l.r.km)), q = P(l.r.km);
      pastilleLettre(ctx, xa, ya - 26, l.lettre, th, true);
      pastilleLettre(ctx, q[0], q[1], l.lettre, th, false);
    });
    // la légende des lettres, en colonne à gauche du plan
    var yl = py0 + 30;
    lieux.forEach(function (l) {
      pastilleLettre(ctx, 76, yl - 8, l.lettre, th, false);
      ctx.fillStyle = th.ink; ctx.font = (opts.manuscrit ? '34px ' + MAIN : '600 27px ' + SANS); ctx.textAlign = 'left';
      ctx.fillText(l.r.nom, 106, yl);
      ctx.fillStyle = th.mut; ctx.font = '20px ' + MONO;
      ctx.fillText(fKm(l.r.km) + ' · ' + fM(eleAuKm(data, l.r.km)), 106, yl + 26);
      yl += Math.min(74, (py1 - py0 - 30) / Math.max(1, lieux.length));
    });
    ctx.fillStyle = th.mut; ctx.font = '22px ' + MONO; ctx.textAlign = 'right';
    ctx.fillText('glisse  →', W - 56, H - 22);
  }

  /* ---------- couverture « paysage » : la carte devient montagne ----------
   * En haut, le plan : la boucle sur un quadrillage kilométrique, comme une
   * feuille de carte. En bas, le voyage découpé en tranches de distance,
   * chaque tranche une couche de papier : le départ au fond, pâle, l'arrivée
   * devant, sombre. Les couches se recouvrent comme des chaînes de montagnes
   * vues de loin — mais chaque arête est le VRAI profil de sa tranche.
   * Le quadrillage est vrai lui aussi : un carreau fait cinq kilomètres. */
  function couverturePaysage(ctx, data, L, th, opts) {
    var T = data.trace, total = data.total.km;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = th.acc; ctx.font = '26px ' + MONO;
    ctx.fillText('CARNET DE ROUTE', 64, 104);
    if (opts.signature) signer(ctx, W - 64, 88, opts.signature, th, 0.9);
    ctx.fillStyle = th.ink; ctx.font = '800 104px ' + SANS;
    var lignes = titreEnLignes(ctx, opts.titre || data.titre, 820);
    lignes.forEach(function (l, j) { ctx.fillText(l, 58, 222 + j * 98); });
    var yt = 222 + (lignes.length - 1) * 98 + 50;
    ctx.font = '26px ' + MONO; ctx.fillStyle = th.mut;
    var ch = chiffresDe(data);
    ctx.fillText(ch[0][0] + ' KM  ·  ' + ch[1][0] + ' M  ·  ↑ ' + ch[2][0] + ' M  ·  ' + ch[3][0] + ' ' + ch[3][1], 62, yt);

    // le plan, sur son quadrillage
    var bx = 60, by = yt + 40, bw = W - 120, bh = 430;
    var sc = Math.min(bw / T.largeur, bh / T.hauteur);
    var ox = bx + (bw - T.largeur * sc) / 2, oy = by + (bh - T.hauteur * sc) / 2;
    var fondP = Object.assign({}, opts, { fondu: opts.fondu === 'cadre' ? 'cadre' : 'bords' });
    if (dessinerRelief(ctx, data, { sc: sc, ox: ox, oy: oy }, [0, by - 20, W, bh + 300], th, fondP, { mode: 'bords' })) mentionRelief(ctx, data, 60, by - 30, th);
    var pas = 5 / T.kmParUnite * sc;   // cinq kilomètres, en pixels
    ctx.strokeStyle = th.mut; ctx.lineWidth = 1; ctx.globalAlpha = 0.35;
    ctx.beginPath();
    for (var gx = ox % pas; gx < W; gx += pas) { ctx.moveTo(gx, by - 20); ctx.lineTo(gx, by + bh + 260); }
    for (var gy = by - 20 + ((oy - by) % pas); gy < by + bh + 260; gy += pas) { ctx.moveTo(0, gy); ctx.lineTo(W, gy); }
    ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = th.mut; ctx.font = '18px ' + MONO; ctx.textAlign = 'right';
    ctx.fillText('1 CARREAU = 5 KM', W - 60, by - 30);
    ctx.textAlign = 'left';
    var P = carte(ctx, T, L, data, bx, by, bw, bh, th, 4, false);
    var d0 = P(0);
    ctx.fillStyle = th.bg; ctx.strokeStyle = th.ink; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(d0[0], d0[1], 11, 0, 7); ctx.fill(); ctx.stroke();
    var lieux = lieuxLettres(data);
    lieux.forEach(function (l) { var q = P(l.r.km); pastilleLettre(ctx, q[0], q[1], l.lettre, th, false); });

    /* les couches de papier : autant de tranches que de tranches de ~30 km,
     * cinq au plus. Chaque couche est opaque — elle cache celle de derrière,
     * comme un papier découpé posé sur un autre. */
    var N = Math.max(3, Math.min(5, Math.round(total / 30)));
    var emin = T.eleMin, emax = T.eleMax;
    var haut = 210, y0 = by + bh - 30, ecart = (H - 40 - y0 - 30) / N;
    function melange(a, b, k) {
      var A = hexRgb(a), B = hexRgb(b);
      return 'rgb(' + [0, 1, 2].map(function (i) { return Math.round(A[i] + (B[i] - A[i]) * k); }).join(',') + ')';
    }
    function tranche(i) { return [total * i / N, total * (i + 1) / N]; }
    function pied(i) { return y0 + (i + 1) * ecart + 30; }
    // l'arête de la couche i à l'abscisse x : le vrai profil de sa tranche
    function arete(i, x) {
      var t = tranche(i), km = t[0] + (t[1] - t[0]) * x / W;
      return pied(i) - (eleAuKm(data, km) - emin) / Math.max(1, emax - emin) * haut;
    }
    // un point de la couche i n'est visible que si aucune couche de devant ne le couvre
    function visible(i, x, y) {
      for (var j = i + 1; j < N; j++) if (arete(j, x) < y + 6) return false;
      return true;
    }

    // première passe : le papier. La couche du fond laisse transparaître la carte.
    for (var i = 0; i < N; i++) {
      var teinte = melange(th.panneau || th.bg, th.crete || th.ink, 0.12 + 0.62 * i / (N - 1));
      ctx.save();
      ctx.globalAlpha = i === 0 ? 0.78 : 1;
      ctx.shadowColor = th.ombre; ctx.shadowBlur = 22; ctx.shadowOffsetY = -4;
      ctx.beginPath(); ctx.moveTo(0, H);
      for (var x = 0; x <= W; x += 4) ctx.lineTo(x, arete(i, x));
      ctx.lineTo(W, H); ctx.closePath();
      ctx.fillStyle = teinte; ctx.fill();
      ctx.restore();
      // le bord du papier : un liseré clair, la découpe
      ctx.strokeStyle = th.cadre; ctx.lineWidth = 2.5;
      ctx.beginPath();
      for (x = 0; x <= W; x += 4) ctx[x ? 'lineTo' : 'moveTo'](x, arete(i, x));
      ctx.stroke();
    }

    /* seconde passe : les mots, posés là où ils restent visibles.
     * Écrits avec les couches, ceux du fond disparaissaient sous le papier
     * de devant — la numérotation 01, 02, 03 était illisible. */
    for (i = 0; i < N; i++) {
      var t = tranche(i), clair = i < N / 2;
      var coul = clair ? th.ink : th.bg;
      // l'étiquette : au point visible le plus à droite de l'arête
      var etq = String(i + 1).padStart(2, '0') + ' · KM ' + Math.round(t[0]) + '–' + Math.round(t[1]);
      ctx.font = '19px ' + MONO;
      var tw = ctx.measureText(etq).width;
      for (x = W - 30 - tw; x > 30; x -= 20) {
        // l'étiquette s'écrit SOUS l'arête, dans le papier : c'est là qu'il faut être visible
        var ya = Math.max(arete(i, x), arete(i, x + tw)) + 30;
        if (visible(i, x, ya + 8) && visible(i, x + tw, ya + 8) && visible(i, x + tw / 2, ya + 8) && !(i === N - 1 && x < 260)) {
          ctx.fillStyle = clair ? th.ink : th.bg; ctx.textAlign = 'left';
          ctx.fillText(etq, x, ya);
          break;
        }
      }
      lieux.forEach(function (l) {
        if (l.r.km < t[0] || l.r.km >= t[1]) return;
        var xl = (l.r.km - t[0]) / (t[1] - t[0]) * W, yl = arete(i, xl);
        if (visible(i, xl, yl - 40)) pastilleLettre(ctx, xl, yl - 24, l.lettre, th, true);
      });
      data.etapes.slice(1).forEach(function (et) {
        if (et.kmDebut < t[0] || et.kmDebut >= t[1]) return;
        var xn = (et.kmDebut - t[0]) / (t[1] - t[0]) * W, yn = arete(i, xn);
        ctx.fillStyle = coul; ctx.font = '18px ' + MONO; ctx.textAlign = 'center';
        if (visible(i, xn, yn - 30)) ctx.fillText('☾ NUIT · ' + et.de.toUpperCase(), xn, yn - 18);
        else ctx.fillText('☾ NUIT · ' + et.de.toUpperCase(), xn, yn + 30);
        ctx.textAlign = 'left';
      });
    }
    ctx.fillStyle = th.bg; ctx.font = '22px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('glisse  →', 40, H - 22);
    ctx.textAlign = 'left';
  }

  function hexRgb(h) {
    if (h.indexOf('rgb') === 0) return h.match(/\d+/g).slice(0, 3).map(Number);
    h = h.replace('#', '');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }

  /* ---------- couverture « carte & chiffres » ---------- */
  function couvertureCarte(ctx, data, L, th, opts) {
    var T = data.trace, e = L.echant;
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = th.acc; ctx.font = '26px ' + MONO;
    ctx.fillText('CARNET DE ROUTE', 64, 118);
    if (opts.signature) signer(ctx, W - 64, 96, opts.signature, th, 1);
    ctx.fillStyle = th.ink; ctx.font = '800 124px ' + SANS;
    var lignes = titreEnLignes(ctx, opts.titre || data.titre, 940);
    lignes.forEach(function (l, j) { ctx.fillText(l, 58, 250 + j * 116); });
    var yt = 250 + (lignes.length - 1) * 116 + 64;
    var sous = opts.sousTitre != null ? opts.sousTitre : data.sousTitre;
    if (sous) {
      ctx.font = '400 36px ' + SANS; ctx.fillStyle = th.ink;
      titreEnLignes(ctx, sous, 900).forEach(function (l) { ctx.fillText(l, 62, yt); yt += 46; });
    }
    var yc = Math.max(yt + 90, 560);
    chiffresDe(data).forEach(function (c, j) {
      var y = yc + j * 132;
      ctx.fillStyle = th.ink; ctx.font = '800 92px ' + SANS; ctx.textAlign = 'left';
      ctx.fillText(c[0], 58, y);
      ctx.fillStyle = th.acc; ctx.font = '24px ' + MONO;
      ctx.fillText(c[1], 64, y + 34);
    });
    var bx = 500, by = yc - 110, bw = W - 500 - 60, bh = Math.min(1060, yc + 3 * 132 + 40) - by;
    var cadC = cadreCarte(T, bx, by, bw, bh), fonduC = centreFondu(T, cadC);
    var clipC = (opts.fondu || 'halo') === 'cadre' ? [bx - 20, by - 20, bw + 40, bh + 40] : [300, by - 170, W - 300, bh + 330];
    if (dessinerRelief(ctx, data, cadC, clipC, th, opts, fonduC)) mentionRelief(ctx, data, W - 60, by + bh + 124, th, 'right');
    carte(ctx, T, L, data, bx, by, bw, bh, th, 6, true);
    var y0 = L.Y(e[0].ele);
    ctx.fillStyle = th.mut; ctx.font = '26px ' + MONO; ctx.textAlign = 'right';
    ctx.fillText('DÉPART · ' + data.etapes[0].de.toUpperCase(), e[0].x - 26, y0 + 60);
    ctx.fillText('glisse  →', W - 56, H - 30);
  }

  /* ---------- la fiche d'expédition ----------
   * Un cartouche de carte d'état-major : les étapes, une échelle
   * d'altitude, et trois photos présentées comme des échantillons de
   * terrain — numérotées, nommées, cotées. Pas de coordonnées : la règle
   * des affiches vaut ici aussi, l'altitude en tient lieu. */
  function fiche(ctx, data, L, images, th, opts) {
    var o = (L.n - 1) * W, e = L.echant, fin = e[e.length - 1], yf = L.Y(fin.ele);
    ctx.fillStyle = th.ink; ctx.font = '700 32px ' + SANS; ctx.textAlign = 'left';
    ctx.fillText(data.etapes[data.etapes.length - 1].a, fin.x - 140, yf - 42);

    var px = o + 430, pw = W - 430 - 46, py = 70, ph = H - 140;
    ctx.fillStyle = th.panneau; ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px, py, pw, ph, 18); else ctx.rect(px, py, pw, ph);
    ctx.fill(); ctx.stroke();
    var x = px + 34, xr = px + pw - 34, y = py + 60;
    ctx.fillStyle = th.acc; ctx.font = '22px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('FICHE D’EXPÉDITION', x, y);
    ctx.textAlign = 'right'; ctx.fillText('N° 01', xr, y);
    y += 62;
    ctx.fillStyle = th.ink; ctx.font = '800 50px ' + SANS; ctx.textAlign = 'left';
    titreEnLignes(ctx, opts.titre || data.titre, pw - 68).forEach(function (l) { ctx.fillText(l, x - 2, y); y += 52; });
    y += 18;

    data.etapes.forEach(function (et, j) {
      ctx.strokeStyle = th.mut; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(xr, y - 30); ctx.stroke();
      ctx.fillStyle = th.acc; ctx.font = '20px ' + MONO;
      ctx.fillText('ÉTAPE ' + (j + 1), x, y);
      ctx.fillStyle = th.ink; ctx.font = '700 30px ' + SANS;
      ctx.fillText(et.de + ' → ' + et.a, x, y + 38);
      ctx.fillStyle = th.mut; ctx.font = '21px ' + MONO;
      ctx.fillText(fKm(et.kmFin - et.kmDebut) + ' · +' + fM(et.dplus) + ' · ↑ ' + fM(et.altMax), x, y + 70);
      y += 118;
    });

    // l'échelle d'altitude : des segments alternés, comme l'échelle d'une carte
    y += 6;
    ctx.fillStyle = th.acc; ctx.font = '20px ' + MONO;
    ctx.fillText('ÉCHELLE D’ALTITUDE', x, y);
    y += 22;
    var amin = Math.floor(data.trace.eleMin / 500) * 500, amax = Math.ceil(data.trace.eleMax / 500) * 500;
    function AX(a) { return x + (a - amin) / (amax - amin) * (xr - x); }
    for (var a = amin; a < amax; a += 250) {
      ctx.fillStyle = ((a - amin) / 250) % 2 ? th.bg : th.ink;
      ctx.fillRect(AX(a), y, AX(a + 250) - AX(a), 12);
    }
    ctx.strokeStyle = th.ink; ctx.lineWidth = 1.2; ctx.strokeRect(x, y, xr - x, 12);
    ctx.fillStyle = th.mut; ctx.font = '18px ' + MONO; ctx.textAlign = 'center';
    for (a = amin; a <= amax; a += 500) ctx.fillText(String(a), AX(a), y + 36);
    // la plage du voyage, de son point bas à son toit
    ctx.fillStyle = th.crete || th.acc;
    ctx.fillRect(AX(data.trace.eleMin), y + 46, AX(data.trace.eleMax) - AX(data.trace.eleMin), 4);
    ctx.textAlign = 'left'; ctx.font = '18px ' + MONO; ctx.fillStyle = th.ink;
    ctx.fillText('le voyage', AX(data.trace.eleMin), y + 72);
    y += 110;

    // les échantillons
    ctx.fillStyle = th.acc; ctx.font = '20px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('ÉCHANTILLONS', x, y);
    y += 20;
    var vus = {}, ech = L.places.map(function (p) { return { p: p, nom: legendeDe(data, p.m), alt: eleAuKm(data, p.m.km) }; })
      .filter(function (q) { return q.nom && !vus[q.nom] && (vus[q.nom] = true); })
      .sort(function (a1, b1) { return b1.alt - a1.alt; }).slice(0, 3)
      .sort(function (a1, b1) { return a1.p.m.km - b1.p.m.km; });
    var cote = Math.floor((xr - x - 2 * 18) / 3);
    ech.forEach(function (q, i) {
      var ex = x + i * (cote + 18);
      ctx.fillStyle = th.cadre; ctx.fillRect(ex, y, cote, cote);
      peindrePhoto(ctx, images[q.p.m.id], ex + 6, y + 6, cote - 12, cote - 12, opts, th);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1; ctx.strokeRect(ex, y, cote, cote);
      ctx.fillStyle = th.acc; ctx.font = '18px ' + MONO;
      ctx.fillText('0' + (i + 1) + '.', ex, y + cote + 26);
      ctx.fillStyle = th.ink; ctx.font = opts.manuscrit ? '26px ' + MAIN : '600 20px ' + SANS;
      var ly = y + cote + 26;
      titreEnLignes(ctx, q.nom, cote - 36).slice(0, 2).forEach(function (l) { ctx.fillText(l, ex + 34, ly); ly += 26; });
      ctx.fillStyle = th.mut; ctx.font = '17px ' + MONO;
      ctx.fillText(fM(q.alt) + ' · ' + fKm(q.p.m.km), ex, y + cote + 90);
    });
    y += cote + 170;

    // les totaux, la petite boucle, la signature
    ctx.strokeStyle = th.mut; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(x, y - 36); ctx.lineTo(xr, y - 36); ctx.stroke();
    ctx.fillStyle = th.ink; ctx.font = '800 58px ' + SANS; ctx.textAlign = 'left';
    ctx.fillText(fKm(data.total.km), x, y + 22);
    ctx.font = '800 40px ' + SANS;
    ctx.fillText('+' + fM(data.total.dplus), x, y + 76);
    var yb = py + ph - 150;
    carte(ctx, data.trace, L, data, xr - 330, yb, 120, 120, th, 2.5, false);
    if (opts.signature) {
      signer(ctx, xr, yb + 58, opts.signature, th, 0.95);
      if (opts.lienSignature) {
        ctx.fillStyle = th.mut; ctx.font = '19px ' + MONO; ctx.textAlign = 'right';
        ctx.fillText(opts.lienSignature, xr, yb + 138);
      }
    }
    ctx.textAlign = 'left'; ctx.fillStyle = th.mut; ctx.font = '18px ' + MONO;
    ctx.fillText('Kilomètres étirés où les photos se serrent.', o + 40, H - 26);
  }

  /* ---------- le panorama ---------- */
  function dessiner(canvas, data, L, images, opts) {
    var att = attribuer(data, L);
    data.__legendes = att.leg;
    var th = THEMES[opts.theme] || THEMES.papier;
    canvas.width = L.largeur; canvas.height = H;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = th.bg; ctx.fillRect(0, 0, L.largeur, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var e = L.echant, i;

    // le grain du papier : quelques milliers de points, tirés d'une graine fixe
    var graine = 7;
    function alea() { graine = (graine * 16807) % 2147483647; return graine / 2147483647; }
    ctx.fillStyle = th.ink; ctx.globalAlpha = 0.035;
    for (i = 0; i < L.largeur * 3; i++) ctx.fillRect(alea() * L.largeur, alea() * H, 1.4, 1.4);
    ctx.globalAlpha = 1;

    /* les hachures sous la crête : une gravure, un trait tous les 7 px */
    ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.28;
    ctx.beginPath();
    for (var x = e[0].x; x <= e[e.length - 1].x; x += 7) {
      var y = L.Y(eleAuKm(data, xVersKm(L, x)));
      ctx.moveTo(x, y + 9); ctx.lineTo(x, Y_HACH);
    }
    ctx.stroke(); ctx.globalAlpha = 1;

    // la crête
    ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = 5;
    ctx.beginPath();
    e.forEach(function (p, j) { ctx[j ? 'lineTo' : 'moveTo'](p.x, L.Y(p.ele)); });
    ctx.stroke();
    // départ et arrivée
    [e[0], e[e.length - 1]].forEach(function (p) {
      ctx.fillStyle = th.bg; ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, L.Y(p.ele), 12, 0, 7); ctx.fill(); ctx.stroke();
    });
    if (opts.couverture !== 'carte') {
      ctx.fillStyle = th.ink; ctx.font = '700 32px ' + SANS; ctx.textAlign = 'left';
      ctx.fillText(data.etapes[0].de, e[0].x + 24, L.Y(e[0].ele) - 36);
      ctx.fillStyle = th.acc; ctx.font = '22px ' + MONO;
      ctx.fillText('DÉPART · ÉTAPE 1', e[0].x + 24, L.Y(e[0].ele) - 76);
    }

    // la règle : ses graduations s'écartent là où l'échelle s'étire
    ctx.strokeStyle = th.mut; ctx.fillStyle = th.mut; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(e[0].x, Y_REGLE); ctx.lineTo(e[e.length - 1].x, Y_REGLE); ctx.stroke();
    ctx.font = '26px ' + MONO; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (var t = 0; t <= L.total; t += 5) {
      var xt = L.X(t), long = t % 10 === 0;
      ctx.beginPath(); ctx.moveTo(xt, Y_REGLE - (long ? 14 : 7)); ctx.lineTo(xt, Y_REGLE); ctx.stroke();
      var bord = xt % W;
      if (long && bord > 30 && bord < W - 30) ctx.fillText(String(t), xt, Y_REGLE + 12);
    }
    ctx.textBaseline = 'alphabetic';

    // les nuits : un trait vertical dans le paysage
    data.etapes.slice(1).forEach(function (et, k) {
      var xn = L.X(et.kmDebut), yn = L.Y(eleAuKm(data, et.kmDebut));
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5; ctx.setLineDash([3, 9]);
      ctx.beginPath(); ctx.moveTo(xn, 110); ctx.lineTo(xn, yn - 14); ctx.stroke();
      ctx.setLineDash([]);
      /* l'en-tête de l'étape se pose à droite du trait ; s'il déborderait
       * de la planche, il passe à gauche, et le mot « nuit » change de côté */
      ctx.font = '700 40px ' + SANS;
      var txt = et.de + ' → ' + et.a, tw = ctx.measureText(txt).width;
      var aDroite = xn + 18 + tw < (Math.floor(xn / W) + 1) * W - 40;
      ctx.save(); ctx.translate(aDroite ? xn - 12 : xn + 40, 118); ctx.rotate(Math.PI / 2);
      ctx.fillStyle = th.mut; ctx.font = '24px ' + MONO; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
      ctx.fillText(('Nuit · ' + et.de).toUpperCase().split('').join(' '), 0, 0);
      ctx.restore();
      ctx.textAlign = aDroite ? 'left' : 'right';
      var xt0 = aDroite ? xn + 18 : xn - 18;
      ctx.fillStyle = th.acc; ctx.font = '24px ' + MONO; ctx.textBaseline = 'alphabetic';
      ctx.fillText('ÉTAPE ' + (k + 2), xt0, 132);
      ctx.fillStyle = th.ink; ctx.font = '700 40px ' + SANS;
      ctx.fillText(txt, xt0, 178);
      ctx.textAlign = 'left';
    });

    /* les repères : un point sur la crête et un nom dans la gravure.
     * En manuscrit, le nom est écrit à la main, penché, et une flèche
     * remonte vers le point — l'annotation d'un carnet de terrain. */
    var finEtage = [-1e9, -1e9, -1e9];
    (data.reperes || []).forEach(function (r) {
      if (r.fort || att.portes[r.nom]) return;
      var xr = L.X(r.km), yr = L.Y(eleAuKm(data, r.km));
      ctx.fillStyle = th.ink;
      ctx.beginPath(); ctx.arc(xr, yr, 6, 0, 7); ctx.fill();
      ctx.font = opts.manuscrit ? '38px ' + MAIN : '26px ' + MONO;
      var tw = ctx.measureText(r.nom).width, ty = Math.min(yr + (opts.manuscrit ? 96 : 64), Y_HACH - 60);
      var gaucheT = (xr % W) + tw + 30 > W;
      var x0 = gaucheT ? xr - tw + 10 : xr - 10;
      // le premier étage libre à cet endroit ; à défaut, le moins encombré
      var niveau = 0;
      while (niveau < 2 && finEtage[niveau] > x0 - 20) niveau++;
      ty += niveau * (opts.manuscrit ? 56 : 46);
      finEtage[niveau] = x0 + tw;
      if (opts.manuscrit) {
        ecrireMain(ctx, r.nom, x0, ty, 38, th, -0.05);
        flecheMain(ctx, x0 + (gaucheT ? tw - 30 : 30), ty - 36, xr + (gaucheT ? 4 : -4), yr + 14, th.ink, gaucheT ? 24 : -24);
      } else {
        ctx.fillStyle = th.bg; ctx.fillRect(x0 - 8, ty - 30, tw + 16, 40);
        ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(xr, yr + 8); ctx.lineTo(xr, ty - 30); ctx.stroke();
        ctx.fillStyle = th.ink; ctx.textAlign = 'left'; ctx.fillText(r.nom, x0, ty);
      }
    });

    // le toit de chaque étape, en grand : c'est lui qu'on retient
    data.etapes.forEach(function (et) {
      var best = null;
      e.forEach(function (p) { if (p.km >= et.kmDebut && p.km <= et.kmFin && (!best || p.ele > best.ele)) best = p; });
      if (!best) return;
      var yb = L.Y(best.ele);
      var cache = L.places.some(function (p) { return best.x > p.x - 90 && best.x < p.x + p.w + 90 && yb - 80 < p.y + p.h + 110; });
      var bordT = best.x % W;
      if (cache || bordT < 90 || bordT > W - 90) return;
      ctx.fillStyle = th.acc;
      ctx.beginPath(); ctx.moveTo(best.x, yb - 14); ctx.lineTo(best.x - 10, yb - 30); ctx.lineTo(best.x + 10, yb - 30); ctx.closePath(); ctx.fill();
      ctx.font = '600 30px ' + SANS; ctx.textAlign = 'center';
      ctx.fillText(fM(best.ele), best.x, yb - 44);
      ctx.textAlign = 'left';
    });

    /* les photos, suspendues à leur kilomètre — en trois passes : les
     * fils, puis les tirages, puis les légendes. Un tirage ne doit jamais
     * cacher la légende d'un autre. */
    L.places.forEach(function (p) {
      var bas = p.y + p.h + 30 + lignesLegende(ctx, data, p, th, opts).reduce(function (s0, l) { return s0 + l.h; }, 0);
      ctx.strokeStyle = th.ink; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(p.x + p.w / 2, bas); ctx.lineTo(p.xv, p.yv - 12); ctx.stroke();
      ctx.fillStyle = th.acc;
      ctx.beginPath(); ctx.arc(p.xv, p.yv, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = th.bg; ctx.lineWidth = 3; ctx.stroke();
    });
    L.places.forEach(function (p) {
      var im = images[p.m.id];
      ctx.save();
      ctx.shadowColor = th.ombre; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      ctx.fillStyle = th.cadre; ctx.fillRect(p.x - 12, p.y - 12, p.w + 24, p.h + 24);
      ctx.restore();
      if (im && im.complete && im.naturalWidth) peindrePhoto(ctx, im, p.x, p.y, p.w, p.h, opts, th);
    });
    L.places.forEach(function (p) {
      var ls = lignesLegende(ctx, data, p, th, opts), lw = 0, hh = 0;
      ls.forEach(function (l) { ctx.font = l.f; lw = Math.max(lw, ctx.measureText(l.t).width); hh += l.h; });
      ctx.fillStyle = th.bg; ctx.globalAlpha = 0.92;
      ctx.fillRect(p.x - 8, p.y + p.h + 16, lw + 16, hh + 8);
      ctx.globalAlpha = 1; ctx.textAlign = 'left';
      var yy = p.y + p.h + 16;
      ls.forEach(function (l) {
        yy += l.h; ctx.font = l.f; ctx.fillStyle = l.c;
        if (l.main) ecrireMain(ctx, l.t, p.x, yy - 8, parseInt(l.f, 10), th, -0.03);
        else ctx.fillText(l.t, p.x, yy - 8);
      });
    });

    if (opts.couverture === 'carte') couvertureCarte(ctx, data, L, th, opts);
    else if (opts.couverture === 'paysage') couverturePaysage(ctx, data, L, th, opts);
    else couvertureCoupe(ctx, data, L, th, opts);
    fiche(ctx, data, L, images, th, opts);
    return canvas;
  }

  function planches(grand, n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var c = document.createElement('canvas');
      c.width = W; c.height = H;
      c.getContext('2d').drawImage(grand, i * W, 0, W, H, 0, 0, W, H);
      out.push(c);
    }
    return out;
  }

  global.Horizon = {
    composer: composer, dessiner: dessiner, planches: planches, W: W, H: H, THEMES: THEMES,
    // ce que le Reel reprend, pour dessiner avec les mêmes gestes
    outils: { couvertureCoupe: couvertureCoupe, titreEnLignes: titreEnLignes, eleAuKm: eleAuKm, hexRgb: hexRgb, MAIN: MAIN,
              xVersKm: xVersKm, carte: carte, dessinerRelief: dessinerRelief, cadreCarte: cadreCarte, centreFondu: centreFondu, signer: signer, couvrir: couvrir, peindrePhoto: peindrePhoto,
              fKm: fKm, fM: fM, SANS: SANS, MONO: MONO, MAIN: MAIN }
  };
})(this);
