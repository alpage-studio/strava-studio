/* « Musée personnel » — un catalogue d'exposition, pas un palmarès.
 *
 * Chaque pièce est une trace, une date, un titre et un cartel écrit à la
 * main. Le vocabulaire graphique est celui d'un mur de musée : beaucoup de
 * blanc, un filet, une typographie discrète, et surtout AUCUN classement.
 * Pas de médaille, pas de « meilleur », pas de premier ni de dernier — juste
 * un ordre que tu décides.
 *
 * Deux vues :
 *   · Galerie — le mur entier
 *   · Cartel  — une seule pièce, pour un tirage propre
 *
 * La collection vit dans ce navigateur (voir musee.js). Ce template ne fait
 * que la dessiner : il ne crée, ne modifie et ne supprime rien.
 */
Studio.template({
  id: 'musee',
  name: 'Musée personnel — la collection',
  famille: 'serie',
  multi: true,

  options: [
    { key: 'vue', type: 'select', label: 'Vue', default: 'galerie', reflow: true,
      choices: [['galerie', 'Galerie — le mur'],
                ['cartel', 'Cartel — une seule pièce']] },
    { key: 'piece', type: 'range', label: 'Pièce n°', default: 1, min: 1, max: 24, step: 1 },
    { key: 'fond', type: 'color', label: 'Fond', default: '#F6F4EF' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#16151A' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#8A7B5C' },
    { key: 'titre', type: 'text', label: 'Titre de l’exposition', default: '' },
    { key: 'cartels', type: 'toggle', label: 'Cartels sous les pièces', default: true }
  ],

  inert: function (a, vals) {
    return (!vals || vals.vue !== 'cartel') ? ['piece'] : [];
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.45), hair = melange(ink, 0.15);
    var pieces = (s.musee || []);

    H.fill(o.fond);
    H.grain(0.012);
    var g = H.grid({ cols: 6, margin: u(8) });

    if (!pieces.length) {
      H.text('La collection est vide', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('crée une pièce depuis une sortie chargée, dans le panneau de gauche',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    H.text(String(o.titre || '').trim() || 'Collection', g.left, g.top + u(3.6),
           H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(pieces.length + (pieces.length > 1 ? ' pièces' : ' pièce'),
           g.right, g.top + u(3.6), H.t('label', { color: faint, align: 'right' }));

    if (o.vue === 'cartel') cartel(pieces[Math.min(pieces.length, Math.max(1, Math.round(o.piece))) - 1]);
    else galerie();

    /* ================= galerie ================= */

    function galerie() {
      var zone = { x: g.left, y: g.top + u(10), w: g.width, h: g.height - u(14) };
      var n = pieces.length;
      var cols = n <= 2 ? 1 : n <= 6 ? 2 : n <= 12 ? 3 : 4;
      var rows = Math.ceil(n / cols);
      var cw = zone.w / cols, chh = zone.h / rows;
      var legende = o.cartels ? u(9) : u(3);
      var cote = Math.min(cw - u(3), chh - legende - u(3));
      var reste = n % cols;
      var decale = reste ? (cols - reste) * cw / 2 : 0;
      var derniere = Math.floor((n - 1) / cols);

      pieces.forEach(function (p, i) {
        var rangee = Math.floor(i / cols);
        var cx = zone.x + (i % cols) * cw + (rangee === derniere ? decale : 0);
        var cy = zone.y + rangee * chh;
        var ox = cx + (cw - cote) / 2, oy = cy + (chh - cote - legende) / 2;
        cadre({ x: ox, y: oy, w: cote, h: cote }, p, cote * 0.012);
        if (o.cartels) petitCartel(p, ox, oy + cote + u(4.5), cote);
      });
    }

    /* Le cadre : un filet fin et beaucoup d'air autour de la trace. C'est
     * l'air qui fait le mur de musée ; une trace au bord fait une vignette. */
    function cadre(box, p, largeur) {
      ctx.save();
      ctx.strokeStyle = hair; ctx.lineWidth = u(0.1);
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.restore();
      trace(p, { x: box.x + box.w * 0.16, y: box.y + box.h * 0.16,
                 w: box.w * 0.68, h: box.h * 0.68 }, largeur);
    }

    function trace(p, box, largeur) {
      var n = (p.lat || []).length;
      if (n < 2) return;
      var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
      for (var i = 0; i < n; i++) {
        if (p.lat[i] < laMin) laMin = p.lat[i];
        if (p.lat[i] > laMax) laMax = p.lat[i];
        if (p.lon[i] < loMin) loMin = p.lon[i];
        if (p.lon[i] > loMax) loMax = p.lon[i];
      }
      var c = Math.cos((laMin + laMax) / 2 * Math.PI / 180);
      var ech = Math.max((loMax - loMin) * c, laMax - laMin) || 1e-6;
      var cote = Math.min(box.w, box.h);
      var ox = box.x + (box.w - cote) / 2, oy = box.y + (box.h - cote) / 2;
      var vus = H.progressCount(n);
      ctx.save();
      ctx.strokeStyle = p.couleur || ink;
      ctx.lineWidth = Math.max(u(0.22), largeur);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      for (var k = 0; k < Math.min(n, vus); k++) {
        var X = ox + cote * (0.5 + ((p.lon[k] - (loMin + loMax) / 2) * c) / ech);
        var Y = oy + cote * (0.5 - (p.lat[k] - (laMin + laMax) / 2) / ech);
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* Le cartel : titre, date, et c'est tout. Le récit est réservé à la vue
     * « cartel » — sur un mur, un paragraphe par pièce ne se lit pas. */
    function petitCartel(p, x, y, larg) {
      H.text(p.titre, x, y, H.t('title', { size: 2.8, color: ink, maxWidth: larg }));
      H.text(dateLisible(p.date), x, y + u(3.4),
             H.t('label', { color: faint, maxWidth: larg }));
    }

    /* ================= cartel ================= */

    function cartel(p) {
      if (!p) return;
      var zone = { x: g.left, y: g.top + u(12), w: g.width, h: g.height * 0.48 };
      var cote = Math.min(zone.w, zone.h);
      var ox = zone.x + (zone.w - cote) / 2, oy = zone.y;
      cadre({ x: ox, y: oy, w: cote, h: cote }, p, u(0.75));

      var y = oy + cote + u(9);
      H.rule(g.left, y - u(5), g.right, { color: hair });
      H.text(p.titre, g.left, y, H.t('title', { size: 6.4, color: ink, maxWidth: g.width }));
      H.text(dateLisible(p.date), g.left, y + u(5.4),
             H.t('label', { color: melange(o.accent, 0.95), maxWidth: g.width }));

      if (p.recit) {
        var lignes = decoupe(p.recit, g.width, H.t('meta', { size: 2.6 }));
        lignes.slice(0, 9).forEach(function (l, i) {
          H.text(l, g.left, y + u(12) + i * u(4.2),
                 H.t('meta', { size: 2.6, color: melange(ink, 0.8) }));
        });
      }

      /* Les chiffres existent, mais tout en bas et tout petits : ce sont des
       * mentions de catalogue, pas une performance. */
      var mentions = [];
      if (p.distance_km != null) mentions.push(H.fmt.km(p.distance_km, 1) + ' km');
      if (p.elev_gain_m != null) mentions.push(Math.round(p.elev_gain_m) + ' m');
      if (p.nomSortie && p.nomSortie !== p.titre) mentions.push(p.nomSortie);
      H.text(mentions.join('   ·   '), g.left, g.bottom,
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    function decoupe(texte, larg, style) {
      var mots = String(texte).split(/\s+/), ligne = '', out = [];
      mots.forEach(function (m) {
        var essai = ligne ? ligne + ' ' + m : m;
        if (H.measureWith(essai, style, style.size) > larg && ligne) { out.push(ligne); ligne = m; }
        else ligne = essai;
      });
      if (ligne) out.push(ligne);
      return out;
    }

    function dateLisible(iso) {
      if (!iso) return 'sans date';
      var d = new Date(iso);
      if (isNaN(d)) return 'sans date';
      return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
