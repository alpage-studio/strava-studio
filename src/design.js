/* design.js — le socle graphique.
 *
 * Trois choses manquaient aux premiers templates, et ce sont elles qui
 * séparent un tableau de bord d'une page de magazine :
 *   une vraie police, une grille, une échelle typographique.
 * Ce fichier ajoute les trois au helper H. Il ne dessine rien tout seul.
 */
(function (global) {
  'use strict';

  var FAMILY = '"Archivo", "Segoe UI", "Helvetica Neue", Arial, sans-serif';

  /* Échelle typographique : cinq rôles, pas cinquante tailles.
   * Chaque rôle porte sa graisse, son interlettrage et sa largeur.
   * Écrire H.t('label') plutôt que {size: u(2.1), weight: 700, tracking: u(0.35)}
   * est ce qui rend un jeu de templates cohérent entre eux. */
  var SCALE = {
    hero:  { size: 17,  weight: 700, tracking: -0.055, stretch: 'normal' },
    value: { size: 6.2, weight: 700, tracking: -0.03,  stretch: 'normal' },
    title: { size: 3.4, weight: 600, tracking: -0.01,  stretch: 'normal' },
    label: { size: 1.6, weight: 600, tracking:  0.14,  stretch: 'normal', upper: true },
    meta:  { size: 1.9, weight: 400, tracking:  0,     stretch: 'normal' }
  };

  function extend(H) {
    var u = H.u, ctx = H.ctx;
    H.FONT = FAMILY;

    /* --- rôle typographique --- */
    // H.t('value')                -> l'objet de style prêt pour H.text()
    // H.t('value', {size: 9})     -> même rôle, taille forcée (en unités u)
    H.t = function (role, over) {
      var d = SCALE[role] || SCALE.meta;
      var o = {
        size: u(over && over.size != null ? over.size : d.size),
        weight: d.weight,
        stretch: d.stretch,
        font: FAMILY
      };
      // l'interlettrage est proportionnel au corps, jamais absolu :
      // c'est ce qui fait tenir un même style du micro-label au chiffre héros
      o.tracking = d.tracking * o.size;
      o.upper = d.upper;
      Object.keys(over || {}).forEach(function (k) {
        if (k !== 'size') o[k] = over[k];
      });
      return o;
    };

    /* --- grille --- */
    /* g.x(i) = bord gauche de la colonne i ; g.w(n) = largeur de n colonnes.
     * Plus aucun nombre magique dans les templates : toute position sort
     * de la grille, donc tout s'aligne avec tout par construction. */
    H.grid = function (opt) {
      opt = opt || {};
      var m = opt.margin == null ? u(7) : opt.margin;
      var top = opt.top == null ? m : opt.top;
      var cols = opt.cols || 6;
      var gut = opt.gutter == null ? u(2) : opt.gutter;
      var box = opt.box || { x: 0, y: 0, w: H.w, h: H.h };
      var inner = {
        x: box.x + m, y: box.y + top,
        w: box.w - 2 * m, h: box.h - top - m
      };
      var cw = (inner.w - gut * (cols - 1)) / cols;
      var step = opt.step == null ? u(3.2) : opt.step;
      return {
        m: m, cols: cols, gutter: gut, colWidth: cw, step: step,
        left: inner.x, right: inner.x + inner.w,
        top: inner.y, bottom: inner.y + inner.h,
        width: inner.w, height: inner.h,
        x: function (i) { return inner.x + i * (cw + gut); },
        w: function (n) { return n * cw + (n - 1) * gut; },
        y: function (n) { return inner.y + n * step; },        // rythme depuis le haut
        yb: function (n) { return inner.y + inner.h - n * step; } // depuis le bas
      };
    };

    /* --- carte encartée --- */
    /* Le fond perdu est le réflexe par défaut ; la carte est ce qui donne
     * l'air éditorial. Elle pose aussi une zone de sécurité pour le texte. */
    H.card = function (box, opt) {
      opt = opt || {};
      ctx.save();
      if (opt.shadow) {
        ctx.shadowColor = opt.shadow;
        ctx.shadowBlur = opt.shadowBlur == null ? u(4) : opt.shadowBlur;
        ctx.shadowOffsetY = u(1);
      }
      H.roundRect(box.x, box.y, box.w, box.h, opt.radius == null ? u(2) : opt.radius);
      ctx.fillStyle = opt.fill || '#fff';
      ctx.fill();
      ctx.restore();
      if (opt.stroke) {
        ctx.save();
        H.roundRect(box.x, box.y, box.w, box.h, opt.radius == null ? u(2) : opt.radius);
        ctx.strokeStyle = opt.stroke;
        ctx.lineWidth = opt.strokeWidth || u(0.12);
        ctx.stroke();
        ctx.restore();
      }
      return box;
    };

    /* --- filet --- */
    H.rule = function (x1, y, x2, opt) {
      opt = opt || {};
      ctx.save();
      ctx.strokeStyle = opt.color || 'rgba(0,0,0,.14)';
      ctx.lineWidth = opt.width == null ? u(0.1) : opt.width;
      ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke();
      ctx.restore();
    };

    /* --- bloc étiquette + valeur --- */
    /* L'étiquette AU-DESSUS, jamais à côté : c'est ce qui permet d'aligner
     * plusieurs blocs sur une même ligne de base sans les faire coulisser. */
    H.field = function (label, value, x, y, opt) {
      opt = opt || {};
      var lab = H.t('label', { color: opt.labelColor || 'rgba(0,0,0,.45)', align: opt.align });
      H.text(String(label).toUpperCase(), x, y, lab);
      var val = H.t(opt.role || 'value', {
        color: opt.color || '#000', align: opt.align,
        size: opt.size, maxWidth: opt.maxWidth
      });
      H.text(value, x, y + (opt.gap == null ? val.size * 0.98 : opt.gap), val);
      return y + (opt.gap == null ? val.size * 0.98 : opt.gap);
    };

    /* --- histogramme en barres fines --- */
    /* Une seule série, une seule valeur mise en avant. Prend n'importe quel
     * tableau de nombres : splits, altitudes, fréquence cardiaque. */
    H.bars = function (values, box, opt) {
      opt = opt || {};
      var vals = values.filter(function (v) { return v != null && isFinite(v); });
      if (vals.length < 2) return;
      // pendant une animation, seules les barres déjà atteintes sont peintes
      var shown = H.progressCount ? H.progressCount(values.length) : values.length;
      var lo = opt.min == null ? Math.min.apply(null, vals) : opt.min;
      var hi = opt.max == null ? Math.max.apply(null, vals) : opt.max;
      var span = (hi - lo) || 1;
      var n = values.length;
      var gap = opt.gap == null ? Math.max(u(0.12), box.w / n * 0.35) : opt.gap;
      var bw = Math.max(u(0.15), box.w / n - gap);
      var floorY = box.y + box.h;
      var invert = !!opt.invert; // true : la plus petite valeur = la barre la plus haute

      ctx.save();
      values.forEach(function (v, i) {
        if (v == null || !isFinite(v) || i >= shown) return;
        var k = (v - lo) / span;
        if (invert) k = 1 - k;
        var bh = Math.max(u(0.3), (opt.floor == null ? 0.06 : opt.floor) * box.h + k * box.h * 0.94);
        var isPeak = opt.peak != null && i === opt.peak;
        ctx.fillStyle = isPeak ? (opt.peakColor || '#E5502D') : (opt.color || 'rgba(0,0,0,.55)');
        ctx.fillRect(box.x + i * (bw + gap), floorY - bh, bw, bh);
      });
      ctx.restore();
    };

    /* --- grain ---
     * Un aplat ou un dégradé nu sonne numérique. Une trame de bruit très
     * faible lui rend de la matière. Tuile mise en cache : la générer par
     * pixel sur 1080 × 1920 coûterait cher à chaque rendu. */
    H.grain = function (amount) {
      if (!amount) return;
      if (!global.__grainTile) {
        var t = document.createElement('canvas');
        t.width = t.height = 96;
        var tc = t.getContext('2d');
        var img = tc.createImageData(96, 96);
        for (var i = 0; i < img.data.length; i += 4) {
          var v = 120 + Math.random() * 135;
          img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
          img.data[i + 3] = 255;
        }
        tc.putImageData(img, 0, 0);
        global.__grainTile = t;
      }
      ctx.save();
      ctx.globalAlpha = amount;
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = ctx.createPattern(global.__grainTile, 'repeat');
      ctx.fillRect(0, 0, H.w, H.h);
      ctx.restore();
    };

    /* --- type d'activité, en clair ---
     * Le GPX écrit « running », « MTB », « Ride »… selon la montre. */
    H.activityLabel = function (act) {
      var t = String(act.type || '').toLowerCase();
      if (t.indexOf('run') >= 0 || t.indexOf('trail') >= 0) return 'course à pied';
      if (t.indexOf('mtb') >= 0 || t.indexOf('mountain') >= 0) return 'vtt';
      if (t.indexOf('ride') >= 0 || t.indexOf('bik') >= 0 || t.indexOf('cycl') >= 0) return 'vélo';
      if (t.indexOf('hik') >= 0 || t.indexOf('walk') >= 0 || t.indexOf('march') >= 0) return 'randonnée';
      if (t.indexOf('ski') >= 0) return 'ski';
      if (t.indexOf('swim') >= 0) return 'natation';
      return 'activité';
    };

    /* --- coordonnées géographiques, en notation degrés/minutes --- */
    H.coords = function (track) {
      if (!track || !track.length) return '';
      var p = track[0];
      function dm(v, pos, neg) {
        var d = Math.floor(Math.abs(v));
        var m = Math.round((Math.abs(v) - d) * 60);
        return d + '° ' + m + '′ ' + (v >= 0 ? pos : neg);
      }
      return dm(p.lat, 'N', 'S') + '   ' + dm(p.lon, 'E', 'W');
    };
  }

  global.Design = { extend: extend, SCALE: SCALE, FAMILY: FAMILY };
}(window));
