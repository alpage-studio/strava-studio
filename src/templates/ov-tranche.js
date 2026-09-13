/* 1f · Tranche — colonne verticale sur le bord droit.
 * Le cadre reste entièrement ouvert. Le plus éditorial des six.
 */
Studio.template({
  id: 'ov-tranche',
  name: '1f · Tranche',
  transparent: true,

  options: [Overlay.OPT_THIRD, Overlay.OPT_SCRIM],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);

    if (o.voile) {
      H.scrim('left', [
        [0, 'rgba(0,0,0,.5)'], [0.22, 'rgba(0,0,0,.12)'], [0.38, 'rgba(0,0,0,0)']
      ]);
    }

    /* filet vertical */
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.fillRect(w - px(154), py(180), px(1.5), h - py(360));
    ctx.restore();

    /* colonne verticale : les colonnes se succèdent de droite à gauche */
    H.vcolumn([
      { text: f.name, size: px(44), tracking: -px(44) * 0.01, color: '#fff' },
      { text: (f.time + ' · ' + f.ascentUpper + ' · ' + f.third.value).toUpperCase(),
        size: px(22), font: H.MONO, tracking: px(22) * 0.24, color: 'rgba(255,255,255,.7)' }
    ], w - px(96), py(180), px(30));

    /* petite marque de trace, en bas à gauche */
    H.route(a.route, { x: px(96), y: h - py(180) - px(300), w: px(300), h: px(300) }, {
      color: '#fff',
      width: px(1.5)
    });
  }
});
