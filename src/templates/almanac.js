/* « Almanac » — la forme d'une année.
 *
 * Une planche d'observatoire : au centre la période, dans le champ les
 * activités, à la périphérie les quelques-unes qu'on a choisi de nommer.
 * Ce n'est pas un nuage de points déguisé en affiche — chaque règle
 * géométrique est explicite et se lit dans la légende.
 *
 * ── Les trois anneaux ────────────────────────────────────────────────
 *
 *   NOYAU      la période, ses totaux, rien d'autre. Il reste dégagé.
 *   CHAMP      une marque par activité, petite et délicate.
 *   PÉRIPHÉRIE les repères de temps, les orbites, et jusqu'à trois
 *              mémoires épinglées avec leur filet vers la marge.
 *
 * ── La géométrie, et pourquoi elle est ainsi ─────────────────────────
 *
 * ANGLE = POSITION EXACTE DANS LA PÉRIODE. Le 1er janvier est à midi sur le
 * cadran, le 31 décembre y revient. L'heure ne pèse donc qu'une fraction de
 * jour. Encoder « date ET heure » comme deux informations mêlées aurait
 * donné à deux sorties du même jour, l'une à 8 h l'autre à 18 h, un écart
 * angulaire aussi grand qu'entre deux semaines — l'heure aurait crié plus
 * fort que la saison. Sur la variante « jour », en revanche, l'heure DEVIENT
 * l'information angulaire : c'est là que le cadran sert vraiment.
 *
 * RAYON = une mesure au choix, échelle LINÉAIRE par défaut. Une orbite n'est
 * pas une grille décorative : l'anneau « 100 km » est le lieu des sorties de
 * cent kilomètres, et une sortie s'y pose littéralement.
 *
 * SURFACE = une autre mesure. Surface et non rayon : doubler le rayon
 * quadruple la tache, et une sortie deux fois plus montagneuse paraîtrait
 * quatre fois plus grosse.
 *
 * FORME = le sport. Pas la couleur : la couleur est secondaire, et la
 * planche entière se lit en noir et blanc. C'est ce qui la rend imprimable
 * et lisible par quelqu'un qui distingue mal les teintes.
 *
 * ── Ce qu'on ne fait pas ─────────────────────────────────────────────
 *
 * On ne déplace JAMAIS un point pour éviter un chevauchement : sa position
 * est sa donnée. Quand ça se bouscule, on le dit et on propose de réduire
 * la période ou de filtrer par sport. Et un creux de trois semaines reste un
 * creux : le vide est une donnée, on ne le remplit pas.
 *
 * L'animation ne bouge rien : toute la géométrie est calculée pour la
 * période entière avant la première image, et la révélation ne fait que
 * dévoiler des positions déjà fixées.
 */
