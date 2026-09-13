/* Template « Chiffres » — typographique, sans trace. Un seul chiffre domine,
 * le reste se lit en colonne. Montre qu'un template n'est pas obligé
 * d'afficher une carte pour raconter la sortie.
 */
Studio.template({
  id: 'chiffres',
  name: 'Chiffres',

  options: [
    { key: 'encre', type: 'color', label: 'Encre', default: '#0F1115' },
    { key: 'papier', type: 'color', label: 'Papier', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E73635' },
    { key: 'heros', type: 'select', label: 'Chiffre héros', default: 'distance',
      choices: [['distance', 'Distance'], ['duree', 'Temps'], ['deniv', 'Dénivelé']] },
    { key: 'splits', type: 'toggle', label: 'Barres des kilomètres', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var m = u(9);

    H.fill(o.papier);

    /* --- bandeau de tête --- */
    H.text(String(a.name).toUpperCase(), m, m + u(3), {
      size: u(2.6), weight: 700, color: o.encre, tracking: u(0.35)
    });

    /* --- le héros --- */
    var hero = { v: H.fmt.km(a.distance_km, 1), l: 'kilomètres' };
    if (o.heros === 'duree') hero = { v: H.fmt.duration(a.duration_s), l: 'de mouvement' };
    if (o.heros === 'deniv') hero = { v: H.fmt.int(a.elev_gain_m), l: 'mètres de dénivelé' };

    var heroY = h * 0.42;
    H.text(hero.v, m, heroY, { size: u(22), weight: 800, color: o.encre });
    H.text(hero.l.toUpperCase(), m, heroY + u(5), {
      size: u(2.6), weight: 700, color: o.accent, tracking: u(0.4)
    });

    /* --- colonne de stats secondaires --- */
    var rows = [
      ['Temps', H.fmt.duration(a.duration_s)],
      ['Vitesse', H.fmt.speed(a.speed_kmh) + ' km/h'],
      ['D+', a.elev_gain_m != null ? a.elev_gain_m + ' m' : '—']
    ];
    if (a.hr_avg) rows.push(['FC moy.', a.hr_avg + ' bpm']);
    if (o.heros === 'distance') rows.shift(); // pas deux fois la même valeur

    var y = heroY + u(14);
    rows.forEach(function (r) {
      ctx.save();
      ctx.strokeStyle = o.encre + '22';
      ctx.lineWidth = u(0.12);
      ctx.beginPath(); ctx.moveTo(m, y - u(3.6)); ctx.lineTo(w - m, y - u(3.6)); ctx.stroke();
      ctx.restore();
      H.text(r[0].toUpperCase(), m, y, { size: u(2.4), weight: 600, color: o.encre + 'A0', tracking: u(0.25) });
      H.text(r[1], w - m, y, { size: u(3.6), weight: 700, color: o.encre, align: 'right' });
      y += u(8);
    });

    /* --- barres des kilomètres --- */
    if (o.splits && a.splits.length > 1) {
      var paces = a.splits.map(function (sp) { return sp.pace_s; }).filter(function (p) { return p; });
      if (paces.length) {
        var fast = Math.min.apply(null, paces), slow = Math.max.apply(null, paces);
        var span = (slow - fast) || 1;
        var bw = (w - 2 * m) / a.splits.length;
        var floor = h - m, maxH = u(16);
        a.splits.forEach(function (sp, i) {
          if (!sp.pace_s) return;
          // le km le plus rapide = la barre la plus haute
          var k = 1 - (sp.pace_s - fast) / span;
          var bh = u(2) + k * maxH;
          ctx.fillStyle = (sp.pace_s === fast) ? o.accent : o.encre + '33';
          H.roundRect(m + i * bw + bw * 0.15, floor - bh, bw * 0.7, bh, u(0.4));
          ctx.fill();
        });
      }
    }
  }
});
