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

  options: [
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
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.45), hair = melange(ink, 0.16);

    H.fill(o.fond);
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
    H.text(String(o.titre || '').trim() || (a.name || 'Partition'), g.left, g.top + u(3.6),
           H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(part.duree + ' s', g.right, g.top + u(3.6),
           H.t('label', { color: faint, align: 'right' }));

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
        H.field(c[0], c[1], g.left + i * (g.width / 3), basSource + u(1.5), {
          color: ink, labelColor: faint, role: 'meta', size: 2.2, gap: u(3.2),
          maxWidth: g.width / 3 - u(2)
        });
      });
    H.text('GAMME PENTATONIQUE · LE SON NE DÉMARRE QUE SI TU LE DEMANDES',
           g.left, g.bottom, H.t('label', { color: faint, maxWidth: g.width }));

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
