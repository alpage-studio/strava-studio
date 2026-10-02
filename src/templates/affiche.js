/* « Affiche » — le nom d'abord, le chiffre ensuite, la trace en filigrane.
 *
 * D'APRÈS UNE MAQUETTE, PAS UNE INVENTION. Cette planche vient d'une étude de
 * mise en page qui dormait dans `design/` — un dossier que git ignore, donc
 * jamais publiée, jamais vue par personne. Elle est reprise ici telle qu'elle
 * était pensée : un titre qui occupe le tiers haut, un grand nombre calé en
 * bas, et le parcours en retrait derrière les deux.
 *
 * CE QUI LA DISTINGUE DES AUTRES. « Éditorial » met le chiffre en premier et
 * le nom en petit ; ici c'est l'inverse, et c'est tout le sujet : une affiche
 * de sortie NOMMÉE, où le lieu compte plus que la performance. Le parcours ne
 * sert pas à lire un itinéraire — il est posé en filigrane, à douze pour cent
 * d'encre, comme une texture.
 */
Studio.template({
  id: 'affiche',
  name: 'Affiche — le nom, puis le nombre',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'mesure', type: 'select', label: 'Le grand nombre', default: 'distance',
      choices: [['distance', 'Distance'], ['deniv', 'Dénivelé'], ['duree', 'Temps']] },
    { key: 'fond', type: 'select', label: 'Fond', default: 'sombre',
      choices: [['sombre', 'Sombre'], ['papier', 'Papier'], ['transparent', 'Transparent']] },
    { key: 'filigrane', type: 'range', label: 'Trace en filigrane', default: 12, min: 0, max: 40 },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var dit = Alpage.dit(o);
    var sombre = o.fond === 'sombre';
    var encre = sombre ? '#F4F2EC' : '#1A1A17';

    if (o.fond === 'papier') H.fill('#F4F2EC');
    else if (sombre) H.fill('#141414');

    var g = H.grid({ cols: 6, margin: u(8) });

    /* Le parcours EN PREMIER : tout le reste se pose dessus. Il ne porte
     * aucune information de position lisible à cette opacité — c'est une
     * texture, et la planche ne prétend pas le contraire. */
    if (o.filigrane > 0 && a.route && a.route.pts && a.route.pts.length) {
      H.route(a.route, { x: g.left, y: g.top + g.height * 0.22, w: g.width, h: g.height * 0.6 }, {
        color: Alpage.melange(encre, o.filigrane / 100),
        width: u(0.9), pad: u(2)
      });
    }

    if (dit.titre) {
      var titre = String(o.titre || '').trim() || a.name || H.mot('Sortie');
      H.text(titre, g.left, g.top + u(5), H.t('title', {
        size: 9, color: encre, maxWidth: g.w(5)
      }));
    }

    if (dit.mesures) {
      var m = o.mesure === 'deniv'
        ? { v: H.fmt.int(a.elev_gain_m), l: H.mot('mètres de dénivelé') }
        : o.mesure === 'duree'
          ? { v: H.fmt.duration(a.duration_s), l: H.mot('de mouvement') }
          : { v: H.fmt.km(a.distance_km, 1), l: H.mot('kilomètres') };
      var base = g.bottom - u(6);
      H.text(m.v, g.left, base, H.t('hero', { size: 15, color: encre, maxWidth: g.w(5) }));
      H.text(m.l, g.left, base + u(4), H.t('label', { color: Alpage.melange(encre, 0.6) }));
    }
  }
});
