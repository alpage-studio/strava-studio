/* 1f · Tranche — colonne verticale sur le bord droit.
 * Le cadre reste entièrement ouvert. Le plus éditorial des six.
 */
Studio.template({
  id: 'ov-tranche',
  name: '1f · Tranche',
  transparent: true,

  options: [Overlay.OPT_INK, Overlay.OPT_THIRD, Overlay.OPT_SCRIM],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);
      var P = Overlay.palette(o);

    if (o.voile) {
      H.scrim('left', P.scrim([
        [0, .5], [0.22, .12], [0.38, 0]
      ]));
    }

    /* filet vertical */
    ctx.save();
    ctx.fillStyle = P.a(.28);
    ctx.fillRect(w - px(154), py(180), px(1.5), h - py(360));
    ctx.restore();

    /* colonne verticale : les colonnes se succèdent de droite à gauche */
    H.vcolumn([
      { text: f.name, size: px(44), tracking: -px(44) * 0.01, color: P.ink },
      { text: f.trio(' · '),
        size: px(22), font: H.MONO, tracking: px(22) * 0.24, color: P.a(.7) }
    ], w - px(96), py(180), px(30));

    /* petite marque de trace, en bas à gauche */
    H.route(a.route, { x: px(96), y: h - py(180) - px(300), w: px(300), h: px(300) }, {
      color: P.ink,
      width: px(1.5)
    });
  }
});
