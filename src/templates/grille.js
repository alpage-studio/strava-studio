/* « Grille » — six mesures en tableau, le profil en pied.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE A EN PROPRE : aucune hiérarchie. Six mesures du même corps, en
 * deux colonnes, séparées par des filets — la mise en page d'une fiche
 * technique, pas d'une affiche. « Éditorial » écrase tout sous un chiffre
 * héros ; ici on vient LIRE, pas admirer.
 *
 * Une mesure absente s'écrit « — » et non zéro : voir le reste du studio.
 */
Studio.template({
  id: 'grille',
  name: 'Grille — la fiche technique',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
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
    var filet = Alpage.melange(encre, 0.18);
    if (o.fond === 'papier') H.fill('#F4F2EC');
    else if (sombre) H.fill('#141414');

    var g = H.grid({ cols: 6, margin: u(8) });

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top + u(3.4), H.t('title', { size: 4.2, color: encre, maxWidth: g.w(5) }));
    }

    /* Six cases, deux colonnes. Chacune porte son filet haut : c'est lui qui
     * fait la grille, pas un fond. */
    if (dit.mesures) {
      var cases = [
        [H.mot('distance'), a.distance_km != null ? H.fmt.km(a.distance_km, 2) + ' km' : '—'],
        [H.mot('en mouvement'), H.fmt.duration(a.duration_s)],
        [H.mot('dénivelé'), a.elev_gain_m != null ? H.fmt.int(a.elev_gain_m) + ' m' : '—'],
        [H.mot('vitesse'), a.speed_kmh ? H.fmt.speed(a.speed_kmh) + ' km/h' : '—'],
        [H.mot('altitude max'), a.elev_max_m != null ? H.fmt.int(a.elev_max_m) + ' m' : '—'],
        [H.mot('FC moy.'), a.hr_avg ? a.hr_avg + ' bpm' : '—']
      ];
      var haut = g.top + u(12);
      var pas = u(13);
      var larg = g.width / 2;
      cases.forEach(function (c, i) {
        var x = g.left + (i % 2) * larg;
        var y = haut + Math.floor(i / 2) * pas;
        H.rule(x, y, x + larg - u(3), { color: filet });
        H.text(c[0], x, y + u(3.4), H.t('label', { color: Alpage.melange(encre, 0.55) }));
        H.text(c[1], x, y + u(8.4), H.t('value', {
          size: 5, color: encre, maxWidth: larg - u(4)
        }));
      });
    }

    if (o.profil && (a.profile || []).length > 3) {
      H.profile(a.profile, { x: g.left, y: g.bottom - u(12), w: g.width, h: u(10) }, {
        fill: Alpage.melange(encre, 0.14), stroke: Alpage.melange(encre, 0.5), width: u(0.25)
      });
    }
  }
});
