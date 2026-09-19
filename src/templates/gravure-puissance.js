/* « Gravure de puissance » — l'effort en watts, en lignes.
 *
 * La sœur de Gravure d'altitude : même dessin, autre grandeur. Le tracé de
 * puissance d'UNE sortie devient le sujet, et sous lui des copies qui le
 * reprennent en s'aplatissant. Le dessin est partagé (`Alpage.graveLignes`) ;
 * ce qui suit ne l'est PAS, parce que les watts ne se lisent pas comme des
 * mètres.
 *
 * ── LE PIED DU DESSIN EST ZÉRO WATT ──────────────────────────────────
 *
 * L'altitude se lit entre son minimum et son maximum : personne ne monte
 * depuis le niveau de la mer. La puissance, elle, part de zéro — ne pas
 * pédaler n'est pas une absence de mesure, c'est une descente. Ancrer les
 * watts sur leur minimum effacerait les récupérations, qui sont la moitié de
 * ce que raconte une sortie.
 *
 * ── L'ÉCHELLE EST ABSOLUE, ET C'EST TOUT LE SUJET ────────────────────
 *
 * `a.power.data[].y` est normalisé par le maximum de la sortie. Dessiné tel
 * quel, un tempo régulier à 150 W et une séance de sprints à 400 W donnent
 * deux affiches IDENTIQUES — exactement le piège déjà rencontré sur
 * l'altitude, où une plaine de dix-sept mètres prenait l'allure d'un col.
 *
 * On dessine donc les WATTS, rapportés à une référence choisie. Une sortie
 * facile occupe peu de hauteur, une sortie dure en occupe beaucoup, et deux
 * affiches côte à côte se comparent pour de bon.
 *
 * Le FTP, quand on le connaît, est la meilleure référence : il rapporte
 * l'effort à CE coureur plutôt qu'à un barème. Il n'arrive que de Strava ou
 * d'intervals.icu — un GPX ne le porte pas — d'où le repli sur 400 W, dit
 * dans le réglage et non caché.
 *
 * ── CE QUE LES COPIES NE SONT PAS ────────────────────────────────────
 *
 * Ni des zones d'entraînement, ni des intervalles de tolérance : des copies
 * du même tracé, écrasées. Seule la ligne du haut est mesurée.
 */
