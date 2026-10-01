/* « Trame » — le parcours tissé.
 *
 * Une chaîne verticale, une trame horizontale, et le parcours qui les
 * traverse comme un fil : dessus, dessous, dessus. De loin c'est une pièce
 * textile ; de près on reconnaît la sortie, et le tissage s'y resserre là où
 * l'effort a été fourni.
 *
 * ── UN SEUL REPÈRE : L'ESPACE ────────────────────────────────────────
 *
 * La tentation était de faire descendre le temps le long de la planche — une
 * rangée de trame par minute. Le parcours, lui, est dessiné dans l'espace de
 * la carte : les deux axes auraient alors voulu dire deux choses à la fois,
 * et plus rien n'aurait été lisible ensemble.
 *
 * Le brief dit « l'effort resserre LOCALEMENT le tissage ». C'est donc pris
 * au mot : la trame se densifie au VOISINAGE des points où la mesure est
 * haute. Tout reste dans l'espace de la carte, et le rapprochement entre une
 * zone serrée et l'endroit du parcours qui l'a produite se fait à l'œil.
 *
 * ── LA MESURE EST CHOISIE, ET SEULEMENT PARMI CELLES QUI EXISTENT ────
 *
 * `Alpage.mesures()` interroge la trace : altitude, puissance, cardio,
 * cadence n'apparaissent au menu que si CETTE sortie les porte. Proposer la
 * puissance à quelqu'un sans capteur serait un réglage qui ne fait rien.
 *
 * Sans aucune mesure, la trame reste RÉGULIÈRE et la planche l'écrit. Une
 * trame qui ondule au hasard laisserait croire à un effort qu'on n'a pas
 * enregistré — c'est exactement ce que ce studio refuse.
 *
 * L'échelle vient de `Alpage.serie()` : bornée aux centiles 3 et 97, donc
 * stable d'une sortie à l'autre, et un pic isolé n'écrase pas le reste.
 *
 * ── DESSUS-DESSOUS, POUR DE VRAI ─────────────────────────────────────
 *
 * Le fil du parcours est peint d'un trait ; puis, un croisement sur deux — de
 * chaîne comme de trame, comptés le long du fil — est REPEINT par-dessus lui.
 * C'est ce qui fabrique l'entrelacement : sans quoi on aurait une ligne posée
 * sur une grille, ce que le brief écarte explicitement.
 */
