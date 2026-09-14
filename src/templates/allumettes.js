/* « Allumettes » — les efforts durs comme des allumettes brûlées.
 *
 * Le comptage seul serait un chiffre de plus. Ce qui rend cette planche
 * unique, c'est qu'elle dit AUSSI où elles ont brûlé : chaque allumette est
 * posée sur le profil, à l'endroit de la sortie où l'effort a eu lieu. On
 * voit d'un coup qu'on a tout dépensé dans les trois premiers cols, ou
 * qu'on s'est fait avoir sur un faux plat.
 *
 * Chaque bâtonnet est consumé en proportion de ce que l'effort a coûté —
 * l'énergie dépensée au-dessus du seuil. Une relance de trente secondes
 * noircit la tête ; un col la brûle jusqu'aux doigts.
 */
Studio.template({
  id: 'allumettes',
  name: 'Allumettes',

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#12100E' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F4EFE6' },
    { key: 'bois', type: 'color', label: 'Bois', default: '#C9A227' },
    { key: 'braise', type: 'color', label: 'Braise', default: '#E5502D' },
    { key: 'seuil', type: 'range', label: 'Seuil (% FTP)', default: 105, min: 90, max: 130 },
    { key: 'duree', type: 'range', label: 'Durée min. (s)', default: 20, min: 10, max: 90 },
    { key: 'profil', type: 'toggle', label: 'Poser sur le profil', default: true },
    { key: 'grain', type: 'toggle', label: 'Grain', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre;
    var faint = melange(ink, 0.5);
    var hair = melange(ink, 0.2);

    H.fill(o.fond);
    if (o.grain) H.grain(0.06);

    var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
    var CH = g.height;

    var feu = a.burned ? a.burned({ pct: o.seuil / 100, minSec: o.duree }) : { list: [] };
    var n = feu.list.length;

    /* ---------- en-tête ---------- */
    H.text(a.name, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));

    /* ---------- le compte ---------- */
    var y = g.top + CH * 0.13;
    H.text('allumettes brûlées', g.left, y, H.t('label', { color: faint }));
    var heroStyle = H.t('hero', { size: 17, color: ink });
    var heroBase = y + heroStyle.size * 0.95;
    H.text(String(n), g.left, heroBase, heroStyle);

    /* Dire d'où vient le compte : sans capteur, ce n'est pas la même
     * grandeur, et une planche qui le tait ment. */
    var legende = feu.source === 'puissance'
      ? 'au-dessus de ' + feu.seuil + ' W' + (feu.estime ? ' (seuil estimé)' : ' · ' + o.seuil + ' % FTP')
      : feu.source === 'cardiaque'
        ? 'au-dessus de ' + feu.seuil + ' bpm — sans capteur de puissance'
        : 'aucune donnée d’effort sur cette sortie';
    H.text(legende, g.left, heroBase + u(4.6), H.t('label', { color: faint }));

    /* ---------- les allumettes, posées sur le profil ---------- */
    var zoneTop = g.top + CH * 0.36;
    var zoneH = CH * 0.44;
    var box = { x: g.left, y: zoneTop, w: g.width, h: zoneH };

    var prof = a.profile;
    var baseY = box.y + box.h;

    if (o.profil && prof && prof.length > 1) {
      // le relief, discret : c'est le décor, pas le sujet
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(box.x, baseY);
      prof.forEach(function (p) {
        ctx.lineTo(box.x + p.x * box.w, baseY - p.y * box.h * 0.55);
      });
      ctx.lineTo(box.x + box.w, baseY);
      ctx.closePath();
      ctx.fillStyle = melange(ink, 0.09);
      ctx.fill();
      ctx.restore();
    }

    // hauteur du relief à une abscisse donnée, pour y planter l'allumette
    function relief(x) {
      if (!o.profil || !prof || prof.length < 2) return 0;
      var i = Math.min(prof.length - 1, Math.max(0, Math.round(x * (prof.length - 1))));
      return prof[i].y * box.h * 0.55;
    }

    if (n) {
      var coutMax = Math.max.apply(null, feu.list.map(function (m) { return m.cout; })) || 1;
      var largeur = Math.max(u(0.7), Math.min(u(1.6), box.w / (n * 2.2)));
      var hauteur = box.h * 0.42;

      feu.list.forEach(function (m) {
        var x = box.x + m.x * box.w;
        var pied = baseY - relief(m.x);
        var brule = 0.18 + 0.62 * (m.cout / coutMax);   // part consumée
        allumette(x, pied, largeur, hauteur, brule);
      });
    }

    // ligne de sol
    H.rule(g.left, baseY, g.right, { color: hair });

    /* ---------- pied ---------- */
    var footY = g.bottom;
    H.rule(g.left, footY - u(9), g.right, { color: hair });
    var cols = [
      ['distance', H.fmt.km(a.distance_km, 1) + ' km'],
      ['en mouvement', H.fmt.duration(a.duration_s)],
      [feu.source === 'puissance' ? 'coût total' : 'd+',
        feu.source === 'puissance' ? Math.round(feu.total || 0) + ' kJ'
                                   : H.fmt.int(a.elev_gain_m) + ' m']
    ];
    var colW = g.width / cols.length;
    cols.forEach(function (c, i) {
      H.field(c[0], c[1], g.left + i * colW, footY - u(5.4), {
        color: ink, labelColor: faint, size: 4.2, maxWidth: colW - u(2)
      });
    });

    /* ================= le dessin d'une allumette ================= */
    function allumette(x, pied, larg, haut, part) {
      var sommet = pied - haut;
      var teteH = haut * 0.13;
      var bruleH = Math.min(haut * 0.9, haut * part);

      ctx.save();

      // le bâtonnet, du pied vers le haut
      ctx.fillStyle = o.bois;
      H.roundRect(x - larg / 2, sommet, larg, haut, larg * 0.45);
      ctx.fill();

      // la part consumée, depuis la tête vers le bas
      ctx.fillStyle = melange('#000000', 0.82);
      H.roundRect(x - larg / 2, sommet, larg, bruleH, larg * 0.45);
      ctx.fill();

      // la tête : braise si à peine entamée, cendre si consumée
      var vive = part < 0.45;
      ctx.fillStyle = vive ? o.braise : melange('#000000', 0.9);
      H.roundRect(x - larg * 0.85, sommet - teteH * 0.35, larg * 1.7, teteH * 1.7, larg * 0.85);
      ctx.fill();

      // un point de braise sur les allumettes encore chaudes
      if (vive) {
        ctx.fillStyle = melange(o.braise, 0.55);
        ctx.beginPath();
        ctx.arc(x, sommet + teteH * 0.5, larg * 0.42, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    /* '#F4EFE6' + 0.5 -> 'rgba(244,239,230,.5)' */
    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
