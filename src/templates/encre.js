/* « Encre » — le geste du terrain.
 *
 * Le parcours comme un trait de plume : une seule forme qui occupe la page.
 * Le titre est petit — c'est la forme qui porte l'affiche, pas le texte.
 *
 * ORIGINAL       Trait · Fibres · Réserve
 * EXPLORATIONS   Fil · Courant · Pinceau
 *
 * ── Les trois défauts corrigés, et pourquoi ils existaient ────────────
 *
 * 1. LES ENCOCHES BLANCHES le long du ruban n'étaient pas un défaut de
 *    rendu : elles sont géométriquement inévitables. Quand la demi-largeur
 *    dépasse le rayon de courbure local, le bord intérieur se replie et se
 *    croise ; la petite boucle a la winding opposée et `nonzero` l'annule.
 *    La seule réponse est de BORNER la demi-largeur par le rayon de
 *    courbure. La masquer avec de la texture aurait laissé le trou dessous.
 *
 * 2. LE CHAPELET — cet aspect bosselé sur toute la longueur — venait d'une
 *    épaisseur qui variait trop vite : la courbure brute module point par
 *    point, et la « matière » ajoutait une ondulation de période courte. Un
 *    geste de plume ne change pas d'épaisseur tous les vingt mètres. Les
 *    deux sont désormais lissés sur des fenêtres longues.
 *
 * 3. LES POINTES PARASITES venaient des normales, calculées sur une
 *    polyligne dont la DIRECTION restait discontinue même après lissage des
 *    positions. On lisse maintenant les directions elles-mêmes, ce qui donne
 *    une tangente continue par construction.
 *
 * ── Honnêteté ────────────────────────────────────────────────────────
 * Par défaut l'épaisseur suit la COURBURE : effet de style, et la planche
 * l'écrit. En « épaisseur par mesure », elle suit une mesure réellement
 * présente, et la légende dit laquelle avec ses bornes. Aucune trace ouverte
 * n'est refermée.
 */
