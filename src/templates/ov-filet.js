/* 1a · Filet — surcouche transparente, la valeur sûre.
 * Cotes du handoff, espace d'export 1080 × 1920.
 */
Studio.template({
  id: 'ov-filet',
  name: '1a · Filet',
  transparent: true,

  options: [Overlay.OPT_THIRD, Overlay.OPT_SCRIM],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);

    if (o.voile) {
      H.scrim('top', [
        [0, 'rgba(0,0,0,.55)'], [0.26, 'rgba(0,0,0,.18)'], [0.46, 'rgba(0,0,0,0)']
      ]);
    }

    var left = px(80), right = w - px(80);
    var blockBottom = h - py(132);

    /* Le bloc se pose du bas vers le haut : la rangée de statistiques est
     * ancrée au bas, le reste remonte. */
    var vSize = px(44), lSize = px(20);
    var vTop = blockBottom - H.lh(vSize);
    var lTop = vTop - px(12) - H.lh(lSize);

    var label = { size: lSize, font: H.MONO, weight: 400, tracking: lSize * 0.2, color: 'rgba(255,255,255,.62)', upper: true };
    var value = { size: vSize, font: H.SANS, weight: 400, tracking: -vSize * 0.01, color: '#fff' };

    var cols = [
      ['temps', f.time],
      ['d+', f.ascent],
      [f.third.label, f.third.value]
    ];

    // space-between : on mesure chaque colonne, l'espace restant se partage
    var widths = cols.map(function (c) {
      return Math.max(
        H.measure(String(c[0]).toUpperCase(), label),
        H.measure(c[1], value)
      );
    });
    var sum = widths.reduce(function (x, y) { return x + y; }, 0);
    var gap = (right - left - sum) / (cols.length - 1);

    var x = left;
    cols.forEach(function (c, i) {
      H.text(c[0], x, H.bl(lTop, lSize), label);
      H.text(c[1], x, H.bl(vTop, vSize), value);
      x += widths[i] + gap;
    });

    /* filet */
    var hairY = lTop - px(30) - px(1.5);
    H.hair(left, hairY, right, 'rgba(255,255,255,.3)');

    /* nom de la sortie */
    var nSize = px(52);
    var nameBottom = hairY - px(34);
    H.text(f.name, left, H.bl(nameBottom - H.lh(nSize), nSize), {
      size: nSize, font: H.SANS, weight: 400, tracking: -nSize * 0.02,
      color: '#fff', maxWidth: right - left
    });
  }
});
