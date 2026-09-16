/* « Empreinte » — le sceau d'une sortie.
 *
 * Le parcours au centre, et autour de lui une famille de contours qui
 * s'écartent régulièrement — entre empreinte digitale, anneau de croissance
 * et estampe. Derrière, un aplat simple, légèrement décalé, comme un second
 * passage d'impression mal calé.
 *
 * ── Ce que les contours SONT, et ce qu'ils ne sont pas ────────────────
 *
 * Ce sont des décalages parallèles de la trace. Rien de plus. Ils ne
 * décrivent AUCUNE altitude et la planche ne les appelle jamais des courbes
 * de niveau : la ressemblance est réelle et le malentendu serait facile.
 * L'anneau à 300 m dit « à trois cents mètres du parcours », pas « à trois
 * cents mètres d'altitude ».
 *
 * ── Fermé, ouvert : deux familles différentes ────────────────────────
 *
 * Une boucle véritablement refermée produit des contours FERMÉS, dedans et
 * dehors. Un parcours ouvert produit des rubans OUVERTS, qui s'écartent de
 * part et d'autre. On ne referme jamais une trace ouverte pour faire un
 * plus joli sceau : l'aller-retour du lundi ne devient pas une boucle.
 *
 * ── Le décalage se replie, et c'est voulu ────────────────────────────
 *
 * Un décalage par les normales se croise dans les virages plus serrés que
 * le décalage lui-même. Nettoyer ces boucles demande un vrai offset de
 * polygone — dix fois le code. Rempli en `nonzero`, le repli se lit comme
 * une boucle d'encre : c'est exactement ce que fait un anneau de croissance
 * autour d'un nœud. On le garde, et on borne le décalage maximal pour qu'il
 * reste une signature et non une bouillie.
 */
