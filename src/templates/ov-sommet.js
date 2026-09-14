/* 1g / 1h · Sommet — surcouche transparente : parcours en haut, profil en bas.
 *
 * Même composition que les templates « Sommet » composés, mais en PNG à canal
 * alpha, et dans le vocabulaire de la famille des surcouches.
 *
 * Une décision de lisibilité s'écarte du reste de la famille : le parcours
 * flotte au milieu du cadre, là où un voile le couvrirait à moitié. Il porte
 * donc un halo noir diffus plutôt qu'un voile. Le halo se lit comme une ombre
 * portée, il laisse la photo ouverte, et il fait partie de l'alpha exporté.
 */
(function () {
  'use strict';

  var OPTIONS = [
    Overlay.OPT_INK,
    Overlay.OPT_THIRD,
    { key: 'reperes', type: 'toggle', label: 'Repères de distance', default: true },
    { key: 'halo', type: 'toggle', label: 'Halo sur le parcours', default: true },
    Overlay.OPT_SCRIM
  ];

  function niceStep(km) {
    var raw = km / 8, steps = [1, 2, 2.5, 5, 10, 20, 25, 50];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
    return 50;
  }

  function resample(values, n) {
    if (values.length <= n) return values.slice();
    var out = [], st = values.length / n;
    for (var i = 0; i < n; i++) {
      var a0 = Math.floor(i * st), b0 = Math.max(a0 + 1, Math.floor((i + 1) * st));
      var sl = values.slice(a0, b0);
      out.push(sl.reduce(function (x, y) { return x + y; }, 0) / sl.length);
    }
    return out;
  }

  function draw(mode) {
    return function (s) {
      var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H;
      var px = H.px, py = H.py;
      var f = Overlay.fields(a, o, H);
      var P = Overlay.palette(o);

      if (o.voile) {
        H.scrim('top', P.scrim([
          [0, .58], [0.32, .2], [0.56, 0]
        ]));
      }

      var left = px(80), right = w - px(80);
      var label = { size: px(20), font: H.MONO, weight: 400, tracking: px(20) * 0.2,
                    color: P.a(.62), upper: true };
      var value = { size: px(44), font: H.SANS, weight: 400, tracking: -px(44) * 0.01,
                    color: P.ink };

      /* ---------- le bas se pose en premier, du bas vers le haut ---------- */

      /* pied : une valeur, pas de notice */
      var capSize = px(20);
      var capBase = (h - py(132)) - capSize * 0.26;
      H.text(f.ascentUpper + ' D+', left, capBase,
        Object.assign({}, label, { color: P.a(.85) }));

      /* filet, puis bande de profil */
      var hairY = capBase - capSize * 0.92 - px(22);
      H.hair(left, hairY, right, P.a(.3));

      var profH = py(260);
      var profBottom = hairY - px(26);
      var box = { x: left, y: profBottom - profH, w: right - left, h: profH };

      var prof = a.profile;
      var peakX = box.x + box.w / 2, peakDrawn = false;
      if (prof && prof.length > 1) {
        var peak = 0;
        prof.forEach(function (p, i) { if (p.y > prof[peak].y) peak = i; });

        if (mode === 'barres') {
          var vals = resample(prof.map(function (p) { return p.y; }), 64);
          var pk = vals.indexOf(Math.max.apply(null, vals));
          H.bars(vals, box, {
            color: P.a(.62), peak: pk, peakColor: P.ink, floor: 0.05
          });
          peakX = box.x + (pk + 0.5) * (box.w / vals.length);
        } else {
          if (o.reperes && a.distance_km) {
            var step = niceStep(a.distance_km);
            ctx.save();
            ctx.strokeStyle = P.a(.32);
            ctx.lineWidth = px(1.5);
            ctx.setLineDash([px(9), px(9)]);
            for (var km = step; km < a.distance_km; km += step) {
              var gx = box.x + (km / a.distance_km) * box.w;
              ctx.beginPath();
              ctx.moveTo(gx, box.y - px(16));
              ctx.lineTo(gx, box.y + box.h);
              ctx.stroke();
            }
            ctx.restore();
          }

          // le profil suit la progression de l'animation, comme le parcours
          var vus = Math.max(2, H.progressCount(prof.length));
          ctx.save();
          ctx.beginPath();
          prof.slice(0, vus).forEach(function (p, i) {
            var x = box.x + p.x * box.w, y = box.y + box.h - p.y * box.h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = P.ink;
          ctx.lineWidth = px(3);
          ctx.lineJoin = ctx.lineCap = 'round';
          ctx.stroke();

          peakX = box.x + prof[peak].x * box.w;
          if (peak < vus) {
            var peakY = box.y + box.h - prof[peak].y * box.h;
            ctx.fillStyle = P.ink;
            ctx.beginPath();
            ctx.arc(peakX, peakY, px(8), 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.restore();
        }
        peakDrawn = true;
      }

      if (peakDrawn && a.elev_max_m != null) {
        var pxClamped = Math.max(box.x + px(60), Math.min(box.x + box.w - px(60), peakX));
        H.text(a.elev_max_m + ' m', pxClamped, box.y - px(26),
          Object.assign({}, label, { align: 'center', color: P.a(.85) }));
      }

      /* statistiques — l'écart au profil réserve une voie à l'étiquette du
       * sommet, qui peut tomber sous n'importe quelle colonne */
      var vTop = box.y - px(92) - H.lh(value.size);
      var lTop = vTop - px(12) - H.lh(label.size);
      var cols = [
        ['distance', H.fmt.km(a.distance_km, 1) + ' km'],
        ['temps', f.time],
        [f.third && f.third.label, f.third && f.third.value]
      ].filter(function (c) { return c[1] != null; });
      var widths = cols.map(function (c) {
        return Math.max(H.measure(String(c[0]).toUpperCase(), label), H.measure(c[1], value));
      });
      var sum = widths.reduce(function (x, y) { return x + y; }, 0);
      var gap = (right - left - sum) / (cols.length - 1);
      var x = left;
      cols.forEach(function (c, i) {
        H.text(c[0], x, H.bl(lTop, label.size), label);
        H.text(c[1], x, H.bl(vTop, value.size), value);
        x += widths[i] + gap;
      });

      /* filet haut + nom de la sortie */
      var hair2 = lTop - px(30) - px(1.5);
      H.hair(left, hair2, right, P.a(.3));

      var nSize = px(52);
      var nameBottom = hair2 - px(34);
      H.text(f.name, left, H.bl(nameBottom - H.lh(nSize), nSize), {
        size: nSize, font: H.SANS, weight: 400, tracking: -nSize * 0.02,
        color: P.ink, maxWidth: right - left
      });

      /* ---------- parcours : tout l'espace restant en haut ---------- */
      var routeTop = py(200);
      var routeBottom = nameBottom - H.lh(nSize) - px(60);
      H.route(a.route, { x: left, y: routeTop, w: right - left, h: routeBottom - routeTop }, {
        color: P.ink,
        width: px(2.5),
        glow: o.halo ? P.halo : null,
        dots: px(9),
        startColor: P.ink,
        endColor: P.a(.45)
      });
    };
  }

  Studio.template({
    id: 'ov-sommet-ligne',
    name: '1g · Sommet ligne',
    transparent: true,
    options: OPTIONS,
    draw: draw('ligne')
  });

  Studio.template({
    id: 'ov-sommet-barres',
    name: '1h · Sommet barres',
    transparent: true,
    options: OPTIONS,
    draw: draw('barres')
  });
}());
