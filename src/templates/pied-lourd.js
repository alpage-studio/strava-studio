/* « Pied lourd » — tout le poids en bas, le haut presque vide.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE A EN PROPRE : un déséquilibre VOULU. Les trois quarts hauts ne
 * portent qu'un titre et le parcours ; tout le reste — chiffre, mesures,
 * filets — se tasse dans le quart bas. C'est la composition d'une pochette de
 * disque, et c'est la seule du studio à assumer un vide aussi franc en haut.
 */
Studio.template({
  id: 'pied-lourd',
  name: 'Pied lourd — tout se tasse en bas',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'mesure', type: 'select', label: 'Le grand nombre', default: 'distance',
      choices: [['distance', 'Distance'], ['deniv', 'Dénivelé'], ['duree', 'Temps']] },
    { key: 'fond', type: 'select', label: 'Fond', default: 'sombre',
      choices: [['sombre', 'Sombre'], ['papier', 'Papier'], ['transparent', 'Transparent']] },
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
    var pied = g.bottom - g.height * 0.28;

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top + u(3.4), H.t('title', { size: 3.4, color: encre, maxWidth: g.w(4) }));
    }

    /* Le parcours occupe le vide du haut sans le remplir : il est centré dans
     * la zone laissée libre, et respire. */
    if (a.route && a.route.pts && a.route.pts.length) {
      H.route(a.route, { x: g.left, y: g.top + u(9), w: g.width, h: pied - g.top - u(16) }, {
        color: Alpage.melange(encre, 0.72), width: u(0.9), pad: u(3)
      });
    }

    H.rule(g.left, pied, g.right, { color: Alpage.melange(encre, 0.3) });

    if (dit.mesures) {
      var m = o.mesure === 'deniv'
        ? { v: H.fmt.int(a.elev_gain_m), u: H.mot('M') }
        : o.mesure === 'duree'
          ? { v: H.fmt.duration(a.duration_s), u: '' }
          : { v: H.fmt.km(a.distance_km, 2), u: H.mot('KM') };

      var st = H.t('hero', { size: 12, color: encre });
      var base = pied + u(14);
      H.text(m.v, g.left, base, st);
      if (m.u) {
        var larg = H.measure(m.v, st);
        H.text(m.u, g.left + larg + u(1.4), base, H.t('hero', {
          size: 4, color: Alpage.melange(encre, 0.7)
        }));
      }

      var cotes = [
        [H.mot('en mouvement'), H.fmt.duration(a.duration_s)],
        [H.mot('vitesse'), a.speed_kmh ? H.fmt.speed(a.speed_kmh) + ' km/h' : '—'],
        [H.mot('dénivelé'), a.elev_gain_m != null ? H.fmt.int(a.elev_gain_m) + ' m' : '—']
      ];
      var colW = g.width / 3;
      cotes.forEach(function (c, i) {
        H.field(c[0], c[1], g.left + i * colW, g.bottom - u(5), {
          color: encre, labelColor: Alpage.melange(encre, 0.55),
          size: 3.4, maxWidth: colW - u(2)
        });
      });
    }
  }
});
