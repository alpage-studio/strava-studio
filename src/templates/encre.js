/* « Encre » — le geste du terrain.
 *
 * Le parcours comme un trait de plume : une seule forme, posée hors centre,
 * qui occupe la page. Le titre est petit — c'est la forme qui porte
 * l'affiche, pas le texte.
 *
 * Trois interprétations du même geste :
 *   · Trait   — un ruban plein, d'épaisseur modulée
 *   · Fibres  — cinq à onze filaments qui suivent le parcours
 *   · Réserve — le parcours en papier clair, réservé dans une bande d'encre
 *
 * ── Deux décisions techniques portent le rendu ────────────────────────
 *
 * 1. RÉÉCHANTILLONNER PAR DISTANCE avant tout. Un GPS enregistre au temps :
 *    une montée à 6 km/h pose cinq fois plus de points qu'une descente à 50.
 *    Moduler l'épaisseur « par point » raconterait donc la vitesse, sans
 *    qu'on puisse le deviner en regardant. Après rééchantillonnage, un
 *    centimètre de papier vaut toujours le même nombre de mètres.
 *
 * 2. LE RUBAN EST UN POLYGONE, pas un trait. Un côté à l'aller, l'autre au
 *    retour, rempli en `nonzero`. Les croisements se remplissent alors tout
 *    seuls — ce que fait une plume qui repasse sur son trait. L'alternative
 *    (un `stroke` par segment, à épaisseur variable) laisse un raccord
 *    visible à chaque virage, et c'est exactement là que l'œil regarde.
 *
 * ── Honnêteté ────────────────────────────────────────────────────────
 * Par défaut l'épaisseur suit la COURBURE : c'est un effet de style, et la
 * planche l'écrit. En mode « épaisseur par mesure », elle suit une mesure
 * réellement présente dans le fichier, et une légende dit laquelle, avec
 * ses bornes. Aucune trace ouverte n'est refermée.
 */
