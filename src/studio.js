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
    /* La famille range le template dans le sélecteur. Déduite si elle n'est
     * pas déclarée : seize templates existaient avant cette notion, aucun
     * n'a à être modifié pour continuer à s'afficher au bon endroit. */
    if (!def.famille) def.famille = def.transparent ? 'surcouche' : 'affiche';
    /* `transparent` peut être une FONCTION des options : les planches Alpage
     * s'exportent au choix sur papier ou en surcouche à poser sur une photo.
     * Ce qui suit — le fond de contrôle, la légende, la composition vidéo —
     * doit donc interroger l'état RÉSOLU, pas la déclaration. */
    if (typeof def.transparent === 'function') def.transparentDynamique = true;
    registry.push(def);
    return def;
  }

  function all() { return registry.slice(); }

  /* ---------- chronologie ----------
   * UNE seule définition du temps, lue par l'aperçu animé, l'export vidéo et
   * la séquence PNG. Chacun avait la sienne : la séquence PNG recopiait la
   * courbe de la vidéo « à l'identique » dans un commentaire, ce qui est la
   * définition d'une divergence qui attend son heure.
   *
   *   'trace'    — le tracé se dessine, le texte arrive ensuite (par défaut)
   *   'lineaire' — le temps passe tel quel : à une planche qui raconte sa
   *                propre histoire, on ne superpose pas une deuxième courbe.
   */
  function chrono(tplId, opts) {
    var tpl = get(tplId) || {};
    var lineaire = tpl.chrono === 'lineaire';
    /* `duree` peut être une FONCTION des options : la partition dure ce que
     * dure la pièce, et son réglage de tempo la fait varier de dix à vingt
     * secondes. Une durée figée ici aurait laissé l'aperçu et la vidéo
     * s'arrêter au milieu du morceau — la désynchronisation exacte que la
     * chronologie unique est censée rendre impossible. */
    var duree = typeof tpl.duree === 'function' ? tpl.duree(opts || {}) : tpl.duree;
    return {
      duree: duree || 4200,
      // fraction du temps consacrée à la révélation ; le reste est l'arrêt final
      reveal: lineaire ? 1 : 0.78,
      at: function (k) {                   // k = temps écoulé / durée totale
        k = Math.max(0, Math.min(1, k));
        if (lineaire) return { p: k, fade: 1 };
        var p = Math.min(1, k / this.reveal);
        return { p: 1 - Math.pow(1 - p, 3), fade: Math.max(0, Math.min(1, (p - 0.55) / 0.3)) };
      }
    };
  }
  function get(id) {
    for (var i = 0; i < registry.length; i++) if (registry[i].id === id) return registry[i];
    return registry[0];
  }

  /* ---------- le support, réglage GLOBAL ----------
   *
   * Le principe du studio : toute planche peut se poser sur une photo. Il
   * n'était vrai que pour quatorze templates sur trente-trois — les six
   * Alpage, qui avaient leur propre menu « Fond », et les huit surcouches,
   * qui ne savent faire que cela. Les dix-neuf autres peignaient un fond
   * opaque sans que rien ne permette de le retirer.
   *
   * Le réglage vit donc ICI, une fois, et non dans chaque template : un
   * choix qui vaut pour tous n'a pas à être redéclaré trente-trois fois,
   * et l'oubli d'une seule déclaration est exactement ce qui a produit le
   * défaut. Le moteur neutralise alors ce qui fabrique un fond — H.fill()
   * et le grain — et les quatre templates qui peignent un dégradé en
   * direct demandent H.surcouche() avant de le faire. */
  var supportSurcouche = false;
  function setSupport(actif) { supportSurcouche = !!actif; }

  /* LE VOILE, RÉGLAGE GLOBAL — EN PASSANT PAR CELUI DU TEMPLATE.
   *
   * Sans fond, une planche claire posée sur une photo claire est illisible.
   * Chaque template a DÉJÀ son voile — `optionsFond()` dans alpage.js le
   * déclare avec le même vocabulaire pour toutes : aucun, bas, haut, centre —
   * mais il était enterré dans les réglages fins, et un commentaire de l'app
   * affirmait qu'il était devenu global alors qu'il ne l'était pas. Résultat :
   * les vingt-cinq planches hors de la famille « sur photo » étaient
   * transparentes sans être utilisables sur une photo chargée.
   *
   * Le moteur ne peint donc PAS de voile à lui : il transmet le choix global
   * dans le vocabulaire de chaque planche, exactement comme il le fait déjà
   * pour le fond. Un voile générique par-dessus aurait ignoré le travail de
   * composition de chaque template — une première version le faisait, et
   * n'avait aucun effet parce que toutes les planches déclarent déjà la clé
   * qu'elle croyait absente. */
  var voileGlobal = 'aucun';
  function setVoile(v) { voileGlobal = v || 'aucun'; }

  /* ET POUR LES DIX-SEPT PLANCHES QUI N'EN ONT PAS.
   *
   * `transmetVoile` ne sert que celles qui declarent un voile — quinze sur
   * trente-deux. J'avais verifie six planches, vu que toutes portaient la cle,
   * et conclu que toutes la portaient : les dix-sept autres restaient
   * transparentes sans protection, et le journal annoncait le contraire.
   * C'est l'erreur qu'on reproche a un controle qui echantillonne et affirme.
   *
   * Pour celles-la, le moteur peint. Ce n'est pas un pis-aller : un voile est
   * une couche entre la photo et l'encre, et poser une couche est exactement
   * son travail. Les planches qui savent mieux faire gardent le leur. */
  function poseVoile(ctx, w, h, mode) {
    var g;
    if (mode === 'bas' || mode === 'haut') {
      g = mode === 'bas' ? ctx.createLinearGradient(0, h, 0, 0)
                         : ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(18,20,16,.58)');
      g.addColorStop(0.30, 'rgba(18,20,16,.20)');
      g.addColorStop(0.52, 'rgba(18,20,16,0)');
      ctx.save();
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
      return;
    }
    /* Au centre : un cercle ecrase au format du cadre. Canvas ne connait que
     * le cercle, on ecrase le repere — et on deborde largement, parce
     * qu'apres l'ecrasement le cadre ne tient plus dans le rayon. */
    ctx.save();
    ctx.translate(w / 2, h / 2);
    var k = h / w;
    ctx.scale(1, k);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, w * 0.78);
    g.addColorStop(0, 'rgba(18,20,16,.52)');
    g.addColorStop(0.62, 'rgba(18,20,16,.24)');
    g.addColorStop(1, 'rgba(18,20,16,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-w * 2, -h * 2 / k, w * 4, h * 4 / k);
    ctx.restore();
  }

  function transmetVoile(tpl, o, mode) {
    var def = tpl.options.filter(function (d) { return d.key === 'voile'; })[0];
    if (!def) return;
    if (def.type === 'select') {
      var possible = (def.choices || []).some(function (c) { return c[0] === mode; });
      if (possible) o.voile = mode;
    } else if (def.type === 'toggle') {
      /* LE RÉGLAGE GLOBAL AJOUTE, IL NE RETIRE PAS.
       *
       * La famille « sur photo » porte son voile par défaut — c'est sa raison
       * d'être : elle garantit la lisibilité sur n'importe quelle image. Une
       * première version écrivait `o.voile = (mode !== 'aucun')`, et comme le
       * réglage global part sur « aucun », ces huit planches perdaient leur
       * voile dès l'ouverture. Mesuré : 41 % du cadre couvert, puis 1 %. Leur
       * propre menu reste disponible pour l'éteindre volontairement. */
      if (mode !== 'aucun') o.voile = true;
    } else if (def.type === 'range') {
      o.voile = mode === 'aucun' ? (def.min || 0) : def.default;
    }
  }

  /* Un template est-il transparent POUR CES OPTIONS ?
   * Trois endroits en dépendent — le fond de contrôle sous l'aperçu, la
   * légende, et la composition de la vidéo — et chacun lisait jusqu'ici
   * `tpl.transparent` directement. Avec une déclaration devenue fonction,
   * ils auraient tous reçu `true` (une fonction est vraie) et cru que les
   * six planches Alpage étaient toujours transparentes. */
  function estTransparent(tpl, opts) {
    if (supportSurcouche) return true;
    if (typeof tpl === 'string') tpl = get(tpl);
    if (!tpl) return false;
    if (typeof tpl.transparent !== 'function') return !!tpl.transparent;
    var o = {};
    tpl.options.forEach(function (def) { o[def.key] = def.default; });
    Object.keys(opts || {}).forEach(function (k) {
      if (opts[k] !== undefined && opts[k] !== null) o[k] = opts[k];
    });
    return !!tpl.transparent(o);
  }

  /* ---------- rendu achromatique ----------
   *
   * « Noir & blanc » ne peut pas être un filtre CSS sur l'aperçu : le filtre
   * ne suit pas dans `toBlob`, et l'export sortirait en couleur. Il ne peut
   * pas non plus être un `filter: grayscale()` sur le contexte canvas — tous
   * les moteurs ne le gèrent pas, et il s'appliquerait aussi aux photos qu'on
   * veut parfois garder en couleur.
   *
   * On convertit donc CHAQUE couleur à la source, au moment où un template
   * la pose. Trois conséquences voulues :
   *   · le papier crème devient un gris neutre — du crème n'est pas du noir
   *     et blanc, et le laisser aurait vidé le réglage de son sens ;
   *   · les exports PNG, vidéo et séquence sont achromatiques par
   *     construction, sans code supplémentaire ;
   *   · les couleurs d'origine ne sont jamais écrasées : on les traduit à
   *     l'affichage, donc revenir en couleur les restitue exactement.
   *
   * La luminance suit Rec. 709. Une conversion naïve (moyenne des trois
   * canaux) rendrait le rouille et le bleu au même gris : deux sorties
   * distinctes deviendraient indiscernables. Les templates multi-sorties
   * gardent en plus leurs formes et leurs styles de trait, qui ne dépendent
   * pas de la couleur.
   */
  function versGris(couleur) {
    if (couleur == null) return couleur;
    if (typeof couleur !== 'string') return couleur;   // dégradé, motif : intact
    var c = couleur.trim();

    var r, v, b, alpha = 1;
    var hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(c);
    if (hex) {
      var t = hex[1];
      if (t.length === 3) t = t[0] + t[0] + t[1] + t[1] + t[2] + t[2];
      var n = parseInt(t, 16);
      r = (n >> 16) & 255; v = (n >> 8) & 255; b = n & 255;
    } else {
      var m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(c);
      if (!m) return couleur;                          // mot-clé, autre syntaxe : intact
      r = parseFloat(m[1]); v = parseFloat(m[2]); b = parseFloat(m[3]);
      if (m[4] !== undefined) alpha = parseFloat(m[4]);
    }
    var y = Math.round(0.2126 * r + 0.7152 * v + 0.0722 * b);
    return alpha >= 1 ? 'rgb(' + y + ',' + y + ',' + y + ')'
                      : 'rgba(' + y + ',' + y + ',' + y + ',' + alpha + ')';
  }

  /* Les couleurs d'identité des planches multi-sorties ne peuvent PAS passer
   * par la luminance : le rouille tombe à 96 et le bleu à 87, soit neuf
   * niveaux d'écart — deux sorties deviennent indiscernables. On leur
   * substitue donc une rampe régulière, qui garde l'ordre d'arrivée et
   * étale les valeurs sur la plage lisible (35 à 205 : le noir pur et le
   * blanc pur disparaîtraient sur le papier comme sur l'encre).
   *
   * La bibliothèque elle-même n'est pas touchée : on traduit à l'affichage,
   * donc revenir en couleur restitue exactement les teintes choisies. */
  function rampeDeGris(n) {
    var out = [];
    for (var i = 0; i < n; i++) {
      var v = n <= 1 ? 120 : Math.round(35 + (205 - 35) * (i / (n - 1)));
      out.push('rgb(' + v + ',' + v + ',' + v + ')');
    }
    return out;
  }

  /* On intercepte les DEUX propriétés de couleur du contexte. Tout passe par
   * elles — remplissages, traits, textes — donc aucun template n'a à savoir
   * que le mode existe, y compris ceux écrits plus tard. */
  function installeAchromatique(ctx) {
    if (ctx.__gris) return;
    ctx.__gris = true;
    ['fillStyle', 'strokeStyle'].forEach(function (prop) {
      var desc = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(ctx), prop) ||
        Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, prop);
      if (!desc || !desc.set) return;
      Object.defineProperty(ctx, prop, {
        configurable: true,
        get: function () { return desc.get.call(ctx); },
        set: function (v) { desc.set.call(ctx, state.achromatique ? versGris(v) : v); }
      });
    });
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

      /* En surcouche, un aplat qui couvre toute la planche EST le fond :
       * on ne le peint pas, sinon le PNG exporté n'a plus d'alpha et il n'y
       * a plus rien à poser sur une photo. */
      fill: function (color) {
        if (state.transparent) return;
        ctx.save(); ctx.fillStyle = color; ctx.fillRect(0, 0, w, h); ctx.restore();
      },

      /* Un template qui peint son fond autrement qu'avec H.fill() — un
       * dégradé, par exemple — demande ceci avant de le faire. */
      surcouche: function () { return !!state.transparent; },

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
      /* Une photo est-elle disponible ici ? Un template qui compose un récit
       * doit pouvoir retirer une scène « photo » avant de la dessiner, pas
       * découvrir en cours de route que H.photo() a refusé. */
      hasPhoto: function () { return !!state.photo && !state.transparent; },

      photo: function (box) {
        var img = state.photo;
        if (!img || state.transparent) return false;
        box = box || { x: 0, y: 0, w: w, h: h };
        var r = Math.max(box.w / img.width, box.h / img.height);
        var dw = img.width * r, dh = img.height * r;
        ctx.save();
        ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
        /* Une image ne passe pas par fillStyle : le mode achromatique doit
         * la traiter explicitement, et seulement si l'utilisateur l'a
         * demandé — une affiche en noir et blanc sur une photo couleur est
         * une composition courante, pas une incohérence. */
        if (state.achromatique && state.photoGris && 'filter' in ctx) {
          ctx.filter = 'grayscale(1)';
        }
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
  var state = { photo: null, progress: 1, textFade: 1, library: [], historique: null, achromatique: false, photoGris: false };

  function setPhoto(img) { state.photo = img; }
  function setMinimal(v) { state.minimal = !!v; }
  /* Couleur ou noir & blanc, pour TOUT le studio : aperçu comme exports.
   * `photoGris` décide à part si une photo de fond suit — on veut parfois
   * une affiche achromatique sur une photo restée en couleur. */
  function setAchromatique(v, photo) {
    state.achromatique = !!v;
    state.photoGris = !!photo;
  }
  /* Les sorties chargées, dans l'ordre choisi. Les templates simples
   * l'ignorent ; ceux qui déclarent multi: true la lisent dans s.library. */
  function setLibrary(entrees) { state.library = entrees || []; }
  /* L'empreinte de l'historique d'exploration, déjà aplatie. Elle arrive par
   * ce chemin plutôt que d'être lue dans le template : IndexedDB est
   * asynchrone, et un draw() ne peut pas attendre. */
  function setHistorique(h) { state.historique = h || null; }
  /* La collection du musée, pour les mêmes raisons : IndexedDB est
   * asynchrone, le rendu ne l'est pas. */
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
    installeAchromatique(ctx);
    ctx.clearRect(0, 0, w, h);

    var o = {};
    tpl.options.forEach(function (def) { o[def.key] = def.default; });
    Object.keys(options || {}).forEach(function (k) {
      if (options[k] !== undefined && options[k] !== null) o[k] = options[k];
    });

    state.transparent = estTransparent(tpl, o);

    /* Les six planches Alpage ont leur propre menu « Fond » : quand le
     * reglage global demande une surcouche, on le leur transmet dans leur
     * propre vocabulaire plutot que de leur retirer le fond sous les pieds.
     * Leur voile — le degrade qui rend le texte lisible sur une photo —
     * continue ainsi de fonctionner. */
    if (supportSurcouche) {
      tpl.options.forEach(function (def) {
        if (def.key !== 'fond' || !def.choices) return;
        var aTransparent = def.choices.some(function (c) { return c[0] === 'transparent'; });
        if (aTransparent) o.fond = 'transparent';
      });
      transmetVoile(tpl, o, voileGlobal);
    }

    /* Le voile du moteur, pour les planches qui n'en declarent pas : AVANT le
     * template, puisqu'il se pose entre la photo et l'encre. */
    if (supportSurcouche && voileGlobal && voileGlobal !== 'aucun' &&
        !tpl.options.some(function (d) { return d.key === 'voile'; })) {
      poseVoile(ctx, w, h, voileGlobal);
    }

    var H = helpers(ctx, w, h, state);
    try {
      /* progress/fade sont aussi passés BRUTS. Les helpers en tiennent déjà
       * compte — c'est ce qui fait que tout template s'anime gratuitement —
       * mais une planche qui raconte une chronologie (le film) a besoin de
       * savoir OÙ l'on en est, pas seulement d'être tronquée. */
      /* En noir et blanc, la bibliothèque passe par la rampe : les teintes
       * d'origine restent intactes dans Library, on ne traduit que ce que
       * le template reçoit. */
      var biblio = state.library;
      if (state.achromatique && biblio.length) {
        var rampe = rampeDeGris(biblio.length);
        biblio = biblio.map(function (e, i) {
          var copie = {};
          Object.keys(e).forEach(function (k) { copie[k] = e[k]; });
          copie.couleur = rampe[i];
          return copie;
        });
      }
      tpl.draw({ ctx: ctx, w: w, h: h, a: activity, o: o, H: H, library: biblio,
                 historique: state.historique,
                 progress: state.progress, fade: state.textFade });
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
    template: template, all: all, get: get, chrono: chrono,
    estTransparent: estTransparent,
    render: render, exportPNG: exportPNG, setPhoto: setPhoto, setMinimal: setMinimal,
    setLibrary: setLibrary, setHistorique: setHistorique,
    setAchromatique: setAchromatique,
    setSupport: setSupport, setVoile: setVoile,
    versGris: versGris, rampeDeGris: rampeDeGris,
    setProgress: setProgress, fmt: fmt
  };
}(window));
