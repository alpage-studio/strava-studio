/* « Fresque collective » — le cadavre exquis des parcours.
 *
 * Plusieurs traces mises bout à bout : l'arrivée de l'une devient le départ
 * de la suivante. Elles peuvent venir de villes différentes, d'années
 * différentes, de gens différents — c'est le propos.
 *
 * Ce qui doit rester clair, et que la planche écrit noir sur blanc :
 *
 *   - CE N'EST PAS UN ITINÉRAIRE. On déplace, on tourne, on redimensionne.
 *     Le résultat est une composition. Une mention le dit sur l'image même,
 *     parce que l'image circulera sans son contexte.
 *   - AUCUN FOND DE CARTE. Un fond cartographique sous un assemblage qui
 *     n'est pas géographique serait un mensonge appuyé.
 *   - LES FICHIERS NE SONT PAS TOUCHÉS. Les transformations vivent ici, au
 *     dessin. Les traces de la bibliothèque restent ce qu'elles sont, et
 *     l'enregistrement du projet les réécrit telles quelles.
 *   - CHAQUE CONTRIBUTION GARDE SON IDENTITÉ : sa couleur, son nom, sa
 *     place dans l'ordre. Réordonner ne repeint rien.
 *
 * Rien ne part nulle part : le studio ne sait toujours parler à personne.
 * Pour continuer la fresque demain, « Enregistrer le projet ».
 */
