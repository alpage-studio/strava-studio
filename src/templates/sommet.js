/* « Sommet » — le parcours en haut, le profil d'altitude en bas.
 *
 * Deux variantes, un seul dessin : le profil se rend en LIGNE (avec repères
 * d'intervalle et point au sommet) ou en BARRES. Tout le reste est commun.
 *
 * Le parti pris : les deux graphiques partagent exactement les mêmes marges
 * et le même point de départ marqué, pour qu'on les lise comme une seule
 * sortie et non comme deux illustrations empilées.
 */
(function () {
  'use strict';

  var OPTIONS = [
    { key: 'fond', type: 'select', label: 'Fond', default: 'degrade',
      choices: [['degrade', 'Dégradé'], ['aplat', 'Aplat'], ['photo', 'Photo']] },
    { key: 'haut', type: 'color', label: 'Fond — haut', default: '#1B1B3A' },
    { key: 'bas', type: 'color', label: 'Fond — bas', default: '#E98A7B' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#FFFFFF' },
    { key: 'reperes', type: 'toggle', label: 'Repères de distance', default: true },
    { key: 'grain', type: 'toggle', label: 'Grain', default: true }
  ];

  /* Intervalle « rond » donnant 6 à 9 repères sur la distance totale. */
  function niceStep(km) {
    var raw = km / 8, steps = [1, 2, 2.5, 5, 10, 20, 25, 50];
    for (var i = 0; i < steps.length; i++) if (steps[i] >= raw) return steps[i];
    return 50;
  }

  /* délègue à Alpage : une seule définition pour tout le studio */
  function alpha(hex, k) { return Alpage.melange(hex, k); }

  function draw(mode) {
    return function (s) {
      var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
      var ink = o.encre;
      var faint = alpha(ink, 0.55);
      var hair = alpha(ink, 0.22);

      /* ---------- fond ----------
       * En surcouche il n'y a pas de fond : ni photo (le moteur la refuse
       * pour garder l'alpha), ni aplat, ni degrade. */
      if (H.surcouche()) {
        /* rien */
      } else if (o.fond === 'photo' && H.photo()) {
        ctx.fillStyle = alpha('#000000', 0.25);
        ctx.fillRect(0, 0, w, h);
      } else if (o.fond === 'aplat') {
        H.fill(o.haut);
      } else {
        ctx.fillStyle = H.gradient([[0, o.haut], [1, o.bas]]);
        ctx.fillRect(0, 0, w, h);
      }
      if (o.grain) H.grain(0.05);

      var g = H.grid({ cols: 6, margin: u(7), gutter: u(1.6) });
      var CH = g.height;

      /* ---------- en-tête ---------- */
      H.text(a.name, g.left, g.top + u(3.6), H.t('title', {
        color: ink, maxWidth: g.w(4)
      }));

      /* ---------- ancrage du bas ---------- */
      var capBase = g.bottom;
      var profH = CH * (mode === 'barres' ? 0.16 : 0.15);
      var profBottom = capBase - u(4.6);
      var profTop = profBottom - profH;
      var box = { x: g.left, y: profTop, w: g.width, h: profH };

      /* ---------- statistiques ---------- */
      var statsBase = profTop - u(10);
      var stats = [
        ['distance', H.fmt.km(a.distance_km, 1) + ' km'],
        ['en mouvement', H.fmt.duration(a.duration_s)],
        ['vitesse', H.fmt.speed(a.speed_kmh) + ' km/h']
      ];
      var colW = g.width / stats.length;
      stats.forEach(function (st, i) {
        H.field(st[0], st[1], g.left + i * colW, statsBase - u(4), {
          color: ink, labelColor: faint, size: 4.4, maxWidth: colW - u(2)
        });
      });

      /* ---------- parcours ----------
       * Il occupe tout ce qui reste entre l'en-tête et les statistiques. */
      var routeTop = g.top + CH * 0.09;
      H.route(a.route, {
        x: g.left, y: routeTop, w: g.width, h: (statsBase - u(9)) - routeTop
      }, {
        color: ink,
        width: u(0.42),
        dots: u(0.85),
        startColor: ink,
        endColor: alpha(ink, 0.35)
      });

      /* ---------- profil ---------- */
      var prof = a.profile;
      if (prof && prof.length > 1) {
        var peak = 0;
        prof.forEach(function (p, i) { if (p.y > prof[peak].y) peak = i; });
        var peakX = box.x + prof[peak].x * box.w;

        if (mode === 'barres') {
          var vals = resample(prof.map(function (p) { return p.y; }), 64);
          var pk = vals.indexOf(Math.max.apply(null, vals));
          H.bars(vals, box, {
            color: alpha(ink, 0.62), peak: pk, peakColor: ink, floor: 0.05
          });
          peakX = box.x + (pk + 0.5) * (box.w / vals.length);
        } else {
          /* repères de distance : c'est eux qui donnent une échelle au profil */
          if (o.reperes) {
            var step = niceStep(a.distance_km || 10);
            ctx.save();
            // un peu plus marqués que les filets : ils portent du sens
            ctx.strokeStyle = alpha(ink, 0.32);
            ctx.lineWidth = u(0.14);
            ctx.setLineDash([u(0.9), u(0.9)]);
            for (var km = step; km < (a.distance_km || 0); km += step) {
              var x = box.x + (km / a.distance_km) * box.w;
              ctx.beginPath();
              ctx.moveTo(x, box.y - u(1.5));
              ctx.lineTo(x, box.y + box.h);
              ctx.stroke();
            }
            ctx.restore();
          }

          // le profil se trace en même temps que le parcours pendant une animation
          var vus = H.progressCount(prof.length);
          ctx.save();
          ctx.beginPath();
          prof.slice(0, Math.max(2, vus)).forEach(function (p, i) {
            var x = box.x + p.x * box.w, y = box.y + box.h - p.y * box.h;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          });
          ctx.strokeStyle = ink;
          ctx.lineWidth = u(0.34);
          ctx.lineJoin = ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();

          /* le point au sommet : la seule annotation qui mérite sa place,
           * et elle n'apparaît qu'une fois le sommet atteint */
          if (peak < vus) {
            var peakY = box.y + box.h - prof[peak].y * box.h;
            ctx.save();
            ctx.fillStyle = ink;
            ctx.beginPath();
            ctx.arc(peakX, peakY, u(0.75), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        }

        if (a.elev_max_m != null) {
          H.text(a.elev_max_m + ' m', clamp(peakX, box.x + u(4), box.x + box.w - u(4)),
            box.y - u(2.4), H.t('label', { color: ink, align: 'center' }));
        }
      }

      /* ---------- pied ----------
       * Une valeur, rien d'autre : les légendes qui expliquent le graphique
       * sont de la notice, pas de l'image. */
      H.rule(g.left, profBottom + u(1), g.right, { color: hair });
      H.text(H.fmt.int(a.elev_gain_m) + ' m D+', g.left, capBase,
        H.t('label', { color: ink }));

      /* ---------- utilitaires ---------- */
      function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
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
    };
  }

  Studio.template({
    id: 'sommet-ligne',
    name: 'Sommet · ligne',
    options: OPTIONS,
    draw: draw('ligne')
  });

  Studio.template({
    id: 'sommet-barres',
    name: 'Sommet · barres',
    options: OPTIONS,
    draw: draw('barres')
  });
}());
