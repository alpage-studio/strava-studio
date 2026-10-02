/* « Photo » — un dégradé profond, le chiffre en bas, rien d'autre.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE A EN PROPRE, FACE AUX SURCOUCHES. Les huit surcouches sont
 * transparentes : elles se posent SUR une photo qu'on fournit. Celle-ci
 * fabrique son propre fond — un dégradé qui descend vers le noir — pour qui
 * n'a pas de photo mais veut le même calme. Elle accepte une photo si on en
 * met une, et le dégradé devient alors le voile qui rend le texte lisible.
 */
Studio.template({
  id: 'photo',
  name: 'Photo — le dégradé et le nombre',
  famille: 'affiche',

  options: [
    { key: 'mesure', type: 'select', label: 'Le grand nombre', default: 'distance',
      choices: [['distance', 'Distance'], ['deniv', 'Dénivelé'], ['duree', 'Temps']] },
    { key: 'teinte', type: 'color', label: 'Teinte du fond', default: '#2B3440' },
    { key: 'profondeur', type: 'range', label: 'Profondeur', default: 70, min: 20, max: 100 },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var dit = Alpage.dit(o);
    var encre = '#F4F2EC';

    /* La photo d'abord si elle existe ; le dégradé ensuite, qui sert alors de
     * voile. Sans photo, le dégradé EST le fond. */
    var avecPhoto = H.hasPhoto() && H.photo();
    H.fill(H.gradient([
      [0, avecPhoto ? 'rgba(0,0,0,0)' : o.teinte],
      [0.45, avecPhoto ? 'rgba(0,0,0,0.15)' : o.teinte],
      [1, 'rgba(8,9,11,' + (o.profondeur / 100) + ')']
    ]));

    var g = H.grid({ cols: 6, margin: u(8) });

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top + u(4), H.t('title', { size: 4, color: encre, maxWidth: g.w(5) }));
    }

    if (a.route && a.route.pts && a.route.pts.length) {
      H.route(a.route, { x: g.left, y: g.top + g.height * 0.22, w: g.width, h: g.height * 0.4 }, {
        color: Alpage.melange(encre, 0.55), width: u(0.8), pad: u(2)
      });
    }

    if (dit.mesures) {
      var m = o.mesure === 'deniv'
        ? { v: H.fmt.int(a.elev_gain_m), l: H.mot('mètres de dénivelé') }
        : o.mesure === 'duree'
          ? { v: H.fmt.duration(a.duration_s), l: H.mot('de mouvement') }
          : { v: H.fmt.km(a.distance_km, 1), l: H.mot('kilomètres') };
      var base = g.bottom - u(8);
      H.text(m.v, g.left, base, H.t('hero', { size: 13, color: encre, maxWidth: g.w(5) }));
      H.text(m.l, g.left, base + u(4), H.t('label', { color: Alpage.melange(encre, 0.7) }));

      H.text(H.fmt.duration(a.duration_s), g.right, base,
             H.t('value', { size: 4.6, color: Alpage.melange(encre, 0.85), align: 'right' }));
    }
  }
});
