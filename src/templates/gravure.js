/* « Gravure d'altitude » — le relief parcouru, en lignes.
 *
 * Le profil d'UNE sortie devient le sujet de l'affiche : une crête, et sous
 * elle une vingtaine de lignes qui la reprennent en s'aplatissant vers la
 * base. L'ensemble évoque une gravure topographique ; il n'en est pas une.
 *
 * ── CE QUE LES LIGNES SONT, ET CE QU'ELLES NE SONT PAS ───────────────
 *
 * Ce sont des COPIES DU MÊME PROFIL, écrasées. Elles ne décrivent aucun
 * terrain autour du parcours, et la planche ne les appelle jamais des courbes
 * de niveau : la ressemblance est réelle et le malentendu serait facile.
 *
 * De vraies courbes de niveau demanderaient les altitudes du terrain
 * ALENTOUR. Un GPX ne contient que celles du chemin parcouru — c'est la même
 * limite qui bloque Médaillon · Topographie, et elle ne se contourne pas avec
 * de l'ingéniosité.
 *
 * La ligne du HAUT est la seule mesurée. Elle est tracée plus sombre et plus
 * épaisse pour qu'on sache laquelle croire.
 *
 * ── UNE SORTIE PLATE DOIT RESTER PLATE ───────────────────────────────
 *
 * `a.profile` normalise l'altitude entre 0 et 1 : une boucle de plaine qui
 * varie de douze mètres y occupe toute la hauteur, exactement comme un col.
 * Dessiner cette valeur donnerait une montagne à qui n'en a pas gravi.
 *
 * On repart donc des MÈTRES — `elev_max_m − elev_min_m` — et on les rapporte
 * à une référence de 900 m. En dessous, l'affiche est visiblement plus plate ;
 * au-dessus, elle plafonne, sans quoi un col de 2000 m sortirait du cadre.
 *
 * ── L'AMPLITUDE EST EXAGÉRÉE, ET C'EST DIT DANS LE RÉGLAGE ───────────
 *
 * À l'échelle vraie, 1450 m de dénivelé sur 60 km font une pente de 2 % :
 * une ligne droite. Toute affiche de relief exagère la verticale, celle-ci
 * comprise. Le réglage le dit ; l'affiche n'a pas à le porter.
 */