Studio.template({
  id: 'gravure-puissance',
  name: 'Gravure de puissance — l’effort en watts',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  variantes: [
    { nom: 'Frise', dit: 'l’effort traverse la feuille',
      o: { composition: 'frise' } },
    { nom: 'Massif', dit: 'un bloc compact, lignes serrées',
      o: { composition: 'massif' } }
  ],

  options: [
    { key: 'composition', type: 'select', label: 'Composition', default: 'frise', reflow: true,
      choices: [['frise', 'Original · Frise — l’effort traverse la feuille'],
                ['massif', 'Original · Massif — un bloc de lignes serrées']] },
    { key: 'reference', type: 'select', label: 'Échelle verticale', default: 'auto',
      choices: [['auto', 'Automatique — ton FTP s’il est connu, sinon 400 W'],
                ['250', 'Pleine hauteur à 250 W'],
                ['400', 'Pleine hauteur à 400 W'],
                ['600', 'Pleine hauteur à 600 W']] },
    { key: 'lignes', type: 'range', label: 'Nombre de lignes', default: 26, min: 10, max: 44, step: 1 },
    { key: 'pic', type: 'toggle', label: 'Marquer le pic de puissance', default: true },
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A54F37' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte(), Alpage.optionsFond()),

  draw: function (s) {
    var ctx = s.ctx, a = s.a, o = s.o, H = s.H, u = H.u;
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var faint = melange(encre, 0.45);
    var g = H.grid({ cols: 6, margin: u(8) });
    var dit = Alpage.dit(o);
    var compo = o.composition === 'massif' ? 'massif' : 'frise';

    var serie = (a && a.power && a.power.data) || [];
    if (!a || !a.has_power || serie.length < 4) {
      /* RIEN N'EST INVENTÉ. Sans capteur, la puissance ne se déduit pas : on
       * pourrait l'estimer depuis la pente et la vitesse, mais ce serait un
       * modèle présenté comme une mesure. La planche le dit et s'arrête.
       *
       * Elle dit aussi D'OÙ vient la puissance, parce que la question suivante
       * est toujours « pourquoi je ne l'ai pas ». */
      H.text('Cette sortie n’a pas de puissance', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Il faut un capteur de puissance — depuis un GPX, Strava ou intervals.icu',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- l'échelle, en watts ---------- */
    var choix = o.reference == null ? 'auto' : String(o.reference);
    var refAuto = a.ftp ? Math.round(a.ftp * 1.5) : 400;
    var reference = choix === 'auto' ? refAuto : (Number(choix) || 400);

    var zone = compo === 'frise'
      ? { x: g.left, w: g.width, haut: g.height * 0.30 }
      : { x: g.left + g.width * 0.10, w: g.width * 0.80, haut: g.height * 0.34 };

    var nLignes = Math.max(10, Math.min(44, Math.round(o.lignes || 26)));
    if (compo === 'massif') nLignes = Math.round(nLignes * 1.4);

    /* Un pic au-dessus de la référence dépasse — jusqu'à un tiers, puis se
     * couche. Le plafond garde la planche dans son cadre ; le chiffre exact
     * du pic est imprimé, de sorte que rien ne se perd en le bornant. */
    function hauteur(w) {
      return Math.min(1.35, Math.max(0, w) / reference) * zone.haut;
    }

    var ecart = compo === 'massif' ? zone.haut * 0.55 : zone.haut * 0.42;
    var basTexte = dit.rien ? g.bottom : g.bottom - u(dit.fabrication ? 16 : 12);
    var milieu = g.top + (basTexte - g.top) * 0.50;
    /* Le bloc est centré sur ce qu'il OCCUPE vraiment, pas sur la hauteur
     * réservée : une sortie facile ne doit pas flotter au ras du titre. */
    var pts = Alpage.graveSerie(serie, zone,
      function (p) { return p.w; }, hauteur);
    var plusHaut = 0;
    pts.forEach(function (p) { if (p.h > plusHaut) plusHaut = p.h; });
    zone.base = milieu + (plusHaut - ecart) / 2;
    zone.base = Math.min(zone.base, basTexte - ecart);
    zone.base = Math.max(zone.base, g.top + plusHaut);

    Alpage.graveLignes(ctx, pts, {
      zone: zone, lignes: nLignes, ecart: ecart, encre: encre,
      opacite: compo === 'massif' ? { min: 0.20, max: 0.65 } : { min: 0.12, max: 0.50 },
      traitMesure: Math.max(1.1, u(0.30)),
      traitCopie: Math.max(0.5, u(0.11))
    });

    /* ---------- le pic ---------- */
    if (o.pic !== false && a.power.max) {
      var idx = 0;
      for (var m = 1; m < pts.length; m++) if (pts[m].h > pts[idx].h) idx = m;
      var sx = pts[idx].x, sy = zone.base - pts[idx].h;
      ctx.save();
      ctx.strokeStyle = o.accentC || Alpage.PALETTE.rouille;
      ctx.lineWidth = Math.max(1, u(0.22));
      ctx.beginPath();
      ctx.moveTo(sx, sy - u(2.6));
      ctx.lineTo(sx, sy - u(0.8));
      ctx.stroke();
      ctx.restore();
      if (!dit.rien) {
        /* LE MAXIMUM DE LA SÉRIE, PAS CELUI DU DESSIN. Le tracé est moyenné
         * par casier pour rester net à l'impression ; son sommet est donc plus
         * bas que le pic réel. Imprimer la valeur du dessin sous-déclarerait
         * l'effort — c'est le genre d'écart qu'on ne remarque jamais. */
        H.text(Math.round(a.power.max) + ' W', sx, sy - u(3.4),
               H.t('label', { color: melange(encre, 0.55), align: 'center' }));
      }
    }

    /* ---------- le texte ---------- */
    if (dit.rien) return;

    var yTitre = g.bottom - u(dit.fabrication ? 11 : 6);
    var titre = String(o.titre || '').trim() || a.name || 'Sortie';
    H.text(titre, g.left, yTitre, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(4) }));

    var bouts = [];
    var moyenne = a.power_avg || a.power.avg;
    if (moyenne) bouts.push(Math.round(moyenne) + ' W MOYENS');
    if (a.power_weighted) bouts.push(Math.round(a.power_weighted) + ' W PONDÉRÉS');
    if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
    if (bouts.length) {
      H.text(bouts.join('  ·  '), g.left, yTitre + u(4.4),
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    /* La fabrication appartient aux « Données ». L'échelle y figure parce
     * qu'une hauteur ne veut rien dire sans elle : deux affiches ne se
     * comparent que si elles sont à la même référence. */
    if (dit.fabrication) {
      var note = 'COPIES DU MÊME TRACÉ — NI ZONES NI COURBES · PLEINE HAUTEUR À ' +
                 reference + ' W' + (choix === 'auto' && a.ftp ? ' (FTP ' + Math.round(a.ftp) + ' W)' : '');
      H.text(note, g.left, yTitre + u(8.2),
             H.t('label', { color: melange(encre, 0.3), maxWidth: g.width }));
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
