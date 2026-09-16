/* « Radiale » — la sortie enroulée sur un cercle.
 *
 * L'angle porte la distance parcourue, le rayon porte l'altitude. Une sortie
 * devient un anneau : les cols sont des bosses, les descentes des creux, et
 * l'ensemble se lit comme un objet plutôt que comme un graphique.
 *
 * Ce que ça gagne sur le profil classique : la fin rejoint le début, donc une
 * boucle se voit comme une boucle. Ce que ça coûte : on ne compare plus deux
 * sorties d'un coup d'œil. C'est un template d'affiche, pas d'analyse.
 */
Studio.template({
  id: 'radiale',
  name: 'Radiale',

  options: [
    { key: 'fond', type: 'color', label: 'Fond — haut', default: '#0E1220' },
    { key: 'fond2', type: 'color', label: 'Fond — bas', default: '#232A44' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E8FF54' },
    { key: 'remplissage', type: 'select', label: 'Anneau', default: 'barres',
      choices: [['barres', 'Barres radiales'], ['aire', 'Aire pleine']] },
    { key: 'trace', type: 'toggle', label: 'Parcours au centre', default: true },
    { key: 'grain', type: 'toggle', label: 'Grain', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = alpha(ink, 0.55);

    if (!H.surcouche()) {
      ctx.fillStyle = H.gradient([[0, o.fond], [1, o.fond2]]);
      ctx.fillRect(0, 0, w, h);
      if (o.grain) H.grain(0.05);
    }

    var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
    var CH = g.height;

    /* ---------- en-tête ---------- */
    H.text(a.name, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));

    /* ---------- pied ---------- */
    var capBase = g.bottom;
    H.rule(g.left, capBase - u(9), g.right, { color: alpha(ink, 0.2) });
    var stats = [
      ['distance', H.fmt.km(a.distance_km, 1) + ' km'],
      ['en mouvement', H.fmt.duration(a.duration_s)],
      ['dénivelé', H.fmt.int(a.elev_gain_m) + ' m']
    ];
    var colW = g.width / stats.length;
    stats.forEach(function (st, i) {
      H.field(st[0], st[1], g.left + i * colW, capBase - u(4.8), {
        color: ink, labelColor: faint, size: 4.4, maxWidth: colW - u(2)
      });
    });

    /* ---------- l'anneau ---------- */
    var cx = w / 2;
    var top = g.top + CH * 0.16;
    var bottom = capBase - u(14);
    var cy = (top + bottom) / 2;
    // l'anneau déborde la grille : cadré sur la marge, il laissait deux
    // vides symétriques qui ne disaient rien
    var rMax = Math.min(w / 2 - u(4), (bottom - top) / 2);
    var rIn = rMax * 0.52;          // rayon du plancher : altitude minimale
    var span = rMax - rIn;

    var prof = a.profile;
    if (prof && prof.length > 1) {
      var startAngle = -Math.PI / 2;   // midi : le départ est en haut

      if (o.remplissage === 'aire') {
        ctx.save();
        ctx.beginPath();
        prof.forEach(function (p, i) {
          var ang = startAngle + p.x * Math.PI * 2;
          var r = rIn + p.y * span;
          var x = cx + Math.cos(ang) * r, y = cy + Math.sin(ang) * r;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.fillStyle = alpha(ink, 0.14);
        ctx.fill();
        ctx.strokeStyle = ink;
        ctx.lineWidth = u(0.4);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      } else {
        var n = 168;
        ctx.save();
        ctx.lineCap = 'butt';
        ctx.lineWidth = Math.max(u(0.16), (Math.PI * 2 * rIn) / n * 0.55);
        for (var i = 0; i < n; i++) {
          var t = i / n;
          var p = prof[Math.min(prof.length - 1, Math.round(t * (prof.length - 1)))];
          var ang = startAngle + t * Math.PI * 2;
          var r = rIn + p.y * span;
          ctx.strokeStyle = alpha(ink, 0.72);
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
          ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* cercle de plancher : il donne son échelle à l'anneau */
      ctx.save();
      ctx.strokeStyle = alpha(ink, 0.24);
      ctx.lineWidth = u(0.14);
      ctx.beginPath();
      ctx.arc(cx, cy, rIn, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      /* le sommet, seule annotation */
      var peak = 0;
      prof.forEach(function (p, i) { if (p.y > prof[peak].y) peak = i; });
      var pa = startAngle + prof[peak].x * Math.PI * 2;
      var pr = rIn + span + u(2.4);
      ctx.save();
      ctx.fillStyle = o.accent;
      ctx.beginPath();
      ctx.arc(cx + Math.cos(pa) * (rIn + span), cy + Math.sin(pa) * (rIn + span), u(0.8), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      /* L'étiquette suit le sommet autour du cercle. Posée vers l'extérieur
       * elle sort du cadre quand le sommet tombe à l'est ou à l'ouest ; on
       * la bascule alors VERS L'INTÉRIEUR de l'anneau, où l'espace est
       * toujours libre. La brider sur place la ferait chevaucher le point. */
      var lw = u(10);
      var outX = cx + Math.cos(pa) * pr;
      // hors cadre vers l'extérieur ⇒ on la pose dans l'anneau vide, entre le
      // parcours et le plancher des barres, où rien ne peut la heurter
      var dehors = (outX - lw < u(4)) || (outX + lw > w - u(4));
      var lr = dehors ? rIn * 0.82 : pr;
      var lx = cx + Math.cos(pa) * lr;
      var ly = cy + Math.sin(pa) * lr + u(0.8);
      var align = dehors ? 'center'
        : (Math.cos(pa) < -0.3 ? 'right' : (Math.cos(pa) > 0.3 ? 'left' : 'center'));
      H.text(a.elev_max_m + ' m', lx, ly, H.t('label', { color: o.accent, align: align }));

      /* repères de distance sur le cercle de plancher */
      var step = niceStep(a.distance_km || 10);
      if (a.distance_km) {
        ctx.save();
        ctx.strokeStyle = alpha(ink, 0.3);
        ctx.lineWidth = u(0.12);
        for (var km = step; km < a.distance_km; km += step) {
          var ka = startAngle + (km / a.distance_km) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(cx + Math.cos(ka) * (rIn - u(1.6)), cy + Math.sin(ka) * (rIn - u(1.6)));
          ctx.lineTo(cx + Math.cos(ka) * rIn, cy + Math.sin(ka) * rIn);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* pas de légende : les repères sont un rythme, pas une notice */
    }

    /* ---------- le parcours, au centre de l'anneau ---------- */
    if (o.trace) {
      var rr = rIn * 1.3;
      H.route(a.route, { x: cx - rr / 2, y: cy - rr / 2, w: rr, h: rr }, {
        color: alpha(ink, 0.85),
        width: u(0.34)
      });
    }

    /* ---------- utilitaires ---------- */
    function niceStep(km) {
      var raw = km / 8, steps = [1, 2, 2.5, 5, 10, 20, 25, 50];
      for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
      return 50;
    }
    function alpha(c, k) {
      var n = parseInt(String(c).replace('#', ''), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + k + ')';
    }
  }
});
