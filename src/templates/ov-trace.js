/* 1c · Trace — la forme du parcours comme sujet.
 * Le voile est radial : il creuse le centre sans poser de panneau.
 */
Studio.template({
  id: 'ov-trace',
  name: '1c · Trace',
  transparent: true,

  options: [Overlay.OPT_INK, Overlay.OPT_THIRD, Overlay.OPT_SCRIM],

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);
      var P = Overlay.palette(o);

    if (o.voile) {
      H.scrimRadial(1.20, 0.70, 0.50, 0.42, P.scrim([
        [0, .42], [0.72, 0]
      ]));
    }

    /* trace : carré de 760, à 160 du bord gauche, 420 du haut */
    H.route(a.route, { x: px(160), y: py(420), w: px(760), h: py(760) }, {
      color: P.ink,
      width: px(2.5)
    });

    /* légende centrée */
    var cx = w / 2;
    var nSize = px(46), dSize = px(22);
    var top = py(1268);

    H.text(f.name, cx, H.bl(top, nSize), {
      size: nSize, font: H.SANS, weight: 400, tracking: -nSize * 0.02,
      color: P.ink, align: 'center', maxWidth: w - px(160)
    });

    var dTop = top + H.lh(nSize) + px(22);
    H.text(f.trio('   '),
      cx, H.bl(dTop, dSize), {
        size: dSize, font: H.MONO, weight: 400, tracking: dSize * 0.22,
        color: P.a(.7), align: 'center', maxWidth: w - px(160)
      });
  }
});