Studio.template({
  id: 'fresque',
  name: 'Fresque collective — les traces bout à bout',
  famille: 'serie',
  multi: true,
  duree: 12000,
  chrono: 'lineaire',

  options: [
    { key: 'sens', type: 'select', label: 'Composition', default: 'auto', reflow: true,
      choices: [['auto', 'Automatique — selon le format'],
                ['bande', 'Fresque horizontale'],
                ['serpentin', 'Affiche verticale — en serpentin']] },
    { key: 'echelle', type: 'select', label: 'Échelle', default: 'commune',
      choices: [['commune', 'Commune — les longueurs restent comparables'],
                ['egale', 'Égale — chaque trace occupe autant de place']] },
    { key: 'noms', type: 'text', label: 'Prénoms (séparés par ;)', default: '' },
    { key: 'rotation', type: 'range', label: 'Rotation', default: 100, min: 0, max: 100, step: 5 },
    { key: 'fond', type: 'color', label: 'Fond', default: '#0D0D10' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'epaisseur', type: 'range', label: 'Épaisseur', default: 10, min: 3, max: 26, step: 1 },
    { key: 'raccords', type: 'toggle', label: 'Marquer les raccords', default: true },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.5);

    var contribs = (s.library || []).filter(function (e) {
      return e.activity && e.activity.route && e.activity.route.pts.length > 1;
    });

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(7) });

    if (!contribs.length) {
      H.text('Charge des traces', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('chacune prolongera la précédente', g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint }));
      return;
    }

    var noms = String(o.noms || '').split(';').map(function (x) { return x.trim(); });

    /* ---------- disposition ---------- */
    var sens = o.sens;
    if (sens === 'auto') sens = w > h ? 'bande' : 'serpentin';

    var titre = String(o.titre || '').trim() || 'Fresque';
    H.text(titre, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(contribs.length + (contribs.length > 1 ? ' contributions' : ' contribution'),
           g.right, g.top + u(3.6), H.t('label', { color: faint, align: 'right' }));

    var basNote = g.bottom - u(4);
    var zone = { x: g.left, y: g.top + u(10), w: g.width, h: basNote - u(8) - (g.top + u(10)) };

    /* ---------- l'assemblage, en deux temps ----------
     *
     * 1. On chaîne les traces dans un espace ABSTRAIT : chacune ramenée à
     *    l'origine sur son départ, tournée pour suivre la direction du
     *    moment, posée au bout de la précédente.
     * 2. Une fois la chaîne entière connue, on la met à l'échelle et on la
     *    centre dans la page.
     *
     * Le premier jet avançait directement en pixels, avec un pas moyen par
     * contribution. Il suffisait qu'une trace soit plus longue que prévu pour
     * que la fresque sorte de la page par le bas — et on ne s'en apercevait
     * qu'à la huitième contribution. Ici la composition ne peut PAS déborder :
     * on ne connaît son échelle qu'après l'avoir entièrement construite.
     */
    var echelleCommune = o.echelle === 'commune';
    var longueurs = contribs.map(function (e) { return e.activity.distance_km || 1; });
    var longMax = Math.max.apply(null, longueurs);
    var force = (Number(o.rotation) || 0) / 100;

    var abstrait = [];            // [{ e, pts: [{x,y}], depart: {x,y} }]
    var cur = { x: 0, y: 0 };
    var minX = 0, maxX = 0, minY = 0, maxY = 0;

    contribs.forEach(function (e, i) {
      var cote = echelleCommune ? 0.55 + 0.75 * Math.sqrt(longueurs[i] / longMax) : 1.15;
      /* La direction : en bande on avance vers la droite avec une ondulation
       * fonction du RANG — donc stable d'un rendu à l'autre —, en serpentin
       * on descend en ondulant. C'est cette ondulation qui distingue une
       * fresque d'une file de vignettes. */
      var angle = sens === 'bande'
        ? Math.sin(i * 1.7) * 0.55 * force
        : (Math.PI / 2) + Math.sin(i * 2.1) * 0.55 * force;

      var place = placement(e, cur, angle, cote);
      abstrait.push({ e: e, pts: place.pts, depart: { x: cur.x, y: cur.y } });
      place.pts.forEach(function (p) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });
      cur = place.fin;
    });

    var larg = (maxX - minX) || 1, haut = (maxY - minY) || 1;
    var k = Math.min(zone.w / larg, zone.h / haut);
    var ox = zone.x + (zone.w - larg * k) / 2 - minX * k;
    var oy = zone.y + (zone.h - haut * k) / 2 - minY * k;
    function versPage(p) { return { x: ox + p.x * k, y: oy + p.y * k }; }

    var reveles = Math.max(0, Math.min(1, s.progress)) * contribs.length;

    abstrait.forEach(function (c, i) {
      var part = Math.max(0, Math.min(1, reveles - i));
      if (part <= 0) return;
      var fin = Math.max(2, Math.ceil(c.pts.length * part));
      ctx.save();
      ctx.strokeStyle = c.e.couleur;
      ctx.lineWidth = Math.max(u(0.25), u(o.epaisseur / 14));
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      for (var n = 0; n < fin; n++) {
        var q = versPage(c.pts[n]);
        if (n === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.stroke();
      ctx.restore();

      var d = versPage(c.depart);
      var nom = (noms[i] || '').trim();
      if (nom) {
        H.text(nom, d.x, d.y - u(2.6),
               H.t('label', { color: melange(c.e.couleur, 0.95), align: 'center',
                              maxWidth: zone.w / 3 }));
      }
      if (o.raccords) {
        ctx.save();
        ctx.fillStyle = o.fond;
        ctx.strokeStyle = c.e.couleur;
        ctx.lineWidth = u(0.28);
        ctx.beginPath(); ctx.arc(d.x, d.y, u(0.9), 0, Math.PI * 2);
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
    });

    /* ---------- la mention, non négociable ---------- */
    H.text('COMPOSITION GRAPHIQUE — LES TRACES SONT DÉPLACÉES, TOURNÉES ET MISES À L’ÉCHELLE. ' +
           'CE N’EST PAS UN ITINÉRAIRE.',
           g.left, basNote, H.t('label', { color: faint, maxWidth: g.width }));
    H.text(echelleCommune
             ? 'longueurs comparables entre contributions'
             : 'chaque contribution occupe la même place — longueurs non comparables',
           g.left, g.bottom, H.t('meta', { color: melange(ink, 0.38), maxWidth: g.width }));

    /* ================= placement d'une contribution ================= */

    /* Renvoie les points placés ET le point de sortie, qui devient le départ
     * de la suivante. Ne dessine rien : à ce stade on ne connaît pas encore
     * l'échelle de la page. */
    function placement(e, depart, angle, cote) {
      var pts = e.activity.route.pts;
      var a = pts[0], b = pts[pts.length - 1];

      /* Angle propre de la trace, pour l'annuler avant d'appliquer le nôtre.
       * Une boucle (départ ≈ arrivée) n'en a pas : on la laisse telle quelle
       * et elle se pose comme un médaillon sur le parcours de la fresque. */
      var dx = b.x - a.x, dy = b.y - a.y;
      var boucle = Math.hypot(dx, dy) < 0.06;
      var propre = boucle ? 0 : Math.atan2(dy, dx);
      var rot = angle - propre;
      var cos = Math.cos(rot), sin = Math.sin(rot);

      function place(p) {
        var px = (p.x - a.x) * cote, py = (p.y - a.y) * cote;
        return { x: depart.x + px * cos - py * sin, y: depart.y + px * sin + py * cos };
      }

      /* Le point de sortie : l'arrivée de la trace si elle est ouverte, un
       * pas dans la direction courante si c'est une boucle — sinon la
       * contribution suivante se poserait exactement sur celle-ci. */
      return {
        pts: pts.map(place),
        fin: boucle
          ? { x: depart.x + Math.cos(angle) * cote * 0.9,
              y: depart.y + Math.sin(angle) * cote * 0.9 }
          : place(b)
      };
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