Studio.template({
  id: 'encre',
  name: 'Encre — le geste du terrain',
  famille: 'affiche',
  /* La transparence est une OPTION : la même planche s'exporte sur papier
   * ou en surcouche à poser sur une photo. */
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'interpretation', type: 'select', label: 'Composition', default: 'trait', reflow: true,
      choices: [['trait', 'Original · Trait — ruban plein'],
                ['fibres', 'Original · Fibres — filaments'],
                ['reserve', 'Original · Réserve — parcours en clair'],
                ['fil', 'Exploration · Fil — un seul trait net'],
                ['courant', 'Exploration · Courant — lignes qui s’ouvrent'],
                ['pinceau', 'Exploration · Pinceau — le geste']] },
    { key: 'epaisseur', type: 'range', label: 'Épaisseur', default: 40, min: 8, max: 100, step: 2 },
    { key: 'matiere', type: 'range', label: 'Matière', default: 24, min: 0, max: 100, step: 4 },
    { key: 'source', type: 'select', label: 'Épaisseur par', default: 'courbure', reflow: true,
      choices: [['courbure', 'Courbure — un choix de style'],
                ['ele', 'Altitude — mesurée'],
                ['w', 'Puissance — mesurée'],
                ['hr', 'Fréquence cardiaque — mesurée'],
                ['cad', 'Cadence — mesurée'],
                ['egale', 'Épaisseur constante']] },
    { key: 'orientation', type: 'select', label: 'Orientation', default: 'nord',
      choices: [['nord', 'Nord en haut'],
                ['diagonale', 'Diagonale — rotation artistique'],
                ['remplir', 'Au mieux du format']] },
    /* --- avancé --- */
    { key: 'fibres', type: 'range', label: 'Nombre de lignes', default: 7, min: 5, max: 11, step: 2 },
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'grain', type: 'toggle', label: 'Grain du papier', default: true }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsTexte(), Alpage.optionsFond()),

  inert: function (a, vals) {
    var morts = [];
    if (!vals) return morts;
    if (vals.interpretation !== 'fibres' && vals.interpretation !== 'courant') morts.push('fibres');
    // « Fil » est par définition un trait net d'épaisseur constante
    if (vals.interpretation === 'fil') morts.push('matiere', 'source', 'epaisseur');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || Alpage.PALETTE.papier);
    if (!socle.transparent && o.grain) H.grain(0.012);

    var vue = Alpage.projette(a.track);
    var g = H.grid({ cols: 6, margin: u(9) });

    if (vue.pts.length < 4) {
      H.text('Charge une sortie avec une trace', g.left, g.top + g.height * 0.46,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Encre dessine le parcours, pas ses chiffres',
             g.left, g.top + g.height * 0.46 + u(5),
             H.t('label', { color: melange(encre, 0.5) }));
      return;
    }

    var mode = o.interpretation;
    var estFin = mode === 'fil';

    /* ---------- géométrie ----------
     * Le pas d'échantillonnage se choisit en PIXELS de rendu, pas en mètres
     * de terrain : c'est la finesse à l'écran qui décide si une courbe est
     * lisse ou facettée. Un pas géographique donnait un trait facetté sur une
     * sortie courte et une bouillie de points sur une longue. */
    var cotePx = Math.min(g.width, g.height);
    var cible = Math.max(260, Math.min(1400, Math.round(cotePx / 1.6)));
    var pas = Math.max(1, vue.etendue / cible);
    var pts = Alpage.reechantillonne(vue.pts, pas);
    /* Lisser les DIRECTIONS, pas seulement les positions : ce sont elles qui
     * fabriquent les normales, donc les bords du ruban. */
    var fen = Math.max(2, Math.round(pts.length / 140));
    pts = Alpage.lisseDirections(Alpage.lisse(pts, fen), fen);

    /* Une boucle refermée doit l'être aussi à l'encre, sinon le ruban laisse
     * une encoche là où ses deux bouts se touchent. On ne referme QUE ce qui
     * revient réellement à son départ — une trace ouverte reste ouverte. */
    var bouclee = Math.hypot(pts[0].x - pts[pts.length - 1].x,
                             pts[0].y - pts[pts.length - 1].y) < vue.etendue * 0.02;
    /* Sur une boucle, on PROLONGE la trace de quelques points au-delà de son
     * départ. Le ruban se recouvre alors à la couture et `nonzero` ne voit
     * qu'une seule forme. Fermer le chemin (`closePath`) ne suffisait pas :
     * les deux bords du ruban ont chacun leur extrémité, et elles ne se
     * rejoignent pas au même endroit — d'où l'encoche visible à trois
     * heures sur la première version. */
    var recouvreN = 0;
    if (bouclee) {
      recouvreN = Math.min(14, Math.floor(pts.length * 0.02));
      for (var rc = 1; rc <= recouvreN; rc++) pts.push(pts[rc]);
    }

    var vue2 = bornes(pts);

    /* ---------- orientation ---------- */
    var angle = 0;
    if (o.orientation === 'diagonale') angle = -Math.PI / 9;
    else if (o.orientation === 'remplir') angle = angleOptimal(pts, w > h);
    if (angle) { pts = tourne(pts, angle); vue2 = bornes(pts); }

    /* ---------- cadrage ----------
     * La forme occupe ~70 % de la surface utile et se décale LÉGÈREMENT vers
     * l'angle le plus vide de la trace, pour libérer la place du titre. Le
     * premier jet décalait de 13 % dans les deux axes, ce qui repoussait le
     * dessin dans un coin et laissait la moitié de la page vide. */
    var coin = coinLePlusVide(pts, vue2);
    var haut = g.top + u(11), bas = g.bottom - u(9);
    var zone = { x: g.left, y: haut, w: g.width, h: bas - haut };
    var cadre = Alpage.cadre(vue2, zone, {
      marge: u(1.5),
      echelle: estFin ? 0.90 : 0.94,
      ancreX: -coin.x * 0.07, ancreY: -coin.y * 0.07
    });

    var P = pts.map(cadre.point);
    var N = Alpage.normales(P);
    var alea = Alpage.graine(vue);
    var mesureUtilisee = null;
    var ep = epaisseurs(pts);
    var base = u(o.epaisseur / 22);

    var reveles = H.progressCount(P.length);

    /* FIBRES et COURANT partagent le trace du faisceau, mais pas la
     * RESPIRATION — et c'est elle qui les distingue.
     *
     *   Fibres  : une vibration. L'ecart varie peu (55 a 100 %) et vite
     *             (trois et sept ouvertures par tour) : un faisceau serre.
     *   Courant : une houle. L'ecart descend presque a zero — les lignes
     *             reviennent alors SUR le parcours — puis s'ouvre au-dela
     *             de l'amplitude nominale, sur deux ou trois longues
     *             portions seulement.
     *
     * Les deux se ressemblaient parce qu'elles partageaient cette
     * respiration : seule l'ouverture nominale changeait, ce qui revenait a
     * dessiner le meme faisceau plus ou moins large. */
    if (mode === 'fibres') {
      dessineFibres(2.6, 0.30, { min: 0.55, amp: 0.45, h1: 3, h2: 7, periode: 190 });
    } else if (mode === 'courant') {
      dessineFibres(5.6, 0.14, { min: 0.12, amp: 1.28, h1: 2, h2: 5, periode: 430 });
    }
    else if (mode === 'reserve') dessineReserve();
    else if (mode === 'fil') dessineFil();
    else if (mode === 'pinceau') dessineRuban(1.45, 0.30, true);
    else dessineRuban(0.78, 0.22);

    legende(coin);

    /* ================= compositions ================= */

    /* TRAIT et PINCEAU — un ruban plein.
     * `ampleur` règle combien l'épaisseur varie, `plancher` son minimum.
     *
     * PINCEAU n'était qu'un Trait plus gras : même courbe d'épaisseur, mêmes
     * bouts francs. Trois choses distinguent un geste d'un feutre :
     *
     *   1. LA PRESSION. La main appuie et relâche sur de longues portions.
     *      L'épaisseur ne suit donc plus seulement la mesure point par point
     *      — elle est mélangée à une ondulation lente, sur une période bien
     *      plus longue que le relief.
     *   2. LES ATTAQUES. Un pinceau se pose et se lève : le trait s'amincit
     *      aux deux bouts. Sur une BOUCLE il n'y a pas de bout — on ne
     *      l'applique donc pas, sinon la couture s'ouvrirait.
     *   3. L'ASYMÉTRIE. Les deux bords d'un trait de pinceau ne sont pas
     *      symétriques : le poil charge davantage d'un côté. On décale la
     *      ligne centrale d'une fraction de l'épaisseur, ce qui épaissit un
     *      bord et affine l'autre sans toucher au parcours réel. */
    function dessineRuban(ampleur, plancher, geste) {
      var n = Math.max(2, reveles);
      var vus = P.slice(0, n);
      var total = P.length;

      var demi = ep.slice(0, n).map(function (v, i) {
        var e2 = plancher + ampleur * v;
        if (geste) {
          /* la pression : 0,45 de mesure, 0,55 de main */
          var pression = 0.5 + 0.5 * Alpage.ondulation(alea, i, 520, 11);
          e2 = plancher + ampleur * (0.45 * v + 0.55 * pression);
          if (!bouclee) {
            /* attaque et levée : une rampe en puissance sur 9 % du tracé */
            var kd = Math.min(1, (i + 1) / (total * 0.09));
            var kf = Math.min(1, (total - i) / (total * 0.09));
            e2 *= Math.pow(Math.min(kd, kf), 0.65);
          }
        }
        return base * e2 * matiere(i);
      });

      /* Le borne-fou : au-delà du rayon de courbure, le bord intérieur se
       * croise et `nonzero` perce un trou. */
      demi = Alpage.borneParCourbure(demi, vus, 0.70);

      var axe = vus;
      if (geste) {
        axe = vus.map(function (q, i) {
          var d = demi[i] * 0.22;
          return { x: q.x + N[i].x * d, y: q.y + N[i].y * d };
        });
      }
      remplit(Alpage.ruban(axe, demi), encre);
      frontDEncre(vus);
    }

    /* FIL — un seul trait net, sans texture ni modulation.
     * L'épaisseur est fixe et petite : environ 3 px pour 1080 de large. */
    function dessineFil() {
      var n = Math.max(2, reveles);
      ctx.save();
      ctx.beginPath();
      for (var i = 0; i < n; i++) {
        if (i === 0) ctx.moveTo(P[i].x, P[i].y); else ctx.lineTo(P[i].x, P[i].y);
      }
      if (bouclee && n >= P.length) ctx.closePath();
      ctx.strokeStyle = encre;
      ctx.lineWidth = Math.max(1.6, w / 340);
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    /* FIBRES et COURANT — des lignes qui accompagnent le parcours.
     * `ouverture` règle l'amplitude du faisceau. Courant respire beaucoup
     * plus largement : ce sont des resserrements et des ouvertures, pas une
     * vibration. Dans les virages serrés, le décalage est RÉDUIT par le
     * rayon de courbure plutôt que de former des nœuds. */
    function dessineFibres(ouverture, epaisseurTrait, resp) {
      var nb = Math.max(5, Math.min(11, Math.round(o.fibres) | 1));
      var fin = Math.max(2, reveles);
      var periodeBoucle = P.length - (bouclee ? recouvreN : 0) || 1;
      var phase = alea(3, 9) * 6.283;
      /* La limite de décalage est LISSÉE avant d'être appliquée. Bornée
       * point par point, elle passe brutalement de 100 px à 20 px sur un
       * virage et la fibre fait un saut en ligne droite — les traits
       * parasites qu'on voyait en travers du faisceau. */
      var R = Alpage.rayonsDeCourbure(P, 5);
      var fR = Math.max(3, Math.round(P.length / 45));
      var lim = [];
      for (var q = 0; q < R.length; q++) {
        var a2 = Math.max(0, q - fR), b2 = Math.min(R.length - 1, q + fR), mn = Infinity;
        // le MINIMUM de la fenêtre, puis lissé : on anticipe le virage
        for (var r2 = a2; r2 <= b2; r2++) mn = Math.min(mn, R[r2]);
        lim.push(mn);
      }
      var limL = [];
      for (var q2 = 0; q2 < lim.length; q2++) {
        var a3 = Math.max(0, q2 - fR), b3 = Math.min(lim.length - 1, q2 + fR), su = 0, nn = 0;
        for (var r3 = a3; r3 <= b3; r3++) { su += Math.min(lim[r3], 1e6); nn++; }
        limL.push(su / nn);
      }
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var f = 0; f < nb; f++) {
        var t = nb === 1 ? 0 : (f / (nb - 1)) * 2 - 1;
        ctx.beginPath();
        for (var i = 0; i < fin; i++) {
          /* Une ondulation LENTE, semée par la géométrie : l'écart s'ouvre
           * et se referme sur de longues portions.
           *
           * Sur une BOUCLE elle doit être périodique, sinon le faisceau
           * arrive à la couture avec une ouverture différente de celle qu'il
           * avait au départ, et le décrochement se voit. Une somme de
           * sinusoïdes en fraction de tour se referme sur elle-même par
           * construction. */
          var souffle;
          if (bouclee) {
            var tb = i / periodeBoucle;
            souffle = resp.min + resp.amp * (0.5 + 0.5 * (
              Math.sin(tb * Math.PI * 2 * resp.h1 + phase) * 0.62 +
              Math.sin(tb * Math.PI * 2 * resp.h2 + phase * 1.7) * 0.38));
          } else {
            souffle = resp.min + resp.amp *
              (0.5 + 0.5 * Alpage.ondulation(alea, i, resp.periode, 7));
          }
          var d = t * base * ouverture * souffle;
          var plafond = limL[i] * 0.80;
          if (Math.abs(d) > plafond) d = (d < 0 ? -1 : 1) * plafond;
          var X = P[i].x + N[i].x * d, Y = P[i].y + N[i].y * d;
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        // la ligne centrale reste le parcours : elle porte le trait
        var centre = 1 - Math.abs(t);
        ctx.globalAlpha = 0.32 + 0.68 * centre;
        ctx.lineWidth = Math.max(0.9, base * epaisseurTrait * (0.45 + 0.75 * centre));
        ctx.strokeStyle = encre;
        ctx.stroke();
      }
      ctx.restore();
    }

    /* RÉSERVE — l'encre autour, le parcours en papier. */
    function dessineReserve() {
      var n = Math.max(2, reveles);
      var vus = P.slice(0, n);
      var large = Alpage.borneParCourbure(ep.slice(0, n).map(function (v, i) {
        return base * (1.6 + 1.6 * v) * matiere(i);
      }), vus, 0.70);
      remplit(Alpage.ruban(vus, large), encre);
      var etroit = Alpage.borneParCourbure(ep.slice(0, n).map(function (v, i) {
        return base * (0.30 + 0.66 * v) * matiere(i);
      }), vus, 0.70);
      remplit(Alpage.ruban(vus, etroit), papier);
    }

    function remplit(poly, couleur) {
      ctx.save();
      ctx.beginPath();
      poly.forEach(function (p, i) {
        if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      ctx.closePath();
      ctx.fillStyle = couleur;
      ctx.fill('nonzero');
      ctx.restore();
    }

    function frontDEncre(vus) {
      if (s.progress >= 1 || vus.length < 3) return;
      var p = vus[vus.length - 1];
      ctx.save();
      ctx.fillStyle = encre; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(p.x, p.y, base * 0.7, 0, Math.PI * 2);
      ctx.fill(); ctx.restore();
    }

    /* ================= l'épaisseur ================= */

    function epaisseurs(list) {
      if (o.source === 'egale' || estFin) return list.map(function () { return 0.55; });
      if (o.source === 'courbure') {
        /* Lissée LARGEMENT : la courbure brute module point par point et
         * c'est elle qui donnait le chapelet. */
        var c = Alpage.courbure(list, 6);
        return moyenneGlissante(c, Math.max(4, Math.round(list.length / 26)))
          .map(function (v) { return Math.min(1, Math.pow(v, 0.5) * 2.1); });
      }
      var s2 = Alpage.serie(list, o.source);
      if (!s2) return list.map(function () { return 0.55; });
      mesureUtilisee = s2;
      // même lissage : une mesure brute donne le même chapelet
      return moyenneGlissante(s2.valeurs, Math.max(3, Math.round(list.length / 30)));
    }

    function moyenneGlissante(serie, f) {
      var out = [];
      for (var i = 0; i < serie.length; i++) {
        var a0 = Math.max(0, i - f), b0 = Math.min(serie.length - 1, i + f), su = 0, n = 0;
        for (var j = a0; j <= b0; j++) { su += serie[j]; n++; }
        out.push(su / n);
      }
      return out;
    }

    /* La matière : une ondulation TRÈS lente, comme une plume qui se
     * recharge. Période longue et amplitude modeste — l'ancienne version
     * ondulait quatre fois plus vite et fabriquait le chapelet. */
    function matiere(i) {
      var f = (Number(o.matiere) || 0) / 100;
      if (!f || estFin) return 1;
      return 1 + f * 0.30 * Alpage.ondulation(alea, i, 230, 1);
    }

    /* ================= composition ================= */

    function coinLePlusVide(list, v) {
      var cx = (v.minX + v.maxX) / 2, cy = (v.minY + v.maxY) / 2;
      var q = [0, 0, 0, 0];
      list.forEach(function (p) { q[(p.x < cx ? 0 : 1) + (p.y < cy ? 0 : 2)]++; });
      var min = 0;
      for (var i = 1; i < 4; i++) if (q[i] < q[min]) min = i;
      return { x: (min % 2) ? 1 : -1, y: (min >= 2) ? 1 : -1, indice: min };
    }

    function legende(coin) {
      var dit = Alpage.dit(o);
      if (dit.rien) return;
      var enBas = coin.y > 0;
      var y = enBas ? g.bottom : g.top + u(4.4);
      var titre = String(o.titre || '').trim() || a.name || 'Sortie';
      H.text(titre, g.left, y, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(3) }));

      /* LE PINCEAU DIT QU'IL EST UN GESTE.
       *
       * Sa pression mélange la mesure à une ondulation de main : 45 % de ce
       * que le capteur a relevé, 55 % d'invention. Écrire « ÉPAISSEUR :
       * ALTITUDE · 412 M → 1180 M » sous un trait pareil serait exactement
       * ce que l'en-tête de ce fichier interdit — laisser croire qu'on lit
       * une mesure là où on regarde un effet. La planche le dit donc. */
      /* DEUX SORTES DE NOTES, ET UNE SEULE SURVIT A « SIGNATURE ».
       *
       * Celles qui expliquent la FABRICATION — « épaisseur : courbure du
       * parcours — effet de style », « parcours tourné, non déformé » — ont
       * leur place dans l'aide du réglage, pas sur une affiche qu'on accroche.
       *
       * Celles qui empêchent de MAL LIRE une donnée restent. « Geste — la
       * mesure n'est qu'une part de l'épaisseur » n'explique pas comment
       * c'est fait : elle évite de croire qu'on lit une altitude sous un
       * trait qui n'en est pas une. La retirer rendrait la planche jolie et
       * menteuse — c'est exactement ce que l'en-tête de ce fichier interdit. */
      var honnetete = null;
      if (mode === 'pinceau') honnetete = 'GESTE — LA MESURE N’EST QU’UNE PART';
      else if (!estFin && o.source !== 'courbure' && o.source !== 'egale' && !mesureUtilisee) {
        honnetete = 'MESURE ABSENTE DE CE FICHIER';
      }

      var note = honnetete;
      if (dit.fabrication) {
        if (estFin) note = 'TRAIT NET — ÉPAISSEUR CONSTANTE';
        else if (o.source === 'courbure') note = 'ÉPAISSEUR : COURBURE DU PARCOURS — EFFET DE STYLE';
        else if (o.source === 'egale') note = 'ÉPAISSEUR CONSTANTE';
        else if (mesureUtilisee) {
          var lib = { ele: 'ALTITUDE', w: 'PUISSANCE', hr: 'FRÉQUENCE CARDIAQUE', cad: 'CADENCE' }[o.source];
          var unite = { ele: ' M', w: ' W', hr: ' BPM', cad: ' TR/MIN' }[o.source];
          note = 'ÉPAISSEUR : ' + lib + ' · ' + Math.round(mesureUtilisee.lo) + unite +
                 ' → ' + Math.round(mesureUtilisee.hi) + unite;
        }
        if (honnetete && note !== honnetete) note = honnetete + ' · ' + note;
      } else if (!note) {
        /* SIGNATURE : ce qu'on veut lire sur un mur. Une mesure absente n'est
         * jamais remplacee par une valeur inventee — elle est tue. */
        var bouts = [];
        if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
        if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' M D+');
        note = bouts.join('  ·  ');
      }
      if (note) {
        H.text(note, g.left, y + u(4.4), H.t('label', { color: melange(encre, 0.5), maxWidth: g.width }));
      }
      if (angle && dit.fabrication) {
        H.text('PARCOURS TOURNÉ, NON DÉFORMÉ', g.right, y + u(4.4),
               H.t('label', { color: melange(encre, 0.32), align: 'right' }));
      }
    }

    /* ================= utilitaires ================= */

    function tourne(list, ang) {
      var c = Math.cos(ang), si = Math.sin(ang);
      return list.map(function (p) {
        var q = { x: p.x * c - p.y * si, y: p.x * si + p.y * c };
        q.ele = p.ele; q.w = p.w; q.hr = p.hr; q.cad = p.cad; q.i = p.i;
        return q;
      });
    }

    function bornes(list) {
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      list.forEach(function (p) {
        if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
        if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
      });
      return { pts: list, minX: minX, maxX: maxX, minY: minY, maxY: maxY,
               largeur: maxX - minX, hauteur: maxY - minY };
    }

    function angleOptimal(list, paysage) {
      var best = 0, meilleur = -Infinity;
      for (var deg = -45; deg <= 45; deg += 5) {
        var r = bornes(tourne(list, deg * Math.PI / 180));
        var ratio = paysage ? r.largeur / (r.hauteur || 1) : r.hauteur / (r.largeur || 1);
        var aire = Math.min(ratio, 2.4);
        if (aire > meilleur) { meilleur = aire; best = deg * Math.PI / 180; }
      }
      return best;
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
