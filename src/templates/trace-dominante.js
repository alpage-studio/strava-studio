/* « Tracé dominant » — le parcours prend les deux tiers, les chiffres s'effacent.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE A EN PROPRE FACE À « TRACE ». Trace équilibre : un titre, un
 * parcours, un profil, trois colonnes de chiffres — chacun sa part. Ici le
 * parcours écrase tout, les mesures tiennent sur une ligne de huit points de
 * corps, et le titre passe en capitales fines. C'est une planche pour un
 * parcours qui VAUT d'être regardé — une boucle lisible, un dessin qui tient
 * debout seul.
 */
Studio.template({
  id: 'trace-dominante',
  name: 'Tracé dominant — le parcours d’abord',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'fond', type: 'select', label: 'Fond', default: 'papier',
      choices: [['papier', 'Papier'], ['sombre', 'Sombre'], ['transparent', 'Transparent']] },
    { key: 'epaisseur', type: 'range', label: 'Épaisseur du trait', default: 14, min: 4, max: 36 },
    { key: 'marqueurs', type: 'toggle', label: 'Départ et arrivée', default: true },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var dit = Alpage.dit(o);
    var sombre = o.fond === 'sombre';
    var encre = sombre ? '#F4F2EC' : '#1A1A17';
    if (o.fond === 'papier') H.fill('#F4F2EC');
    else if (sombre) H.fill('#141414');

    var g = H.grid({ cols: 6, margin: u(7) });

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top + u(3), H.t('label', {
               size: 2.4, color: Alpage.melange(encre, 0.75), maxWidth: g.w(5)
             }));
    }

    /* DEUX TIERS DE LA FEUILLE. Le reste n'est qu'une ligne de pied. */
    if (a.route && a.route.pts && a.route.pts.length) {
      H.route(a.route, { x: g.left, y: g.top + u(7), w: g.width, h: g.height * 0.68 }, {
        color: encre,
        width: u(o.epaisseur / 10),
        pad: u(3),
        dots: o.marqueurs ? u(1.3) : 0,
        startColor: o.marqueurs ? encre : null,
        endColor: o.marqueurs ? Alpage.melange(encre, 0.5) : null
      });
    }

    if (dit.mesures) {
      H.rule(g.left, g.bottom - u(8), g.right, { color: Alpage.melange(encre, 0.22) });
      var bouts = [];
      if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' km');
      if (a.speed_kmh) bouts.push(H.fmt.speed(a.speed_kmh) + ' km/h');
      if (a.elev_gain_m != null) bouts.push(H.fmt.int(a.elev_gain_m) + ' m');
      var colW = g.width / Math.max(1, bouts.length);
      bouts.forEach(function (b, i) {
        H.text(b, g.left + i * colW, g.bottom - u(2),
               H.t('value', { size: 3.6, color: encre, maxWidth: colW - u(2) }));
      });
    }
  }
});
