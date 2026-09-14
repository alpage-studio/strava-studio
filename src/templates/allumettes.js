/* « Allumettes » — les efforts durs, et où ils ont brûlé.
 *
 * Compter les efforts serait un chiffre de plus. Ce qui rend la planche
 * unique, c'est qu'elle les POSE sur le profil, à l'endroit de la sortie où
 * ils ont eu lieu : on voit que tout est parti en grappes sur les bosses, et
 * qu'il n'y a rien dans la descente.
 *
 * Parti pris graphique : le filet, pas l'illustration. Une allumette est un
 * trait d'un demi-millimètre, consumé depuis la tête en proportion de son
 * coût. Pas de bois doré, pas de flamme — le studio parle en filets et en
 * une seule couleur d'accent, et cette planche parle la même langue.
 * L'accent ne sert qu'une fois : sur l'effort le plus cher de la sortie.
 */
Studio.template({
  id: 'allumettes',
  name: 'Allumettes',

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#0E0E10' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E5502D' },
    { key: 'seuil', type: 'range', label: 'Seuil (% FTP)', default: 105, min: 90, max: 130 },
    { key: 'duree', type: 'range', label: 'Durée min. (s)', default: 20, min: 10, max: 90 },
    { key: 'profil', type: 'toggle', label: 'Poser sur le profil', default: true }
  ],

  /* Le seuil ne s'applique qu'à une sortie dont on connaît le FTP : sans
   * lui, la détection se cale sur un percentile, et en mode cardiaque sur
   * la fréquence maximale observée. Le curseur est alors décoratif. */
  inert: function (a) {
    var feu = a.burned ? a.burned({}) : null;
    return (feu && feu.source === 'puissance' && !feu.estime) ? [] : ['seuil'];
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre;
    var faint = melange(ink, 0.45);
    var hair = melange(ink, 0.16);

    H.fill(o.fond);

    var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
    var CH = g.height;

    var feu = a.burned ? a.burned({ pct: o.seuil / 100, minSec: o.duree }) : { list: [] };
    var n = feu.list.length;

    /* ---------- en-tête ---------- */
    H.text(a.name, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));

    /* ---------- le compte ---------- */
    var y = g.top + CH * 0.14;
    H.text('allumettes brûlées', g.left, y, H.t('label', { color: faint }));
    var heroStyle = H.t('hero', { size: 16, color: ink });
    var heroBase = y + heroStyle.size * 0.95;
    H.text(String(n), g.left, heroBase, heroStyle);

    /* D'où vient le compte : sans capteur ce n'est pas la même grandeur,
     * et une planche qui le tait ment. */
    var legende = feu.source === 'puissance'
      ? 'au-dessus de ' + feu.seuil + ' W' + (feu.estime ? ' — seuil estimé' : ' · ' + o.seuil + ' % FTP')
      : feu.source === 'cardiaque'
        ? 'au-dessus de ' + feu.seuil + ' bpm — sans capteur de puissance'
        : 'aucune donnée d’effort sur cette sortie';
    H.text(legende, g.left, heroBase + u(4.4), H.t('label', { color: faint }));

    /* ---------- la zone des allumettes ---------- */
    var box = { x: g.left, y: g.top + CH * 0.38, w: g.width, h: CH * 0.42 };
    var sol = box.y + box.h;
    var relH = box.h * 0.46;   // amplitude laissée au relief

    /* Le profil en LIGNE, pas en masse : il situe sans peser. */
    var prof = a.profile;
    if (o.profil && prof && prof.length > 1) {
      ctx.save();
      ctx.beginPath();
      prof.forEach(function (p, i) {
        var px = box.x + p.x * box.w, py = sol - p.y * relH;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      });
      ctx.strokeStyle = melange(ink, 0.20);
      ctx.lineWidth = u(0.1);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    /* Altitude sous une abscisse donnée.
     *
     * La silhouette est tracée avec la distance normalisée de chaque point
     * (p.x), mais on cherchait la hauteur par INDICE — x × nombre de points.
     * Les deux axes ne coïncident que si l'échantillonnage est parfaitement
     * régulier ; dès qu'on ralentit en montée, ils divergent, et les
     * allumettes flottent au-dessus du relief.
     *
     * On encadre donc la distance par ses deux points voisins et on
     * interpole, comme le trait lui-même. */
    function relief(x) {
      if (!o.profil || !prof || prof.length < 2) return 0;
      if (x <= prof[0].x) return prof[0].y * relH;
      var fin = prof[prof.length - 1];
      if (x >= fin.x) return fin.y * relH;

      var lo = 0, hi = prof.length - 1;
      while (hi - lo > 1) {                     // recherche dichotomique
        var mid = (lo + hi) >> 1;
        if (prof[mid].x <= x) lo = mid; else hi = mid;
      }
      var a0 = prof[lo], b0 = prof[hi];
      var ecart = b0.x - a0.x;
      var k = ecart > 0 ? (x - a0.x) / ecart : 0;
      return (a0.y + (b0.y - a0.y) * k) * relH;
    }

    if (n) {
      var couts = feu.list.map(function (m) { return m.cout; });
      var coutMax = Math.max.apply(null, couts) || 1;
      var plusCher = couts.indexOf(coutMax);

      var larg = u(0.34);                 // fin, mais plus présent que le décor
      var haut = box.h * 0.40;

      feu.list.forEach(function (m, i) {
        allumette(
          box.x + m.x * box.w,
          sol - relief(m.x),
          larg, haut,
          0.15 + 0.70 * (m.cout / coutMax),
          i === plusCher
        );
      });

      /* L'unique annotation : le plus gros effort, nommé. */
      var mx = feu.list[plusCher];
      var ax = box.x + mx.x * box.w;
      var valeur = feu.source === 'puissance'
        ? mx.moyenne + ' W pendant ' + H.fmt.duration(mx.duree)
        : 'effort de ' + H.fmt.duration(mx.duree);
      H.text(valeur,
        Math.max(box.x + u(9), Math.min(box.x + box.w - u(9), ax)),
        sol - relief(mx.x) - haut - u(3.4),
        H.t('label', { color: o.accent, align: 'center' }));
    }

    H.rule(g.left, sol, g.right, { color: hair });

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

    /* ================= une allumette ================= */
    /* Un trait fin. La part consumée part de la TÊTE et descend : c'est le
     * sens dans lequel une allumette brûle, et c'est ce qui rend la lecture
     * immédiate sans légende. */
    function allumette(x, pied, larg, haut, part, vedette) {
      var sommet = pied - haut;
      var brule = haut * Math.min(0.88, part);
      var teteR = larg * 1.45;

      ctx.save();
      ctx.lineCap = 'butt';
      ctx.lineWidth = larg;

      // la partie intacte
      ctx.strokeStyle = melange(ink, 0.32);
      ctx.beginPath();
      ctx.moveTo(x, pied);
      ctx.lineTo(x, sommet + brule);
      ctx.stroke();

      // la partie consumée
      ctx.strokeStyle = vedette ? o.accent : ink;
      ctx.beginPath();
      ctx.moveTo(x, sommet + brule);
      ctx.lineTo(x, sommet + teteR);
      ctx.stroke();

      // la tête
      ctx.fillStyle = vedette ? o.accent : ink;
      ctx.beginPath();
      ctx.arc(x, sommet + teteR * 0.9, teteR, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
