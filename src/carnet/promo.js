/* promo.js — le carnet en PROMOTION : donner envie d'aller rouler.
 *
 * Le récit (recit.js) est un SOUVENIR : il raconte tout, pour ceux qui y
 * étaient. La promotion s'adresse à ceux qui n'y étaient pas, et finit sur
 * une invitation — le parcours sur Komoot, et la collection du club. Même
 * carnet, autres choix :
 *
 *   - huit images au plus : couverture, parcours, cinq moments, invitation ;
 *   - une ou deux photos par moment, jamais trois : une dominante, et une
 *     seconde seulement si elle montre autre chose ;
 *   - pas de page « sans photo » : un trou de 34 km n'est pas une raison de
 *     continuer à faire défiler ;
 *   - des chiffres dans UNE convention : « 158 km · 5 545 m D+ · 2 jours »,
 *     « Alt. max. 2 787 m », « km 16–19 » ;
 *   - un fil allégé : le voyage entier, le moment en couleur, un seul point ;
 *   - des petits textes qui restent lisibles à 390 px de large — 26 px au
 *     moins sur une image de 1080.
 *
 * Les liens ne sont PAS dans les images : un lien écrit sur une photo ou dans
 * la légende d'un post ne se clique pas sur Instagram. L'invitation dit où
 * les trouver (« liens en bio ») ; la story laisse la place du sticker lien ;
 * le carnet web, lui, porte de vrais liens.
 */