Studio.template({
  id: 'empreinte',
  name: 'Empreinte — le sceau d’une sortie',
  famille: 'affiche',
  /* La transparence est une OPTION : la même planche s'exporte sur papier
   * ou en surcouche à poser sur une photo. */
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'composition', type: 'select', label: 'Composition', default: 'sceau', reflow: true,
      choices: [['sceau', 'Sceau — une empreinte'],
                ['triptyque', 'Triptyque — trois sorties'],
                ['collection', 'Collection — jusqu’à sept']] },
    { key: 'lignes', type: 'range', label: 'Nombre de lignes', default: 16, min: 3, max: 40, step: 1 },
    { key: 'ecart', type: 'range', label: 'Écartement', default: 40, min: 10, max: 100, step: 2 },
    { key: 'aplat', type: 'select', label: 'Aplat', default: 'hautgauche', reflow: true,
      choices: [['hautgauche', 'Décalé en haut à gauche'],
                ['basdroite', 'Décalé en bas à droite'],
                ['centre', 'Centré'],
                ['aucun', 'Aucun aplat']] },
    { key: 'accentC', type: 'color', label: 'Aplat', default: '#A54F37' },
    /* --- avancé --- */
    { key: 'texte', type: 'toggle', label: 'Titre et date', default: true },
    { key: 'echelleCollection', type: 'select', label: 'Échelle (collection)', default: 'uniforme',
      choices: [['uniforme', 'Taille uniforme — composition'],
                ['geo', 'Échelle géographique commune']] },
    /* fond, voile, papier, encre : injectés depuis le socle Alpage */
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsFond()),

  inert: function (a, vals) {
    var morts = [];
    if (!vals) return morts;
    if (vals.composition !== 'collection') morts.push('echelleCollection');
    if (vals.aplat === 'aucun') morts.push('accentC');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    /* Papier ou surcouche : c'est la MÊME planche. Le socle pose le fond,
     * le voile éventuel, et rend l'encre à utiliser. */
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || o.papierC || '#F2EFE6');
    var faint = melange(encre, 0.45);


    var g = H.grid({ cols: 6, margin: u(8) });

    /* ---------- les sujets ---------- */
    var biblio = (s.library || []).filter(function (e) {
      return e.activity && e.activity.track && e.activity.track.length > 8;
    });
    var sujets;
    if (o.composition === 'sceau' || !biblio.length) {
      sujets = [{ activity: a, couleur: o.accentC }];
    } else if (o.composition === 'triptyque') {
      sujets = biblio.slice(0, 3);
    } else {
      sujets = biblio.slice(0, 7);
    }
    sujets = sujets.filter(function (e) { return e.activity && (e.activity.track || []).length > 8; });

    if (!sujets.length) {
      H.text('Charge une sortie', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Empreinte fabrique son sceau à partir du parcours',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint }));
      return;
    }

    /* ---------- préparation : une fois, avant l'animation ----------
     * La géométrie de TOUS les contours est calculée d'emblée. Pendant
     * l'animation on n'en révèle qu'une partie : si on la recalculait au
     * fil de la révélation, chaque image redessinerait des contours
     * légèrement différents et l'ensemble tremblerait. */
    var prepares = sujets.map(preparer);
    /* Semé avant tout dessin : `var` est hoisté, son affectation non. */
    var alea = Alpage.graine(prepares[0].vue);

    /* ---------- disposition ---------- */
    var titreH = o.texte ? u(14) : u(2);
    var zone = { x: g.left, y: g.top + u(2), w: g.width, h: g.height - titreH };

    if (o.composition === 'sceau') {
      poseSceau(prepares[0], zone, 1);
    } else {
      var n = prepares.length;
      var cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
      if (o.composition === 'triptyque') cols = (w > h) ? 3 : 1;
      var rows = Math.ceil(n / cols);
      var cw = zone.w / cols, chh = zone.h / rows;
      var reste = n % cols;
      var decale = reste ? (cols - reste) * cw / 2 : 0;
      var derniere = Math.floor((n - 1) / cols);
      /* Échelle géographique commune : la plus grande étendue fixe le
       * rapport, et chaque sceau garde SA taille dans ce rapport. En
       * uniforme, chacun remplit sa case — plus beau, non comparable, et
       * le pied de planche le dit. */
      var etendueMax = Math.max.apply(null, prepares.map(function (p) { return p.vue.etendue; })) || 1;
      prepares.forEach(function (p, i) {
        var rangee = Math.floor(i / cols);
        var cx = zone.x + (i % cols) * cw + (rangee === derniere ? decale : 0);
        var cy = zone.y + rangee * chh;
        var facteur = o.echelleCollection === 'geo' && o.composition === 'collection'
          ? Math.max(0.28, Math.sqrt(p.vue.etendue / etendueMax)) : 1;
        poseSceau(p, { x: cx + u(1), y: cy + u(1), w: cw - u(2), h: chh - u(7) }, facteur, i);
      });
    }

    legende();

    /* ================= préparation d'un sujet ================= */

    function preparer(e) {
      var vue = Alpage.projette(e.activity.track);
      var pas = Math.max(3, vue.etendue / 420);
      /* Deux passes de lissage large AVANT tout décalage. Rééchantillonner
       * une trace rend la polyligne linéaire par morceaux : les sommets
       * d'origine restent des angles vifs, et un décalage par les normales
       * y produit des croisements en éventail — seize anneaux deviennent
       * alors une hachure. Ce qui suit doit être une courbe, pas un polygone. */
      var pts = Alpage.reechantillonne(vue.pts, pas);
      var fen = Math.max(3, Math.round(pts.length / 55));
      pts = Alpage.lisse(Alpage.lisse(pts, fen), fen);
      /* Fermée ? Le critère est géométrique : le dernier point revient-il
       * au premier, à 2 % de l'étendue près. Une réponse « oui » change la
       * famille de contours, donc on ne la devine pas au nom du fichier. */
      var fermee = pts.length > 8 &&
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < vue.etendue * 0.02;
      /* La couleur de bibliothèque n'entre PAS ici : sept aplats arc-en-ciel
       * contrediraient la règle des deux accents au plus, et transformeraient
       * une collection d'estampes en nuancier. */
      return { entree: e, activity: e.activity, vue: vue, pts: pts, fermee: fermee };
    }

    /* ================= un sceau ================= */

    function poseSceau(p, boite, facteur, index) {
      var cote = Math.min(boite.w, boite.h) * facteur;
      var sousBoite = { x: boite.x + (boite.w - cote) / 2, y: boite.y + (boite.h - cote) / 2,
                        w: cote, h: cote };
      var cadre = Alpage.cadre(p.vue, sousBoite, { marge: cote * 0.2 });
      var P = p.pts.map(cadre.point);
      var N = Alpage.normales(P);

      var nb = Math.max(3, Math.round(o.lignes));

      /* La taille de la FORME, pas celle de la case : un aller-retour occupe
       * un dixième de son cadre, et un aplat calé sur le cadre l'aurait
       * englouti. On mesure le rayon réellement occupé par le parcours. */
      var cx = 0, cy = 0;
      P.forEach(function (q) { cx += q.x; cy += q.y; });
      cx /= P.length; cy /= P.length;
      var rayon = 0;
      P.forEach(function (q) { rayon = Math.max(rayon, Math.hypot(q.x - cx, q.y - cy)); });
      rayon = Math.max(rayon, cote * 0.04);

      /* L'écartement total de la famille, en fraction du rayon de la forme.
       * C'est ce qui fait la signature : une couronne large se lit comme un
       * anneau de croissance, une couronne étroite comme un simple halo. */
      var ecartMax = rayon * 0.85 * (Number(o.ecart) || 40) / 100;
      var pasAnneau = ecartMax / nb;

      /* Densité bornée par le format : sous un anneau tous les 1,4 px,
       * l'impression et l'export produisent du moiré. On réduit alors le
       * NOMBRE d'anneaux plutôt que de les serrer davantage. */
      var mini = Math.max(1.4, u(0.18));
      if (pasAnneau < mini) { pasAnneau = mini; nb = Math.max(3, Math.floor(ecartMax / pasAnneau)); }

      /* 1. l'aplat, DERRIÈRE, décalé — un second passage d'impression mal
       *    calé. Il est calé sur la forme et reste plus petit que la
       *    couronne : c'est le sceau qu'on regarde, pas la pastille. */
      if (o.aplat !== 'aucun') {
        /* Le rayon de l'aplat suit la MOYENNE GÉOMÉTRIQUE des deux demi-
         * dimensions de la forme, pas son rayon maximal. Sur un parcours
         * allongé — un aller-retour, une vallée — le rayon maximal vaut la
         * demi-longueur : le disque couvrait alors toute la planche et
         * avalait la couronne. La moyenne géométrique donne un disque à la
         * mesure de la tache d'encre, ce que fait un vrai tampon. */
        var demiL = 0, demiH = 0;
        P.forEach(function (q) {
          demiL = Math.max(demiL, Math.abs(q.x - cx));
          demiH = Math.max(demiH, Math.abs(q.y - cy));
        });
        var rAplat = Math.sqrt(Math.max(1, demiL) * Math.max(1, demiH)) * 1.1 + ecartMax * 0.3;
        rAplat = Math.max(rayon * 0.24, Math.min(rayon * 0.86, rAplat));
        var dec = (rAplat + ecartMax) * 0.2;
        var dx = o.aplat === 'hautgauche' ? -dec : o.aplat === 'basdroite' ? dec : 0;
        var dy = o.aplat === 'hautgauche' ? -dec * 0.8 : o.aplat === 'basdroite' ? dec * 0.8 : 0;
        ctx.save();
        ctx.fillStyle = o.accentC;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, rAplat, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* 2. les contours, par CHAMP DE DISTANCE.
       *
       * On calcule une fois la distance au parcours sur une grille, puis on
       * en extrait les lignes de niveau. Les anneaux fusionnent alors d'eux-
       * mêmes là où la place manque, s'arrondissent aux extrémités et
       * contournent proprement un parcours qui se recoupe. Le décalage par
       * les normales, essayé d'abord, s'effondrait sur toute forme allongée :
       * les anneaux intérieurs s'empilaient en hachure et chaque extrémité
       * ouvrait un éventail de traits.
       *
       * Aucun espace intérieur n'est comblé : s'il n'y a pas la place pour un
       * anneau, le champ n'en produit pas, et c'est la bonne réponse. */
      var marge = ecartMax * 1.15;
      var bx = Infinity, by = Infinity, bX = -Infinity, bY = -Infinity;
      P.forEach(function (q) {
        if (q.x < bx) bx = q.x; if (q.x > bX) bX = q.x;
        if (q.y < by) by = q.y; if (q.y > bY) bY = q.y;
      });
      var boiteChamp = { x: bx - marge, y: by - marge,
                         w: (bX - bx) + 2 * marge, h: (bY - by) + 2 * marge };
      // une grille carrée : sur une boîte très allongée, la résolution suit
      var res = Math.max(90, Math.min(230, Math.round(140 * Math.sqrt(cote / 400))));
      var champ = Alpage.champDistance(P, boiteChamp, res);

      var revelation = H.progressCount(nb + 1);
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var k = nb; k >= 1; k--) {
        if (nb - k >= revelation) continue;
        var segs = Alpage.ligneDeNiveau(champ, k * pasAnneau);
        ctx.beginPath();
        for (var t2 = 0; t2 < segs.length; t2++) {
          ctx.moveTo(segs[t2][0].x, segs[t2][0].y);
          ctx.lineTo(segs[t2][1].x, segs[t2][1].y);
        }
        ctx.strokeStyle = melange(encre, 0.26 + 0.5 * (1 - k / nb));
        ctx.lineWidth = Math.max(0.6, rayon * 0.0045);
        ctx.stroke();
      }
      ctx.restore();

      /* 3. la géométrie principale, plus appuyée que ses satellites */
      ctx.save();
      ctx.beginPath();
      P.forEach(function (q, i) { if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      if (p.fermee) ctx.closePath();
      ctx.strokeStyle = encre;
      ctx.lineWidth = Math.max(1.2, rayon * 0.014);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      /* 4. la date, sous le sceau, en collection */
      if (o.composition !== 'sceau' && o.texte && index != null) {
        H.text(courte(p.activity.date), boite.x + boite.w / 2, boite.y + boite.h + u(4.5),
               H.t('label', { color: faint, align: 'center', maxWidth: boite.w }));
      }
    }


    /* ================= texte ================= */

    function legende() {
      if (!o.texte) return;
      var y = g.bottom;
      var titre = String(o.titre || '').trim() ||
        (o.composition === 'sceau' ? (a.name || 'Sortie')
          : o.composition === 'triptyque' ? 'Triptyque' : 'Collection');
      H.text(titre, g.left, y - u(5.4), H.t('title', { size: 3.4, color: encre, maxWidth: g.w(4) }));

      var bouts = [];
      if (o.composition === 'sceau') {
        if (a.date) bouts.push(courte(a.date).toUpperCase());
        if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
        bouts.push(prepares[0].fermee ? 'BOUCLE FERMÉE' : 'PARCOURS OUVERT');
      } else {
        bouts.push(prepares.length + (prepares.length > 1 ? ' EMPREINTES' : ' EMPREINTE'));
        bouts.push(o.echelleCollection === 'geo' && o.composition === 'collection'
          ? 'ÉCHELLE GÉOGRAPHIQUE COMMUNE' : 'TAILLES UNIFORMES — NON COMPARABLES');
      }
      H.text(bouts.join('   ·   '), g.left, y,
             H.t('label', { color: faint, maxWidth: g.width }));
      H.text('LIGNES DÉCALÉES DU PARCOURS — CE NE SONT PAS DES COURBES D’ALTITUDE',
             g.right, y, H.t('label', { color: melange(encre, 0.3), align: 'right', maxWidth: g.w(3) }));
    }

    function courte(d) {
      if (!d) return 'sans date';
      return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
