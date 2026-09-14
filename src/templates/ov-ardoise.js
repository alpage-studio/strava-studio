/* 1d · Ardoise — index de claquette ancré en haut.
 * Les deux tiers bas de la photo restent nets.
 */
Studio.template({
  id: 'ov-ardoise',
  name: '1d · Ardoise',
  transparent: true,

  options: [Overlay.OPT_INK, Overlay.OPT_THIRD, Overlay.OPT_SCRIM],

  draw: function (s) {
    var a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);
      var P = Overlay.palette(o);

    if (o.voile) {
      H.scrim('bottom', P.scrim([
        [0, .5], [0.24, .14], [0.40, 0]
      ]));
    }

    var left = px(96), right = left + px(520);
    var y = py(120);

    /* nom + date */
    var nSize = px(40), dSize = px(20);
    H.text(f.name, left, H.bl(y, nSize), {
      size: nSize, font: H.SANS, weight: 400, tracking: -nSize * 0.01,
      color: P.ink, maxWidth: right - left
    });
    y += H.lh(nSize) + px(36);

    /* premier filet, puis trois lignes séparées de filets plus discrets */
    H.hair(left, y, right, P.a(.26));
    y += px(1.5);

    var lSize = px(20), vSize = px(34);
    var rows = [
      ['en mouvement', f.time],
      ['d+', f.ascent],
      [f.third && f.third.label, f.third && f.third.value]
    ].filter(function (c) { return c[1] != null; });

    rows.forEach(function (r, i) {
      var rowTop = y + px(26);
      var base = H.bl(rowTop, vSize);
      H.text(r[0], left, base, {
        size: lSize, font: H.MONO, weight: 400, tracking: lSize * 0.2,
        color: P.a(.6), upper: true
      });
      H.text(r[1], right, base, {
        size: vSize, font: H.SANS, weight: 400, color: P.ink, align: 'right'
      });
      y = rowTop + H.lh(vSize) + px(26);
      if (i < rows.length - 1) {
        H.hair(left, y, right, P.a(.16));
        y += px(1.5);
      }
    });
  }
});