(function (global) {
  'use strict';

  var W = 1080, H = 1350;
  function O() { return global.Horizon.outils; }
  function R() { return global.Recit.outils; }
  var NB = ' ';   // un nombre ne se sépare jamais de son unité

  /* ---------- les chiffres, dans une seule convention ---------- */
  function milliers(n) { return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  var F = {
    km: function (km) { return milliers(km) + NB + 'km'; },
    dplus: function (m) { return milliers(m) + NB + 'm' + NB + 'D+'; },
    alt: function (m) { return 'Alt.' + NB + 'max.' + NB + milliers(m) + NB + 'm'; },
    jours: function (data, opts) { var n = (opts.jours || data.etapes.length); return n + NB + (n > 1 ? 'jours' : 'jour'); },
    position: function (a, b) {
      var x = Math.round(a), y = Math.round(b);
      return 'km' + NB + x + (y > x ? '–' + y : '');
    }
  };
  function altMax(data) { return data.etapes.reduce(function (m, et) { return Math.max(m, et.altMax || 0); }, 0); }
  function etapeDe(data, km) { for (var i = data.etapes.length - 1; i >= 0; i--) if (km >= data.etapes[i].kmDebut - 1e-9) return i; return 0; }

  /* ---------- composer ---------- */
  function composer(data, opts) {
    var cible = Math.max(5, Math.min(8, opts.nbImages || 8));
    // couverture, parcours et invitation prennent trois places
    var moments = R().momentsDe(data, opts, cible - 3, true).map(function (s) { return R().preparerMoment(data, opts, s, 2); });
    var images = [{ type: 'couverture' }, { type: 'parcours' }].concat(moments, [{ type: 'invitation' }]);
    images.forEach(function (im, k) { im.n = k + 1; im.total = images.length; });
    return images;
  }

  /* ---------- dessiner ---------- */
  function tirage(ctx, im, x, y, w, h, th, opts) {
    ctx.save();
    ctx.shadowColor = th.ombre; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
    ctx.fillStyle = th.cadre; ctx.fillRect(x - 6, y - 6, w + 12, h + 12);
    ctx.restore();
    if (im && im.complete && im.naturalWidth) O().peindrePhoto(ctx, im, x, y, w, h, opts, th);
  }

  // le fil allégé : le voyage entier, le moment en couleur, un point, rien d'autre
  function fil(ctx, data, a, b, th, x0, x1, y0, y1) {
    var T = data.trace, total = data.total.km, E = O().eleAuKm, pas = total / 300;
    x0 = x0 == null ? 60 : x0; x1 = x1 == null ? W - 60 : x1; y0 = y0 == null ? 1176 : y0; y1 = y1 == null ? 1262 : y1;
    function X(k) { return x0 + k / total * (x1 - x0); }
    function Y(e) { return y1 - (e - T.eleMin) / Math.max(1, T.eleMax - T.eleMin) * (y1 - y0); }
    function trait(k0, k1) { ctx.beginPath(); for (var k = k0; k <= k1 + 1e-9; k += pas) ctx[k === k0 ? 'moveTo' : 'lineTo'](X(k), Y(E(data, k))); ctx.stroke(); }
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.25; ctx.lineWidth = 3; trait(0, total); ctx.globalAlpha = 1;
    if (a != null) {
      ctx.strokeStyle = th.ink; ctx.lineWidth = 3; trait(0, a);
      ctx.strokeStyle = th.crete && th.crete !== th.ink ? th.crete : th.acc; ctx.lineWidth = 7; trait(a, Math.max(a + pas, b));
      var c = (a + b) / 2;
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(X(c), Y(E(data, c)), 10, 0, 7); ctx.fill();
      ctx.strokeStyle = th.bg; ctx.lineWidth = 3; ctx.stroke();
    }
    // la nuit : un tiret discret, sans mot
    data.etapes.slice(1).forEach(function (et) {
      ctx.strokeStyle = th.ink; ctx.globalAlpha = 0.35; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(X(et.kmDebut), y0 - 8); ctx.lineTo(X(et.kmDebut), y0 + 8); ctx.stroke(); ctx.globalAlpha = 1;
    });
  }

  function entete(ctx, data, s, th) {
    var et = data.etapes[s.etape] || data.etapes[0];
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO;
    ctx.fillText(('Jour ' + (s.etape + 1) + ' · ' + et.de + ' → ' + et.a).toUpperCase(), 60, 96);
  }

  function titre(ctx, txt, y, th) {
    ctx.fillStyle = th.ink; ctx.textAlign = 'left';
    ctx.font = '800 76px ' + O().SANS;
    if (ctx.measureText(txt).width <= 960) { ctx.fillText(txt, 58, y); return 0; }
    ctx.font = '800 60px ' + O().SANS;
    O().titreEnLignes(ctx, txt, 960).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, 58, y - 30 + i * 62); });
    return 32;
  }

  function couverture(ctx, data, images, th, opts) {
    var couv = data.medias.filter(function (m) { return m.id === data.couverture; })[0] || data.medias[0];
    // la photo forte en premier : c'est elle qui arrête le pouce
    if (couv && images[couv.id]) O().peindrePhoto(ctx, images[couv.id], 0, 0, W, 800, opts, th);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = th.ink; ctx.font = '800 112px ' + O().SANS;
    var lignes = O().titreEnLignes(ctx, opts.titre || data.titre, 960).slice(0, 2);
    var y = 930;
    lignes.forEach(function (l, i) { ctx.fillText(l, 56, y + i * 104); });
    y += (lignes.length - 1) * 104 + 66;
    var sous = opts.sousTitre != null ? opts.sousTitre : data.sousTitre;
    if (sous) { ctx.font = '400 36px ' + O().SANS; O().titreEnLignes(ctx, sous, 960).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, 60, y + i * 46); }); y += 46 * Math.min(2, O().titreEnLignes(ctx, sous, 960).length); }
    ctx.fillStyle = th.ink; ctx.font = '36px ' + O().MONO;
    ctx.fillText([F.km(data.total.km), F.dplus(data.total.dplus), F.jours(data, opts)].join('  ·  '), 60, y + 44);
    // la collection, annoncée dès la couverture
    var K = opts.komoot || {};
    if (K.nom) {
      ctx.fillStyle = th.acc; ctx.font = '600 28px ' + O().SANS;
      ctx.fillText('Collection Komoot · ' + K.nom, 60, H - 56);
    }
    if (opts.signature) O().signer(ctx, W - 56, H - 70, opts.signature, th, 0.62, opts.signatureSobre);
  }

  function parcours(ctx, data, th, opts) {
    var T = data.trace;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO; ctx.fillText('LE PARCOURS', 60, 96);
    ctx.fillStyle = th.ink; ctx.font = '800 76px ' + O().SANS; ctx.fillText(opts.titre || data.titre, 58, 184);
    // la carte, dominante, sur le vrai relief s'il existe
    var bx = 60, by = 220, bw = W - 120, bh = 720;
    var cad = O().cadreCarte(T, bx, by, bw, bh);
    O().dessinerRelief(ctx, data, cad, [0, 200, W, 780], th, Object.assign({}, opts, { fondu: opts.fondu || 'halo' }), O().centreFondu(T, cad));
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.strokeStyle = th.crete || th.ink; ctx.lineWidth = 7;
    ctx.beginPath();
    for (var i = 0; i < T.x.length; i++) ctx[i ? 'lineTo' : 'moveTo'](cad.ox + T.x[i] * cad.sc, cad.oy + T.y[i] * cad.sc);
    ctx.stroke();
    function P(km) { var q = global.CarnetLecteur.auKm(T, km); return [cad.ox + q.x * cad.sc, cad.oy + q.y * cad.sc]; }
    function etiquette(q, txt, gras) {
      ctx.font = (gras ? '700 30px ' : '28px ') + O().SANS;
      var tw = ctx.measureText(txt).width, droite = q[0] < W * 0.6, x = droite ? q[0] + 24 : q[0] - 24 - tw;
      ctx.fillStyle = th.bg; ctx.globalAlpha = 0.9; ctx.fillRect(x - 8, q[1] - 26, tw + 16, 38); ctx.globalAlpha = 1;
      ctx.fillStyle = th.ink; ctx.fillText(txt, x, q[1] + 4);
    }
    var d = P(0);
    ctx.fillStyle = th.bg; ctx.strokeStyle = th.ink; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(d[0], d[1], 16, 0, 7); ctx.fill(); ctx.stroke();
    etiquette(d, 'Départ · ' + data.etapes[0].de, true);
    data.etapes.slice(1).forEach(function (et, k) {
      var q = P(et.kmDebut);
      ctx.fillStyle = th.acc; ctx.beginPath(); ctx.arc(q[0], q[1], 12, 0, 7); ctx.fill();
      etiquette(q, et.de + ' · fin du jour ' + (k + 1), false);
    });
    // les jours, en clair
    var y = 1010;
    data.etapes.forEach(function (et, j) {
      ctx.fillStyle = th.acc; ctx.font = '28px ' + O().MONO; ctx.fillText('JOUR ' + (j + 1), 60, y);
      ctx.fillStyle = th.ink; ctx.font = '700 36px ' + O().SANS; ctx.fillText(et.de + ' → ' + et.a, 220, y);
      ctx.fillStyle = th.ink; ctx.font = '30px ' + O().MONO;
      ctx.fillText(F.km(et.kmFin - et.kmDebut) + '  ·  ' + F.dplus(et.dplus), 222, y + 44);
      y += 110;
    });
    ctx.fillStyle = th.ink; ctx.font = '30px ' + O().MONO;
    ctx.fillText(F.alt(altMax(data)) + (opts.terrain ? '  ·  ' + opts.terrain : ''), 60, y + 6);
    if (data.relief) { ctx.fillStyle = th.mut; ctx.font = '22px ' + O().MONO; ctx.textAlign = 'right'; ctx.fillText('Relief © swisstopo', W - 60, H - 30); ctx.textAlign = 'left'; }
  }

  function moment(ctx, data, s, images, th, opts) {
    entete(ctx, data, s, th);
    var d = titre(ctx, s.titre, 186, th);
    ctx.fillStyle = th.ink; ctx.globalAlpha = 0.72; ctx.font = '30px ' + O().MONO;
    ctx.fillText(F.position(s.a, s.b), 62, 242 + d); ctx.globalAlpha = 1;
    var texte = (opts.textes && opts.textes[s.cle]) || '';
    var hA = texte ? 96 : 0, y0 = 290 + d, h = 830 - y0 - hA + 160;
    var c = s.choix;
    if (c.length === 1) tirage(ctx, images[c[0].id], 60, y0, 960, h, th, opts);
    else {
      tirage(ctx, images[c[0].id], 60, y0, 620, h, th, opts);
      tirage(ctx, images[c[1].id], 710, y0, 310, h, th, opts);
    }
    if (texte) {
      ctx.fillStyle = th.ink; ctx.font = '400 32px ' + O().SANS;
      O().titreEnLignes(ctx, texte, 960).slice(0, 2).forEach(function (l, i) { ctx.fillText(l, 60, y0 + h + 52 + i * 40); });
    }
    fil(ctx, data, s.a, s.b, th);
  }

  /* L'INVITATION — la dernière image, et la raison de toute la série.
   * Elle dit où trouver les liens ; elle ne les écrit pas, puisqu'ils ne se
   * cliqueraient pas. `format` 'story' laisse libre la zone du sticker lien. */
  function invitation(ctx, data, images, th, opts, w, h, format) {
    var fin = data.medias.filter(function (m) { return m.id === opts.photoInvitation; })[0];
    if (!fin) {
      // à défaut : la photo prise le plus haut — le plus beau point de vue du voyage, en général
      fin = data.medias.slice().sort(function (a, b) { return O().eleAuKm(data, b.km) - O().eleAuKm(data, a.km); })[0];
    }
    ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
    if (fin && images[fin.id]) O().peindrePhoto(ctx, images[fin.id], 0, 0, w, h, opts, th);
    var g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(12,12,10,.72)'); g.addColorStop(0.55, 'rgba(12,12,10,.35)'); g.addColorStop(1, 'rgba(12,12,10,.8)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    var K = opts.komoot || {}, x = 64, y = format === 'story' ? 260 : 200;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = '#FFFFFF';
    var hl = format === 'story' ? 92 : 84;
    ctx.font = '800 ' + hl + 'px ' + O().SANS;
    var accroche = O().titreEnLignes(ctx, opts.accroche || 'Votre prochaine sortie commence ici.', w - 128).slice(0, 3);
    accroche.forEach(function (l, i) { ctx.fillText(l, x, y + i * hl); });
    var y2 = y + (accroche.length - 1) * hl;
    var lignes = [];
    lignes.push((opts.titre || data.titre) + ' est sur Komoot.');
    if (K.nom) lignes.push(K.dansCollection ? 'Il fait partie de la collection ' + K.nom + '.'
                                            : (K.parcours ? 'Et ' + K.parcours + ' parcours' : 'D’autres parcours') + ' vous attendent dans la collection ' + K.nom + '.');
    ctx.font = '400 44px ' + O().SANS;
    var yl = y2 + 110;
    lignes.forEach(function (t) { O().titreEnLignes(ctx, t, w - 128).forEach(function (l) { ctx.fillText(l, x, yl); yl += 58; }); yl += 14; });
    if (opts.lienEnBio !== false) {
      ctx.font = '700 40px ' + O().SANS;
      var t = 'Liens en bio', tw = ctx.measureText(t).width;
      ctx.fillStyle = th.crete && th.crete !== th.ink ? th.crete : th.acc;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x, yl + 10, tw + 64, 76, 38); else ctx.rect(x, yl + 10, tw + 64, 76);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF'; ctx.fillText(t, x + 32, yl + 62);
    }
    // la story : on laisse la place du sticker lien, au tiers bas, et on ne la remplit pas
    if (opts.signature) O().signer(ctx, w - 56, h - (format === 'story' ? 150 : 90), opts.signature, { mut: 'rgba(255,255,255,.8)', ink: '#FFFFFF' }, 0.8, false);
  }

  function dessiner(ctx, data, im, images, opts) {
    var th = global.Horizon.THEMES[opts.theme] || global.Horizon.THEMES.papier;
    ctx.save();
    R().fond(ctx, th);
    if (im.type === 'couverture') couverture(ctx, data, images, th, opts);
    else if (im.type === 'parcours') parcours(ctx, data, th, opts);
    else if (im.type === 'moment') moment(ctx, data, im, images, th, opts);
    else invitation(ctx, data, images, th, opts, W, H);
    ctx.restore();
  }

  function dessinerStory(ctx, data, images, opts) {
    var th = global.Horizon.THEMES[opts.theme] || global.Horizon.THEMES.papier;
    ctx.save(); invitation(ctx, data, images, th, opts, 1080, 1920, 'story'); ctx.restore();
  }

  global.Promo = { composer: composer, dessiner: dessiner, dessinerStory: dessinerStory, invitation: invitation, F: F, W: W, H: H };
})(this);
