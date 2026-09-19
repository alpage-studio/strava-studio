/* « Sous-bois » — le souvenir du lieu.
 *
 * Une carte de sortie dessinée à l'encre : un trait fin, un peu tremblé, sur
 * un papier ivoire. Quelques sapins en marge, deux ou trois noms posés le long
 * du chemin, et beaucoup de vide. Ce n'est pas une carte topographique — c'est
 * la page d'un carnet.
 *
 * ── LE TREMBLÉ EST DÉTERMINISTE, ET IL LE RESTE ──────────────────────
 *
 * L'irrégularité vient de `Alpage.graine(vue)`, semée sur la GÉOMÉTRIE de la
 * sortie : même parcours, même tremblé, à chaque rendu. Un bruit tiré au sort
 * à chaque image ferait grésiller le trait pendant l'export animé — trente
 * images par seconde d'une carte qui frissonne.
 *
 * Il est aussi BORNÉ. Un tremblé libre efface les lacets : c'est exactement ce
 * qu'il ne faut pas, puisque les lacets sont ce qu'on reconnaît d'une sortie.
 * L'écart est donc plafonné à une fraction de l'espacement des points, et il
 * se pose le long de la NORMALE — jamais dans le sens de la marche, où il
 * rallongerait ou raccourcirait le chemin.
 *
 * ── LES SAPINS NE SONT PAS DES ARBRES ────────────────────────────────
 *
 * Ce sont des ornements. Ils ne décrivent aucune forêt, aucune position, et
 * la planche ne le laisse pas croire : ils se posent dans les MARGES, à
 * distance du tracé, et les « Données » le disent en toutes lettres.
 *
 * Un GPX ne porte aucune information de couvert végétal. Dessiner des arbres
 * là où le terrain en a demanderait une source que nous n'avons pas, et
 * inventer cette source serait pire que de s'en passer.
 *
 * ── AUCUNE ANNOTATION N'EST INVENTÉE ─────────────────────────────────
 *
 * Trois champs, vides par défaut. Le studio ne connaît ni le nom du col, ni
 * celui du refuge : il ne possède que des coordonnées. Deviner « Col de… »
 * depuis une latitude demanderait un service extérieur, et une devinette
 * imprimée sur une affiche devient un souvenir faux.
 */
