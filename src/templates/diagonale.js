/* « Diagonale » — le parcours en haut à gauche, le nombre en bas à droite.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE A EN PROPRE : le VIDE. Les deux tiers de la feuille ne portent
 * rien, et le regard traverse en diagonale. Toutes les autres planches de la
 * famille remplissent — c'est la seule qui fasse de la réserve son sujet.
 * Elle demande un parcours lisible en petit : une boucle s'y tient, un
 * aller-retour droit y paraît maigre.
 */
Studio.template({
  id: 'diagonale',
  name: 'Diagonale — la réserve comme sujet',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'mesure', type: 'select', label: 'Le grand nombre', default: 'distance',
      choices: [['distance', 'Distance'], ['deniv', 'Dénivelé'], ['duree', 'Temps']] },
    { key: 'fond', type: 'select', label: 'Fond', default: 'papier',
      choices: [['papier', 'Papier'], ['sombre', 'Sombre'], ['transparent', 'Transparent']] },
    { key: 'profil', type: 'toggle', label: 'Profil en pied', default: true },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var dit = Alpage.dit(o);
    var sombre = o.fond === 'sombre';
    var encre = sombre ? '#F4F2EC' : '#1A1A17';
    if (o.fond === 'papier') H.fill('#F4F2EC');
    else if (sombre) H.fill('#141414');

    var g = H.grid({ cols: 6, margin: u(9) });

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top + u(3), H.t('title', { size: 3.4, color: encre, maxWidth: g.w(4) }));
    }

    /* Le parcours occupe le quadrant HAUT GAUCHE, et rien ne vient le
     * contredire à droite : c'est ce vide qui fait la diagonale. */
    if (a.route && a.route.pts && a.route.pts.length) {
      H.route(a.route, { x: g.left, y: g.top + u(8), w: g.width * 0.52, h: g.height * 0.34 }, {
        color: encre, width: u(0.8), pad: u(1.5)
      });
    }

    if (dit.mesures) {
      var m = o.mesure === 'deniv'
        ? { v: H.fmt.int(a.elev_gain_m), u: H.mot('m D+') }
        : o.mesure === 'duree'
          ? { v: H.fmt.duration(a.duration_s), u: '' }
          : { v: H.fmt.km(a.distance_km, 2), u: H.mot('KM') };

      /* Le nombre est calé à DROITE et bas : l'autre bout de la diagonale. */
      var base = g.bottom - (o.profil ? u(16) : u(6));
      var st = H.t('hero', { size: 13, color: encre, align: 'right' });
      H.text(m.v, g.right, base, st);
      if (m.u) {
        H.text(m.u, g.right, base + u(4.2),
               H.t('label', { color: Alpage.melange(encre, 0.6), align: 'right' }));
      }

      var cotes = [
        [H.mot('en mouvement'), H.fmt.duration(a.duration_s)],
        [H.mot('dénivelé'), a.elev_gain_m != null ? H.fmt.int(a.elev_gain_m) + ' m' : '—']
      ];
      cotes.forEach(function (c, i) {
        H.text(c[0] + '  ' + c[1], g.right, g.top + u(9) + i * u(4),
               H.t('label', { color: Alpage.melange(encre, 0.55), align: 'right' }));
      });
    }

    if (o.profil && (a.profile || []).length > 3) {
      H.profile(a.profile, { x: g.left, y: g.bottom - u(9), w: g.width, h: u(7) }, {
        fill: Alpage.melange(encre, 0.12), stroke: Alpage.melange(encre, 0.5), width: u(0.25)
      });
    }
  }
});
