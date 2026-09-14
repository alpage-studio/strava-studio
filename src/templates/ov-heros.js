/* 1e · Héros — un seul nombre à l'échelle de l'affiche.
 * À utiliser quand une statistique porte toute l'histoire.
 */
Studio.template({
  id: 'ov-heros',
  name: '1e · Héros',
  transparent: true,

  options: [
    { key: 'heros', type: 'select', label: 'Chiffre héros', default: 'deniv',
      choices: [['deniv', 'Dénivelé'], ['distance', 'Distance'], ['temps', 'Temps']] },
    Overlay.OPT_INK,
    Overlay.OPT_THIRD,
    Overlay.OPT_SCRIM
  ],

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
    var px = H.px, py = H.py;
    var f = Overlay.fields(a, o, H);
      var P = Overlay.palette(o);

    if (o.voile) {
      H.scrim('top', P.scrim([
        [0, .6], [0.34, .2], [0.60, 0]
      ]));
    }

    var hero = { v: H.fmt.int(a.elev_gain_m), u: 'mètres de dénivelé' };
    if (o.heros === 'distance') hero = { v: H.fmt.km(a.distance_km, 1), u: 'kilomètres parcourus' };
    if (o.heros === 'temps') hero = { v: H.fmt.duration(a.duration_s), u: 'de mouvement' };

    var left = px(84);
    var containerBottom = h - py(300);

    /* ligne d'unité, collée au bas du bloc */
    var uSize = px(26);
    var uTop = containerBottom - H.lh(uSize);
    H.text(hero.u, left, H.bl(uTop, uSize), {
      size: uSize, font: H.MONO, weight: 400, tracking: uSize * 0.28,
      color: P.a(.72), upper: true
    });

    /* le nombre : 300 px suppose 4 glyphes, il rétrécit au-delà */
    var hSize = px(300);
    H.text(hero.v, left, uTop - px(26) + px(3), {
      size: hSize, font: H.SANS, weight: 400, tracking: -hSize * 0.05,
      color: P.ink, maxWidth: w - px(168)
    });

    /* pied : nom à gauche, deux valeurs à droite */
    var fSize = px(21);
    var fBase = (h - py(140)) - fSize * 0.26;
    var foot = { size: fSize, font: H.MONO, weight: 400, tracking: fSize * 0.12,
                 color: P.a(.78), upper: true };
    H.text(f.name, left, fBase, foot);
    H.text([f.time, f.thirdUpper].filter(function (v) { return v; }).join(' · '), w - px(84), fBase,
      Object.assign({}, foot, { align: 'right' }));
  }
});