Studio.template({
  id: 'sous-bois',
  name: 'Sous-bois — le souvenir du lieu',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  variantes: [
    { nom: 'Carnet', dit: 'trait fin, sapins en marge', o: {} },
    { nom: 'Clairière', dit: 'le chemin seul, beaucoup de papier',
      o: { composition: 'clairiere' } },
    { nom: 'Charbon', dit: 'encre sombre plutôt que verte', o: { encre: '#242820' } }
  ],

  options: [
    /* LA COMPOSITION EN PREMIER, comme partout ailleurs dans le studio.
     * Sans elle, la première liste déroulante de cette planche était
     * « Texte », héritée du socle — et le catalogue proposait alors comme
     * « variantes » les trois niveaux de texte, ce qui n'est pas un choix de
     * composition. Le harnais l'a vu avant moi. */
    { key: 'composition', type: 'select', label: 'Composition', default: 'carnet', reflow: true,
      choices: [['carnet', 'Original · Carnet — la carte et ses sapins'],
                ['clairiere', 'Original · Clairière — le chemin seul']] },
    { key: 'ornements', type: 'range', label: 'Sapins en marge', default: 7, min: 0, max: 14, step: 1 },
    { key: 'tremble', type: 'range', label: 'Tremblé du trait', default: 55, min: 0, max: 100, step: 5 },
    { key: 'trait', type: 'range', label: 'Épaisseur du trait', default: 22, min: 10, max: 46, step: 2 },
    /* LES TROIS ANNOTATIONS, VIDES PAR DÉFAUT. « Position » n'a de sens que
     * si le champ porte un texte : un repère sans nom ne dit rien. */
    { key: 'note1', type: 'text', label: 'Repère 1 — col, refuge, souvenir', default: '' },
    { key: 'pos1', type: 'range', label: 'Repère 1 · où sur le parcours', default: 25, min: 0, max: 100, step: 1 },
    { key: 'note2', type: 'text', label: 'Repère 2', default: '' },
    { key: 'pos2', type: 'range', label: 'Repère 2 · où sur le parcours', default: 55, min: 0, max: 100, step: 1 },
    { key: 'note3', type: 'text', label: 'Repère 3', default: '' },
    { key: 'pos3', type: 'range', label: 'Repère 3 · où sur le parcours', default: 80, min: 0, max: 100, step: 1 },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte(), Alpage.optionsFond('#2C3A2E')),

  draw: function (s) {
    var ctx = s.ctx, a = s.a, o = s.o, H = s.H, u = H.u;
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var faint = melange(encre, 0.45);
    var g = H.grid({ cols: 6, margin: u(8) });
    var dit = Alpage.dit(o);

    var vue = Alpage.projette(a && a.track);
    if (vue.pts.length < 4) {
      /* AUCUN PARCOURS INVENTÉ. Sans trace, il n'y a pas de carte — et une
       * carte fabriquée serait le seul mensonge que cette planche puisse
       * commettre. */
      H.text('Cette sortie n’a pas de trace', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Sous-bois dessine le chemin parcouru : il lui faut des coordonnées',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- cadrage asymétrique ----------
     * Le chemin monte vers la droite et laisse l'angle bas-gauche au texte :
     * la référence est une page de carnet, pas une planche centrée. */
    var basTexte = dit.rien ? g.bottom : g.bottom - u(dit.fabrication ? 17 : 13);
    var zone = { x: g.left, y: g.top + u(2), w: g.width, h: basTexte - g.top - u(2) };
    var cadre = Alpage.cadre(vue, zone, {
      marge: u(4), echelle: 0.82, ancreX: 0.12, ancreY: -0.10
    });

    /* Un pas fixe en MÈTRES : sans lui, le tremblé raconterait la densité des
     * points GPS — donc la vitesse — au lieu de la forme du chemin. */
    var pas = Alpage.reechantillonne(vue.pts, Math.max(6, vue.etendue / 420));
    var P = pas.map(cadre.point);
    var N = Alpage.normales(P);
    var alea = Alpage.graine(vue);

    /* Le tremblé, borné par l'espacement des points : au-delà, les lacets se
     * referment et le parcours devient une courbe générique. */
    var espacement = 0;
    for (var i = 1; i < P.length; i++) {
      espacement += Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y);
    }
    espacement = P.length > 1 ? espacement / (P.length - 1) : 1;
    var ampleur = Math.min(espacement * 0.45, u(0.55)) * ((o.tremble == null ? 55 : o.tremble) / 100);

    var T = P.map(function (p, k) {
      var d = Alpage.ondulation(alea, k, 26, 3) * ampleur;
      var n = N[k] || { x: 0, y: 0 };
      return { x: p.x + n.x * d, y: p.y + n.y * d };
    });

    /* ---------- les ornements, dans les marges ----------
     * « Clairière » les retire tous : la même carte, sans rien autour. */
    var nOrn = o.composition === 'clairiere' ? 0
      : Math.max(0, Math.min(14, Math.round(o.ornements == null ? 7 : o.ornements)));
    if (nOrn) dessineOrnements(nOrn);

    /* ---------- le chemin ---------- */
    var vus = H.progressCount ? H.progressCount(T.length) : T.length;
    ctx.save();
    ctx.strokeStyle = encre;
    ctx.lineWidth = Math.max(0.7, u((o.trait == null ? 22 : o.trait) / 22 * 0.18));
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (var k = 0; k < vus; k++) {
      if (k === 0) ctx.moveTo(T[k].x, T[k].y); else ctx.lineTo(T[k].x, T[k].y);
    }
    ctx.stroke();
    ctx.restore();

    /* Le départ, d'un petit rond ouvert — le seul repère que la planche pose
     * d'elle-même, et il ne prétend rien nommer. */
    if (vus > 2) {
      ctx.save();
      ctx.strokeStyle = encre;
      ctx.lineWidth = Math.max(0.7, u(0.16));
      ctx.beginPath();
      ctx.arc(T[0].x, T[0].y, u(0.9), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    /* ---------- les repères, s'il y en a ---------- */
    if (!dit.rien && vus >= T.length) reperes();

    /* ---------- le texte ---------- */
    if (dit.rien) return;

    var yTitre = g.bottom - u(dit.fabrication ? 12 : 7);
    var titre = String(o.titre || '').trim() || a.name || 'Sortie';
    H.text(titre, g.left, yTitre, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(4) }));

    var bouts = [];
    if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
    if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' M D+');
    if (a.duration_s) bouts.push(H.fmt.duration(a.duration_s));
    if (bouts.length) {
      H.text(bouts.join('  ·  '), g.left, yTitre + u(4.2),
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    if (dit.fabrication) {
      H.text('SAPINS DÉCORATIFS — AUCUNE POSITION RÉELLE · TRAIT LÉGÈREMENT TREMBLÉ',
             g.left, yTitre + u(8),
             H.t('label', { color: melange(encre, 0.3), maxWidth: g.width }));
    }

    /* ================= les morceaux ================= */

    /* Les repères de l'utilisateur, posés le long du chemin. Rien ici n'est
     * deviné : un champ vide ne dessine rien. */
    function reperes() {
      [[o.note1, o.pos1], [o.note2, o.pos2], [o.note3, o.pos3]].forEach(function (r) {
        var texte = String(r[0] || '').trim();
        if (!texte) return;
        var f = Math.max(0, Math.min(1, (r[1] == null ? 50 : r[1]) / 100));
        var p = T[Math.min(T.length - 1, Math.round(f * (T.length - 1)))];
        ctx.save();
        ctx.strokeStyle = melange(encre, 0.7);
        ctx.lineWidth = Math.max(0.6, u(0.14));
        /* une petite croix, comme sur un carnet */
        ctx.beginPath();
        ctx.moveTo(p.x - u(0.7), p.y - u(0.7)); ctx.lineTo(p.x + u(0.7), p.y + u(0.7));
        ctx.moveTo(p.x + u(0.7), p.y - u(0.7)); ctx.lineTo(p.x - u(0.7), p.y + u(0.7));
        ctx.stroke();
        ctx.restore();
        /* L'étiquette se pose du côté où il reste de la place : à gauche du
         * point quand il est dans la moitié droite, et réciproquement. Un
         * texte ancré toujours à gauche sortait de la feuille. */
        var aDroite = p.x < (g.left + g.right) / 2;
        H.text(texte, p.x + (aDroite ? u(1.6) : -u(1.6)), p.y - u(1.2),
               H.t('label', { color: encre, align: aDroite ? 'left' : 'right',
                              maxWidth: g.w(2) }));
      });
    }

    /* Des sapins et des touffes, posés dans le vide. Ils évitent le tracé :
     * un ornement collé au chemin se lirait comme une information. */
    function dessineOrnements(combien) {
      var libre = [];
      var mailleX = 11, mailleY = 15;
      var seuil = Math.min(zone.w, zone.h) * 0.085;
      /* LA ZONE DES ORNEMENTS N'EST PAS CELLE DE LA CARTE.
       *
       * Les sapins se posaient jusqu'au bas du cadre et venaient s'asseoir
       * sur le titre ; d'autres touchaient la marge droite. Un arbre à demi
       * sorti de la feuille ne se lit plus comme un ornement, il se lit
       * comme une erreur d'impression. On garde donc une réserve tout
       * autour, et surtout au-dessus du bloc de texte. */
      var marge = u(4);
      var orn = { x: zone.x + marge, y: zone.y + marge,
                  w: zone.w - 2 * marge, h: zone.h - 2 * marge };
      for (var ix = 0; ix < mailleX; ix++) {
        for (var iy = 0; iy < mailleY; iy++) {
          var cx = orn.x + (ix + 0.5) / mailleX * orn.w;
          var cy = orn.y + (iy + 0.5) / mailleY * orn.h;
          var proche = Infinity;
          for (var j = 0; j < P.length; j += 3) {
            var dd = Math.hypot(P[j].x - cx, P[j].y - cy);
            if (dd < proche) proche = dd;
          }
          if (proche > seuil) libre.push({ x: cx, y: cy, loin: proche });
        }
      }
      /* Les plus éloignées d'abord, puis un ordre stable : deux rendus de la
       * même sortie doivent poser les mêmes arbres aux mêmes endroits. */
      libre.sort(function (m, n) { return n.loin - m.loin || m.x - n.x || m.y - n.y; });

      /* EN BOSQUETS, PAS EN LISTE.
       *
       * Prendre simplement les cases les plus éloignées du tracé les choisit
       * toutes sur le MÊME bord — celui d'où le parcours est le plus loin —
       * et les sapins s'alignaient en colonne. Une colonne régulière se lit
       * comme une légende, pas comme un sous-bois.
       *
       * On retient donc deux ou trois ancres bien séparées, et on groupe les
       * arbres autour. L'écart vient de `alea`, semé sur la géométrie : les
       * mêmes bosquets à chaque rendu. */
      var ancres = [];
      var ecartMini = Math.min(zone.w, zone.h) * 0.30;
      for (var q = 0; q < libre.length && ancres.length < 3; q++) {
        var c = libre[q], loin = true;
        for (var r = 0; r < ancres.length; r++) {
          if (Math.hypot(ancres[r].x - c.x, ancres[r].y - c.y) < ecartMini) { loin = false; break; }
        }
        if (loin) ancres.push(c);
      }
      if (!ancres.length) return;

      ctx.save();
      ctx.strokeStyle = melange(encre, 0.55);
      ctx.lineWidth = Math.max(0.5, u(0.12));
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      var poses = [];
      for (var n = 0; n < combien; n++) {
        var an = ancres[n % ancres.length];
        var rayon = u(4.6);
        var px = an.x + (alea(n + 31, 6) * 2 - 1) * rayon;
        var py = an.y + (alea(n + 47, 7) * 2 - 1) * rayon * 0.72;
        /* la dispersion peut sortir de la réserve : on y ramène */
        px = Math.max(orn.x, Math.min(orn.x + orn.w, px));
        py = Math.max(orn.y, Math.min(orn.y + orn.h, py));
        /* deux arbres superposés font une tache : on écarte, ou on renonce */
        var serre = false;
        for (var t2 = 0; t2 < poses.length; t2++) {
          if (Math.hypot(poses[t2].x - px, poses[t2].y - py) < u(2.4)) { serre = true; break; }
        }
        if (serre) continue;
        /* jamais sur le tracé, même après dispersion */
        var pres = Infinity;
        for (var j2 = 0; j2 < P.length; j2 += 3) {
          var d2 = Math.hypot(P[j2].x - px, P[j2].y - py);
          if (d2 < pres) pres = d2;
        }
        if (pres < seuil * 0.75) continue;
        poses.push({ x: px, y: py });
        var haut = u(3.0) * (0.78 + 0.44 * alea(n + 91, 5));
        if (alea(n + 17, 2) > 0.74) touffe(px, py, haut);
        else sapin(px, py, haut);
      }
      ctx.restore();
    }

    /* Un sapin : quatre étages de branches qui s'élargissent vers le bas, et
     * un tronc COURT sous le dernier.
     *
     * Le premier jet faisait monter le tronc sur toute la hauteur, à travers
     * les étages : cela ne se lisait plus comme un arbre mais comme une
     * flèche empennée. Un trait de trop, et le motif change de sujet. */
    function sapin(x, y, haut) {
      var large = haut * 0.40;
      var cime = y - haut * 0.50, pied = y + haut * 0.30;
      ctx.beginPath();
      /* tronc : seulement sous le feuillage */
      ctx.moveTo(x, pied);
      ctx.lineTo(x, y + haut * 0.50);
      for (var e = 0; e < 4; e++) {
        var t = e / 3;
        var ye = cime + (pied - cime) * (0.22 + 0.78 * t);
        var l = large * (0.30 + 0.70 * t);
        /* chaque étage retombe légèrement : c'est ce qui fait la branche */
        ctx.moveTo(x - l, ye);
        ctx.lineTo(x, ye - haut * 0.26);
        ctx.lineTo(x + l, ye);
      }
      ctx.stroke();
    }

    /* Une touffe : une tige et quelques départs. Elle casse la répétition
     * sans prétendre nommer une espèce. */
    function touffe(x, y, haut) {
      ctx.beginPath();
      ctx.moveTo(x, y + haut * 0.5);
      ctx.lineTo(x, y - haut * 0.5);
      for (var e = 0; e < 3; e++) {
        var ye = y + haut * 0.25 - haut * 0.30 * e;
        var l = haut * 0.26 * (1 - e * 0.18);
        ctx.moveTo(x, ye);
        ctx.lineTo(x - l, ye - l * 0.85);
        ctx.moveTo(x, ye);
        ctx.lineTo(x + l, ye - l * 0.85);
      }
      ctx.stroke();
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
