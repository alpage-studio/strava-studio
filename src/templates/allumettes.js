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

    /* ---------- la zone des allumettes ----------
     * Elles reposent toutes sur UNE MÊME LIGNE, et non sur le relief.
     * Plantées sur le terrain, chacune démarrait à une hauteur différente :
     * on voyait où elles avaient brûlé, mais on ne pouvait plus comparer
     * leur coût d'un coup d'œil — ce qui est pourtant le sujet. Le relief
     * passe derrière, en masse discrète : il situe sans fausser la lecture.
     * La position horizontale dit toujours « où ». */
    var box = { x: g.left, y: g.top + CH * 0.30, w: g.width, h: CH * 0.50 };
    var sol = box.y + box.h;

    var prof = a.profile;
    if (o.profil && prof && prof.length > 1) {
      var relH = box.h * 0.52;
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(box.x, sol);
      prof.forEach(function (p) {
        ctx.lineTo(box.x + p.x * box.w, sol - p.y * relH);
      });
      ctx.lineTo(box.x + box.w, sol);
      ctx.closePath();
      ctx.fillStyle = melange(ink, 0.10);
      ctx.fill();
      ctx.restore();
    }

    if (n) {
      var couts = feu.list.map(function (m) { return m.cout; });
      var coutMax = Math.max.apply(null, couts) || 1;
      var plusCher = couts.indexOf(coutMax);

      var larg = u(0.66);           // assez large pour lire une tête
      var haut = box.h * 0.60;     // courte : une allumette n'est pas une aiguille

      /* Deux efforts rapprochés donnaient deux traits superposés, illisibles.
       * On impose un écart minimal en décalant vers la droite de proche en
       * proche : l'ordre et la zone restent justes, la grappe se lit. */
      var ecartMin = larg * 2.6;
      var xs = [], dernier = -Infinity;
      feu.list.forEach(function (m) {
        var x = Math.max(box.x + larg, box.x + m.x * box.w);
        if (x - dernier < ecartMin) x = dernier + ecartMin;
        x = Math.min(x, box.x + box.w - larg);
        xs.push(x);
        dernier = x;
      });

      feu.list.forEach(function (m, i) {
        allumette(xs[i], sol, larg, haut, m.cout / coutMax, i === plusCher);
      });

      /* Une seule annotation, reliée à son allumette par un trait : sans le
       * trait, elle flotte et on ne sait pas de laquelle elle parle. */
      var mx = feu.list[plusCher], ax = xs[plusCher];
      var sommet = sol - haut;
      var yTexte = sommet - u(5.2);
      ctx.save();
      ctx.strokeStyle = melange(o.accent, 0.55);
      ctx.lineWidth = u(0.1);
      ctx.beginPath();
      ctx.moveTo(ax, sommet - u(1.4));
      ctx.lineTo(ax, yTexte + u(1.1));
      ctx.stroke();
      ctx.restore();

      var valeur = feu.source === 'puissance'
        ? mx.moyenne + ' W pendant ' + H.fmt.duration(mx.duree)
        : 'effort de ' + H.fmt.duration(mx.duree);
      var alignement = ax > box.x + box.w * 0.82 ? 'right'
                     : ax < box.x + box.w * 0.18 ? 'left' : 'center';
      H.text(valeur, ax, yTexte, H.t('label', { color: o.accent, align: alignement }));
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

    /* ================= une allumette =================
     * Longueur totale constante, part consumée proportionnelle au coût :
     * une relance noircit la tête, un col brûle jusqu'aux doigts. La
     * comparaison se fait donc sur une seule variable, sur une seule
     * ligne de base. */
    function allumette(x, pied, larg, haut, part, vedette) {
      var sommet = pied - haut;
      var brule = haut * (0.12 + 0.76 * part);
      var teteH = larg * 2.1;

      ctx.save();

      // le bois restant
      ctx.fillStyle = melange(ink, 0.16);
      H.roundRect(x - larg / 2, sommet, larg, haut, larg * 0.5);
      ctx.fill();

      // la part consumée, depuis la tête vers le bas
      ctx.fillStyle = vedette ? o.accent : ink;
      H.roundRect(x - larg / 2, sommet, larg, brule, larg * 0.5);
      ctx.fill();

      // la tête : un peu plus large que le bâtonnet, c'est elle qui dit
      // « allumette » plutôt que « barre »
      ctx.fillStyle = vedette ? o.accent : ink;
      H.roundRect(x - larg * 0.95, sommet - teteH * 0.22, larg * 1.9, teteH, larg * 0.95);
      ctx.fill();

      ctx.restore();
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