Studio.template({
  id: 'almanac',
  name: 'Almanac — la forme d’une année',
  famille: 'serie',
  /* La transparence est une OPTION : la même planche s'exporte sur papier
   * ou en surcouche à poser sur une photo. */
  transparent: function (o) { return o.fond === 'transparent'; },
  multi: true,
  chrono: 'lineaire',
  duree: 12000,

  options: [
    { key: 'echelleTemps', type: 'select', label: 'Période', default: 'annee', reflow: true,
      choices: [['mois', 'Mois — une rotation, un mois'],
                ['annee', 'Année — une rotation, une année'],
                ['annees', 'Années — plusieurs systèmes côte à côte']] },
    { key: 'orbite', type: 'select', label: 'Orbite (rayon)', default: 'distance',
      choices: [['distance', 'Distance'], ['deniv', 'Dénivelé'], ['duree', 'Durée']] },
    { key: 'taille', type: 'select', label: 'Taille (surface)', default: 'deniv',
      choices: [['deniv', 'Dénivelé'], ['distance', 'Distance'], ['duree', 'Durée']] },
    { key: 'remarquables', type: 'select', label: 'À la périphérie', default: 'distance', reflow: true,
      choices: [['distance', 'Les plus longues'],
                ['deniv', 'Les plus montagneuses'],
                ['duree', 'Les plus longues en temps'],
                ['aucune', 'Aucune']] },
    { key: 'couleur', type: 'select', label: 'Couleur', default: 'mono',
      choices: [['mono', 'Monochrome — la forme dit le sport'],
                ['sport', 'Une teinte par sport']] },
    /* --- avancé --- */
    { key: 'decalage', type: 'range', label: 'Période (0 = la dernière)', default: 0, min: -6, max: 0, step: 1, reflow: true },
    { key: 'symboles', type: 'range', label: 'Taille des symboles', default: 100,
      min: 60, max: 180, step: 5 },
    { key: 'orbites', type: 'toggle', label: 'Orbites de référence', default: true },
    /* fond, voile, papier, encre : injectés depuis le socle Alpage */
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A54F37' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsFond()),

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    /* Papier ou surcouche : c'est la MÊME planche. Le socle pose le fond,
     * le voile éventuel, et rend l'encre à utiliser. */
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || o.papierC || '#F2EFE6');
    var accent = o.accentC;
    var faint = melange(encre, 0.42), hair = melange(encre, 0.13);
    var ampleurSymboles = Math.max(0.5, (Number(o.symboles) || 100) / 100);

    /* ================= les familles de formes ================= */

    /* Chaque sport a son langage graphique. La couleur ne fait que le
     * redoubler : la planche se lit entièrement en noir et blanc, ce qui la
     * rend imprimable et lisible sans distinguer les teintes. */
    var FAMILLES = {
      route:  { forme: 'plein',   nom: 'vélo de route', teinte: '#A54F37' },
      vtt:    { forme: 'anneau',  nom: 'vtt',           teinte: '#355E70' },
      course: { forme: 'point',   nom: 'course à pied', teinte: '#C99A32' },
      marche: { forme: 'ouvert',  nom: 'randonnée',     teinte: '#6B7A5A' },
      ski:    { forme: 'radial',  nom: 'ski',           teinte: '#7A6E9B' },
      autre:  { forme: 'croix',   nom: 'autre',         teinte: '#8A8478' }
    };

    function familleDe(a) {
      var t = String(a.type || '').toLowerCase();
      if (t.indexOf('mtb') >= 0 || t.indexOf('mountain') >= 0 || t.indexOf('gravel') >= 0) return 'vtt';
      if (t.indexOf('run') >= 0 || t.indexOf('trail') >= 0) return 'course';
      if (t.indexOf('hik') >= 0 || t.indexOf('walk') >= 0 || t.indexOf('march') >= 0) return 'marche';
      if (t.indexOf('ski') >= 0 || t.indexOf('skat') >= 0) return 'ski';
      if (t.indexOf('ride') >= 0 || t.indexOf('bik') >= 0 || t.indexOf('cycl') >= 0 ||
          t.indexOf('velo') >= 0 || t.indexOf('vélo') >= 0) return 'route';
      return 'autre';
    }


    var g = H.grid({ cols: 6, margin: u(7) });
    var encombrement = 0;   // marques qui se chevauchent — dit en légende

    var toutes = (s.library || []).filter(function (e) {
      return e.activity && e.activity.date instanceof Date && !isNaN(e.activity.date);
    });

    if (!toutes.length) {
      H.text('Charge des sorties datées', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Almanac dessine la structure d’une période, pas une sortie',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* Quelles familles sont présentes, et sur combien de lignes tiennent
     * leurs libellés à la largeur de CETTE page. Le pas était fixe — trente
     * unités par entrée — et la cinquième s'écrivait à cent-vingt unités
     * sur une page qui en fait quatre-vingt-six. */
    function disposeLegende() {
      var presentes = {};
      toutes.forEach(function (e) { presentes[familleDe(e.activity)] = 1; });
      var styleNom = H.t('label', {});
      var cles = Object.keys(FAMILLES).filter(function (c) { return presentes[c]; });
      var larges = cles.map(function (cle) {
        return u(4.2) + H.measure(FAMILLES[cle].nom.toUpperCase(), styleNom) + u(4);
      });
      var lignes = [[]];
      var courante = 0;
      cles.forEach(function (cle, i) {
        var l = lignes[lignes.length - 1];
        if (l.length && courante + larges[i] > g.width) { lignes.push([]); courante = 0; }
        lignes[lignes.length - 1].push(i);
        courante += larges[i];
      });
      return { cles: cles, larges: larges, lignes: lignes };
    }

    /* ---------- les périodes ---------- */
    var periodes = decoupePeriodes(toutes);
    if (!periodes.length) { return; }

    /* ---------- disposition ---------- */
    var multi = o.echelleTemps === 'annees' && periodes.length > 1;

    /* La légende n'a pas de hauteur fixe : elle a le nombre de lignes qu'il
     * lui faut. On la MESURE donc avant de placer le champ — sinon le
     * système descend jusqu'à une légende d'une ligne et se fait traverser
     * par la deuxième. */
    var LIGNES_LEGENDE = disposeLegende();
    var basLegende = g.bottom - u(14.5) - (LIGNES_LEGENDE.lignes.length - 1) * u(4.6);

    if (multi) {
      /* Le triptyque : même langage graphique, mêmes échelles, trois
       * systèmes. Des échelles propres à chaque année rendraient la
       * comparaison — qui est tout le propos — impossible. */
      var n = Math.min(periodes.length, 3);
      var groupe = periodes.slice(-n);
      var echelles = echellesCommunes(groupe);
      var cols = (w >= h) ? n : (n <= 2 ? 1 : 2);
      var rows = Math.ceil(n / cols);
      var cw = g.width / cols, chh = (basLegende - g.top - u(4)) / rows;
      groupe.forEach(function (p, i) {
        var cx = g.left + (i % cols) * cw + cw / 2;
        var cy = g.top + u(4) + Math.floor(i / cols) * chh + chh / 2;
        var R = Math.min(cw, chh) * 0.40;
        systeme(p, cx, cy, R, echelles, i / n, 1 / n, true);
      });
    } else {
      /* ---------- où vont les mémoires épinglées ----------
       *
       * Elles décident de toute la composition, et le premier jet ne les
       * plaçait nulle part : il les écrivait aux marges de la PAGE, à une
       * hauteur fixe, en supposant qu'une story laisse toujours de la place
       * à côté du cercle. En paysage leurs filets traversaient le champ de
       * part en part ; en carré les libellés s'écrivaient carrément DANS la
       * constellation, par-dessus les mois et les orbites.
       *
       * On leur réserve donc une zone d'abord, et le système prend ce qui
       * reste : une COLONNE à droite quand la page est large, une BANDE en
       * haut sinon. Les filets deviennent courts et ne coupent plus rien. */
      /* Colonne ou bande : le critère est le RAPPORT de la page, et la bande
       * est dimensionnée sur ce qu'elle doit contenir. Le premier jet posait
       * une bande de 23 unités pour trois mémoires qui en demandent 51 : en
       * carré et en 4:5 les deux dernières s'écrivaient par-dessus les mois
       * et les orbites. Seule la story 9:16 a la hauteur pour une bande. */
      var epingles = o.remarquables !== 'aucune';
      var enColonne = epingles && (w / h) > 0.72;
      var colAnnot = enColonne ? g.width * 0.29 : 0;
      var hBande = u(9) + 3 * u(13) + u(3);
      var bandeHaut = (epingles && !enColonne) ? hBande : u(4);

      var zone = { x: g.left, y: g.top + bandeHaut,
                   w: g.width - colAnnot, h: basLegende - (g.top + bandeHaut) };
      var marge = { enColonne: enColonne,
                    x: enColonne ? g.right - colAnnot + u(3) : g.left,
                    largeur: enColonne ? colAnnot - u(3) : g.width,
                    y: enColonne ? zone.y + u(4) : g.top + u(4),
                    droite: g.right };

      var p0 = periodes[periodes.length - 1];
      var ech = echellesCommunes([p0]);
      var R = Math.min(zone.w * 0.46, zone.h * 0.46);
      systeme(p0, zone.x + zone.w / 2, zone.y + zone.h / 2, R, ech, 0, 1, false, marge);
    }

    legende();

    /* ================= découpage en périodes ================= */

    function decoupePeriodes(list) {
      var tri = list.slice().sort(function (a, b) { return a.activity.date - b.activity.date; });
      var cles = {};
      var mode = o.echelleTemps;
      tri.forEach(function (e) {
        var d = e.activity.date;
        var cle = mode === 'mois' ? (d.getFullYear() + '-' + pad(d.getMonth() + 1))
                                  : String(d.getFullYear());
        (cles[cle] = cles[cle] || []).push(e);
      });
      var ordonnees = Object.keys(cles).sort().map(function (cle) {
        var membres = cles[cle];
        var d0 = membres[0].activity.date;
        var debut, fin, nom;
        if (mode === 'mois') {
          debut = new Date(d0.getFullYear(), d0.getMonth(), 1);
          fin = new Date(d0.getFullYear(), d0.getMonth() + 1, 1);
          nom = debut.toLocaleDateString('fr-CH', { month: 'long', year: 'numeric' });
        } else {
          debut = new Date(d0.getFullYear(), 0, 1);
          fin = new Date(d0.getFullYear() + 1, 0, 1);
          nom = String(d0.getFullYear());
        }
        return { cle: cle, nom: nom, debut: debut, fin: fin, membres: membres };
      });
      /* Le décalage recule dans le temps : 0 = la dernière période
       * renseignée, -1 la précédente. Les périodes VIDES intermédiaires ne
       * sont pas fabriquées — le vide n'est pas une période. */
      if (o.echelleTemps !== 'annees') {
        var idx = ordonnees.length - 1 + Math.round(o.decalage);
        idx = Math.max(0, Math.min(ordonnees.length - 1, idx));
        return [ordonnees[idx]];
      }
      return ordonnees;
    }

    /* ================= échelles ================= */

    function valeur(act, quoi) {
      if (quoi === 'distance') return act.distance_km || 0;
      if (quoi === 'deniv') return act.elev_gain_m == null ? null : act.elev_gain_m;
      return (act.duration_s || 0) / 3600;
    }
    function unite(quoi) { return quoi === 'distance' ? 'km' : quoi === 'deniv' ? 'm D+' : 'h'; }

    /* Les bornes sont communes à toutes les périodes affichées : c'est ce
     * qui permet de comparer deux années côte à côte. */
    function echellesCommunes(groupe) {
      var toutesAct = [];
      groupe.forEach(function (p) { p.membres.forEach(function (e) { toutesAct.push(e.activity); }); });
      function max(quoi) {
        var vals = toutesAct.map(function (a) { return valeur(a, quoi); })
          .filter(function (v) { return v != null && isFinite(v); });
        return vals.length ? Math.max.apply(null, vals) : 1;
      }
      return { rMax: max(o.orbite) || 1, sMax: max(o.taille) || 1 };
    }

    /* ================= un système ================= */

    function systeme(p, cx, cy, R, ech, phase, part, compact, marge) {
      var rNoyau = R * 0.30;
      var membres = p.membres;
      var duree = p.fin - p.debut;

      /* --- la géométrie, calculée EN ENTIER avant toute révélation --- */
      var astres = membres.map(function (e) {
        var a = e.activity;
        var t = Alpage.positionDansPeriode(a.date, p.debut, p.fin);
        var ang = -Math.PI / 2 + t * Math.PI * 2;      // le début en haut, sens horaire
        var vr = valeur(a, o.orbite);
        var vs = valeur(a, o.taille);
        var rr = rNoyau + (R - rNoyau) * Math.max(0, Math.min(1, (vr || 0) / ech.rMax));
        /* Surface ∝ mesure : le rayon suit donc la racine. Une mesure
         * ABSENTE (dénivelé non renseigné) n'est pas zéro — elle reçoit un
         * symbole creux, identifié dans la légende. */
        var absente = vs == null;
        var aire = absente ? 0.18 : Math.max(0.02, vs / ech.sMax);
        /* La taille des symboles est un COEFFICIENT, pas une formule : il
         * multiplie tous les rayons à l'identique. Les proportions entre
         * sorties — la seule chose que la surface raconte — sont donc
         * intactes, on regarde simplement la planche de plus ou moins loin. */
        var rp = (R * (compact ? 0.035 : 0.045) * Math.sqrt(aire) + R * 0.006) * ampleurSymboles;
        return {
          entree: e, activity: a, t: t, ang: ang, r: rr, rayon: rp,
          absente: absente, nulle: !absente && vs === 0,
          famille: familleDe(a), x: cx + Math.cos(ang) * rr, y: cy + Math.sin(ang) * rr
        };
      });

      /* --- les orbites de référence --- */
      if (o.orbites) {
        var pasOrb = choisitPas(ech.rMax);
        ctx.save();
        /* Les orbites de référence sont ce qui rend la planche LISIBLE :
         * sans elles, un astre à mi-rayon ne dit rien. À 0,13 elles
         * disparaissaient sur le papier — elles étaient là, mais on ne les
         * voyait pas, ce qui revient au même. */
        ctx.strokeStyle = melange(encre, 0.20);
        ctx.lineWidth = Math.max(0.4, u(0.055));
        for (var v = pasOrb; v <= ech.rMax * 1.001; v += pasOrb) {
          var rr = rNoyau + (R - rNoyau) * (v / ech.rMax);
          ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke();
          if (!compact) {
            H.text(Math.round(v) + ' ' + unite(o.orbite), cx + u(0.8), cy - rr - u(0.8),
                   H.t('label', { size: 1.35, color: melange(encre, 0.48) }));
          }
        }
        ctx.restore();
      }

      /* --- les repères de temps --- */
      reperesTemps(p, cx, cy, rNoyau, R, compact);

      /* --- le champ --- */
      /* La révélation est CHRONOLOGIQUE et n'affecte que la visibilité :
       * chaque astre est déjà à sa place définitive. */
      var seuil = part >= 1 ? 1 : Math.max(0, Math.min(1, (s.progress - phase) / part));
      astres.forEach(function (as) {
        if (as.t > seuil) return;
        marque(as, compact);
      });

      /* --- les remarquables, à la périphérie --- */
      if (o.remarquables !== 'aucune' && !compact && seuil >= 0.98 && marge) {
        remarquables(astres, cx, cy, R, marge);
      }

      /* --- le noyau --- */
      noyau(p, cx, cy, rNoyau, compact);

      /* --- l'encombrement, dit et non corrigé --- */
      /* L'encombrement est REMONTÉ à la légende. Écrit sous le cercle, il
       * tombait sur le filet du bloc de bas de page dès que le système
       * occupait toute la hauteur. */
      if (!compact) encombrement = compte(astres);
    }

    /* Combien de marques en recouvrent une autre. On COMPTE, on ne déplace
     * pas : la position d'un astre est sa donnée. */
    function compte(astres) {
      var n = 0;
      for (var i = 0; i < astres.length; i++) {
        for (var j = i + 1; j < astres.length; j++) {
          var d = Math.hypot(astres[i].x - astres[j].x, astres[i].y - astres[j].y);
          if (d < (astres[i].rayon + astres[j].rayon) * 0.75) { n++; break; }
        }
      }
      return n;
    }

    function marque(as, compact) {
      var f = FAMILLES[as.famille] || FAMILLES.autre;
      var couleur = o.couleur === 'sport' ? f.teinte : melange(encre, 0.82);
      var r = as.rayon;
      ctx.save();
      ctx.translate(as.x, as.y);
      ctx.strokeStyle = couleur;
      ctx.fillStyle = couleur;
      ctx.lineWidth = Math.max(0.5, r * 0.28);

      /* Mesure de taille ABSENTE : un symbole creux, distinct du zéro. Un
       * dénivelé nul est une information ; un dénivelé non renseigné en est
       * une autre, et les confondre ferait mentir la planche. */
      if (as.absente) {
        ctx.setLineDash([r * 0.7, r * 0.7]);
        ctx.beginPath(); ctx.arc(0, 0, Math.max(u(0.5), r), 0, Math.PI * 2); ctx.stroke();
        ctx.restore(); return;
      }
      if (as.nulle) {
        // mesure nulle : un repère minimal, plein mais très petit
        ctx.beginPath(); ctx.arc(0, 0, Math.max(0.7, u(0.16)), 0, Math.PI * 2); ctx.fill();
        ctx.restore(); return;
      }

      switch (f.forme) {
        case 'plein':
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); break;
        case 'anneau':
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
          ctx.lineWidth = Math.max(0.4, r * 0.2); ctx.stroke(); break;
        case 'point':
          ctx.beginPath(); ctx.arc(0, 0, r * 0.62, 0, Math.PI * 2); ctx.fill(); break;
        case 'ouvert':
          ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2);
          ctx.fillStyle = papier; ctx.fill(); ctx.stroke(); break;
        case 'radial':
          ctx.rotate(as.ang);
          ctx.beginPath(); ctx.moveTo(-r * 1.6, 0); ctx.lineTo(r * 1.6, 0); ctx.stroke();
          ctx.beginPath(); ctx.arc(0, 0, r * 0.5, 0, Math.PI * 2); ctx.fill(); break;
        default:
          ctx.beginPath();
          ctx.moveTo(-r, -r); ctx.lineTo(r, r);
          ctx.moveTo(r, -r); ctx.lineTo(-r, r);
          ctx.stroke();
      }
      ctx.restore();
      void compact;
    }

    /* ================= repères de temps ================= */

    function reperesTemps(p, cx, cy, rNoyau, R, compact) {
      var mode = o.echelleTemps;
      var duree = p.fin - p.debut;
      ctx.save();
      ctx.strokeStyle = melange(encre, 0.28);
      ctx.lineWidth = Math.max(0.4, u(0.055));

      if (mode === 'mois') {
        // un repère par semaine, le jour en périphérie
        var d = new Date(p.debut);
        while (d < p.fin) {
          var t = (d - p.debut) / duree;
          trait(t, d.getDate() === 1 || d.getDate() % 7 === 1);
          if (!compact && (d.getDate() === 1 || d.getDate() % 7 === 1)) {
            etiquette(t, String(d.getDate()));
          }
          d = new Date(d.getTime() + 86400000);
        }
      } else {
        var MOIS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];
        for (var m = 0; m < 12; m++) {
          var dm = new Date(p.debut.getFullYear(), m, 1);
          var tm = (dm - p.debut) / duree;
          if (tm < 0 || tm > 1) continue;
          trait(tm, true);
          if (!compact || m % 3 === 0) etiquette(tm, MOIS[m]);
        }
      }
      ctx.restore();

      function trait(t, fort) {
        var ang = -Math.PI / 2 + t * Math.PI * 2;
        var r0 = fort ? rNoyau : R - u(1.4);
        ctx.globalAlpha = fort ? 0.5 : 0.25;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
        ctx.lineTo(cx + Math.cos(ang) * R, cy + Math.sin(ang) * R);
        ctx.stroke();
      }
      function etiquette(t, str) {
        var ang = -Math.PI / 2 + t * Math.PI * 2;
        var rr = R + u(compact ? 2.4 : 3.4);
        H.text(str, cx + Math.cos(ang) * rr, cy + Math.sin(ang) * rr + u(0.6),
               H.t('label', { size: compact ? 1.3 : 1.7, color: faint, align: 'center' }));
      }
    }

    /* ================= le noyau ================= */

    function noyau(p, cx, cy, rNoyau, compact) {
      var membres = p.membres;
      var km = membres.reduce(function (t, e) { return t + (e.activity.distance_km || 0); }, 0);
      var dp = membres.reduce(function (t, e) { return t + (e.activity.elev_gain_m || 0); }, 0);

      // le noyau reste dégagé : un disque de papier, pas un cartouche
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, rNoyau * 0.92, 0, Math.PI * 2);
      ctx.fillStyle = papier; ctx.fill();
      ctx.restore();

      var titre = compact ? p.nom : (String(o.titre || '').trim() || p.nom);
      H.text(titre.toUpperCase(), cx, cy - (compact ? u(0.4) : u(2.4)),
             H.t(compact ? 'title' : 'value', {
               size: compact ? 3 : 7.4, color: encre, align: 'center',
               maxWidth: rNoyau * 1.5
             }));
      if (!compact) {
        H.text(membres.length + ' sorties', cx, cy + u(3.4),
               H.t('label', { color: faint, align: 'center' }));
        H.text(H.fmt.km(km, 0) + ' km · ' + Math.round(dp) + ' m D+', cx, cy + u(7),
               H.t('label', { color: faint, align: 'center' }));
      } else {
        H.text(membres.length + ' · ' + H.fmt.km(km, 0) + ' km', cx, cy + u(3.4),
               H.t('label', { size: 1.4, color: faint, align: 'center' }));
      }
    }

    /* ================= les remarquables ================= */

    /* Jusqu'à trois, choisies par une RÈGLE que l'utilisateur pose. Un filet
     * fin les relie à leur étiquette en marge — l'annotation à la main d'une
     * planche d'observatoire, pas une infobulle. */
    function remarquables(astres, cx, cy, R, marge) {
      var quoi = o.remarquables;
      var tri = astres.slice().filter(function (as) {
        return valeur(as.activity, quoi) != null;
      }).sort(function (a, b) {
        return valeur(b.activity, quoi) - valeur(a.activity, quoi);
      }).slice(0, 3);

      var pas = u(13);
      tri.forEach(function (as, i) {
        /* En COLONNE, tout part vers la droite : le filet sort de l'astre,
         * contourne le cercle et rejoint sa ligne. En BANDE, l'étiquette se
         * range du côté où se trouve l'astre, au-dessus du système. */
        var droite = marge.enColonne || Math.cos(as.ang) >= 0;
        var xTexte = marge.enColonne ? marge.x : (droite ? marge.droite : marge.x);
        var xFilet = marge.enColonne ? marge.x - u(1.5) : xTexte;
        var yMarge = marge.y + u(9) + i * pas;
        var al = marge.enColonne ? 'left' : (droite ? 'right' : 'left');

        ctx.save();
        ctx.strokeStyle = melange(encre, 0.3);
        ctx.lineWidth = Math.max(0.4, u(0.06));
        ctx.beginPath();
        ctx.moveTo(as.x + Math.cos(as.ang) * (as.rayon + u(0.8)),
                   as.y + Math.sin(as.ang) * (as.rayon + u(0.8)));
        /* Le coude passe au-delà du cercle avant de rejoindre la marge :
         * sans lui, le filet retraverse le champ en diagonale. */
        var coude = marge.enColonne
          ? Math.max(cx + R + u(3), xFilet - u(6))
          : (droite ? xFilet - u(14) : xFilet + u(14));
        ctx.lineTo(coude, yMarge - u(1.2));
        ctx.lineTo(xFilet, yMarge - u(1.2));
        ctx.stroke();
        ctx.restore();

        // l'astre nommé reçoit le seul accent de la planche
        ctx.save();
        ctx.strokeStyle = accent;
        ctx.lineWidth = Math.max(0.6, u(0.14));
        ctx.beginPath(); ctx.arc(as.x, as.y, as.rayon * 2.4 + u(0.7), 0, Math.PI * 2);
        ctx.stroke(); ctx.restore();

        var largeur = marge.enColonne ? marge.largeur : u(38);
        H.text(as.activity.date.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' }).toUpperCase(),
               xTexte, yMarge - u(3.4), H.t('label', { color: accent, align: al }));
        H.text(Library.nomCourt(as.activity, 22), xTexte, yMarge + u(1),
               H.t('title', { size: 2.9, color: encre, align: al, maxWidth: largeur }));
        H.text(H.fmt.km(as.activity.distance_km, 1) + ' km' +
               (as.activity.elev_gain_m != null ? ' · ' + Math.round(as.activity.elev_gain_m) + ' m' : ''),
               xTexte, yMarge + u(5), H.t('label', { color: faint, align: al, maxWidth: largeur }));
      });
    }

    /* ================= légende ================= */

    function legende() {
      var y = g.bottom;

      /* Les familles présentes SEULEMENT : une légende qui liste le ski
       * quand il n'y a que du vélo occupe de la place pour rien. La
       * disposition vient d'en haut : c'est elle qui a décidé de la place
       * laissée au champ, elle ne peut pas être recalculée ici. */
      /* Le pas était FIXE : trente unités par entrée, quel que soit le mot
       * et quelle que soit la largeur de la page. À la cinquième famille on
       * écrivait à cent-vingt unités sur une page qui en fait quatre-vingt-six,
       * et « Randonnée » sortait de l'image après « Course à pied ».
       *
       * On mesure donc chaque libellé, et on passe à la ligne quand la
       * suivante ne tient plus. La légende monte d'autant — elle n'a pas de
       * hauteur fixe, elle a le nombre de lignes qu'il lui faut. */
      var cles = LIGNES_LEGENDE.cles;
      var larges = LIGNES_LEGENDE.larges;
      var lignes = LIGNES_LEGENDE.lignes;
      var hLigne = u(4.6);
      var yBase = y - u(7.8) - (lignes.length - 1) * hLigne;
      lignes.forEach(function (ligne, r) {
        var x = g.left;
        ligne.forEach(function (i) {
          var cle = cles[i];
          var faux = { x: x + u(1.4), y: yBase + r * hLigne, ang: 0, rayon: u(0.85),
                       famille: cle, absente: false, nulle: false };
          marque(faux, true);
          H.text(FAMILLES[cle].nom, x + u(4.2), yBase + r * hLigne + u(0.6),
                 H.t('label', { color: faint }));
          x += larges[i];
        });
      });
      var hSupp = (lignes.length - 1) * hLigne;

      H.rule(g.left, y - u(11.5) - hSupp, g.right, { color: hair });

      var regle = 'ANGLE : POSITION DANS LA PÉRIODE · RAYON : ' + nomMesure(o.orbite).toUpperCase() +
                  ' (ÉCHELLE LINÉAIRE) · SURFACE : ' + nomMesure(o.taille).toUpperCase();
      H.text(regle, g.left, y - u(3), H.t('label', { color: melange(encre, 0.42), maxWidth: g.width }));
      H.text('CERCLE POINTILLÉ = MESURE NON RENSEIGNÉE · LES VIDES SONT DES VIDES RÉELS' +
             (encombrement ? ' · ' + encombrement + ' MARQUES SE CHEVAUCHENT — RÉDUIS LA PÉRIODE OU FILTRE PAR SPORT' : ''),
             g.left, y + u(0.6), H.t('label', { color: melange(encre, 0.3), maxWidth: g.width }));
    }

    function nomMesure(q) {
      return q === 'distance' ? 'distance (km)' : q === 'deniv' ? 'dénivelé (m)' : 'durée (h)';
    }

    function choisitPas(max) {
      var c = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000];
      for (var i = 0; i < c.length; i++) if (max / c[i] <= 5) return c[i];
      return 10000;
    }

    function pad(n) { return n < 10 ? '0' + n : String(n); }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
