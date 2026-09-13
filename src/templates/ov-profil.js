/* 1b · Profil — le profil d'altitude EST le graphique.
 * Le plus fort sur une sortie de montagne.
 */
Studio.template({
  id: 'ov-profil',
  name: '1b · Profil',
  transparent: true,

  options: [Overlay.OPT_THIRD, Overlay.OPT_SCRIM],

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);

    if (o.voile) {
      H.scrim('top', [
        [0, 'rgba(0,0,0,.58)'], [0.30, 'rgba(0,0,0,.2)'], [0.52, 'rgba(0,0,0,0)']
      ]);
    }

    /* profil : pleine largeur, 300 de haut, posé à 300 du bas */
    H.elevation(a.profile, {
      x: 0, y: h - py(600), w: w, h: py(300)
    }, {
      fill: 'rgba(255,255,255,.13)',
      stroke: '#fff',
      width: px(2),
      pad: py(30)
    });

    /* légende : nom à gauche, ligne de données à droite, même ligne de base */
    var left = px(80), right = w - px(80);
    var nSize = px(38), dSize = px(24);
    var base = (h - py(150)) - nSize * 0.26;

    H.text(f.name, left, base, {
      size: nSize, font: H.SANS, weight: 400, tracking: -nSize * 0.01,
      color: '#fff', maxWidth: (right - left) * 0.45
    });

    H.text(f.line, right, base, {
      size: dSize, font: H.MONO, weight: 400, tracking: dSize * 0.12,
      color: 'rgba(255,255,255,.85)', align: 'right', maxWidth: (right - left) * 0.55
    });
  }
});
