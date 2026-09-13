/* overlay.js — socle des surcouches transparentes.
 *
 * Un template « overlay » n'est pas une image : c'est un PNG à canal alpha
 * qu'on pose sur sa propre photo dans Stories. Deux conséquences dures :
 *   - il ne peint JAMAIS de fond, et la photo n'entre jamais dans le canvas ;
 *   - le voile (« scrim ») fait partie de l'alpha, il n'est pas une commodité
 *     de prévisualisation. C'est lui qui rend le texte lisible sur une photo
 *     claire, et il doit être exporté.
 *
 * Les cotes de ces templates sont données dans l'espace d'export 1080 × 1920.
 * H.px(n) convertit : à 1080 de large, px(80) vaut 80.
 */
(function (global) {
  'use strict';

  var SANS = '"Helvetica Neue", Helvetica, Arial, sans-serif';
  var MONO = '"IBM Plex Mono", ui-monospace, "Cascadia Mono", Consolas, monospace';

  function extend(H) {
    var ctx = H.ctx, w = H.w, h = H.h;

    H.SANS = SANS;
    H.MONO = MONO;

    // cotes du handoff (espace 1080 × 1920) -> pixels du canvas courant.
    // px() pour les corps, les traits et l'horizontale ; py() pour les
    // positions verticales, qui suivent la hauteur réelle du format.
    H.px = function (n) { return n * w / 1080; };
    H.py = function (n) { return n * h / 1920; };

    // métriques de ligne, pour poser des blocs comme le ferait CSS
    H.lh = function (size) { return size * 1.18; };            // hauteur de ligne
    H.bl = function (top, size) { return top + size * 0.92; }; // ligne de base

    /* Voile directionnel.
     * dir : 'top' | 'bottom' | 'left' | 'right', au sens CSS
     * (linear-gradient(to top, …) part du bas et monte).
     * stops : [[0, 'rgba(0,0,0,.55)'], [0.26, '…'], [0.46, 'rgba(0,0,0,0)']] */
    H.scrim = function (dir, stops) {
      var g;
      if (dir === 'top') g = ctx.createLinearGradient(0, h, 0, 0);
      else if (dir === 'bottom') g = ctx.createLinearGradient(0, 0, 0, h);
      else if (dir === 'left') g = ctx.createLinearGradient(w, 0, 0, 0);
      else g = ctx.createLinearGradient(0, 0, w, 0);
      stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    };

    /* Voile radial elliptique — l'équivalent de
     * radial-gradient(rx% ry% at cx% cy%, …).
     * Canvas ne connaît que le cercle : on écrase le repère pour l'ellipse. */
    H.scrimRadial = function (rxPct, ryPct, cxPct, cyPct, stops) {
      var cx = w * cxPct, cy = h * cyPct;
      var rx = w * rxPct, ry = h * ryPct;
      var k = ry / rx;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, k);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
      ctx.fillStyle = g;
      // le repère est écrasé : on déborde largement pour couvrir tout le cadre
      ctx.fillRect(-w * 2, -h * 2 / k, w * 4, h * 4 / k);
      ctx.restore();
    };

    /* Filet. Les hairlines du handoff font 1,5 px dans l'espace 1080. */
    H.hair = function (x1, y, x2, color, thick) {
      ctx.save();
      ctx.fillStyle = color;
      ctx.fillRect(x1, y, x2 - x1, thick == null ? H.px(1.5) : thick);
      ctx.restore();
    };

    /* Colonne de texte verticale, au sens CSS writing-mode: vertical-rl :
     * les colonnes se succèdent de DROITE à gauche, glyphes tournés d'un
     * quart de tour horaire. Renvoie le bord gauche atteint. */
    H.vcolumn = function (items, rightX, topY, gap) {
      var right = rightX;
      items.forEach(function (it) {
        var size = it.size;
        var left = right - size;
        ctx.save();
        ctx.translate(left + size * 0.78, topY);
        ctx.rotate(Math.PI / 2);
        H.text(it.text, 0, 0, {
          size: size, weight: it.weight || 400, color: it.color || '#fff',
          font: it.font || SANS, tracking: it.tracking || 0, base: 'alphabetic'
        });
        ctx.restore();
        right = left - gap;
      });
      return right;
    };

    /* Profil d'altitude dans une boîte, tracé + aire, à la manière du
     * handoff : aire à 13 % de blanc, ligne pleine par-dessus. */
    H.elevation = function (prof, box, opt) {
      if (!prof || prof.length < 2) return;
      var shown = H.progressCount(prof.length);
      if (shown < prof.length) prof = prof.slice(0, Math.max(2, shown));
      opt = opt || {};
      var pad = opt.pad == null ? 0 : opt.pad;
      var inner = box.h - pad;
      function pt(p) {
        return [box.x + p.x * box.w, box.y + pad + (1 - p.y) * inner];
      }
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(box.x, box.y + box.h);
      prof.forEach(function (p) { var c = pt(p); ctx.lineTo(c[0], c[1]); });
      ctx.lineTo(box.x + box.w, box.y + box.h);
      ctx.closePath();
      ctx.fillStyle = opt.fill || 'rgba(255,255,255,.13)';
      ctx.fill();

      ctx.beginPath();
      prof.forEach(function (p, i) {
        var c = pt(p);
        if (i === 0) ctx.moveTo(c[0], c[1]); else ctx.lineTo(c[0], c[1]);
      });
      ctx.strokeStyle = opt.stroke || '#fff';
      ctx.lineWidth = opt.width == null ? H.px(2) : opt.width;
      ctx.lineJoin = 'round';
      ctx.stroke();
      ctx.restore();
    };
  }

  /* ---------- champs communs aux six surcouches ----------
   * Le handoff parle de TIME / ASCENT / POWER. Nous n'avons pas de
   * puissance : la troisième colonne est un choix de template. */
  var THIRD = {
    allure: function (a, H) { return { label: 'allure', value: a.pace_s_per_km ? H.fmt.pace(a.pace_s_per_km) + '/km' : '—' }; },
    vitesse: function (a, H) { return { label: 'vitesse', value: H.fmt.speed(a.speed_kmh) + ' km/h' }; },
    fc: function (a, H) { return { label: 'fc moy', value: a.hr_avg ? a.hr_avg + ' bpm' : '—' }; },
    distance: function (a, H) { return { label: 'distance', value: H.fmt.km(a.distance_km, 1) + ' km' }; }
  };

  var MOIS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUN', 'JUL', 'AOÛ', 'SEP', 'OCT', 'NOV', 'DÉC'];

  function fields(a, o, H) {
    var third = (THIRD[o.troisieme] || THIRD.vitesse)(a, H);
    var d = a.date;
    var dateline = d
      ? (d.getDate() < 10 ? '0' : '') + d.getDate() + ' ' + MOIS[d.getMonth()] + ' ' + d.getFullYear() +
        ' · ' + H.fmt.time(d).replace(':', ':')
      : '';
    var ascent = a.elev_gain_m != null ? a.elev_gain_m + ' m' : '—';
    return {
      name: a.name,
      dateline: dateline,
      time: H.fmt.duration(a.duration_s),
      ascent: ascent,
      ascentUpper: ascent.toUpperCase(),
      third: third,
      // ligne compacte des trois valeurs, séparateur milieu de point
      line: [ascent.toUpperCase(), H.fmt.duration(a.duration_s), third.value.toUpperCase()].join(' · ')
    };
  }

  /* ---------- encre claire ou sombre ----------
   * Le handoff ne prévoyait que l'encre blanche. Elle meurt sur une photo
   * de neige ou de ciel surexposé. L'encre sombre n'est pas une simple
   * inversion des textes : le VOILE doit s'inverser aussi. Un texte noir a
   * besoin qu'on éclaircisse sous lui, pas qu'on assombrisse — sinon on
   * empile du noir sur du noir et plus rien ne se lit. */
  function palette(o) {
    var sombre = o.encre === 'sombre';
    var rvb = sombre ? '12,12,12' : '255,255,255';
    var voile = sombre ? '255,255,255' : '0,0,0';
    return {
      sombre: sombre,
      ink: sombre ? '#0C0C0C' : '#FFFFFF',
      // halo : il doit contraster AVEC l'encre, donc s'inverser avec elle
      halo: sombre ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.62)',
      // a(k) : l'encre à l'opacité k — pour les étiquettes, jamais les valeurs
      a: function (k) { return 'rgba(' + rvb + ',' + k + ')'; },
      /* scrim([[position, opacité], …]) rend les arrêts dans la bonne
       * couleur de voile. Les positions et les opacités du handoff sont
       * conservées telles quelles. */
      scrim: function (stops) {
        return stops.map(function (s) {
          return [s[0], 'rgba(' + voile + ',' + s[1] + ')'];
        });
      }
    };
  }

  var OPT_INK = {
    key: 'encre', type: 'select', label: 'Encre', default: 'claire',
    choices: [['claire', 'Claire (photo sombre)'], ['sombre', 'Sombre (photo claire)']]
  };

  /* Option « troisième statistique », partagée par les six templates. */
  var OPT_THIRD = {
    key: 'troisieme', type: 'select', label: '3ᵉ donnée', default: 'vitesse',
    choices: [['allure', 'Allure'], ['vitesse', 'Vitesse'], ['fc', 'Fréquence card.'], ['distance', 'Distance']]
  };

  var OPT_SCRIM = {
    key: 'voile', type: 'toggle', label: 'Voile', default: true
  };

  global.Overlay = {
    extend: extend, fields: fields, palette: palette,
    OPT_THIRD: OPT_THIRD, OPT_SCRIM: OPT_SCRIM, OPT_INK: OPT_INK,
    SANS: SANS, MONO: MONO
  };
}(window));
