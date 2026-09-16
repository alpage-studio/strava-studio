/* « Série » — plusieurs sorties sur une seule planche.
 *
 * C'est le premier template qui lit la bibliothèque (s.library) plutôt
 * qu'une activité unique. Il sert de preuve au socle multi-sorties autant
 * que de planche utile : un récapitulatif de semaine ou de saison.
 *
 * Deux règles que les planches multi-sorties suivantes devront reprendre :
 *
 *   - L'ÉCHELLE EST COMMUNE. Chaque trace tient dans sa case, mais toutes
 *     partagent le même rapport mètres/pixel : une sortie de 6 km doit
 *     paraître six fois plus petite qu'une de 36 km. Normaliser chaque case
 *     séparément donnerait six vignettes de même taille et une comparaison
 *     fausse — c'est le piège classique de ce genre de grille.
 *   - LA COULEUR SUIT LA SORTIE, pas sa position. Réordonner la
 *     bibliothèque ne doit pas repeindre les traces, sinon deux images de la
 *     même série ne se lisent plus ensemble.
 */
Studio.template({
  id: 'serie',
  name: 'Série — grille de sorties',
  famille: 'serie',
  multi: true,

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#0E0E10' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'echelle', type: 'select', label: 'Échelle', default: 'commune',
      choices: [['commune', 'Commune — tailles comparables'],
                ['case', 'Par case — chaque trace remplit']] },
    { key: 'couleurs', type: 'toggle', label: 'Couleur par sortie', default: true },
    { key: 'chiffres', type: 'toggle', label: 'Distance et D+', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre;
    var faint = melange(ink, 0.45);
    var hair = melange(ink, 0.16);
    var entrees = (s.library || []).filter(function (e) {
      return e.activity && e.activity.route && e.activity.route.pts.length > 1;
    });

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
    var CH = g.height;

    /* ---------- état vide : dire quoi faire, pas rester blanc ---------- */
    if (!entrees.length) {
      H.text('Charge plusieurs sorties', g.left, g.top + CH * 0.46,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('cette planche en assemble deux ou plus', g.left, g.top + CH * 0.46 + u(5),
             H.t('label', { color: faint }));
      return;
    }

    /* ---------- en-tête ---------- */
    var titre = (o.titre || '').trim() || periode(entrees);
    H.text(titre, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(entrees.length + (entrees.length > 1 ? ' sorties' : ' sortie'),
           g.right, g.top + u(3.6), H.t('label', { color: faint, align: 'right' }));

    /* ---------- pied : les totaux de la série ---------- */
    var footY = g.bottom;
    var totKm = entrees.reduce(function (t, e) { return t + (e.activity.distance_km || 0); }, 0);
    var totT = entrees.reduce(function (t, e) { return t + (e.activity.duration_s || 0); }, 0);
    var totD = entrees.reduce(function (t, e) { return t + (e.activity.elev_gain_m || 0); }, 0);
    H.rule(g.left, footY - u(9), g.right, { color: hair });
    [['total', H.fmt.km(totKm, 0) + ' km'],
     ['en mouvement', H.fmt.duration(totT)],
     ['dénivelé', Math.round(totD) + ' m']].forEach(function (c, i) {
      H.field(c[0], c[1], g.left + i * (g.width / 3), footY - u(5.4), {
        color: ink, labelColor: faint, size: 4.2, maxWidth: g.width / 3 - u(2)
      });
    });

    /* ---------- la grille ---------- */
    var zone = { x: g.left, y: g.top + u(9), w: g.width, h: (footY - u(13)) - (g.top + u(9)) };
    var cols = entrees.length <= 2 ? 1 : entrees.length <= 6 ? 2 : entrees.length <= 12 ? 3 : 4;
    var rows = Math.ceil(entrees.length / cols);
    var cw = zone.w / cols, chh = zone.h / rows;
    var legendeH = o.chiffres ? u(7.5) : u(4.5);

    /* Échelle commune : la plus grande étendue de la série fixe le rapport,
     * et chaque trace est dessinée à SA taille dans ce rapport. */
    var etendueMax = 0;
    entrees.forEach(function (e) {
      etendueMax = Math.max(etendueMax, etendue(e.activity));
    });

    /* La dernière rangée est rarement pleine. La laisser cadrée à gauche
     * ouvre un trou au bord droit de la planche ; on la centre. */
    var reste = entrees.length % cols;
    var decalageDernier = reste ? (cols - reste) * cw / 2 : 0;
    var derniereRangee = Math.floor((entrees.length - 1) / cols);

    entrees.forEach(function (e, i) {
      var rangee = Math.floor(i / cols);
      var cx = zone.x + (i % cols) * cw + (rangee === derniereRangee ? decalageDernier : 0);
      var cy = zone.y + rangee * chh;
      var dessin = { x: cx + u(1.2), y: cy + u(1.2),
                     w: cw - u(2.4), h: chh - legendeH - u(1.2) };

      var couleur = o.couleurs ? e.couleur : ink;
      var facteur = 1;
      if (o.echelle === 'commune' && etendueMax > 0) {
        facteur = Math.sqrt(etendue(e.activity) / etendueMax);
        facteur = Math.max(0.16, facteur);   // une sortie minuscule reste visible
      }

      var cote = Math.min(dessin.w, dessin.h) * facteur;
      H.route(e.activity.route, {
        x: dessin.x + (dessin.w - cote) / 2,
        y: dessin.y + (dessin.h - cote) / 2,
        w: cote, h: cote
      }, { color: couleur, width: Math.max(u(0.22), u(0.42) * facteur) });

      /* légende de la case.
       *
       * La pastille se colle AU NOM, à gauche. Posée au bord droit de la
       * case elle tombait visuellement dans la case voisine : la pastille
       * orange de la première sortie se lisait comme celle de la seconde,
       * et la couleur — qui est justement ce qui identifie une sortie —
       * désignait la mauvaise. Accolée au nom, l'association est muette. */
      var ly = cy + chh - legendeH + u(2.6);
      var tx = cx + u(1.2);
      if (o.couleurs) {
        ctx.save();
        ctx.fillStyle = couleur;
        ctx.beginPath();
        ctx.arc(tx + u(0.8), ly - u(0.9), u(0.8), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        tx += u(3.2);
      }
      H.text(Library.nomCourt(e.activity, cols > 2 ? 16 : 24), tx, ly,
             H.t('label', { color: melange(ink, 0.75), maxWidth: cx + cw - u(2) - tx }));
      if (o.chiffres) {
        H.text(H.fmt.km(e.activity.distance_km, 1) + ' km · ' +
               H.fmt.int(e.activity.elev_gain_m) + ' m',
               tx, ly + u(3.4),
               H.t('label', { color: faint, maxWidth: cx + cw - u(2) - tx }));
      }
    });

    /* ---------- utilitaires ---------- */
    /* Étendue géographique d'une sortie, en degrés : suffisant pour comparer
     * deux traces d'une même région, et sans dépendance. */
    function etendue(act) {
      var pts = act.track;
      if (!pts || pts.length < 2) return 0;
      var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
      for (var i = 0; i < pts.length; i++) {
        if (pts[i].lat == null) continue;
        if (pts[i].lat < laMin) laMin = pts[i].lat;
        if (pts[i].lat > laMax) laMax = pts[i].lat;
        if (pts[i].lon < loMin) loMin = pts[i].lon;
        if (pts[i].lon > loMax) loMax = pts[i].lon;
      }
      if (!isFinite(laMin)) return 0;
      return Math.max(laMax - laMin, (loMax - loMin) * Math.cos(laMin * Math.PI / 180));
    }

    /* Un titre par défaut qui dit la période couverte, sans l'inventer. */
    function periode(list) {
      var dates = list.map(function (e) { return e.activity.date; })
                      .filter(Boolean).sort(function (a, b) { return a - b; });
      if (!dates.length) return 'Série';
      var f = function (d) { return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' }); };
      return dates.length === 1 || f(dates[0]) === f(dates[dates.length - 1])
        ? f(dates[0])
        : f(dates[0]) + ' — ' + f(dates[dates.length - 1]);
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
