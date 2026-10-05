/* « Topographie » — le parcours sur le terrain qu'il traverse.
 *
 * LA SEULE PLANCHE QUI DEMANDE UNE DONNÉE EXTÉRIEURE. Toutes les autres se
 * suffisent du fichier déposé : elles dessinent ce que la trace contient. Un
 * GPX ne connaît pourtant que l'altitude SUR le chemin — jamais le terrain
 * autour. Les courbes de niveau viennent donc de swisstopo, et il faut les
 * demander : « Ajouter le relief » dans le panneau Activité.
 *
 * SANS RELIEF, ELLE RESTE HONNÊTE. Elle dessine le parcours, dit qu'il manque
 * le terrain, et ne feint rien. Une planche qui montrerait des courbes
 * inventées serait pire qu'une planche vide : une carte fausse ne se dénonce
 * pas, elle se croit.
 *
 * LE RELIEF NE COUVRE QUE LA SUISSE et ses abords. Ailleurs, l'import refuse
 * de lui-même plutôt que de livrer des courbes qui ne correspondent à rien.
 */
Studio.template({
  id: 'topo',
  name: 'Topographie — le parcours sur son terrain',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'fond', type: 'select', label: 'Fond', default: 'papier',
      choices: [['papier', 'Papier'], ['sombre', 'Sombre'], ['transparent', 'Transparent']] },
    { key: 'courbes', type: 'select', label: 'Courbes de niveau', default: 'toutes',
      choices: [['toutes', 'Toutes les 100 m'], ['maitresses', 'Une sur cinq — 500 m']] },
    { key: 'densite', type: 'range', label: 'Force des courbes', default: 38, min: 10, max: 80 },
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
    var carte = { x: g.left, y: g.top + u(6), w: g.width, h: g.height * 0.62 };

    /* LE TERRAIN D'ABORD, le parcours dessus. L'ordre n'est pas un détail :
     * une trace sous ses courbes se lirait comme une courbe parmi d'autres. */
    var tracees = H.relief(a.relief, a.route, carte, {
      pad: u(2),
      color: Alpage.melange(encre, o.densite / 160),
      colorMaitresse: Alpage.melange(encre, o.densite / 90),
      maitressesSeules: o.courbes === 'maitresses'
    });

    if (a.route && a.route.pts && a.route.pts.length) {
      H.route(a.route, carte, { color: encre, width: u(1.1), pad: u(2), dots: u(0.9) });
    }

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(5) }));
    }

    if (dit.mesures) {
      var base = g.bottom - u(10);
      H.text(H.fmt.km(a.distance_km, 1), g.left, base,
             H.t('hero', { size: 9, color: encre }));
      H.text(H.mot('kilomètres'), g.left, base + u(3.4),
             H.t('label', { color: Alpage.melange(encre, 0.6) }));

      var dplus = a.elev_gain_m != null ? H.fmt.int(a.elev_gain_m) : '—';
      H.text(dplus, g.right, base, H.t('hero', { size: 9, color: encre, align: 'right' }));
      H.text(H.mot('mètres de dénivelé'), g.right, base + u(3.4),
             H.t('label', { color: Alpage.melange(encre, 0.6), align: 'right' }));
    }

    /* CE QUE LA PLANCHE DOIT À QUELQU'UN D'AUTRE, écrit sur la planche.
     * swisstopo donne le terrain : on le dit là où l'image sera regardée, pas
     * seulement dans un panneau que personne ne rouvrira. */
    if (tracees) {
      /* LE CRÉDIT DE SWISSTOPO NE SE COUPE PAS AVEC LES MENTIONS.
       *
       * « Texte » décide de ce que NOUS disons de nous : le titre, les
       * mesures, la fabrication. Le terrain, lui, vient de quelqu'un
       * d'autre, et sa source se cite. Le laisser derrière un réglage
       * permettait de publier le travail de swisstopo sans le nommer, par
       * simple distraction — ce n'est pas notre signature à masquer. */
      H.text(H.mot('relief · swisstopo'), g.left, g.bottom,
             H.t('label', { color: Alpage.melange(encre, 0.45) }));
      if (dit.mesures) {
        H.text(H.mot('équidistance {e} m', { e: a.relief.equidistance }), g.right, g.bottom,
               H.t('label', { color: Alpage.melange(encre, 0.45), align: 'right' }));
      }
    } else if (dit.titre) {
      /* Pas de relief : on le DIT, au lieu de laisser croire à un terrain plat. */
      H.text(H.mot('sans relief — « Ajouter le relief » dans Activité'),
             g.left, g.bottom, H.t('label', { color: Alpage.melange(encre, 0.4) }));
    }
  }
});
