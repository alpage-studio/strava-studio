/* « Bandes » — une mesure par bandeau, trois fonds qui se répondent.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE FAIT QUE « CHIFFRES » NE FAIT PAS. Chiffres hiérarchise : un
 * héros énorme, trois mesures secondaires en dessous. Ici les trois mesures
 * sont ÉGALES — même corps, même place — et c'est le fond qui les sépare.
 * Une sortie n'a pas toujours un chiffre qui mérite d'écraser les autres.
 */
Studio.template({
  id: 'bandes',
  name: 'Bandes — trois mesures, trois fonds',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'fond', type: 'select', label: 'Fond', default: 'contraste',
      choices: [['contraste', 'Contrasté'], ['papier', 'Papier'], ['transparent', 'Transparent']] },
    { key: 'accent', type: 'color', label: 'Accent', default: '#2F4A3C' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var dit = Alpage.dit(o);
    var papier = o.fond === 'papier';

    /* Trois fonds qui se répondent : noir, papier, accent. En « Papier » ils
     * deviennent trois valeurs du même gris — la composition tient, le
     * contraste baisse. */
    var fonds = papier
      ? ['#F4F2EC', '#E6E2D8', '#D8D3C6']
      : ['#141414', '#F4F2EC', o.accent];
    var encres = papier
      ? ['#1A1A17', '#1A1A17', '#1A1A17']
      : ['#F4F2EC', '#1A1A17', '#F4F2EC'];

    var mesures = [
      [H.mot('en mouvement'), H.fmt.duration(a.duration_s)],
      [H.mot('allure moyenne'), a.speed_kmh ? H.fmt.speed(a.speed_kmh) + ' km/h' : '—'],
      [H.mot('dénivelé'), a.elev_gain_m != null ? H.fmt.int(a.elev_gain_m) + ' m' : '—']
    ];

    var hautTitre = u(22);
    var hBande = (h - hautTitre) / 3;

    /* Le titre occupe la première bande, qui est aussi la plus sombre : c'est
     * elle qui donne le ton de l'affiche. */
    if (!H.surcouche()) {
      ctx.save();
      ctx.fillStyle = fonds[0];
      ctx.fillRect(0, 0, w, hautTitre);
      ctx.restore();
    }
    if (dit.titre) {
      var titre = String(o.titre || '').trim() || a.name || H.mot('Sortie');
      H.text(titre, u(8), hautTitre - u(7), H.t('title', {
        size: 5, color: encres[0], maxWidth: w - u(16)
      }));
    }

    mesures.forEach(function (m, i) {
      var y = hautTitre + i * hBande;
      if (!H.surcouche()) {
        ctx.save();
        ctx.fillStyle = fonds[i];
        ctx.fillRect(0, y, w, hBande);
        ctx.restore();
      }
      if (!dit.mesures) return;
      H.text(m[0], u(8), y + u(8), H.t('label', {
        color: Alpage.melange(encres[i], 0.65)
      }));
      H.text(m[1], u(8), y + hBande * 0.62, H.t('value', {
        size: 8, color: encres[i], maxWidth: w - u(16)
      }));
    });
  }
});