Studio.template({
  id: 'gravure',
  name: 'Gravure d’altitude — le relief parcouru',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  variantes: [
    { nom: 'Frise', dit: 'une crête qui traverse, beaucoup de ciel',
      o: { composition: 'frise' } },
    { nom: 'Massif', dit: 'un bloc compact, lignes serrées',
      o: { composition: 'massif' } }
  ],

  options: [
    { key: 'composition', type: 'select', label: 'Composition', default: 'frise', reflow: true,
      choices: [['frise', 'Original · Frise — une crête qui traverse'],
                ['massif', 'Original · Massif — un bloc de lignes serrées']] },
    { key: 'lignes', type: 'range', label: 'Nombre de lignes', default: 26, min: 10, max: 44, step: 1 },
    { key: 'amplitude', type: 'range',
      label: 'Amplitude verticale — exagérée, comme toute affiche de relief',
      default: 100, min: 40, max: 160, step: 5 },
    { key: 'sommet', type: 'toggle', label: 'Marquer le point culminant', default: true },
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

    var profil = (a && a.profile) || [];
    if (profil.length < 4) {
      /* PAS DE RELIEF INVENTÉ. Sans altitude, la planche le dit et s'arrête —
       * une gravure fabriquée à partir de rien serait un dessin qui ment. */
      H.text('Cette sortie n’a pas d’altitude', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Gravure d’altitude a besoin d’un profil : capteur barométrique ou GPS',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- l'amplitude, en mètres puis en pixels ---------- */
    var denivele = (a.elev_max_m != null && a.elev_min_m != null)
      ? Math.max(0, a.elev_max_m - a.elev_min_m) : null;
    /* 900 m remplit la hauteur prévue ; en dessous, la crête s'aplatit
     * proportionnellement — une plaine a le droit d'avoir l'air d'une
     * plaine. Un plancher de 18 % garde la ligne lisible plutôt que nulle. */
    var partReelle = denivele == null ? 0.72
      : Math.max(0.18, Math.min(1, denivele / 900));
    var exageration = (o.amplitude == null ? 100 : o.amplitude) / 100;

    var zone = compo === 'frise'
      ? { x: g.left, w: g.width, haut: g.height * 0.30 }
      : { x: g.left + g.width * 0.10, w: g.width * 0.80, haut: g.height * 0.34 };
    var amplitude = zone.haut * partReelle * exageration;

    var nLignes = Math.max(10, Math.min(44, Math.round(o.lignes || 26)));
    if (compo === 'massif') nLignes = Math.round(nLignes * 1.4);

    /* LE BLOC EST CENTRÉ, PAS ANCRÉ À UNE FRACTION DE LA PAGE.
     *
     * Avec une ligne de base fixe, la hauteur du dessin dépend du dénivelé —
     * c'est voulu — mais sa POSITION en dépendait aussi : une sortie modérée
     * se tassait en bas de page et laissait quarante pour cent de vide au
     * sommet. Le vide était réel, il n'était pas compose.
     *
     * On centre donc l'ensemble { crête + copies } dans l'espace au-dessus du
     * titre. La planche reste honnête : ce qui dit le relief est la HAUTEUR
     * occupée, pas l'endroit où elle est posée. */
    var ecart = compo === 'massif' ? zone.haut * 0.55 : zone.haut * 0.42;
    var basTexte = dit.rien ? g.bottom : g.bottom - u(dit.fabrication ? 16 : 12);
    var milieu = g.top + (basTexte - g.top) * 0.50;
    zone.base = milieu + (amplitude - ecart) / 2;
    /* jamais dans le texte, jamais hors de la feuille */
    zone.base = Math.min(zone.base, basTexte - ecart);
    zone.base = Math.max(zone.base, g.top + amplitude);

    /* Le profil rééchantillonné. Le regroupement vit dans Alpage : la gravure
     * de puissance en a besoin du même, et deux rééchantillonnages pour un
     * même dessin finiraient par diverger. */
    var pts = Alpage.graveSerie(profil, zone,
      function (p) { return p.y; },
      function (v) { return v * amplitude; });

    Alpage.graveLignes(ctx, pts, {
      zone: zone, lignes: nLignes, ecart: ecart, encre: encre,
      opacite: compo === 'massif' ? { min: 0.20, max: 0.65 } : { min: 0.12, max: 0.50 },
      traitMesure: Math.max(1.1, u(0.30)),
      traitCopie: Math.max(0.5, u(0.11))
    });

    /* ---------- le point culminant ---------- */
    if (o.sommet !== false && denivele) {
      var hautIdx = 0;
      for (var m = 1; m < pts.length; m++) if (pts[m].h > pts[hautIdx].h) hautIdx = m;
      var sx = pts[hautIdx].x, sy = zone.base - pts[hautIdx].h;
      ctx.save();
      ctx.strokeStyle = o.accentC || Alpage.PALETTE.rouille;
      ctx.lineWidth = Math.max(1, u(0.22));
      ctx.beginPath();
      ctx.moveTo(sx, sy - u(2.6));
      ctx.lineTo(sx, sy - u(0.8));
      ctx.stroke();
      ctx.restore();
      if (!dit.rien && a.elev_max_m != null) {
        H.text(Math.round(a.elev_max_m) + ' M', sx, sy - u(3.4),
               H.t('label', { color: melange(encre, 0.55), align: 'center' }));
      }
    }

    /* ---------- le texte ---------- */
    if (dit.rien) return;

    /* LE BLOC DE TEXTE EST ANCRÉ À SON PIED, PAS À SON TITRE.
     *
     * En partant du titre, la troisième ligne des « Données » tombait sous la
     * grille, dans la marge basse : encore lisible, donc invisible à tous les
     * contrôles — et fausse à l'impression, où la marge est ce qu'on rogne. */
    var yTitre = g.bottom - u(dit.fabrication ? 11 : 6);
    var titre = String(o.titre || '').trim() || a.name || 'Sortie';
    H.text(titre, g.left, yTitre, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(4) }));

    var bouts = [];
    if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
    if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' M D+');
    if (dit.fabrication && denivele != null) {
      bouts.push(Math.round(a.elev_min_m) + ' À ' + Math.round(a.elev_max_m) + ' M');
    }
    if (bouts.length) {
      H.text(bouts.join('  ·  '), g.left, yTitre + u(4.4),
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    /* La nature du dessin appartient aux « Données » : elle explique comment
     * c'est fait, pas comment le lire. Ce qui empêcherait de MAL lire — que
     * ces lignes ne sont pas un terrain — y est dit aussi, et le catalogue le
     * répète dans la description du template. */
    if (dit.fabrication) {
      H.text('COPIES DU MÊME PROFIL — PAS DES COURBES DE NIVEAU · VERTICALE EXAGÉRÉE',
             g.left, yTitre + u(8.2),
             H.t('label', { color: melange(encre, 0.3), maxWidth: g.width }));
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }

  }
});
