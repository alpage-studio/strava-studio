/* « Allumettes » — les efforts durs, et où ils ont brûlé.
 *
 * Trois variantes de composition, une seule donnée. Toutes se construisent
 * DU BAS VERS LE HAUT : on pose le pied, puis les allumettes juste
 * au-dessus, puis le compte, puis le titre. C'est ce qui supprime la bande
 * morte qu'une composition ancrée en haut laisse toujours au milieu — le
 * vide s'accumule alors là où personne ne l'a choisi.
 *
 * Les allumettes reposent sur une même ligne de base, jamais sur le relief :
 * plantées sur le terrain, chacune démarre à une hauteur différente et on ne
 * peut plus comparer leur coût, ce qui est pourtant le sujet. Le relief
 * passe derrière ; la position horizontale dit toujours « où ».
 */
Studio.template({
  id: 'allumettes',
  name: 'Allumettes',

  options: [
    { key: 'variante', type: 'select', label: 'Composition', default: 'pied',
      choices: [['pied', 'Pied — compte au-dessus'],
                ['angle', 'Angle — compte à droite'],
                ['bandeau', 'Bandeau — le graphique domine']] },
    { key: 'fond', type: 'color', label: 'Fond', default: '#0E0E10' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E5502D' },
    { key: 'seuil', type: 'range', label: 'Seuil (% FTP)', default: 105, min: 90, max: 130 },
    { key: 'duree', type: 'range', label: 'Durée min. (s)', default: 20, min: 10, max: 90 },
    { key: 'profil', type: 'toggle', label: 'Relief derrière', default: true }
  ],

  /* Le seuil ne s'applique qu'à une sortie dont on connaît le FTP : sans
   * lui la détection se cale sur un percentile, et en mode cardiaque sur la
   * fréquence maximale observée. Le curseur est alors décoratif. */
  inert: function (a) {
    var feu = a.burned ? a.burned({}) : null;
    return (feu && feu.source === 'puissance' && !feu.estime) ? [] : ['seuil'];
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre;
    var faint = melange(ink, 0.45);
    var hair = melange(ink, 0.16);
    var variante = o.variante || 'pied';
    var titreY = null;   // fixé par la variante si le titre rejoint la pile

    H.fill(o.fond);

    var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
    var CH = g.height;

    var feu = a.burned ? a.burned({ pct: o.seuil / 100, minSec: o.duree }) : { list: [] };
    var n = feu.list.length;
    var parPuissance = feu.source === 'puissance';

    var legende = parPuissance
      ? 'au-dessus de ' + feu.seuil + ' W' + (feu.estime ? ' — seuil estimé' : ' · ' + o.seuil + ' % FTP')
      : feu.source === 'cardiaque'
        ? 'au-dessus de ' + feu.seuil + ' bpm — sans capteur de puissance'
        : 'aucune donnée d’effort sur cette sortie';

    /* ================= le pied, posé en premier ================= */
    var footY = g.bottom;
    var pieds = [
      ['distance', H.fmt.km(a.distance_km, 1) + ' km'],
      ['en mouvement', H.fmt.duration(a.duration_s)],
      [parPuissance ? 'coût total' : 'd+',
        parPuissance ? Math.round(feu.total || 0) + ' kJ' : H.fmt.int(a.elev_gain_m) + ' m']
    ];
    // en bandeau, le compte descend dans le pied : le graphique prend tout
    if (variante === 'bandeau') pieds.unshift(['allumettes', String(n)]);

    H.rule(g.left, footY - u(9), g.right, { color: hair });
    var colW = g.width / pieds.length;
    pieds.forEach(function (c, i) {
      H.field(c[0], c[1], g.left + i * colW, footY - u(5.4), {
        color: ink, labelColor: faint,
        size: variante === 'bandeau' ? 3.8 : 4.2,
        maxWidth: colW - u(2)
      });
    });

    /* ================= la zone des allumettes ================= */
    var sol = footY - u(14);
    /* La zone occupe l'essentiel de la hauteur : ancrer en bas ne suffit
     * pas, il faut aussi que le contenu MONTE, sinon on déplace le vide au
     * lieu de le supprimer. */
    var hauteurZone = variante === 'bandeau' ? CH * 0.70
                    : variante === 'angle'   ? CH * 0.60
                    :                          CH * 0.56;
    var box = { x: g.left, y: sol - hauteurZone, w: g.width, h: hauteurZone };

    var prof = a.profile;
    if (o.profil && prof && prof.length > 1) {
      var relH = box.h * (variante === 'angle' ? 0.74 : 0.66);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(box.x, sol);
      prof.forEach(function (p) { ctx.lineTo(box.x + p.x * box.w, sol - p.y * relH); });
      ctx.lineTo(box.x + box.w, sol);
      ctx.closePath();
      ctx.fillStyle = melange(ink, 0.10);
      ctx.fill();
      ctx.restore();
    }

    var plafond = sol;   // le haut réellement occupé, d'où repart la suite

    if (n) {
      var couts = feu.list.map(function (m) { return m.cout; });
      var coutMax = Math.max.apply(null, couts) || 1;
      var plusCher = couts.indexOf(coutMax);

      var larg = u(0.66);
      var haut = box.h * 0.46;
      plafond = sol - haut;

      /* Deux efforts rapprochés donnaient un seul trait épais. On impose un
       * écart minimal en décalant de proche en proche : l'ordre et la zone
       * restent justes, la grappe redevient lisible. */
      var ecartMin = larg * 2.6;
      var xs = [], dernier = -Infinity;
      feu.list.forEach(function (m) {
        var x = Math.max(box.x + larg, box.x + m.x * box.w);
        if (x - dernier < ecartMin) x = dernier + ecartMin;
        xs.push(Math.min(x, box.x + box.w - larg));
        dernier = xs[xs.length - 1];
      });

      feu.list.forEach(function (m, i) {
        allumette(xs[i], sol, larg, haut, m.cout / coutMax, i === plusCher);
      });

      /* Une seule annotation, reliée par un trait à SON allumette. */
      var mx = feu.list[plusCher], ax = xs[plusCher];
      var yTexte = plafond - u(5);
      ctx.save();
      ctx.strokeStyle = melange(o.accent, 0.55);
      ctx.lineWidth = u(0.1);
      ctx.beginPath();
      ctx.moveTo(ax, plafond - u(1.4));
      ctx.lineTo(ax, yTexte + u(1.1));
      ctx.stroke();
      ctx.restore();

      H.text(parPuissance ? mx.moyenne + ' W pendant ' + H.fmt.duration(mx.duree)
                          : 'effort de ' + H.fmt.duration(mx.duree),
        ax, yTexte,
        H.t('label', { color: o.accent,
          align: ax > box.x + box.w * 0.82 ? 'right'
               : ax < box.x + box.w * 0.18 ? 'left' : 'center' }));
      plafond = yTexte - u(3);
    }

    H.rule(g.left, sol, g.right, { color: hair });

    /* ================= le compte, calé sous ce qui précède ================= */
    if (variante === 'pied') {
      /* Il remonte juste au-dessus des allumettes. C'est cet ancrage par le
       * bas qui supprime le trou : le vide restant part en haut, là où une
       * marge se lit comme une respiration et non comme un oubli. */
      var st = H.t('hero', { size: 13, color: ink });
      var baseNombre = plafond - u(4);
      H.text(legende, g.left, baseNombre + u(4.4), H.t('label', { color: faint }));
      H.text(String(n), g.left, baseNombre, st);
      var hautCompte = baseNombre - st.size * 0.92 - u(1.6);
      H.text('allumettes brûlées', g.left, hautCompte, H.t('label', { color: faint }));
      titreY = hautCompte - u(5.5);

    } else if (variante === 'angle') {
      /* Compte à droite, titre à gauche : le regard traverse la planche en
       * diagonale au lieu de descendre le long d'un seul bord. */
      var stA = H.t('hero', { size: 15, color: ink, align: 'right' });
      var baseA = g.top + u(5) + stA.size * 0.92;
      H.text('allumettes brûlées', g.right, g.top + u(1.6), H.t('label', { color: faint, align: 'right' }));
      H.text(String(n), g.right, baseA, stA);
      H.text(legende, g.right, baseA + u(4.4), H.t('label', { color: faint, align: 'right' }));

    } else {
      // bandeau : le compte est dans le pied, il ne reste que la note de seuil
      H.text(legende, g.left, plafond - u(2), H.t('label', { color: faint }));
      titreY = plafond - u(2) - u(5.5);
    }

    /* ================= titre, en dernier =================
     * En « Pied » et « Bandeau » il descend coller à la pile : un titre
     * seul tout en haut, avec quarante pour cent de rien en dessous, se lit
     * comme un trou, pas comme une marge. En « Angle » le haut est déjà
     * occupé par le compte, il y reste. */
    H.text(a.name, g.left, titreY != null ? titreY : g.top + u(3.6), H.t('title', {
      color: ink, maxWidth: variante === 'angle' ? g.w(3) : g.w(4)
    }));

    /* ================= une allumette =================
     * Longueur totale constante, part consumée proportionnelle au coût :
     * une relance noircit la tête, un col brûle jusqu'aux doigts. La
     * comparaison porte donc sur une seule variable, sur une seule ligne. */
    function allumette(x, pied, larg, haut, part, vedette) {
      var sommet = pied - haut;
      var brule = haut * (0.12 + 0.76 * part);
      var teteH = larg * 2.1;

      ctx.save();
      // le bois restant : du contexte, pas la donnée
      ctx.fillStyle = melange(ink, 0.16);
      H.roundRect(x - larg / 2, sommet, larg, haut, larg * 0.5);
      ctx.fill();

      ctx.fillStyle = vedette ? o.accent : ink;
      H.roundRect(x - larg / 2, sommet, larg, brule, larg * 0.5);
      ctx.fill();

      // la tête, plus large que le bâtonnet : c'est elle qui dit
      // « allumette » plutôt que « barre »
      H.roundRect(x - larg * 0.95, sommet - teteH * 0.22, larg * 1.9, teteH, larg * 0.95);
      ctx.fill();
      ctx.restore();
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
