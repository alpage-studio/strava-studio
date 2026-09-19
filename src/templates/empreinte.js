/* « Empreinte » — le sceau d'une sortie.
 *
 * Le parcours au centre, et autour de lui une famille de contours qui
 * s'écartent régulièrement — entre empreinte digitale, anneau de croissance
 * et estampe.
 *
 * ORIGINAL       Sceau · Triptyque · Collection
 * EXPLORATIONS   Soleil · Îlots · Contre-empreinte · Sceau cerclé
 *
 * ── Ce que les contours SONT, et ce qu'ils ne sont pas ────────────────
 *
 * Ce sont des lignes de niveau d'un CHAMP DE DISTANCE au parcours. Rien de
 * plus. Elles ne décrivent aucune altitude et la planche ne les appelle
 * jamais des courbes de niveau : la ressemblance est réelle et le
 * malentendu serait facile. L'anneau à 300 m dit « à trois cents mètres du
 * parcours », pas « à trois cents mètres d'altitude ».
 *
 * ── Fermé, ouvert : deux familles différentes ────────────────────────
 *
 * Une boucle refermée produit des contours fermés, dedans et dehors. Un
 * parcours ouvert produit des rubans ouverts. On ne referme jamais une trace
 * ouverte pour faire un plus joli sceau.
 *
 * ── Le pied de planche a trois zones, pas une ────────────────────────
 *
 * Titre, métadonnées, mention. Elles étaient posées à la même hauteur et se
 * chevauchaient dès que le texte s'allongeait — « TAILLES UNIFORMES » passait
 * à travers « CE NE SONT PAS DES COURBES D'ALTITUDE ». Chacune a maintenant
 * sa ligne, et la mention peut se taire.
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
      choices: [['sceau', 'Original · Sceau'],
                ['triptyque', 'Original · Triptyque'],
                ['collection', 'Original · Collection'],
                ['soleil', 'Exploration · Soleil — disque décentré'],
                ['ilots', 'Exploration · Îlots — trois aplats'],
                ['contre', 'Exploration · Contre-empreinte — contours seuls'],
                ['cercle', 'Exploration · Sceau cerclé']] },
    { key: 'lignes', type: 'range', label: 'Nombre de lignes', default: 13, min: 3, max: 40, step: 1 },
    { key: 'ecart', type: 'range', label: 'Écartement', default: 55, min: 10, max: 100, step: 2 },
    { key: 'aplat', type: 'select', label: 'Aplat', default: 'hautgauche', reflow: true,
      choices: [['hautgauche', 'Décalé en haut à gauche'],
                ['basdroite', 'Décalé en bas à droite'],
                ['centre', 'Centré'],
                ['aucun', 'Aucun aplat']] },
    { key: 'tailleAplat', type: 'range', label: 'Taille de l’aplat', default: 100, min: 25, max: 160, step: 5 },
    { key: 'accentC', type: 'color', label: 'Aplat', default: '#A54F37' },
    /* --- avancé --- */
    { key: 'texte', type: 'toggle', label: 'Titre et date', default: true },
    { key: 'mention', type: 'toggle', label: 'Mention « pas des courbes »', default: true },
    { key: 'ordre', type: 'select', label: 'Ordre (série)', default: 'chrono',
      choices: [['chrono', 'Chronologique'],
                ['biblio', 'Ordre de la bibliothèque']] },
    { key: 'echelleCollection', type: 'select', label: 'Échelle (collection)', default: 'uniforme',
      choices: [['uniforme', 'Taille uniforme — composition'],
                ['geo', 'Échelle géographique commune']] },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsTexte(), Alpage.optionsFond()),

  inert: function (a, vals) {
    var morts = [];
    if (!vals) return morts;
    var multi = ['triptyque', 'collection', 'ilots'].indexOf(vals.composition) >= 0;
    if (vals.composition !== 'collection') morts.push('echelleCollection');
    if (!multi) morts.push('ordre');
    // Contre-empreinte n'a pas d'aplat, par définition
    if (vals.composition === 'contre') morts.push('aplat', 'accentC', 'tailleAplat');
    else if (vals.aplat === 'aucun') morts.push('accentC', 'tailleAplat');
    // Îlots pose ses trois teintes lui-même
    if (vals.composition === 'ilots') morts.push('accentC', 'aplat');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || Alpage.PALETTE.papier);
    if (!socle.transparent) H.grain(0.012);
    var faint = melange(encre, 0.45);

    var g = H.grid({ cols: 6, margin: u(8) });
    var compo = o.composition;
    var estMulti = ['triptyque', 'collection', 'ilots'].indexOf(compo) >= 0;

    /* ---------- les sujets ---------- */
    var biblio = (s.library || []).filter(function (e) {
      return e.activity && e.activity.track && e.activity.track.length > 8;
    });
    if (o.ordre === 'chrono' && biblio.length > 1) {
      /* Chronologique par défaut : une collection d'estampes se lit dans le
       * temps, et la première version sortait 18 août, 26 août, 2 sept,
       * 8 sept, 14 juil… L'ordre de la bibliothèque reste accessible — c'est
       * lui qui permet de composer à la main. */
      biblio = biblio.slice().sort(function (x, y) {
        var dx = x.activity.date ? x.activity.date.getTime() : 0;
        var dy = y.activity.date ? y.activity.date.getTime() : 0;
        return dx - dy;
      });
    }

    var sujets;
    if (!estMulti || !biblio.length) sujets = [{ activity: a }];
    else if (compo === 'triptyque' || compo === 'ilots') sujets = biblio.slice(0, 3);
    else sujets = biblio.slice(0, 7);
    sujets = sujets.filter(function (e) { return e.activity && (e.activity.track || []).length > 8; });

    if (!sujets.length) {
      H.text('Charge une sortie', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Empreinte fabrique son sceau à partir du parcours',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint }));
      return;
    }

    /* La géométrie est calculée EN ENTIER avant toute révélation : la
     * recalculer au fil de l'animation ferait trembler les contours. */
    var prepares = sujets.map(preparer);

    /* ---------- le pied, réservé AVANT de dimensionner le dessin ---------- */
    var hPied = o.texte ? (o.mention ? u(15) : u(11)) : u(2);
    var zone = { x: g.left, y: g.top + u(2), w: g.width, h: g.height - hPied };

    /* ---------- disposition ---------- */
    if (compo === 'ilots') poseIlots(zone);
    else if (estMulti) poseGrille(zone);
    else poseSceau(prepares[0], zone, 1);

    legende();

    /* ================= préparation ================= */

    function preparer(e) {
      var vue = Alpage.projette(e.activity.track);
      var pas = Math.max(2, vue.etendue / 520);
      /* Lissage des DIRECTIONS avant tout contour : rééchantillonner rend la
       * polyligne linéaire par morceaux, et les angles vifs des sommets
       * d'origine se voient dans les anneaux. */
      var pts = Alpage.reechantillonne(vue.pts, pas);
      var fen = Math.max(3, Math.round(pts.length / 60));
      pts = Alpage.lisseDirections(Alpage.lisse(pts, fen), fen);
      var fermee = pts.length > 8 &&
        Math.hypot(pts[0].x - pts[pts.length - 1].x, pts[0].y - pts[pts.length - 1].y) < vue.etendue * 0.02;
      return { entree: e, activity: e.activity, vue: vue, pts: pts, fermee: fermee };
    }

    /* ================= dispositions ================= */

    function poseGrille(boite) {
      var n = prepares.length;
      var cols = n <= 1 ? 1 : n <= 4 ? 2 : 3;
      if (compo === 'triptyque') cols = (w > h) ? 3 : 1;
      var rows = Math.ceil(n / cols);
      var cw = boite.w / cols, chh = boite.h / rows;
      var reste = n % cols;
      var decale = reste ? (cols - reste) * cw / 2 : 0;
      var derniere = Math.floor((n - 1) / cols);
      var etendueMax = Math.max.apply(null, prepares.map(function (p) { return p.vue.etendue; })) || 1;
      prepares.forEach(function (p, i) {
        var rangee = Math.floor(i / cols);
        var cx = boite.x + (i % cols) * cw + (rangee === derniere ? decale : 0);
        var cy = boite.y + rangee * chh;
        var facteur = (o.echelleCollection === 'geo' && compo === 'collection')
          ? Math.max(0.28, Math.sqrt(p.vue.etendue / etendueMax)) : 1;
        poseSceau(p, { x: cx + u(1), y: cy + u(1), w: cw - u(2), h: chh - u(7) }, facteur, i);
      });
    }

    /* ÎLOTS — trois empreintes, trois aplats, une asymétrie tenue.
     * Ni grille régulière, ni tailles identiques : les positions et les
     * échelles sont posées à la main, en fractions de la zone. C'est une
     * COMPOSITION, et les tailles ne comparent rien — la mention le dit. */
    function poseIlots(boite) {
      var TEINTES = [Alpage.PALETTE.rouille, '#C99A32', '#355E70'];
      var PLACES = (w > h * 1.15)
        ? [[0.20, 0.44, 1.00], [0.53, 0.26, 0.76], [0.81, 0.66, 0.90]]
        : [[0.34, 0.20, 1.00], [0.68, 0.49, 0.78], [0.33, 0.78, 0.88]];
      var cote = Math.min(boite.w, boite.h) * (w > h * 1.15 ? 0.56 : 0.54);
      prepares.slice(0, 3).forEach(function (p, i) {
        var pl = PLACES[i];
        var c = cote * pl[2];
        poseSceau(p, { x: boite.x + boite.w * pl[0] - c / 2,
                       y: boite.y + boite.h * pl[1] - c / 2, w: c, h: c }, 1, null,
                  { teinte: TEINTES[i], aplat: i === 1 ? 'basdroite' : 'hautgauche' });
      });
    }

    /* ================= un sceau ================= */

    function poseSceau(p, boite, facteur, index, forcage) {
      forcage = forcage || {};
      var cote = Math.min(boite.w, boite.h) * facteur;
      var sousBoite = { x: boite.x + (boite.w - cote) / 2, y: boite.y + (boite.h - cote) / 2,
                        w: cote, h: cote };
      var cadre = Alpage.cadre(p.vue, sousBoite, { marge: cote * (compo === 'cercle' ? 0.27 : 0.2) });
      var P = p.pts.map(cadre.point);

      /* La taille de la FORME, pas celle de la case. */
      var cx = 0, cy = 0;
      P.forEach(function (q) { cx += q.x; cy += q.y; });
      cx /= P.length; cy /= P.length;
      var rayon = 0, demiL = 0, demiH = 0;
      P.forEach(function (q) {
        rayon = Math.max(rayon, Math.hypot(q.x - cx, q.y - cy));
        demiL = Math.max(demiL, Math.abs(q.x - cx));
        demiH = Math.max(demiH, Math.abs(q.y - cy));
      });
      rayon = Math.max(rayon, cote * 0.04);

      /* Contre-empreinte : moins de lignes, chacune plus présente. */
      var nb = Math.max(3, Math.round(compo === 'contre'
        ? Math.max(12, Math.min(18, o.lignes)) : o.lignes));
      var ecartMax = rayon * 0.85 * (Number(o.ecart) || 40) / 100;
      var pasAnneau = ecartMax / nb;
      var mini = Math.max(1.4, u(0.18));
      if (pasAnneau < mini) { pasAnneau = mini; nb = Math.max(3, Math.floor(ecartMax / pasAnneau)); }

      /* --- 1. l'aplat, derrière --- */
      var aplat = forcage.aplat || o.aplat;
      if (compo !== 'contre' && aplat !== 'aucun') {
        /* Rayon sur la MOYENNE GÉOMÉTRIQUE des demi-dimensions : sur un
         * parcours allongé, le rayon maximal vaut la demi-longueur et le
         * disque avalait toute la planche.
         *
         * « Soleil » le réduit encore et le décale davantage : il doit
         * ponctuer le dessin, pas le dominer. */
        var estSoleil = compo === 'soleil';
        var base = Math.sqrt(Math.max(1, demiL) * Math.max(1, demiH));
        var rAplat = (estSoleil ? base * 0.58 : base * 1.1 + ecartMax * 0.3)
                     * (Number(o.tailleAplat) || 100) / 100;
        rAplat = Math.max(rayon * (estSoleil ? 0.13 : 0.24), Math.min(rayon * 0.92, rAplat));
        var dec = (rAplat + ecartMax) * (estSoleil ? 0.9 : 0.2);
        var dx = aplat === 'hautgauche' ? -dec : aplat === 'basdroite' ? dec : 0;
        var dy = aplat === 'hautgauche' ? -dec * 0.8 : aplat === 'basdroite' ? dec * 0.8 : 0;
        ctx.save();
        ctx.fillStyle = forcage.teinte || o.accentC;
        ctx.globalAlpha = 0.92;
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, rAplat, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      /* --- 2. les contours, par champ de distance ---
       * Les anneaux fusionnent d'eux-mêmes là où la place manque,
       * s'arrondissent aux extrémités et contournent proprement un parcours
       * qui se recoupe. Un décalage par les normales, essayé d'abord,
       * s'effondrait sur toute forme allongée. Aucun espace intérieur n'est
       * comblé : s'il n'y a pas la place, le champ n'en produit pas. */
      var marge = ecartMax * 1.15;
      var bx = Infinity, by = Infinity, bX = -Infinity, bY = -Infinity;
      P.forEach(function (q) {
        if (q.x < bx) bx = q.x; if (q.x > bX) bX = q.x;
        if (q.y < by) by = q.y; if (q.y > bY) bY = q.y;
      });
      var boiteChamp = { x: bx - marge, y: by - marge,
                         w: (bX - bx) + 2 * marge, h: (bY - by) + 2 * marge };
      var res = Math.max(110, Math.min(260, Math.round(170 * Math.sqrt(cote / 400))));
      var champ = Alpage.champDistance(P, boiteChamp, res);

      var revelation = H.progressCount(nb + 1);

      /* UNE LIGNE PÂLE DISPARAÎT QUAND LE MÉDAILLON RÉTRÉCIT.
       *
       * Dans les compositions à trois sujets — Îlots, Triptyque, Collection —
       * chaque empreinte fait le tiers d'un sceau, et ses contours, dessinés
       * à la même finesse et à la même pâleur que sur une planche unique,
       * s'effaçaient : il ne restait que l'aplat. C'est la TAILLE qui décide
       * de ce qui reste lisible, pas la composition — on mesure donc le
       * rayon plutôt que de tester un nom.
       *
       * `petit` vaut 0 pour un sceau pleine page, 1 pour un médaillon de
       * collection. */
      var petit = Math.max(0, Math.min(1, (u(26) - rayon) / u(14)));
      var epais = (compo === 'contre' ? rayon * 0.011 : rayon * 0.0062) * (1 + 1.2 * petit);
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
        /* Le dégradé du plus lointain au plus proche reste, mais son point
         * de départ remonte quand la figure est petite. */
        ctx.strokeStyle = melange(encre, compo === 'contre'
          ? 0.42 + 0.42 * (1 - k / nb)
          : (0.26 + 0.26 * petit) + (0.5 + 0.16 * petit) * (1 - k / nb));
        ctx.lineWidth = Math.max(0.6, epais);
        ctx.stroke();
      }
      ctx.restore();

      /* --- 3. la géométrie principale --- */
      ctx.save();
      ctx.beginPath();
      P.forEach(function (q, i) { if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y); });
      if (p.fermee) ctx.closePath();
      ctx.strokeStyle = encre;
      ctx.lineWidth = Math.max(1.2, rayon * (compo === 'contre' ? 0.020 : 0.014));
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();

      /* --- 4. le cercle du « sceau cerclé » ---
       * Il RASSEMBLE l'empreinte sans la déformer : c'est un cadre posé
       * autour, pas une déformation du parcours. */
      if (compo === 'cercle') {
        var rc = Math.max(rayon + ecartMax * 1.2, cote * 0.40);
        ctx.save();
        ctx.beginPath(); ctx.arc(cx, cy, rc, 0, Math.PI * 2);
        ctx.strokeStyle = melange(encre, 0.55);
        ctx.lineWidth = Math.max(1, rayon * 0.010);
        ctx.stroke();
        ctx.beginPath(); ctx.arc(cx, cy, rc * 1.045, 0, Math.PI * 2);
        ctx.strokeStyle = melange(encre, 0.22);
        ctx.lineWidth = Math.max(0.6, rayon * 0.005);
        ctx.stroke();
        ctx.restore();
        if (o.texte) texteEnArc(cx, cy, rc * 1.13, p.activity);
      }

      /* --- 5. la date, sous chaque pièce d'une série --- */
      if (estMulti && o.texte && index != null) {
        H.text(courte(p.activity.date), boite.x + boite.w / 2, boite.y + boite.h + u(4.5),
               H.t('label', { color: faint, align: 'center', maxWidth: boite.w }));
      }
    }

    /* Le nom sur un arc court. Au-delà d'une longueur, il repasse sous le
     * cercle : un titre long étiré sur un arc devient illisible bien avant
     * d'en faire le tour. */
    function texteEnArc(cx, cy, r, act) {
      var str = (String(o.titre || '').trim() || act.name || 'Sortie').toUpperCase();
      var style = H.t('label', { size: 1.9, color: encre });
      var larg = H.measureWith(str, style, style.size);
      if (larg > Math.PI * 0.62 * r) {
        H.text(str, cx, cy + r + u(4),
               H.t('label', { color: encre, align: 'center', maxWidth: g.width }));
        return;
      }
      ctx.save();
      ctx.fillStyle = encre;
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.font = '600 ' + style.size + 'px ' + H.FONT;
      var total = larg / r, depart = -Math.PI / 2 - total / 2, pos = 0;
      for (var i = 0; i < str.length; i++) {
        var c = str[i], lc = ctx.measureText(c).width;
        var ang = depart + (pos + lc / 2) / r;
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
        ctx.rotate(ang + Math.PI / 2);
        ctx.fillText(c, 0, 0);
        ctx.restore();
        pos += lc;
      }
      ctx.restore();
    }

    /* ================= pied de planche =================
     * Trois lignes, trois hauteurs. Elles partageaient la même avant, et se
     * traversaient dès que l'une s'allongeait. */
    function legende() {
      var dit = Alpage.dit(o);
      if (dit.rien) return;
      if (!o.texte) return;
      var yMention = g.bottom;
      var yMeta = o.mention ? yMention - u(4.2) : yMention;
      var yTitre = yMeta - u(5.4);

      var titre = String(o.titre || '').trim() ||
        (estMulti ? (compo === 'ilots' ? 'Îlots' : compo === 'triptyque' ? 'Triptyque' : 'Collection')
                  : (a.name || 'Sortie'));
      H.text(titre, g.left, yTitre, H.t('title', { size: 3.4, color: encre, maxWidth: g.w(4) }));

      var bouts = [];
      if (!estMulti) {
        if (a.date) bouts.push(courte(a.date).toUpperCase());
        if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
        bouts.push(prepares[0].fermee ? 'BOUCLE FERMÉE' : 'PARCOURS OUVERT');
      } else {
        bouts.push(prepares.length + (prepares.length > 1 ? ' EMPREINTES' : ' EMPREINTE'));
        if (compo === 'ilots') bouts.push('TAILLES DE COMPOSITION — SANS COMPARAISON');
        else bouts.push(o.echelleCollection === 'geo' && compo === 'collection'
          ? 'ÉCHELLE GÉOGRAPHIQUE COMMUNE' : 'TAILLES UNIFORMES');
      }
      H.text(bouts.join('   ·   '), g.left, yMeta,
             H.t('label', { color: faint, maxWidth: g.width }));

      /* CETTE PHRASE N'EXPLIQUE PAS LA FABRICATION : ELLE EMPECHE UNE ERREUR.
       *
       * Les contours ressemblent a des courbes de niveau au point qu'on les
       * lit comme telles. L'en-tete de ce fichier le dit : « la ressemblance
       * est reelle et le malentendu serait facile ». La retirer rendrait la
       * planche plus propre et laisserait croire qu'on lit une altitude.
       *
       * Elle raccourcit donc au lieu de disparaitre : six mots suffisent a
       * eviter l'erreur, et la phrase entiere reste en « Données ». */
      if (o.mention && !dit.rien) {
        H.text(dit.fabrication
                 ? 'LIGNES DÉCALÉES DU PARCOURS — CE NE SONT PAS DES COURBES D’ALTITUDE'
                 : 'LIGNES DE DISTANCE, NON D’ALTITUDE',
               g.left, yMention, H.t('label', { color: melange(encre, 0.3), maxWidth: g.width }));
      }
    }

    function courte(d) {
      if (!d) return 'sans date';
      return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
    void papier;
  }
});
