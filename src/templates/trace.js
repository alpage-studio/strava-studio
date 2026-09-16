/* Template « Trace » — photo plein cadre, tracé GPS, stats en pied.
 * Sert d'exemple de référence : tout ce qu'un template peut faire est ici.
 */
Studio.template({
  id: 'trace',
  name: 'Trace',

  // Ces options deviennent automatiquement des contrôles dans le panneau.
  options: [
    { key: 'accent', type: 'color', label: 'Accent', default: '#E8FF54' },
    { key: 'fond', type: 'select', label: 'Fond', default: 'photo',
      choices: [['photo', 'Photo'], ['sombre', 'Aplat sombre'], ['degrade', 'Dégradé']] },
    { key: 'voile', type: 'range', label: 'Voile', default: 55, min: 0, max: 95 },
    { key: 'titre', type: 'toggle', label: 'Titre de la sortie', default: true },
    { key: 'profil', type: 'toggle', label: 'Profil d’altitude', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;

    /* --- fond --- */
    if (H.surcouche()) {
      /* surcouche : aucun fond, c'est la photo du montage qui le fournit */
    } else if (o.fond === 'photo' && H.photo()) {
      ctx.save();
      ctx.fillStyle = 'rgba(8,10,14,' + (o.voile / 100) + ')';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    } else if (o.fond === 'degrade') {
      ctx.fillStyle = H.gradient([[0, '#151A24'], [1, '#05070B']]);
      ctx.fillRect(0, 0, w, h);
    } else {
      H.fill('#0B0E14');
    }

    /* --- en-tête --- */
    var m = u(8); // marge
    if (o.titre) {
      H.text(a.name, m, m + u(4), { size: u(4.4), weight: 700 });
    }

    /* --- tracé GPS --- */
    H.route(a.route, { x: m, y: h * 0.20, w: w - 2 * m, h: h * 0.42 }, {
      color: o.accent,
      width: u(1.1),
      glow: 'rgba(0,0,0,.55)',
      dots: u(1.2),
      startColor: '#fff',
      endColor: o.accent,
      pad: u(2)
    });

    /* --- profil d'altitude --- */
    if (o.profil && a.profile.length) {
      H.profile(a.profile, { x: m, y: h * 0.655, w: w - 2 * m, h: u(9) }, {
        fill: 'rgba(255,255,255,.14)',
        stroke: 'rgba(255,255,255,.45)',
        width: u(0.3)
      });
    }

    /* --- stats --- */
    var base = h - m - u(2);
    // L'unité descend dans la légende : les valeurs restent courtes et
    // les trois colonnes ne se marchent jamais dessus.
    var cols = [
      [H.fmt.km(a.distance_km), 'kilomètres'],
      [H.fmt.duration(a.duration_s), 'en mouvement'],
      [H.fmt.int(a.elev_gain_m), 'mètres D+']
    ];
    var colW = (w - 2 * m) / cols.length;
    cols.forEach(function (c, i) {
      H.stat(c[0], c[1], m + i * colW, base - u(4), {
        valueSize: u(5.8),
        gap: u(3.2),
        labelSize: u(2),
        labelTracking: u(0.18),
        labelColor: 'rgba(255,255,255,.55)'
      });
    });

    /* --- allure, collée en haut du bloc stats --- */
    var allure = a.speed_kmh ? H.fmt.speed(a.speed_kmh) + ' km/h' : '';
    if (allure) {
      H.text(allure, w - m, base - u(14), {
        size: u(3.2), weight: 700, color: o.accent, align: 'right', tracking: u(0.2)
      });
    }

    /* --- filet --- */
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = u(0.15);
    ctx.beginPath();
    ctx.moveTo(m, base - u(11));
    ctx.lineTo(w - m, base - u(11));
    ctx.stroke();
    ctx.restore();
  }
});
