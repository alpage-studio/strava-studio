/* « Main » — un cadre, et le profil en barres au centre.
 *
 * D'APRÈS UNE MAQUETTE restée dans `design/`, jamais publiée.
 *
 * CE QU'ELLE A EN PROPRE : le CADRE. Une bordure épaisse qui tient toute la
 * composition, et à l'intérieur le profil rendu en barres fines plutôt qu'en
 * aire pleine. Aucune autre planche n'encadre ; c'est ce qui lui donne son air
 * de fiche affichée au mur.
 */
Studio.template({
  id: 'main',
  name: 'Main — le profil encadré',
  famille: 'affiche',

  options: [
    { key: 'cadre', type: 'color', label: 'Cadre', default: '#E5502D' },
    { key: 'papier', type: 'color', label: 'Papier', default: '#FAF8F3' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#101010' },
    { key: 'epaisseur', type: 'range', label: 'Épaisseur du cadre', default: 10, min: 3, max: 24 },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var dit = Alpage.dit(o);
    var encre = o.encre;

    H.fill(o.papier);
    var ep = u(o.epaisseur / 4);
    ctx.save();
    ctx.strokeStyle = o.cadre;
    ctx.lineWidth = ep;
    ctx.strokeRect(ep / 2, ep / 2, w - ep, h - ep);
    ctx.restore();

    var g = H.grid({ cols: 6, margin: ep + u(6) });

    if (dit.titre) {
      H.text(String(o.titre || '').trim() || a.name || H.mot('Sortie'),
             g.left, g.top + u(3), H.t('title', { size: 3.6, color: encre, maxWidth: g.w(4) }));
    }

    if (dit.mesures) {
      var base = g.top + u(14);
      var st = H.t('hero', { size: 9, color: encre });
      var num = H.fmt.km(a.distance_km, 2);
      H.text(num, g.left, base, st);
      H.text(H.mot('KM'), g.left + H.measure(num, st) + u(1.2), base,
             H.t('hero', { size: 3.2, color: Alpage.melange(encre, 0.7) }));

      [[H.mot('en mouvement'), H.fmt.duration(a.duration_s)],
       [H.mot('vitesse'), a.speed_kmh ? H.fmt.speed(a.speed_kmh) + ' km/h' : '—']]
        .forEach(function (c, i) {
          H.field(c[0], c[1], g.left + i * (g.width / 2), base + u(8), {
            color: encre, labelColor: Alpage.melange(encre, 0.5),
            size: 3.4, maxWidth: g.width / 2 - u(3)
          });
        });
    }

    /* LE PROFIL EN BARRES, pas en aire. C'est ce qui distingue cette planche
     * de toutes celles qui dessinent un relief : on lit une suite de valeurs,
     * pas une silhouette de montagne. */
    /* `a.profile` est une liste de POINTS {x, y}, pas de nombres : H.bars
     * filtre sur isFinite et jetait tout, en silence. Et mille cinq cents
     * barres dans neuf cents pixels ne se voient pas — on en garde
     * quatre-vingts, assez pour lire la forme sans fabriquer un peigne. */
    var prof = (a.profile || []).map(function (p) { return p && p.y != null ? p.y : p; })
      .filter(function (v) { return v != null && isFinite(v); });
    if (prof.length > 3) {
      var N = 80;
      var reduit = [];
      for (var i = 0; i < N; i++) {
        reduit.push(prof[Math.min(prof.length - 1, Math.round(i * (prof.length - 1) / (N - 1)))]);
      }
      var box = { x: g.left, y: g.top + g.height * 0.42, w: g.width, h: g.height * 0.34 };
      H.bars(reduit, box, { color: encre });
    }

    if (dit.mesures) {
      H.rule(g.left, g.bottom - u(7), g.right, { color: Alpage.melange(encre, 0.25) });
      H.text(a.elev_gain_m != null ? H.mot('{n} M', { n: H.fmt.int(a.elev_gain_m) }) : '—',
             g.left, g.bottom - u(1.6), H.t('value', { size: 4.6, color: encre }));
      if (a.hr_avg) {
        H.text(a.hr_avg + ' BPM', g.right, g.bottom - u(1.6),
               H.t('label', { color: Alpage.melange(encre, 0.6), align: 'right' }));
      }
    }
  }
});