Studio.template({
  id: 'trame',
  name: 'Trame — le parcours tissé',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  variantes: [
    { nom: 'Toile', dit: 'chaîne et trame régulières, le fil traverse', o: {} },
    { nom: 'Serré', dit: 'un tissage dense, presque une étoffe',
      o: { composition: 'serre' } },
    { nom: 'Lâche', dit: 'peu de fils, beaucoup de papier',
      o: { composition: 'lache' } }
  ],

  options: [
    { key: 'composition', type: 'select', label: 'Composition', default: 'toile', reflow: true,
      choices: [['toile', 'Original · Toile — chaîne et trame régulières'],
                ['serre', 'Original · Serré — une étoffe dense'],
                ['lache', 'Original · Lâche — peu de fils, beaucoup de papier']] },
    /* Les choix sont posés par buildOptions au moment du rendu : voir
     * `mesuresDisponibles` plus bas. On déclare ici le repli, qui vaut pour
     * une sortie dont on ne sait rien. */
    { key: 'mesure', type: 'select', label: 'Ce qui resserre le tissage', default: 'auto',
      choices: [['auto', 'Automatique — la mesure la plus riche de la sortie'],
                ['aucune', 'Aucune — trame régulière'],
                ['ele', 'Altitude'], ['w', 'Puissance'],
                ['hr', 'Fréquence cardiaque'], ['cad', 'Cadence']] },
    { key: 'intensite', type: 'range', label: 'Intensité du resserrement',
      default: 60, min: 0, max: 100, step: 5 },
    { key: 'fil', type: 'range', label: 'Épaisseur du fil', default: 26, min: 12, max: 48, step: 2 },
    { key: 'legende', type: 'toggle', label: 'Légende des correspondances', default: false },
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A8431F' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte(), Alpage.optionsFond()),

  draw: function (s) {
    var ctx = s.ctx, a = s.a, o = s.o, H = s.H, u = H.u;
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var accent = o.accentC || '#A8431F';
    var faint = melange(encre, 0.42);
    var g = H.grid({ cols: 6, margin: u(8) });
    var dit = Alpage.dit(o);
    var compo = o.composition === 'serre' ? 'serre'
              : o.composition === 'lache' ? 'lache' : 'toile';

    var vue = Alpage.projette(a && a.track);
    if (vue.pts.length < 8) {
      H.text(H.mot('Cette sortie n’a pas de trace'), g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text(H.mot('Trame tisse le parcours : il lui faut des coordonnées'),
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- ce que cette sortie porte vraiment ---------- */
    var dispo = Alpage.mesures(a.track);           // [[cle, nom, unite], …]
    var choisie = String(o.mesure || 'auto');
    if (choisie === 'auto') {
      /* L'ordre dit la richesse : une puissance décrit l'effort mieux qu'une
       * altitude, qui décrit le terrain. On prend la première présente. */
      var ordre = ['w', 'hr', 'cad', 'ele'];
      choisie = 'aucune';
      for (var q = 0; q < ordre.length; q++) {
        if (dispo.some(function (m) { return m[0] === ordre[q]; })) { choisie = ordre[q]; break; }
      }
    } else if (choisie !== 'aucune' &&
               !dispo.some(function (m) { return m[0] === choisie; })) {
      /* Demandée mais absente : on ne la fabrique pas, et on le dira. */
      choisie = 'aucune';
    }
    var nomMesure = (dispo.filter(function (m) { return m[0] === choisie; })[0] || [])[1] || null;

    /* ---------- le cadrage ---------- */
    var basTexte = dit.rien ? g.bottom : g.bottom - u(dit.fabrication || o.legende ? 16 : 11);
    var zone = { x: g.left, y: g.top + u(2), w: g.width, h: basTexte - g.top - u(5) };
    var cadre = Alpage.cadre(vue, zone, { marge: u(3), echelle: 0.88 });

    var pas = Alpage.reechantillonne(vue.pts, Math.max(4, vue.etendue / 700));
    var P = pas.map(cadre.point);
    var serie = choisie === 'aucune' ? null : Alpage.serie(pas, choisie);

    /* ---------- le champ d'influence ----------
     * Pour chaque point du tissage, la mesure du point de parcours le plus
     * proche — et à quelle distance. Une grille de compartiments évite de
     * comparer chaque fil à chaque point : sur une trace de mille points et
     * une planche A3, la version naïve prenait plusieurs secondes. */
    var portee = Math.min(zone.w, zone.h) * 0.16;
    var maille = Math.max(8, portee / 2);
    var cases = {};
    P.forEach(function (p, i) {
      var k = Math.floor(p.x / maille) + ':' + Math.floor(p.y / maille);
      (cases[k] || (cases[k] = [])).push(i);
    });
    function influence(x, y) {
      if (!serie) return 0;
      var cx = Math.floor(x / maille), cy = Math.floor(y / maille);
      var best = Infinity, val = 0;
      for (var dx = -1; dx <= 1; dx++) {
        for (var dy = -1; dy <= 1; dy++) {
          var l = cases[(cx + dx) + ':' + (cy + dy)];
          if (!l) continue;
          for (var n = 0; n < l.length; n++) {
            var p = P[l[n]];
            var d = (p.x - x) * (p.x - x) + (p.y - y) * (p.y - y);
            if (d < best) { best = d; val = serie.valeurs[l[n]]; }
          }
        }
      }
      if (best === Infinity) return 0;
      var d2 = Math.sqrt(best);
      if (d2 > portee) return 0;
      /* l'influence s'éteint avec la distance : le tissage se resserre AUTOUR
       * du parcours, il ne change pas d'un bord à l'autre de la feuille */
      var poids = 1 - d2 / portee;
      return val * poids * poids;
    }

    /* ---------- chaîne et trame ----------
     *
     * UN VRAI TISSAGE, PAS UNE GRILLE. Le premier jet posait des cheveux :
     * des traits d'un tiers de pixel, également espacés, également pâles. De
     * loin cela donnait du papier millimétré, et le brief écarte justement
     * « une grille uniforme derrière le parcours ».
     *
     * Ce qui fait une étoffe, ce sont des BRINS qui ont une largeur, et un
     * damier de dessus-dessous : à chaque croisement, ou bien la chaîne
     * passe devant, ou bien la trame. On peint donc la chaîne entière, puis
     * les segments de trame d'une case sur deux — en quinconce d'une rangée
     * à l'autre. L'armure toile apparaît d'elle-même.
     */
    var nChaine = compo === 'serre' ? 54 : compo === 'lache' ? 20 : 34;
    var force = (o.intensite == null ? 60 : o.intensite) / 100;
    var pasX = zone.w / nChaine;
    var largeurBrin = pasX * 0.46;          // le brin occupe ~la moitié du pas
    var xs = [];
    for (var i = 0; i < nChaine; i++) xs.push(zone.x + (i + 0.5) * pasX);

    /* LES LISIÈRES S'ÉTEIGNENT, parce qu'une étoffe a un bord.
     *
     * Le tissage couvrait la feuille d'un trait à l'autre : 37 % d'encre, et
     * plus de papier. Or l'identité d'Alpage tient autant au vide qu'à
     * l'encre. En fondant les quatre bords, le tissage redevient une PIÈCE
     * posée sur la page plutôt qu'un fond imprimé dessous. */
    function lisiere(x, y) {
      var mx = Math.min((x - zone.x) / (zone.w * 0.12), (zone.x + zone.w - x) / (zone.w * 0.12), 1);
      var my = Math.min((y - zone.y) / (zone.h * 0.10), (zone.y + zone.h - y) / (zone.h * 0.10), 1);
      return Math.max(0, Math.min(1, mx)) * Math.max(0, Math.min(1, my));
    }

    ctx.save();
    ctx.lineCap = 'butt';

    /* la chaîne : des brins verticaux, larges et pâles, qui s'éteignent aux
     * deux bouts — un dégradé vertical par brin suffit, la lisière gauche et
     * droite étant prise en charge par l'opacité de chaque brin */
    ctx.lineWidth = largeurBrin;
    xs.forEach(function (x) {
      var bord = lisiere(x, zone.y + zone.h / 2);
      if (bord <= 0.01) return;
      var gr = ctx.createLinearGradient(0, zone.y, 0, zone.y + zone.h);
      var plein = melange(encre, 0.20 * bord);
      var rien = melange(encre, 0);
      gr.addColorStop(0, rien);
      gr.addColorStop(0.10, plein);
      gr.addColorStop(0.90, plein);
      gr.addColorStop(1, rien);
      ctx.strokeStyle = gr;
      ctx.beginPath();
      ctx.moveTo(x, zone.y);
      ctx.lineTo(x, zone.y + zone.h);
      ctx.stroke();
    });

    /* LA TRAME. Les rangées se resserrent près du parcours, et leurs brins y
     * sont plus larges et plus sombres : c'est le resserrement de l'effort,
     * et il porte sur TROIS choses à la fois pour se voir vraiment. */
    var pasYBase = pasX * (compo === 'serre' ? 0.92 : 1.05);
    var rangs = [];
    var y = zone.y + pasYBase * 0.5;
    while (y < zone.y + zone.h && rangs.length < 500) {
      var infLigne = 0;
      for (var m2 = 0; m2 <= 8; m2++) {
        infLigne = Math.max(infLigne, influence(zone.x + zone.w * m2 / 8, y));
      }
      rangs.push({ y: y, inf: infLigne });
      y += pasYBase * (1 - 0.60 * infLigne * force);
    }

    rangs.forEach(function (r, ir) {
      for (var k = 0; k < xs.length; k++) {
        /* le damier : une case sur deux, décalée d'une rangée à l'autre */
        if ((k + ir) % 2 === 0) continue;
        var inf = influence(xs[k], r.y);
        var bord = lisiere(xs[k], r.y);
        if (bord <= 0.01) continue;
        ctx.strokeStyle = melange(encre, (0.16 + 0.62 * inf * force) * bord);
        ctx.lineWidth = largeurBrin * (0.72 + 0.55 * inf * force);
        ctx.beginPath();
        ctx.moveTo(xs[k] - pasX * 0.62, r.y);
        ctx.lineTo(xs[k] + pasX * 0.62, r.y);
        ctx.stroke();
      }
    });
    ctx.restore();

    /* ---------- le fil du parcours ---------- */
    var vus = H.progressCount ? H.progressCount(P.length) : P.length;
    var epFil = Math.max(1.1, u((o.fil == null ? 26 : o.fil) / 26 * 0.34));
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.strokeStyle = accent;
    ctx.lineWidth = epFil;
    ctx.beginPath();
    for (var t = 0; t < vus; t++) {
      if (t === 0) ctx.moveTo(P[t].x, P[t].y); else ctx.lineTo(P[t].x, P[t].y);
    }
    ctx.stroke();
    ctx.restore();

    /* DESSOUS : une fois sur deux, le brin de chaîne repasse PAR-DESSUS le
     * fil. C'est ce repeint qui fabrique l'entrelacement — sans lui on aurait
     * une ligne posée sur une grille, ce que le brief écarte. */
    if (vus >= P.length) entrelace();

    /* ---------- le texte ---------- */
    if (dit.rien) return;

    var yTitre = g.bottom - u(dit.fabrication || o.legende ? 11 : 6);
    var titre = String(o.titre || '').trim() || a.name || 'Sortie';
    H.text(titre, g.left, yTitre, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(4) }));

    var bouts = [];
    if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
    if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' M D+');
    if (bouts.length) {
      H.text(bouts.join('  ·  '), g.left, yTitre + u(4.2),
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    /* LA LÉGENDE DIT CE QUE LE TISSAGE ENCODE, ou qu'il n'encode rien.
     * Elle est facultative — le brief la veut discrète — mais l'absence de
     * mesure, elle, se dit TOUJOURS : une trame régulière qu'on prendrait
     * pour un effort plat serait un mensonge par omission. */
    if (o.legende || !serie) {
      var phrase = serie
        ? 'LE TISSAGE SE RESSERRE OÙ ' + String(nomMesure || choisie).toUpperCase() + ' EST HAUTE'
        : 'TRAME RÉGULIÈRE — CETTE SORTIE NE PORTE AUCUNE MESURE D’EFFORT';
      if (serie && serie.manquantes > P.length * 0.1) {
        phrase += ' · ' + Math.round(100 * serie.manquantes / P.length) + ' % DE POINTS SANS MESURE';
      }
      H.text(phrase, g.left, yTitre + u(7.8),
             H.t('label', { color: melange(encre, 0.34), maxWidth: g.width }));
    }

    /* ================= les morceaux ================= */

    /* L'ENTRELACEMENT SE COMPTE LE LONG DU FIL, ET IL CROISE LES DEUX SENS.
     *
     * La première version ne regardait que la chaîne, et alternait par
     * colonne. Sur un parcours qui traverse la feuille en diagonale, cela
     * faisait vingt-huit croisements pour toute la planche, dont quatorze
     * repeints : à l'œil, le fil passait par-dessus tout, et le tissage
     * n'était qu'une grille avec une ligne posée dessus — exactement ce que
     * le brief écarte. C'est l'image agrandie qui l'a dit ; la planche
     * entière n'y suffisait pas, et aucun contrôle ne l'aurait vu.
     *
     * On relève donc TOUS les croisements — chaîne et trame — on les ordonne
     * le long du parcours, et on repeint un sur deux. L'alternance suit alors
     * le fil, comme une navette : dessus, dessous, dessus.
     *
     * UN BRIN QUI N'EXISTE PAS NE SE REPEINT PAS. La trame est un damier :
     * une case sur deux est vide. Repeindre un segment de trame là où il n'y
     * en a pas aurait fabriqué un brin que l'étoffe ne porte pas. */
    function entrelace() {
      var crois = [];
      for (var p = 1; p < P.length; p++) {
        var a1 = P[p - 1], b1 = P[p];
        for (var c = 0; c < xs.length; c++) {
          var x = xs[c];
          if ((a1.x - x) * (b1.x - x) > 0) continue;
          var f = Math.abs(b1.x - a1.x) < 1e-6 ? 0 : (x - a1.x) / (b1.x - a1.x);
          crois.push({ i: p + f, sens: 'chaine', x: x, y: a1.y + (b1.y - a1.y) * f });
        }
        for (var r2 = 0; r2 < rangs.length; r2++) {
          var yy = rangs[r2].y;
          if ((a1.y - yy) * (b1.y - yy) > 0) continue;
          var gg = Math.abs(b1.y - a1.y) < 1e-6 ? 0 : (yy - a1.y) / (b1.y - a1.y);
          var xc = a1.x + (b1.x - a1.x) * gg;
          /* le brin de trame existe-t-il ici ? même damier qu'au tissage */
          var k = Math.round((xc - zone.x) / pasX - 0.5);
          if (k < 0 || k >= xs.length || (k + r2) % 2 === 0) continue;
          crois.push({ i: p + gg, sens: 'trame', x: xc, y: yy });
        }
      }
      crois.sort(function (m, n) { return m.i - n.i; });

      /* ON EFFACE LE FIL SOUS LE BRIN, PUIS ON REPEINT LE BRIN.
       *
       * Repeindre simplement par-dessus ne suffisait pas : un brin de chaîne
       * est de l'encre à VINGT POUR CENT, et vingt pour cent de gris posés
       * sur un fil rouille ne se voient pas. Les vingt-trois repeints
       * existaient, le banc les comptait, et la planche agrandie ne montrait
       * rien : un croisement qu'on ne voit pas n'entrelace rien.
       *
       * `destination-out` retire le fil sur l'empreinte exacte du brin ; le
       * brin est ensuite peint à sa propre opacité. Le résultat est juste sur
       * un fond clair comme sur une surcouche transparente, où composer une
       * couleur opaque « comme sur le papier » aurait posé une tache. */
      var demi = epFil * 0.75;
      ctx.save();
      ctx.lineCap = 'butt';
      crois.forEach(function (cr, rang) {
        if (rang % 2 === 0) return;                    // celui-là passe DESSUS
        var bord = lisiere(cr.x, cr.y);
        if (bord <= 0.01) return;
        var teinte, epaisseur, ax, ay, bx, by;
        if (cr.sens === 'chaine') {
          teinte = melange(encre, 0.20 * bord);
          epaisseur = largeurBrin;
          ax = cr.x; ay = cr.y - demi; bx = cr.x; by = cr.y + demi;
        } else {
          var inf = influence(cr.x, cr.y);
          teinte = melange(encre, (0.16 + 0.62 * inf * force) * bord);
          epaisseur = largeurBrin * (0.72 + 0.55 * inf * force);
          ax = cr.x - demi; ay = cr.y; bx = cr.x + demi; by = cr.y;
        }
        ctx.lineWidth = epaisseur;
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = '#000';
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = teinte;
        ctx.stroke();
      });
      ctx.restore();
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