Studio.template({
  id: 'encre',
  name: 'Encre — le geste du terrain',
  famille: 'affiche',
  /* La transparence est une OPTION : la même planche s'exporte sur papier
   * ou en surcouche à poser sur une photo. */
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'interpretation', type: 'select', label: 'Interprétation', default: 'trait', reflow: true,
      choices: [['trait', 'Trait — un ruban plein'],
                ['fibres', 'Fibres — des filaments'],
                ['reserve', 'Réserve — le parcours en clair']] },
    { key: 'epaisseur', type: 'range', label: 'Épaisseur', default: 40, min: 8, max: 100, step: 2 },
    { key: 'matiere', type: 'range', label: 'Matière', default: 30, min: 0, max: 100, step: 5 },
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
    { key: 'fibres', type: 'range', label: 'Nombre de fibres', default: 7, min: 5, max: 11, step: 2 },
    /* fond, voile, papier, encre : injectés depuis le socle Alpage */
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'grain', type: 'toggle', label: 'Grain du papier', default: true }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsFond()),

  /* Une mesure absente du fichier ne doit pas rester proposée : le réglage
   * ne ferait rien et rien ne le dirait. */
  inert: function (a, vals) {
    var morts = [];
    if (!vals) return morts;
    if (vals.interpretation !== 'fibres') morts.push('fibres');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    /* Papier ou surcouche : c'est la MÊME planche. Le socle pose le fond,
     * le voile éventuel, et rend l'encre à utiliser. */
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || o.papierC || '#F2EFE6');



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

    /* ---------- préparation de la géométrie ---------- */
    /* Un pas d'échantillonnage proportionnel à l'étendue : 700 points quelle
     * que soit la taille de la sortie, donc un coût de rendu constant et une
     * matière d'aspect identique sur 6 km comme sur 160. */
    var pas = Math.max(2, vue.etendue / 700);
    var brut = Alpage.reechantillonne(vue.pts, pas);
    var pts = Alpage.lisse(brut, 2);
    /* Une boucle refermée sur elle-même doit l'être aussi à l'encre : sinon
     * le ruban laisse une encoche blanche là où ses deux bouts se touchent,
     * et l'œil la lit comme une coupure volontaire. On ne referme QUE ce qui
     * revient réellement à son point de départ — une trace ouverte reste
     * ouverte, c'est la règle. */
    var bouclee = Math.hypot(pts[0].x - pts[pts.length - 1].x,
                             pts[0].y - pts[pts.length - 1].y) < vue.etendue * 0.02;
    if (bouclee) pts.push(pts[0], pts[1]);
    var vue2 = { pts: pts, largeur: vue.largeur, hauteur: vue.hauteur,
                 minX: vue.minX, maxX: vue.maxX, minY: vue.minY, maxY: vue.maxY };

    /* ---------- orientation ---------- */
    /* Le nord en haut par défaut. Une rotation est un choix, jamais un
     * étirement : on tourne les coordonnées, on ne déforme pas le parcours,
     * et la planche le dit en pied. */
    var angle = 0;
    if (o.orientation === 'diagonale') angle = -Math.PI / 9;
    else if (o.orientation === 'remplir') angle = angleOptimal(pts, w > h);
    if (angle) { pts = tourne(pts, angle); vue2 = bornes(pts); }

    /* ---------- où poser la forme ---------- */
    /* 70 % de la surface utile, décalée vers l'angle le plus vide de la
     * trace : c'est CETTE trace qui décide où se met le titre. */
    var coin = coinLePlusVide(pts, vue2);
    var zone = { x: g.left, y: g.top + u(4), w: g.width, h: g.height - u(14) };
    var cadre = Alpage.cadre(vue2, zone, {
      marge: u(2), echelle: 0.995,
      ancreX: -coin.x * 0.13, ancreY: -coin.y * 0.13
    });

    /* ---------- l'épaisseur ---------- */
    /* Ces deux-là sont posés AVANT tout dessin. `var` est hoisté, mais son
     * affectation ne l'est pas : déclarés plus bas, `alea` valait undefined
     * au moment où le ruban s'en servait, et le `= null` de `mesureUtilisee`
     * effaçait après coup la mesure que la légende devait nommer. */
    var alea = Alpage.graine(vue);
    var mesureUtilisee = null;
    var ep = epaisseurs(pts);
    var base = u(o.epaisseur / 22);          // demi-largeur maximale, en pixels

    /* TOUT le dessin se fait en espace-page, jamais en mètres.
     * Le premier jet construisait le ruban sur les coordonnées projetées
     * (des mètres) avec des demi-largeurs en pixels, puis projetait le
     * résultat : les vingt pixels d'épaisseur devenaient vingt MÈTRES, soit
     * un cheveu sur une sortie de soixante kilomètres. Le trait était bien
     * là — invisible. On projette donc les points d'abord, on épaissit
     * ensuite. */
    var P = pts.map(cadre.point);
    var N = Alpage.normales(P);

    /* ---------- dessin ---------- */
    var reveles = H.progressCount(pts.length);
    if (o.interpretation === 'fibres') dessineFibres();
    else if (o.interpretation === 'reserve') dessineReserve();
    else dessineTrait();

    /* ---------- texte ---------- */
    legende(coin);

    /* ================= les trois interprétations ================= */

    /* 1. TRAIT — un ruban plein. */
    function dessineTrait() {
      var n = Math.max(2, reveles);
      var vus = P.slice(0, n);
      var demi = ep.slice(0, n).map(function (v, i) {
        return base * (0.22 + 0.78 * v) * matiere(i);
      });
      remplit(Alpage.ruban(vus, demi), encre);
      frontDEncre(vus);
    }

    /* 2. FIBRES — des filaments parallèles, d'écart progressif. */
    function dessineFibres() {
      var nb = Math.max(5, Math.min(11, Math.round(o.fibres) | 1));
      var fin = Math.max(2, reveles);
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var f = 0; f < nb; f++) {
        var t = nb === 1 ? 0 : (f / (nb - 1)) * 2 - 1;      // -1 .. 1
        ctx.beginPath();
        for (var i = 0; i < fin; i++) {
          /* L'écart s'ouvre et se referme le long du parcours : un faisceau
           * à écart constant se lit comme un tuyau, pas comme des fibres. */
          var ouverture = 0.35 + 0.65 * ep[i];
          var d = t * base * 4.4 * ouverture + Alpage.ondulation(alea, i + f * 997, 34, f) * base * 0.5;
          var X = P[i].x + N[i].x * d, Y = P[i].y + N[i].y * d;
          if (i === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        }
        // la fibre centrale porte le trait, les extérieures s'estompent
        ctx.globalAlpha = 0.34 + 0.66 * (1 - Math.abs(t));
        ctx.lineWidth = Math.max(0.8, base * (0.1 + 0.16 * (1 - Math.abs(t))));
        ctx.strokeStyle = encre;
        ctx.stroke();
      }
      ctx.restore();
    }

    /* 3. RÉSERVE — l'encre autour, le parcours en papier.
     * Deux passes : la bande large en encre, la trace étroite en papier par
     * dessus. `destination-out` aurait aussi marché mais perce le fond et
     * casse l'export transparent ; repeindre en couleur de papier reste
     * lisible dans tous les cas. */
    function dessineReserve() {
      var n = Math.max(2, reveles);
      var vus = P.slice(0, n);
      remplit(Alpage.ruban(vus, ep.slice(0, n).map(function (v, i) {
        return base * (1.6 + 1.6 * v) * matiere(i);
      })), encre);
      remplit(Alpage.ruban(vus, ep.slice(0, n).map(function (v, i) {
        return base * (0.30 + 0.66 * v) * matiere(i);
      })), papier);
    }

    /* Le polygone arrive DÉJÀ en pixels : on ne reprojette plus rien ici. */
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

    /* Le front d'encre : une pointe qui accompagne le dessin pendant
     * l'animation et disparaît à l'arrivée. Aucun scintillement — c'est une
     * fonction de la progression, pas du temps. */
    function frontDEncre(vus) {
      if (s.progress >= 1 || vus.length < 3) return;
      var p = vus[vus.length - 1];
      ctx.save();
      ctx.fillStyle = encre;
      ctx.globalAlpha = 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, base * 0.9, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    /* ================= l'épaisseur ================= */

    function epaisseurs(list) {
      if (o.source === 'egale') return list.map(function () { return 0.55; });
      if (o.source === 'courbure') {
        /* La courbure, lissée deux fois : brute, elle donne un trait qui
         * clignote point par point. */
        var c = Alpage.courbure(list, 4);
        var out = [];
        for (var i = 0; i < c.length; i++) {
          var a0 = Math.max(0, i - 6), b0 = Math.min(c.length - 1, i + 6), sum = 0, n = 0;
          for (var j = a0; j <= b0; j++) { sum += c[j]; n++; }
          out.push(Math.min(1, Math.pow(sum / n, 0.55) * 1.7));
        }
        return out;
      }
      var s2 = Alpage.serie(list, o.source);
      if (!s2) return list.map(function () { return 0.55; });
      mesureUtilisee = s2;
      return s2.valeurs;
    }

    /* La matière : une ondulation lente de l'épaisseur, comme une plume qui
     * se recharge. À zéro, le trait est parfaitement régulier. */
    function matiere(i) {
      var f = (Number(o.matiere) || 0) / 100;
      if (!f) return 1;
      return 1 + f * 0.45 * Alpage.ondulation(alea, i, 55, 1);
    }

    /* ================= composition ================= */

    /* Le coin le plus vide de la trace, sur une grille 2×2 : c'est là que le
     * titre ira, et c'est aussi la direction dans laquelle on décale la
     * forme pour lui faire de la place. */
    function coinLePlusVide(list, v) {
      var cx = (v.minX + v.maxX) / 2, cy = (v.minY + v.maxY) / 2;
      var q = [0, 0, 0, 0];
      list.forEach(function (p) {
        q[(p.x < cx ? 0 : 1) + (p.y < cy ? 0 : 2)]++;
      });
      var min = 0;
      for (var i = 1; i < 4; i++) if (q[i] < q[min]) min = i;
      return { x: (min % 2) ? 1 : -1, y: (min >= 2) ? 1 : -1, indice: min };
    }

    function legende(coin) {
      var enBas = coin.y > 0;
      var y = enBas ? g.bottom : g.top + u(4.4);
      var titre = String(o.titre || '').trim() || a.name || 'Sortie';
      var xg = g.left;

      H.text(titre, xg, y, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(3) }));

      /* La provenance de l'épaisseur, en petit. C'est la ligne qui sépare un
       * graphique d'une décoration : on doit pouvoir savoir si le trait
       * mesure quelque chose ou s'il fait joli. */
      var note;
      if (o.source === 'courbure') note = 'ÉPAISSEUR : COURBURE DU PARCOURS — EFFET DE STYLE';
      else if (o.source === 'egale') note = 'ÉPAISSEUR CONSTANTE';
      else if (mesureUtilisee) {
        var lib = { ele: 'ALTITUDE', w: 'PUISSANCE', hr: 'FRÉQUENCE CARDIAQUE', cad: 'CADENCE' }[o.source];
        var unite = { ele: ' M', w: ' W', hr: ' BPM', cad: ' TR/MIN' }[o.source];
        note = 'ÉPAISSEUR : ' + lib + ' · ' + Math.round(mesureUtilisee.lo) + unite +
               ' → ' + Math.round(mesureUtilisee.hi) + unite +
               (mesureUtilisee.manquantes ? ' · ' + mesureUtilisee.manquantes + ' POINTS SANS MESURE' : '');
      } else {
        note = 'MESURE ABSENTE DE CE FICHIER — ÉPAISSEUR CONSTANTE';
      }
      H.text(note, xg, y + u(4.4), H.t('label', { color: melange(encre, 0.5), maxWidth: g.width }));
      if (angle) {
        H.text('ORIENTATION MODIFIÉE — LE PARCOURS EST TOURNÉ, PAS DÉFORMÉ',
               xg, y + u(7.6), H.t('label', { color: melange(encre, 0.34), maxWidth: g.width }));
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

    /* L'angle qui fait le mieux tenir la trace dans le format. Balayage à
     * 5° : exact suffisant, et surtout déterministe. */
    function angleOptimal(list, paysage) {
      var best = 0, meilleur = -Infinity;
      for (var deg = -45; deg <= 45; deg += 5) {
        var r = bornes(tourne(list, deg * Math.PI / 180));
        var ratio = paysage ? r.largeur / (r.hauteur || 1) : r.hauteur / (r.largeur || 1);
        var aire = Math.min(ratio, 2.4);      // au-delà, ça devient un fil
        if (aire > meilleur) { meilleur = aire; best = deg * Math.PI / 180; }
      }
      return best;
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
