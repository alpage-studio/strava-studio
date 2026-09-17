/* « Relief ressenti » — la côte telle qu'elle a été vécue.
 *
 * Le profil d'altitude est exact et souvent décevant : une montée qui a
 * coûté vingt minutes de souffrance fait 4 % sur le graphique et ressemble
 * à une bosse. Cette planche met le relief réel en regard d'un paysage
 * EXPRESSIF, où la hauteur dit l'effort vécu et non l'altitude.
 *
 * Deux règles de probité, parce que c'est là que ce genre de visuel dérape :
 *
 *   - LA SOURCE EST ÉCRITE. Soit l'utilisateur a réglé lui-même ses
 *     portions — « saisie personnelle » —, soit la hauteur vient d'un
 *     indicateur calculé, et alors on dit lequel. La puissance et la
 *     fréquence cardiaque ne sont pas le ressenti : ce sont des indices, et
 *     la légende le dit avec ce mot-là.
 *   - L'AXE HORIZONTAL RESTE LA DISTANCE RÉELLE. Seule la hauteur est
 *     expressive, et une mention sous la silhouette le rappelle. Étirer
 *     aussi l'axe des distances fabriquerait une sortie qui n'a pas eu lieu.
 *
 * Sans altitude exploitable, on ne dessine PAS de relief réel inventé : le
 * mode bascule sur le paysage ressenti seul, et la planche le dit.
 */
