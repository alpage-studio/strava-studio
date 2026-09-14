/* studio.js — le moteur.
 *
 * Il fait trois choses et rien d'autre :
 *   1. tenir le registre des templates    Studio.template({...})
 *   2. offrir des helpers de dessin        H.route(), H.photo(), H.text()...
 *   3. rendre et exporter                  Studio.render(), Studio.export()
 *
 * Il ne décide d'aucun pixel. Les pixels, c'est tes templates.
 */
(function (global) {
  'use strict';

  var registry = [];

  function template(def) {
    if (!def.id || typeof def.draw !== 'function') {
      throw new Error('Template invalide : il faut un id et une fonction draw().');
    }
    def.options = def.options || [];
    registry.push(def);
    return def;
  }

  function all() { return registry.slice(); }
  function get(id) {
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i];
    return registry[0];
  }

  /* ---------- formatage ---------- */

  var fmt = {
    // 3599 -> "59:59" ; 3600 -> "1:00:00"
    duration: function (s) {
      if (s == null) return '—';
      s = Math.round(s);
      var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
      return h ? h + ':' + pad(m) + ':' + pad(x) : m + ':' + pad(x);
    },
    // secondes par km -> "4:37"
    pace: function (s) {
      if (s == null || !isFinite(s)) return '—';
      var m = Math.floor(s / 60), x = Math.round(s % 60);
      if (x === 60) { m++; x = 0; }
      return m + ':' + pad(x);
    },
    km: function (n, dec) {
      if (n == null) return '—';
      return n.toFixed(dec == null ? 2 : dec).replace('.', ',');
    },
    int: function (n) { return n == null ? '—' : String(Math.round(n)); },
    speed: function (n) { return n == null ? '—' : n.toFixed(1).replace('.', ','); },
    date: function (d, locale) {
      if (!d) return '';
      // le français ne met pas de virgule après le jour de la semaine
      return d.toLocaleDateString(locale || 'fr-CH', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
      }).replace(',', '');
    },
    time: function (d) {
      if (!d) return '';
      return d.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' });
    }
  };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  /* ---------- helpers de dessin ---------- */

  function helpers(ctx, w, h, state) {
    var H = {
      w: w, h: h, ctx: ctx, fmt: fmt,

      /* Unité relative : 1 vu = 1% de la plus petite dimension.
       * Écris tes tailles avec, et ton template survit au changement
       * de format (story 9:16 -> post 4:5) sans une seule retouche. */
      u: function (n) { return n * Math.min(w, h) / 100; },

      fill: function (color) {
        ctx.save(); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
      },

      /* Dégradé vertical. stops = [[0,'#000'],[1,'#fff']] */
      gradient: function (stops, x0, y0, x1, y1) {
        var g = ctx.createLinearGradient(
          x0 == null ? 0 : x0, y0 == null ? 0 : y0,
          x1 == null ? 0 : x1, y1 == null ? h : y1
        );
        stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
        return g;
      },

      /* Photo de fond en "cover" : remplit sans déformer.
       * Refusée sur un template transparent : la photo ne doit jamais entrer
       * dans le canvas, sinon le PNG exporté n'a plus d'alpha. */
      photo: function (box) {
        var img = state.photo;
        if (!img || state.transparent) return false;
        box = box || { x: 0, y: 0, w: w, h: h };
        var r = Math.max(box.w / img.width, box.h / img.height);
        var dw = img.width * r, dh = img.height * r;
        ctx.save();
        ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
        ctx.drawImage(img, box.x + (box.w - dw) / 2, box.y + (box.h - dh) / 2, dw, dh);
        ctx.restore();
        return true;
      },

      /* Trace GPS ajustée dans une boîte, aspect conservé.
       * Si une progression d'animation est en cours, seule la portion déjà
       * parcourue est tracée — c'est ce qui fait que TOUS les templates
       * s'animent sans qu'aucun ne le sache. */
      route: function (fullRoute, box, opt) {
        if (!fullRoute || !fullRoute.pts.length) return;
        var route = fullRoute;
        if (state.progress < 1) {
          var n = Math.max(2, Math.ceil(fullRoute.pts.length * state.progress));
          route = { pts: fullRoute.pts.slice(0, n), aspect: fullRoute.aspect };
        }
        opt = opt || {};
        var pad = opt.pad == null ? 0 : opt.pad;
        var bw = box.w - 2 * pad, bh = box.h - 2 * pad;
        var s = Math.min(bw, bh);
        var ox = box.x + pad + (bw - s) / 2, oy = box.y + pad + (bh - s) / 2;

        ctx.save();
        ctx.beginPath();
        route.pts.forEach(function (p, i) {
          var x = ox + p.x * s, y = oy + p.y * s;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        });
        ctx.lineWidth = opt.width == null ? H.u(1) : opt.width;
        ctx.strokeStyle = opt.color || '#fff';
        ctx.lineJoin = ctx.lineCap = 'round';
        if (opt.glow) { ctx.shadowColor = opt.glow; ctx.shadowBlur = H.u(2); }
        ctx.stroke();
        ctx.restore();

        if (opt.dots) {
          var a = route.pts[0], b = route.pts[route.pts.length - 1];
          [[a, opt.startColor || opt.color || '#fff'], [b, opt.endColor || '#fff']].forEach(function (d) {
            ctx.save();
            ctx.fillStyle = d[1];
            ctx.beginPath();
            ctx.arc(ox + d[0].x * s, oy + d[0].y * s, opt.dots, 0, Math.PI * 2);
            ctx.fill(); ctx.restore();
          });
        }
      },

      /* Profil d'altitude en aire remplie. */
      profile: function (prof, box, opt) {
        if (!prof || prof.length < 2) return;
        if (state.progress < 1) prof = prof.slice(0, Math.max(2, Math.ceil(prof.length * state.progress)));
        opt = opt || {};
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(box.x, box.y + box.h);
        prof.forEach(function (p) {
          ctx.lineTo(box.x + p.x * box.w, box.y + box.h - p.y * box.h);
        });
        ctx.lineTo(box.x + box.w, box.y + box.h);
        ctx.closePath();
        ctx.fillStyle = opt.fill || 'rgba(255,255,255,.25)';
        ctx.fill();
        if (opt.stroke) {
          ctx.lineWidth = opt.width || H.u(0.4);
          ctx.strokeStyle = opt.stroke;
          ctx.stroke();
        }
        ctx.restore();
      },

      /* Applique un style de texte au contexte et renvoie la chaîne à peindre.
       * stretch : keyword CSS (condensed, expanded…) — l'axe de chasse de la
       * police variable. maxWidth : le corps rétrécit plutôt que de déborder. */
      apply: function (str, o) {
        str = String(o.upper ? String(str).toUpperCase() : str);
        var size = o.size || H.u(5);
        var stretch = o.stretch && o.stretch !== 'normal' ? o.stretch + ' ' : '';
        function setFont(s) { ctx.font = stretch + (o.weight || 600) + ' ' + s + 'px ' + (o.font || H.FONT); }
        setFont(size);
        if ('letterSpacing' in ctx) ctx.letterSpacing = (o.tracking || 0) + 'px';

        if (o.maxWidth) {
          // mesure puis rétrécit — deux passes suffisent, l'avance est linéaire
          var wid = H.measureWith(str, o, size);
          if (wid > o.maxWidth) {
            size = size * (o.maxWidth / wid) * 0.995;
            setFont(size);
            if ('letterSpacing' in ctx) ctx.letterSpacing = ((o.tracking || 0) * size / (o.size || 1)) + 'px';
          }
        }
        ctx.fillStyle = o.color || '#fff';
        ctx.textAlign = o.align || 'left';
        ctx.textBaseline = o.base || 'alphabetic';
        return { str: str, size: size };
      },

      measureWith: function (str, o, size) {
        ctx.save();
        var stretch = o.stretch && o.stretch !== 'normal' ? o.stretch + ' ' : '';
        ctx.font = stretch + (o.weight || 600) + ' ' + (size || o.size || H.u(5)) + 'px ' + (o.font || H.FONT);
        if ('letterSpacing' in ctx) ctx.letterSpacing = (o.tracking || 0) + 'px';
        var m = ctx.measureText(String(str)).width;
        ctx.restore();
        return m;
      },

      measure: function (str, o) { return H.measureWith(str, o || {}, (o || {}).size); },

      /* Texte. align: left|center|right, base: top|middle|alphabetic */
      text: function (str, x, y, o) {
        o = o || {};
        if (state.textFade <= 0) return;
        ctx.save();
        if (state.textFade < 1) ctx.globalAlpha = state.textFade;
        var r = H.apply(str, o);
        if (o.tracking && !('letterSpacing' in ctx)) {
          // repli pour les moteurs sans letterSpacing : lettre à lettre
          var chars = r.str.split(''), total = 0, widths = [];
          chars.forEach(function (c) { var cw = ctx.measureText(c).width; widths.push(cw); total += cw + o.tracking; });
          total -= o.tracking;
          var cx = o.align === 'center' ? x - total / 2 : (o.align === 'right' ? x - total : x);
          ctx.textAlign = 'left';
          chars.forEach(function (c, i) { ctx.fillText(c, cx, y); cx += widths[i] + o.tracking; });
        } else {
          ctx.fillText(r.str, x, y);
        }
        ctx.restore();
      },

      /* Bloc "valeur + légende", la brique de base d'un template stats. */
      stat: function (value, label, x, y, o) {
        o = o || {};
        H.text(value, x, y, {
          size: o.valueSize || H.u(8), weight: o.valueWeight || 800,
          color: o.color || '#fff', align: o.align || 'left', base: 'alphabetic'
        });
        H.text(String(label).toUpperCase(), x, y + (o.gap || H.u(3.2)), {
          size: o.labelSize || H.u(2.2), weight: 600,
          color: o.labelColor || 'rgba(255,255,255,.65)',
          align: o.align || 'left', base: 'alphabetic',
          tracking: o.labelTracking == null ? H.u(0.25) : o.labelTracking
        });
      },

      roundRect: function (x, y, rw, rh, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + rw, y, x + rw, y + rh, r);
        ctx.arcTo(x + rw, y + rh, x, y + rh, r);
        ctx.arcTo(x, y + rh, x, y, r);
        ctx.arcTo(x, y, x + rw, y, r);
        ctx.closePath();
      },

      /* Combien d'éléments d'une série sont révélés à cet instant. */
      progressCount: function (total) {
        return state.progress >= 1 ? total : Math.ceil(total * state.progress);
      },

      FONT: '"Inter", "Segoe UI", "Helvetica Neue", Arial, sans-serif'
    };
    // le socle graphique (grille, échelle typo, carte) s'ajoute ici s'il est chargé
    if (global.Design) global.Design.extend(H);
    if (global.Overlay) global.Overlay.extend(H);

    /* Mode minimaliste : le tracé seul, sans un mot.
     * On neutralise les helpers d'écriture APRÈS extension, plutôt que de
     * demander à chaque template de se surveiller. Conséquence voulue :
     * tout template — y compris ceux écrits plus tard — obéit gratuitement.
     * Les filets partent aussi : un trait sous un texte absent est un
     * débris, pas une composition. */
    if (state.minimal) {
      var rien = function () {};
      H.text = rien;
      H.rule = rien;
      H.hair = rien;
    }
    return H;
  }

  /* ---------- rendu ---------- */

  /* progress : fraction de la géométrie révélée (animation)
   * textFade : opacité du texte — les deux valent 1 en rendu normal */
  var state = { photo: null, progress: 1, textFade: 1 };

  function setPhoto(img) { state.photo = img; }
  function setMinimal(v) { state.minimal = !!v; }
  function setProgress(p, fade) {
    state.progress = p == null ? 1 : Math.max(0, Math.min(1, p));
    state.textFade = fade == null ? 1 : Math.max(0, Math.min(1, fade));
  }

  function render(canvas, tplId, activity, options, size) {
    var tpl = get(tplId);
    var w = size[0], h = size[1];
    /* Ne redimensionner QUE si la taille change : écrire canvas.width
     * réinitialise la surface, ce qui casse le flux d'enregistrement vidéo
     * (images noires ou transparentes) quand on rend 30 fois par seconde. */
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h;
    }
    var ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    state.transparent = !!tpl.transparent;

    var o = {};
    tpl.options.forEach(function (def) { o[def.key] = def.default; });
    Object.keys(options || {}).forEach(function (k) {
      if (options[k] !== undefined && options[k] !== null) o[k] = options[k];
    });

    var H = helpers(ctx, w, h, state);
    try {
      tpl.draw({ ctx: ctx, w: w, h: h, a: activity, o: o, H: H });
    } catch (e) {
      ctx.fillStyle = '#111'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = '#ff5a5a';
      ctx.font = '600 ' + (w / 26) + 'px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Erreur dans le template « ' + tpl.id + ' »', w / 2, h / 2 - w / 20);
      ctx.font = '400 ' + (w / 40) + 'px monospace';
      ctx.fillStyle = '#ddd';
      wrap(ctx, e.message, w / 2, h / 2, w * 0.85, w / 30);
      console.error(e);
    }
    return tpl;
  }

  function wrap(ctx, str, x, y, maxW, lh) {
    var words = String(str).split(' '), line = '', lines = [];
    words.forEach(function (word) {
      var test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    });
    if (line) lines.push(line);
    lines.forEach(function (l, i) { ctx.fillText(l, x, y + i * lh); });
  }

  function exportPNG(canvas, filename) {
    canvas.toBlob(function (blob) {
      // sur téléphone, la feuille de partage native ; ailleurs, un téléchargement
      if (global.Share) global.Share.file(blob, filename);
      else {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = filename;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      }
    }, 'image/png');
  }

  global.Studio = {
    template: template, all: all, get: get,
    render: render, exportPNG: exportPNG, setPhoto: setPhoto, setMinimal: setMinimal,
    setProgress: setProgress, fmt: fmt
  };
}(window));
