/* « Pente » — le parcours et le profil colorés par la déclivité.
 *
 * L'idée : aucune des applications du marché ne montre OÙ c'était dur. Le
 * tracé cesse d'être une silhouette et devient une lecture de l'effort.
 *
 * L'encodage est DIVERGENT — la pente a un zéro naturel : descente d'un côté,
 * montée de l'autre, neutre au milieu. Deux teintes et un gris, jamais un
 * arc-en-ciel. Les deux pôles ont été vérifiés au validateur : ΔE 23,3 en
 * vision protanope, 30,2 en vision normale, contraste ≥ 3:1 sur fond sombre.
 *
 * Une échelle colorée sans légende est un décor : la légende est obligatoire
 * et elle porte ses seuils en pourcents.
 */
(function () {
  'use strict';

  var FROID = [61, 143, 209];   // #3D8FD1 — descente
  var CHAUD = [226, 84, 43];    // #E2542B — montée

  Studio.template({
    id: 'pente',
    name: 'Pente',

    options: [
      { key: 'fond', type: 'color', label: 'Fond — haut', default: '#101418' },
      { key: 'fond2', type: 'color', label: 'Fond — bas', default: '#1E2830' },
      { key: 'encre', type: 'color', label: 'Encre', default: '#FFFFFF' },
      { key: 'seuil', type: 'range', label: 'Seuil de saturation (%)', default: 8, min: 3, max: 20 },
      { key: 'grain', type: 'toggle', label: 'Grain', default: true }
    ],

    draw: function (s) {
      var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
      var ink = o.encre;
      var faint = alpha(ink, 0.55);
      var seuil = o.seuil / 100;

      if (!H.surcouche()) {
        ctx.fillStyle = H.gradient([[0, o.fond], [1, o.fond2]]);
        ctx.fillRect(0, 0, w, h);
        if (o.grain) H.grain(0.05);
      }

      var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
      var CH = g.height;

      /* ---------- déclivité lissée ----------
       * Brute, la pente d'un GPS saute entre ±40 % d'un point à l'autre.
       * Lissée sur une fenêtre, elle redevient ce qu'on a senti dans les
       * jambes. */
      var track = a.track;
      var slope = smoothSlope(track, 12);

      /* ---------- en-tête ---------- */
      H.text(a.name, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));

      /* ---------- bas : légende de l'échelle ---------- */
      var capBase = g.bottom;
      var scaleH = u(1.6);
      var scaleW = g.width * 0.52;
      var scaleY = capBase - u(4.6) - scaleH;
      legend(g.left, scaleY, scaleW, scaleH);

      H.text(H.fmt.int(a.elev_gain_m) + ' m D+', g.right, capBase - u(4.6),
        H.t('label', { color: ink, align: 'right' }));

      /* ---------- profil coloré ---------- */
      var profH = CH * 0.16;
      var profBottom = scaleY - u(5);
      var box = { x: g.left, y: profBottom - profH, w: g.width, h: profH };
      profile(box);

      /* ---------- statistiques ---------- */
      var statsBase = box.y - u(6);
      var stats = [
        ['distance', H.fmt.km(a.distance_km, 1) + ' km'],
        ['en mouvement', H.fmt.duration(a.duration_s)],
        ['pente max', pct(Math.max.apply(null, slope))]
      ];
      var colW = g.width / stats.length;
      stats.forEach(function (st, i) {
        H.field(st[0], st[1], g.left + i * colW, statsBase - u(4), {
          color: ink, labelColor: faint, size: 4.4, maxWidth: colW - u(2)
        });
      });

      /* ---------- parcours coloré ---------- */
      route(g.top + CH * 0.09, statsBase - u(11));

      /* ================= dessin ================= */

      /* Le tracé se dessine segment par segment : c'est le prix de la
       * couleur continue, et 900 segments ne coûtent rien. */
      function route(top, bottom) {
        var pts = a.route.pts;
        if (!pts.length) return;
        var bw = g.width, bh = bottom - top;
        var sz = Math.min(bw, bh);
        var ox = g.left + (bw - sz) / 2, oy = top + (bh - sz) / 2;

        ctx.save();
        ctx.lineWidth = u(0.75);
        ctx.lineCap = ctx.lineJoin = 'round';
        for (var i = 1; i < pts.length; i++) {
          ctx.strokeStyle = colorFor(slope[i]);
          ctx.beginPath();
          ctx.moveTo(ox + pts[i - 1].x * sz, oy + pts[i - 1].y * sz);
          ctx.lineTo(ox + pts[i].x * sz, oy + pts[i].y * sz);
          ctx.stroke();
        }
        ctx.restore();
      }

      /* Le profil reprend exactement la même échelle : les deux graphiques
       * disent la même chose de deux façons. */
      function profile(b) {
        var prof = a.profile;
        if (!prof || prof.length < 2) return;
        ctx.save();
        for (var i = 1; i < prof.length; i++) {
          var x0 = b.x + prof[i - 1].x * b.w, x1 = b.x + prof[i].x * b.w;
          var y1 = b.y + b.h - prof[i].y * b.h;
          // l'index du profil suit celui de la trace : les points sans
          // altitude ont été écartés, on retombe dessus par la distance
          var k = Math.min(slope.length - 1, Math.round(prof[i].x * (slope.length - 1)));
          ctx.fillStyle = colorFor(slope[k]);
          ctx.fillRect(x0, y1, Math.max(0.6, x1 - x0 + 0.6), b.y + b.h - y1);
        }
        ctx.restore();
      }

      function legend(x, y, lw, lh) {
        var steps = 48;
        ctx.save();
        for (var i = 0; i < steps; i++) {
          var t = i / (steps - 1);                 // 0 → 1
          ctx.fillStyle = colorFor((t * 2 - 1) * seuil);
          ctx.fillRect(x + t * lw, y, lw / steps + 1, lh);
        }
        ctx.restore();
        /* Les deux bornes suffisent à qualifier l'échelle. Les mots qui
         * l'expliquaient — « plat », « déclivité » — sont de la notice. */
        var lab = H.t('label', { color: faint });
        H.text('−' + Math.round(o.seuil) + ' %', x, y - u(1.6), lab);
        H.text('+' + Math.round(o.seuil) + ' %', x + lw, y - u(1.6),
          Object.assign({}, lab, { align: 'right' }));
      }

      /* ================= utilitaires ================= */

      function colorFor(sl) {
        if (sl == null || !isFinite(sl)) return alpha(ink, 0.5);
        var t = Math.max(-1, Math.min(1, sl / seuil));   // −1 … +1
        /* Le neutre d'une échelle divergente doit RECULER : si « plat » est
         * peint dans l'encre pleine, c'est le plat qui brille le plus alors
         * qu'il ne dit rien. On le mélange au fond. */
        var mid = [
          (hex(ink, 0) + hex(o.fond2, 0)) / 2,
          (hex(ink, 1) + hex(o.fond2, 1)) / 2,
          (hex(ink, 2) + hex(o.fond2, 2)) / 2
        ];
        var pole = t < 0 ? FROID : CHAUD;
        var k = Math.abs(t);
        // neutre au milieu : on s'éloigne de l'encre vers le pôle
        return 'rgb(' +
          Math.round(mid[0] + (pole[0] - mid[0]) * k) + ',' +
          Math.round(mid[1] + (pole[1] - mid[1]) * k) + ',' +
          Math.round(mid[2] + (pole[2] - mid[2]) * k) + ')';
      }

      function pct(v) {
        return (v == null || !isFinite(v)) ? '—' : (v * 100).toFixed(1).replace('.', ',') + ' %';
      }

      function hex(c, i) {
        var n = parseInt(String(c).replace('#', ''), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255][i];
      }

      function alpha(c, k) {
        return 'rgba(' + hex(c, 0) + ',' + hex(c, 1) + ',' + hex(c, 2) + ',' + k + ')';
      }

      function smoothSlope(pts, win) {
        var out = new Array(pts.length).fill(0);
        if (pts.length < 2) return out;
        for (var i = 1; i < pts.length; i++) {
          var a0 = Math.max(0, i - win), b0 = Math.min(pts.length - 1, i + win);
          var dd = pts[b0].d - pts[a0].d;
          var de = (pts[b0].ele != null && pts[a0].ele != null) ? pts[b0].ele - pts[a0].ele : 0;
          out[i] = dd > 1 ? de / dd : 0;
        }
        out[0] = out[1];
        return out;
      }
    }
  });
}());