Studio.template({
  id: 'ressenti',
  name: 'Relief ressenti — vécu contre mesuré',
  famille: 'affiche',

  options: [
    { key: 'mode', type: 'select', label: 'Mode', default: 'diptyque',
      choices: [['diptyque', 'Diptyque — réel et ressenti'],
                ['ressenti', 'Relief ressenti seul'],
                ['reel', 'Relief réel seul']] },
    { key: 'portions', type: 'range', label: 'Portions', default: 4, min: 3, max: 5, step: 1, reflow: true },
    { key: 'p1', type: 'range', label: 'Portion 1', default: 40, min: 0, max: 100, step: 5 },
    { key: 'p2', type: 'range', label: 'Portion 2', default: 85, min: 0, max: 100, step: 5 },
    { key: 'p3', type: 'range', label: 'Portion 3', default: 30, min: 0, max: 100, step: 5 },
    { key: 'p4', type: 'range', label: 'Portion 4', default: 65, min: 0, max: 100, step: 5 },
    { key: 'p5', type: 'range', label: 'Portion 5', default: 45, min: 0, max: 100, step: 5 },
    { key: 'suggerer', type: 'toggle', label: 'Suggérer depuis l’effort mesuré', default: false, reflow: true },
    { key: 'fond', type: 'color', label: 'Fond', default: '#0E0E10' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E5502D' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ],

  /* Les curseurs au-delà du nombre de portions ne pilotent rien, et le
   * bouton de suggestion ne peut rien suggérer sans capteur. */
  inert: function (a, vals) {
    var morts = [];
    var n = Math.max(3, Math.min(5, Math.round((vals && vals.portions) || 4)));
    for (var i = n; i < 5; i++) morts.push('p' + (i + 1));
    var mesure = (a.track || []).some(function (p) { return p.w != null || p.hr != null; });
    if (!mesure) morts.push('suggerer');
    /* Quand la suggestion prend la main, les curseurs ne pilotent plus rien :
     * les laisser vifs ferait croire qu'on règle encore le paysage. */
    if (mesure && vals && vals.suggerer) for (var j = 0; j < n; j++) morts.push('p' + (j + 1));
    if (!(a.profile || []).length) morts.push('mode');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.5), hair = melange(ink, 0.18);
    var n = Math.max(3, Math.min(5, Math.round(o.portions)));
    var prof = a.profile || [];
    var aRelief = prof.length > 1;

    H.fill(o.fond);
    H.grain(0.01);
    var g = H.grid({ cols: 6, margin: u(8) });

    /* --------- ce qui donne la hauteur ressentie --------- */
    var manuel = [o.p1, o.p2, o.p3, o.p4, o.p5].slice(0, n)
      .map(function (v) { return Math.max(0, Math.min(100, Number(v) || 0)) / 100; });
    var calcule = o.suggerer ? effortParPortion(a, n) : null;
    var hauteurs = (calcule && calcule.valeurs) ? calcule.valeurs : manuel;
    var source = (calcule && calcule.valeurs)
      ? 'suggestion d’après ' + calcule.libelle
      : 'saisie personnelle';

    /* --------- mode effectif --------- */
    var mode = o.mode;
    if (!aRelief && mode !== 'ressenti') mode = 'ressenti';

    /* --------- en-tête --------- */
    var titre = String(o.titre || '').trim() || (mode === 'reel' ? 'Le relief' : 'Ce que ça a coûté');
    H.text(titre, g.left, g.top + u(4), H.t('title', { color: ink, maxWidth: g.w(5) }));

    /* --------- disposition --------- */
    /* Les silhouettes occupent toute la bande disponible plutôt qu'une
     * hauteur fixe : à hauteur fixe, le diptyque laissait un tiers de page
     * vide sous le titre. Le ressenti reçoit la plus grande part — c'est le
     * sujet de la planche, le relief réel n'est que la référence. */
    var basSocle = g.bottom - u(10);
    var haut = g.top + u(13);
    var bande = basSocle - haut;
    var ecart = u(11);
    var zoneH, zoneR;
    if (mode === 'diptyque') {
      var hR = (bande - ecart) * 0.40;
      zoneR = { x: g.left, y: haut, w: g.width, h: hR };
      zoneH = { x: g.left, y: haut + hR + ecart, w: g.width, h: bande - hR - ecart };
    } else if (mode === 'reel') {
      zoneR = { x: g.left, y: haut, w: g.width, h: bande };
    } else {
      zoneH = { x: g.left, y: haut, w: g.width, h: bande };
    }

    if (zoneR) {
      silhouetteReelle(zoneR);
      legende(zoneR, 'RELIEF RÉEL', 'altitude mesurée', faint);
    }
    if (zoneH) {
      silhouetteRessentie(zoneH);
      legende(zoneH, 'RELIEF RESSENTI',
              'hauteur expressive — ce n’est pas une altitude', melange(o.accent, 0.85));
    }

    if (!aRelief) {
      H.text('sans altitude exploitable : seul le paysage ressenti est dessiné',
             g.left, g.top + u(8.4), H.t('meta', { color: faint, maxWidth: g.width }));
    }

    /* --------- pied : l'axe des distances et la source --------- */
    H.rule(g.left, basSocle + u(3), g.right, { color: hair });
    var total = a.distance_km;
    for (var i = 0; i <= n; i++) {
      var x = g.left + g.width * (i / n);
      ctx.save();
      ctx.strokeStyle = hair; ctx.lineWidth = u(0.1);
      ctx.beginPath(); ctx.moveTo(x, basSocle + u(3)); ctx.lineTo(x, basSocle + u(4.6)); ctx.stroke();
      ctx.restore();
      if (total) {
        H.text(H.fmt.km(total * i / n, total > 30 ? 0 : 1),
               x, basSocle + u(8),
               H.t('label', { color: faint, align: i === 0 ? 'left' : i === n ? 'right' : 'center' }));
      }
    }
    H.text('DISTANCE RÉELLE, EN KM · ' + source.toUpperCase(),
           g.left, g.bottom, H.t('label', { color: faint, maxWidth: g.width }));

    /* ================= dessin ================= */

    function silhouetteReelle(box) {
      H.profile(prof, box, {
        fill: melange(ink, 0.13), stroke: melange(ink, 0.55), width: u(0.35)
      });
      H.rule(box.x, box.y + box.h, box.x + box.w, { color: hair });
    }

    /* Le paysage ressenti.
     *
     * Chaque portion pose un sommet dont la hauteur est l'effort déclaré.
     * Deux choix assumés :
     *   - la hauteur est passée à la puissance 1,45 : une portion à 90 doit
     *     écraser une portion à 45, pas la dépasser de moitié ;
     *   - la rugosité suit l'effort. Une portion facile ondule, une portion
     *     dure se hérisse. Le bruit est DÉTERMINISTE (semé par l'index),
     *     sinon chaque image d'une vidéo redessinerait une autre montagne. */
    function silhouetteRessentie(box) {
      var pas = 1 / 240;
      var pts = [];
      for (var t = 0; t <= 1.0001; t += pas) {
        pts.push({ x: t, y: Math.max(0, Math.min(1, altitudeVecue(t))) });
      }
      // le remplissage
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + box.h);
      var vus = H.progressCount(pts.length);
      pts.forEach(function (p, i) {
        if (i >= vus) return;
        ctx.lineTo(box.x + p.x * box.w, box.y + box.h - p.y * box.h * 0.94);
      });
      ctx.lineTo(box.x + (vus / pts.length) * box.w, box.y + box.h);
      ctx.closePath();
      ctx.fillStyle = melange(o.accent, 0.22);
      ctx.fill();
      ctx.strokeStyle = o.accent;
      ctx.lineWidth = u(0.42);
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
      H.rule(box.x, box.y + box.h, box.x + box.w, { color: hair });

      /* Le sommet de chaque portion reçoit sa valeur : sans repère chiffré,
       * deux portions proches deviennent indiscernables.
       *
       * L'étiquette se pose sur le POINT LE PLUS HAUT de la portion, pas au
       * milieu de la portion : la rugosité déplace le sommet, et l'étiquette
       * posée au milieu tombait dans la pente, parfois barrée par la crête. */
      hauteurs.forEach(function (v, i) {
        var a0 = i / n, a1 = (i + 1) / n;
        var best = null;
        pts.forEach(function (p) {
          if (p.x < a0 || p.x > a1) return;
          if (!best || p.y > best.y) best = p;
        });
        if (!best) return;
        H.text(Math.round(v * 100) + '',
               box.x + best.x * box.w,
               box.y + box.h - best.y * box.h * 0.94 - u(2.2),
               H.t('label', { color: melange(ink, 0.7), align: 'center' }));
      });
    }

    /* Hauteur vécue en t ∈ [0,1] : interpolation douce entre les sommets de
     * portion, plus une rugosité proportionnelle à l'effort local. */
    function altitudeVecue(t) {
      var pos = t * n - 0.5;
      var i = Math.floor(pos);
      var f = pos - i;
      var v = lissage(val(i - 1), val(i), val(i + 1), val(i + 2), f);
      var dur = Math.pow(Math.max(0, v), 1.45);
      var rug = 0.11 * dur;
      var bruit =
        Math.sin(t * 61.7 + graine(1)) * 0.5 +
        Math.sin(t * 143.3 + graine(2)) * 0.32 +
        Math.sin(t * 317.1 + graine(3)) * 0.18;
      // le relief retombe à zéro aux deux bords : une montagne a un pied
      var bord = Math.min(1, Math.min(t, 1 - t) / 0.04);
      return (dur + rug * bruit) * bord;
    }

    function val(i) {
      if (i < 0 || i >= n) return 0;
      return hauteurs[i] == null ? 0 : hauteurs[i];
    }
    /* Catmull-Rom : passe par les sommets, sans les dépasser brutalement. */
    function lissage(p0, p1, p2, p3, t) {
      var t2 = t * t, t3 = t2 * t;
      return 0.5 * ((2 * p1) + (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
    }
    /* Une graine stable : la même sortie et les mêmes réglages donnent la
     * même montagne, image après image. */
    function graine(k) {
      var base = (a.distance_km || 1) * 97.13 + n * 31.7 + k * 12.9;
      return (base % 6.283);
    }

    function legende(box, titre, note, couleurNote) {
      H.text(titre, box.x, box.y - u(3.4), H.t('label', { color: melange(ink, 0.75) }));
      H.text(note, box.x + box.w, box.y - u(3.4),
             H.t('label', { color: couleurNote, align: 'right', maxWidth: box.w * 0.7 }));
    }

    /* ================= la suggestion ================= */
    /* Moyenne de l'indicateur disponible sur chaque portion, ramenée à 0-1
     * par rapport au maximum de la sortie. C'est un INDICE d'intensité : on
     * le nomme comme tel, et on ne l'appelle jamais « ressenti ». */
    function effortParPortion(act, k) {
      var pts = act.track || [];
      if (pts.length < 2) return null;
      var champ = pts.some(function (p) { return p.w != null; }) ? 'w'
                : pts.some(function (p) { return p.hr != null; }) ? 'hr' : null;
      if (!champ) return null;
      var axe = pts[pts.length - 1].d || 0;
      var somme = new Array(k).fill(0), compte = new Array(k).fill(0);
      pts.forEach(function (p, idx) {
        var v = p[champ];
        if (v == null) return;
        var t = axe ? p.d / axe : idx / (pts.length - 1);
        var b = Math.min(k - 1, Math.floor(t * k));
        somme[b] += v; compte[b]++;
      });
      var moy = somme.map(function (x, i) { return compte[i] ? x / compte[i] : null; });
      var dispo = moy.filter(function (x) { return x != null; });
      if (dispo.length < 2) return null;
      var hi = Math.max.apply(null, dispo);
      var lo = Math.min.apply(null, dispo);
      var span = (hi - lo) || 1;
      return {
        libelle: champ === 'w' ? 'la puissance (indicateur)' : 'la fréquence cardiaque (indicateur)',
        // 0,25 de plancher : une portion molle reste du terrain, pas un trou
        valeurs: moy.map(function (x) { return x == null ? 0.25 : 0.25 + 0.75 * (x - lo) / span; })
      };
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
