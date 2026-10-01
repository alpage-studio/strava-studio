/* « Partition » — la sortie écrite comme une pièce courte.
 *
 * La planche dessine la partition construite par partition.js : une note par
 * point, la hauteur donnée par le relief, l'espacement par la cadence. Le
 * tracé se dessine en même temps que la tête de lecture avance — c'est la
 * même horloge (Studio.chrono) qui pilote l'aperçu animé, l'export vidéo,
 * la séquence PNG, et le lecteur audio.
 *
 * Le template ne produit AUCUN son. Il ne sait même pas qu'un lecteur
 * existe : il dessine un objet de données. C'est ce qui permet d'exporter un
 * PNG de la partition sans jamais ouvrir de contexte audio.
 *
 * Ce qui est écrit sur la planche, et pourquoi :
 *   · d'où vient la pulsation — mesurée (cadence) ou conventionnelle ;
 *   · d'où vient la mélodie — l'altitude, ou rien ;
 *   · si les pauses ont pu être identifiées.
 * Une pièce « d'après ta sortie » qui ne dit pas ce qu'elle a lu n'est
 * qu'une jolie suite de notes.
 */
Studio.template({
  id: 'partition',
  name: 'Partition — la sortie en musique',
  famille: 'affiche',
  chrono: 'lineaire',
  // la planche dure exactement ce que dure la pièce
  duree: function (o) {
    return Math.max(10, Math.min(20, Number(o.tempo) || 14)) * 1000;
  },

  variantes: [
    { nom: 'Musicale', dit: 'une pièce courte, jouable', o: {} },
    { nom: 'Graphique', dit: 'la sortie écrite dans le temps, sans son',
      o: { composition: 'graphique' } }
  ],

  options: [
    /* DEUX LECTURES DE LA MEME SORTIE.
     *
     * « Musicale » construit une pièce jouable — c'est la planche d'origine,
     * adossée à src/partition.js, et sa surface est sombre.
     * « Graphique » ecrit la sortie dans le TEMPS : altitude en ligne,
     * cadence au rythme des marques, effort en densité, pauses en trous. Elle
     * ne produit aucun son et se tient sur papier clair.
     *
     * Deux planches distinctes auraient doublé les réglages de couleur, de
     * texte et de fond pour lire exactement les mêmes données. */
    { key: 'composition', type: 'select', label: 'Composition', default: 'musicale', reflow: true,
      choices: [['musicale', 'Original · Musicale — une pièce courte, jouable'],
                ['graphique', 'Original · Graphique — la sortie écrite dans le temps']] },
    { key: 'mesure', type: 'select', label: 'Épaisseur des marques', default: 'auto',
      choices: [['auto', 'Automatique — la mesure la plus riche de la sortie'],
                ['aucune', 'Aucune — marques régulières'],
                ['w', 'Puissance'], ['hr', 'Fréquence cardiaque']] },
    { key: 'legende', type: 'toggle', label: 'Légende des correspondances', default: false },
    { key: 'ambiance', type: 'select', label: 'Ambiance', default: 'nappe',
      choices: [['nappe', 'Nappe — douce et tenue'],
                ['pince', 'Pincé — court, net'],
                ['cloche', 'Cloche — harmonique']] },
    { key: 'tempo', type: 'range', label: 'Durée (s)', default: 14, min: 10, max: 20, step: 1 },
    { key: 'volume', type: 'range', label: 'Volume', default: 70, min: 0, max: 100, step: 5 },
    { key: 'fond', type: 'color', label: 'Fond', default: '#0E0E12' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#C8F04E' },
    { key: 'trace', type: 'toggle', label: 'Tracé en regard', default: true },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte()),

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;

    /* LA GRAPHIQUE SE TIENT SUR PAPIER CLAIR, LA MUSICALE SUR FOND SOMBRE.
     *
     * Les deux partagent les memes reglages de couleur. Tant que `fond` vaut
     * encore le defaut de la planche musicale, la composition graphique lui
     * substitue le papier d'Alpage : une partition graphique sur fond noir
     * n'a rien a voir avec l'identite du studio. Des que l'utilisateur a
     * choisi une couleur, c'est la sienne qui prime — un defaut intelligent
     * qui refuserait un choix explicite serait pire que pas de defaut. */
    var graphique = o.composition === 'graphique';
    var fondSombreParDefaut = '#0E0E12';
    var fond = (graphique && (o.fond === fondSombreParDefaut || !o.fond))
      ? Alpage.PALETTE.papier : o.fond;
    var ink = (graphique && (o.encre === '#F2F0EA' || !o.encre))
      ? Alpage.PALETTE.encre : o.encre;
    var faint = melange(ink, 0.45), hair = melange(ink, 0.16);

    H.fill(fond);
    if (graphique) return dessineGraphique();
    var g = H.grid({ cols: 6, margin: u(8) });

    var part = Partition.construire(a, { duree: Number(o.tempo) || 14, ambiance: o.ambiance });

    if (part.vide) {
      H.text('Charge une sortie', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('la partition se lit dans le relief et la cadence',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint }));
      return;
    }

    /* ---------- en-tête ---------- */
    /* La planche GRAPHIQUE honorait déjà le réglage ; la MUSICALE non, et
     * l'option n'était déclarée nulle part — un réglage lu sans contrôle
     * pour l'atteindre. Les trois champs de source (pulsation, mélodie,
     * pauses) disent comment la pièce est FABRIQUÉE, pas ce qu'a fait le
     * cycliste : ils suivent dit.fabrication. */
    var dit = Alpage.dit(o);
    if (dit.titre) {
      H.text(String(o.titre || '').trim() || (a.name || 'Partition'), g.left, g.top + u(3.6),
             H.t('title', { color: ink, maxWidth: g.w(4) }));
    }
    if (dit.mesures) {
      H.text(part.duree + ' s', g.right, g.top + u(3.6),
             H.t('label', { color: faint, align: 'right' }));
    }

    /* ---------- disposition ---------- */
    var basSource = g.bottom - u(9);
    var hautPortee = g.top + u(12);
    var hTrace = o.trace ? (basSource - hautPortee) * 0.36 : 0;
    var portee = { x: g.left, y: hautPortee, w: g.width,
                   h: (basSource - hautPortee) - hTrace - (o.trace ? u(8) : 0) };

    /* ---------- la portée ---------- */
    /* Cinq lignes, comme une portée, mais ce sont les degrés de la gamme :
     * une portée classique impliquerait des altérations qui n'existent pas
     * dans une pentatonique. */
    ctx.save();
    ctx.strokeStyle = hair; ctx.lineWidth = u(0.08);
    for (var L = 0; L <= 4; L++) {
      var y = portee.y + portee.h * (L / 4);
      ctx.beginPath(); ctx.moveTo(portee.x, y); ctx.lineTo(portee.x + portee.w, y); ctx.stroke();
    }
    ctx.restore();

    var tete = Math.max(0, Math.min(1, s.progress)) * part.duree;

    part.notes.forEach(function (n) {
      var x = portee.x + (n.t / part.duree) * portee.w;
      var larg = Math.max(u(0.5), (n.duree / part.duree) * portee.w * 0.72);
      var y = portee.y + portee.h * (1 - n.degre / (part.echelle - 1));
      var passee = n.t <= tete;
      var vive = passee && n.t + n.duree >= tete;      // la note en train de sonner

      if (n.pause) {
        // un silence se dessine comme un silence : un trait, pas une note
        ctx.save();
        ctx.strokeStyle = melange(ink, 0.3); ctx.lineWidth = u(0.22);
        ctx.beginPath();
        ctx.moveTo(x, portee.y + portee.h * 0.5 - u(1.2));
        ctx.lineTo(x, portee.y + portee.h * 0.5 + u(1.2));
        ctx.stroke(); ctx.restore();
        return;
      }
      ctx.save();
      ctx.fillStyle = vive ? o.accent : (passee ? melange(ink, 0.85) : melange(ink, 0.22));
      var ep = u(0.55) + n.force * u(0.9);
      H.roundRect(x, y - ep / 2, larg, ep, ep / 2);
      ctx.fill();
      ctx.restore();
    });

    // la tête de lecture
    ctx.save();
    ctx.strokeStyle = o.accent; ctx.lineWidth = u(0.18);
    var xt = portee.x + (tete / part.duree) * portee.w;
    ctx.beginPath(); ctx.moveTo(xt, portee.y - u(2)); ctx.lineTo(xt, portee.y + portee.h + u(2));
    ctx.stroke(); ctx.restore();

    /* ---------- le tracé, en regard ---------- */
    /* Il se dessine à la MÊME position que la tête de lecture : c'est la
     * synchronisation qui rend la pièce lisible, pas la jolie courbe. */
    if (o.trace && a.route && a.route.pts.length > 1) {
      var boite = { x: g.left, y: portee.y + portee.h + u(8), w: g.width, h: hTrace };
      var pts = a.route.pts;
      var cote = Math.min(boite.w, boite.h);
      var ox = boite.x + (boite.w - cote) / 2, oy = boite.y + (boite.h - cote) / 2;
      var jusqua = Math.max(2, Math.ceil(pts.length * (tete / part.duree)));
      ctx.save();
      ctx.strokeStyle = melange(ink, 0.22); ctx.lineWidth = u(0.4);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.beginPath();
      pts.forEach(function (p, i) {
        var X = ox + p.x * cote, Y = oy + p.y * cote;
        if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      });
      ctx.stroke();
      ctx.strokeStyle = o.accent; ctx.lineWidth = u(0.7);
      ctx.beginPath();
      for (var k = 0; k < jusqua; k++) {
        var X2 = ox + pts[k].x * cote, Y2 = oy + pts[k].y * cote;
        if (k === 0) ctx.moveTo(X2, Y2); else ctx.lineTo(X2, Y2);
      }
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- d'où vient quoi ---------- */
    H.rule(g.left, basSource - u(3), g.right, { color: hair });
    var pulsation = part.source.pulsation === 'cadence'
      ? 'cadence mesurée'
      : 'pulsation conventionnelle — un choix, pas une mesure';
    var hauteur = part.source.hauteur === 'altitude'
      ? 'altitude de la trace'
      : 'aucun relief : hauteur fixe';
    [['pulsation', pulsation], ['mélodie', hauteur],
     ['pauses', part.source.pauses ? 'identifiées par l’horodatage' : 'non identifiables']]
      .forEach(function (c, i) {
        if (!dit.fabrication) return;
        H.field(c[0], c[1], g.left + i * (g.width / 3), basSource + u(1.5), {
          color: ink, labelColor: faint, role: 'meta', size: 2.2, gap: u(3.2),
          maxWidth: g.width / 3 - u(2)
        });
      });
    if (dit.fabrication) {
      H.text('GAMME PENTATONIQUE · LE SON NE DÉMARRE QUE SI TU LE DEMANDES',
             g.left, g.bottom, H.t('label', { color: faint, maxWidth: g.width }));
    }

    /* ================= LA PARTITION GRAPHIQUE =================
     *
     * L'AXE HORIZONTAL EST LE TEMPS ÉCOULÉ, pas la distance. C'est ce qui
     * distingue cette planche de toutes les autres du studio : une descente
     * de dix kilomètres en huit minutes y occupe huit minutes, et un col de
     * six kilomètres en quarante minutes en occupe quarante. Un fractionné ne
     * peut alors pas ressembler à un long col — le brief le demande, et c'est
     * l'axe qui le produit, pas un effet de dessin.
     *
     * CE QUE CHAQUE CHOSE ENCODE
     *   la ligne          l'altitude
     *   l'écart des marques   la cadence, si la sortie en porte
     *   l'épaisseur           la puissance ou le cardio, au choix
     *   les trous             les pauses, détectées à l'horodatage
     *   la petite trace       le parcours, en signature
     *
     * RIEN N'EST INVENTÉ. Chaque correspondance ne s'applique que si la
     * mesure existe dans CETTE sortie ; sinon la marque est régulière et la
     * légende le dit. Un rythme de marques fabriqué sans cadence laisserait
     * lire un pédalage qu'on n'a pas enregistré.
     */
    function dessineGraphique() {
      var dit = Alpage.dit(o);
      var g2 = H.grid({ cols: 6, margin: u(8) });
      var accent = o.accent || '#A8431F';

      var pts = (a && a.track) || [];
      var avecTemps = pts.filter(function (p) { return p.t; });
      if (avecTemps.length < 8) {
        H.text('Cette sortie n’a pas d’horodatage', g2.left, g2.top + g2.height * 0.45,
               H.t('title', { color: ink, maxWidth: g2.width }));
        H.text('La partition graphique écrit le TEMPS : sans horloge, elle n’a pas d’axe',
               g2.left, g2.top + g2.height * 0.45 + u(5),
               H.t('label', { color: faint, maxWidth: g2.width }));
        return;
      }

      var t0 = avecTemps[0].t.getTime();
      var t1 = avecTemps[avecTemps.length - 1].t.getTime();
      var duree = Math.max(1, t1 - t0);

      /* ---------- ce que la sortie porte ---------- */
      var dispo = Alpage.mesures(pts);
      function porte(c) { return dispo.some(function (m) { return m[0] === c; }); }

      var choisie = String(o.mesure || 'auto');
      if (choisie === 'auto') {
        choisie = porte('w') ? 'w' : porte('hr') ? 'hr' : 'aucune';
      } else if (choisie !== 'aucune' && !porte(choisie)) {
        choisie = 'aucune';
      }
      var nomMesure = (dispo.filter(function (m) { return m[0] === choisie; })[0] || [])[1];
      var epais = choisie === 'aucune' ? null : Alpage.serie(pts, choisie);
      var cadence = porte('cad') ? Alpage.serie(pts, 'cad') : null;
      var relief = porte('ele') ? Alpage.serie(pts, 'ele') : null;

      /* LES PAUSES, à l'horodatage. Un trou de plus de vingt secondes entre
       * deux points : la montre a cessé d'enregistrer, ou l'on s'est arrêté.
       * C'est la même règle que `movingTime()` dans activity.js — deux seuils
       * différents pour la même notion auraient fini par se contredire. */
      var pauses = [];
      for (var i = 1; i < avecTemps.length; i++) {
        var dt = avecTemps[i].t.getTime() - avecTemps[i - 1].t.getTime();
        if (dt > 20000) {
          pauses.push([(avecTemps[i - 1].t.getTime() - t0) / duree,
                       (avecTemps[i].t.getTime() - t0) / duree]);
        }
      }

      /* ---------- la mise en systèmes ----------
       * En portrait, une seule ligne de temps sur toute la largeur écraserait
       * le relief à quelques pixels de haut. On enroule donc la partition en
       * plusieurs systèmes, comme une portée musicale passe à la ligne. Le
       * nombre suit la forme de la feuille — c'est l'adaptation aux formats
       * que le brief demande, et elle est réelle, pas cosmétique. */
      var rapport = h / w;
      var nSys = rapport > 1.5 ? 4 : rapport > 1.1 ? 3 : rapport > 0.85 ? 2 : 1;

      var haut = g2.top + u(11);
      var basTexte = dit.rien ? g2.bottom : g2.bottom - u(dit.fabrication || o.legende ? 15 : 10);
      /* LA SIGNATURE SE RÉSERVE SA PLACE. Une marge forfaitaire ne suffisait
       * pas : en paysage, où un seul système prend presque toute la hauteur,
       * la petite trace venait se poser en travers du filet. */
      var cote = Math.min(g2.width * 0.22, u(22));
      var dispoH = basTexte - haut - cote - u(2);
      var hSys = dispoH / nSys;
      /* LA PART DU SYSTÈME. Un seul système doit prendre la feuille : en
       * paysage, réserver 38 % à l'interligne d'un interligne qui n'existe pas
       * laissait une planche à moitié vide sous le trait. Plus il y a de
       * systèmes, plus il faut de blanc entre eux pour qu'on les distingue. */
      var hCourbe = hSys * (nSys === 1 ? 0.84 : nSys === 2 ? 0.74 : 0.66);

      /* ---------- LA GRADUATION DU TEMPS ----------
       *
       * L'axe horizontal EST le sujet de cette planche. Sans graduation il
       * restait muet : on voyait un rythme, on ne pouvait pas dire à quelle
       * minute il tombait, et deux systèmes superposés ne disaient pas
       * lequel venait avant l'autre. Une partition numérote ses mesures ;
       * celle-ci horodate ses systèmes.
       *
       * LE PAS SE CHOISIT SUR LA DURÉE RÉELLE, pas sur un nombre fixe de
       * traits : une heure graduée toutes les cinq minutes se lit, huit
       * heures graduées de même deviennent un peigne. On vise quatre à six
       * repères par système et on retient la durée ronde la plus proche —
       * une graduation à 7 min 30 serait juste et illisible. */
      var pasCandidats = [60, 120, 300, 600, 900, 1800, 3600, 7200, 14400];
      var vise = (duree / 1000) / nSys / 5;
      var pas = pasCandidats[pasCandidats.length - 1];
      for (var pc = 0; pc < pasCandidats.length; pc++) {
        if (pasCandidats[pc] >= vise) { pas = pasCandidats[pc]; break; }
      }

      /* ---------- en-tête ---------- */
      if (!dit.rien) {
        H.text(String(o.titre || '').trim() || (a.name || 'Sortie'),
               g2.left, g2.top + u(3.6),
               H.t('title', { size: 3.2, color: ink, maxWidth: g2.w(4) }));
        H.text(H.fmt.duration(Math.round(duree / 1000)), g2.right, g2.top + u(3.6),
               H.t('label', { color: faint, align: 'right' }));
      }

      /* ---------- les systèmes ---------- */
      var vus = H.progressCount ? H.progressCount(nSys * 100) / 100 : nSys;
      for (var sy = 0; sy < nSys; sy++) {
        var f0 = sy / nSys, f1 = (sy + 1) / nSys;
        var y0 = haut + sy * hSys;
        var base = y0 + hCourbe;
        if (sy > vus) break;

        function X(f) { return g2.left + (f - f0) / (f1 - f0) * g2.width; }

        /* LES REPÈRES DE TEMPS, sous le filet.
         *
         * Ils sautent les pauses : l'horloge continue de tourner pendant un
         * arrêt, mais poser un trait au milieu du trou aurait rebouché le
         * seul endroit où l'arrêt se lit. Le temps qu'on gradue ici est
         * celui du DESSIN, et le dessin s'interrompt.
         *
         * Le premier repère de chaque système porte son heure ; les autres
         * sont nus. Une étiquette sous chacun aurait doublé la quantité de
         * texte de la planche pour une information qu'on déduit du pas. */
        ctx.save();
        ctx.strokeStyle = hair;
        ctx.lineWidth = Math.max(0.4, u(0.07));
        for (var sec = 0; sec <= duree / 1000 + 0.5; sec += pas) {
          var fr = (sec * 1000) / duree;
          if (fr < f0 - 1e-9 || fr > f1 + 1e-9) continue;
          if (dansUnePause(fr)) continue;
          var xr = X(fr);
          ctx.beginPath();
          ctx.moveTo(xr, base);
          ctx.lineTo(xr, base + u(0.8));
          ctx.stroke();
        }
        ctx.restore();

        /* L'HEURE SE POSE AU DÉBUT DU SYSTÈME, PAS AU PREMIER REPÈRE ROND.
         *
         * La première version étiquetait le premier repère tombant dans le
         * système : sur quatre systèmes, les quatre étiquettes atterrissaient
         * à quatre endroits différents — au milieu de l'un, au quart de
         * l'autre — et l'œil y lisait un désordre plutôt qu'une chronologie.
         * Une partition numérote le DÉBUT de chaque ligne. */
        if (!dit.rien) {
          H.text(horloge(f0 * duree / 1000), g2.left, base + u(4.2),
                 H.t('label', { size: 1.5, color: melange(ink, 0.30) }));
        }

        /* LE FILET DU SOL dit où commence la mesure — et il S'INTERROMPT sur
         * les pauses. Le laisser courir aurait fermé le seul endroit où l'arrêt
         * pouvait se lire comme un vide : marques et ligne sautent déjà la
         * pause, mais un trait continu dessous recollait le temps. */
        ctx.save();
        ctx.strokeStyle = hair;
        ctx.lineWidth = Math.max(0.4, u(0.07));
        segments(f0, f1).forEach(function (seg) {
          ctx.beginPath();
          ctx.moveTo(X(seg[0]), base);
          ctx.lineTo(X(seg[1]), base);
          ctx.stroke();
        });
        ctx.restore();

        /* LES MARQUES. Leur écart suit la cadence quand elle existe : plus on
         * pédale vite, plus les marques se resserrent. Leur hauteur suit la
         * mesure d'effort. Sans cadence, l'écart est régulier — et dit. */
        var nMarques = Math.round(g2.width / Math.max(3, u(0.9)));
        for (var k = 0; k <= nMarques; k++) {
          var f = f0 + (k / nMarques) * (f1 - f0);
          if (dansUnePause(f)) continue;
          var idx = indexAu(f);
          if (idx < 0) continue;
          /* la cadence resserre : on saute la marque quand le pédalage est
           * lent, on les garde toutes quand il est rapide */
          if (cadence) {
            var c = cadence.valeurs[idx];
            if ((k % 4) !== 0 && c < 0.66) continue;
            if ((k % 2) !== 0 && c < 0.33) continue;
          } else if (k % 3 !== 0) {
            continue;                       // rythme régulier, franchement espacé
          }
          var e = epais ? epais.valeurs[idx] : 0.35;
          /* LES MARQUES MONTENT PLUS HAUT QU'AU PREMIER JET. Bornées à
           * 44 % de la hauteur du système, elles laissaient une bande morte
           * entre le peigne et la ligne d'altitude : deux strates qui ne se
           * rencontraient jamais, et la moitié du système vide. Une marque
           * forte peut désormais atteindre la ligne, et parfois la croiser
           * — c'est exact : la relance a bien eu lieu à cette altitude-là. */
          var hh = hCourbe * (0.10 + 0.52 * e);
          ctx.save();
          ctx.strokeStyle = melange(ink, 0.22 + 0.5 * e);
          ctx.lineWidth = Math.max(0.5, u(0.07) * (1 + 1.6 * e));
          ctx.beginPath();
          ctx.moveTo(X(f), base);
          ctx.lineTo(X(f), base - hh);
          ctx.stroke();
          ctx.restore();
        }

        /* LA LIGNE D'ALTITUDE, par-dessus les marques : c'est elle qu'on suit. */
        if (relief) {
          ctx.save();
          ctx.strokeStyle = ink;
          ctx.lineWidth = Math.max(1, u(0.22));
          ctx.lineJoin = 'round';
          ctx.beginPath();
          var pose = false;
          for (var m = 0; m <= 240; m++) {
            var ff = f0 + (m / 240) * (f1 - f0);
            if (dansUnePause(ff)) { pose = false; continue; }
            var j = indexAu(ff);
            if (j < 0) { pose = false; continue; }
            var yy = base - hCourbe * (0.12 + 0.86 * relief.valeurs[j]);
            if (!pose) { ctx.moveTo(X(ff), yy); pose = true; } else ctx.lineTo(X(ff), yy);
          }
          ctx.stroke();
          ctx.restore();
        }

        /* LES PAUSES : un vrai trou, et deux crochets pour qu'on le lise comme
         * une interruption et non comme une donnée manquante. */
        pauses.forEach(function (p) {
          if (p[1] < f0 || p[0] > f1) return;
          var xa = X(Math.max(p[0], f0)), xb = X(Math.min(p[1], f1));
          ctx.save();
          ctx.strokeStyle = melange(accent, 0.8);
          ctx.lineWidth = Math.max(0.8, u(0.14));
          ctx.beginPath();
          ctx.moveTo(xa, base - u(1.4)); ctx.lineTo(xa, base + u(1.4));
          ctx.moveTo(xb, base - u(1.4)); ctx.lineTo(xb, base + u(1.4));
          ctx.stroke();
          ctx.restore();
        });
      }

      /* ---------- la trace en signature ---------- */
      var vue = Alpage.projette(pts);
      if (vue.pts.length > 4) {
        var boite = { x: g2.right - cote, y: basTexte - cote, w: cote, h: cote };
        var cad2 = Alpage.cadre(vue, boite, { marge: u(1) });
        ctx.save();
        ctx.strokeStyle = melange(ink, 0.5);
        ctx.lineWidth = Math.max(0.6, u(0.11));
        ctx.lineJoin = 'round';
        ctx.beginPath();
        vue.pts.forEach(function (p, i2) {
          var q = cad2.point(p);
          if (i2 === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
        });
        ctx.stroke();
        ctx.restore();
      }

      /* ---------- le texte ---------- */
      if (dit.rien) return;

      var yT = g2.bottom - u(dit.fabrication || o.legende ? 10 : 5);
      var bouts = [];
      if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
      if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' M D+');
      if (pauses.length) bouts.push(pauses.length + (pauses.length > 1 ? ' PAUSES' : ' PAUSE'));
      if (bouts.length) {
        H.text(bouts.join('  ·  '), g2.left, yT,
               H.t('label', { color: faint, maxWidth: g2.width }));
      }

      /* La légende dit ce que chaque chose encode — et surtout ce qu'elle
       * n'encode PAS. L'absence se dit toujours, légende ou non. */
      var manques = [];
      if (!relief) manques.push('ALTITUDE');
      if (!cadence) manques.push('CADENCE');
      if (!epais) manques.push('EFFORT');
      if (o.legende || manques.length) {
        var phrase;
        if (o.legende) {
          phrase = 'AXE : TEMPS ÉCOULÉ · LIGNE : ALTITUDE' +
            (cadence ? ' · ÉCART DES MARQUES : CADENCE' : '') +
            (epais ? ' · ÉPAISSEUR : ' + String(nomMesure).toUpperCase() : '');
        } else {
          phrase = '';
        }
        if (manques.length) {
          phrase += (phrase ? ' · ' : '') + 'NON ENREGISTRÉ : ' + manques.join(', ');
        }
        H.text(phrase, g2.left, yT + u(3.6),
               H.t('label', { color: melange(ink, 0.32), maxWidth: g2.width }));
      }

      /* ---- les petits outils ---- */
      /* L'HEURE ÉCOULÉE, dans une seule écriture pour toute la planche.
       * `H.fmt.duration` change de forme au passage de l'heure — « 40:00 »
       * puis « 1:00:00 » — et les deux étiquettes voisines ne se comparaient
       * plus : la même colonne disait tantôt des minutes, tantôt des heures.
       * Ici, les secondes ne servent à rien : un système dure des minutes. */
      function horloge(secondes) {
        var m = Math.round(secondes / 60);
        if (duree / 1000 < 3600) return m + ' MIN';
        var hh = Math.floor(m / 60), mm = m % 60;
        return hh + 'H' + (mm < 10 ? '0' : '') + mm;
      }

      /* Ce qui reste d'un système une fois les pauses retirées. */
      function segments(a0, a1) {
        var bouts = [], debut = a0;
        pauses.forEach(function (p) {
          if (p[1] <= a0 || p[0] >= a1) return;
          var d = Math.max(p[0], a0), f = Math.min(p[1], a1);
          if (d > debut) bouts.push([debut, d]);
          debut = Math.max(debut, f);
        });
        if (debut < a1) bouts.push([debut, a1]);
        return bouts;
      }
      function dansUnePause(f) {
        for (var i3 = 0; i3 < pauses.length; i3++) {
          if (f > pauses[i3][0] && f < pauses[i3][1]) return true;
        }
        return false;
      }
      /* L'index du point le plus proche de CET instant. Une recherche
       * proportionnelle serait fausse dès qu'il y a une pause : le temps ne
       * s'écoule pas au même rythme que les points. */
      function indexAu(f) {
        var cible = t0 + f * duree;
        var lo = 0, hi = avecTemps.length - 1;
        while (lo < hi) {
          var mid = (lo + hi) >> 1;
          if (avecTemps[mid].t.getTime() < cible) lo = mid + 1; else hi = mid;
        }
        return pts.indexOf(avecTemps[lo]);
      }
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
