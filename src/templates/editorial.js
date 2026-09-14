/* Template « Éditorial » — carte encartée, grille stricte, échelle typo.
 *
 * C'est la démonstration du socle : aucune position n'est un nombre magique,
 * tout sort de la grille (g.x, g.y) et tout style sort des rôles (H.t).
 * Duplique ce fichier pour tes propres compositions.
 */
Studio.template({
  id: 'editorial',
  name: 'Éditorial',

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#E28A2B' },
    { key: 'carte', type: 'color', label: 'Carte', default: '#FBFAF7' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#121212' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E5502D' },
    { key: 'serie', type: 'select', label: 'Graphique', default: 'altitude',
      choices: [['altitude', 'Profil d’altitude'], ['puissance', 'Puissance (3 s)'],
                ['allure', 'Allure par km'], ['fc', 'Fréquence cardiaque'],
                ['aucun', 'Aucun']] },
    { key: 'photo', type: 'toggle', label: 'Photo en fond', default: false }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var gris = alpha(o.encre, 0.45);

    /* ---------- fond ---------- */
    if (o.photo && H.photo()) {
      ctx.fillStyle = alpha('#000000', 0.15);
      ctx.fillRect(0, 0, w, h);
    } else {
      H.fill(o.fond);
    }

    /* ---------- carte ---------- */
    var card = H.card(
      { x: u(4.5), y: u(4.5), w: w - u(9), h: h - u(9) },
      { fill: o.carte, radius: u(2.4), shadow: 'rgba(0,0,0,.28)', shadowBlur: u(5) }
    );

    /* ---------- grille, calée sur la carte ---------- */
    var g = H.grid({ box: card, margin: u(6), cols: 6, gutter: u(1.6) });
    var CH = g.height; // hauteur utile : toutes les hauteurs s'y rapportent

    /* ---------- bandeau de tête ---------- */
    H.text(a.name, g.left, g.top + u(3.6), H.t('title', {
      color: o.encre, maxWidth: g.w(4)
    }));

    /* ---------- pied, posé en premier : il ancre le bas ---------- */
    /* Tout le reste coule depuis le haut et s'arrête ici. Poser l'ancre avant
     * de couler évite le défaut classique : des blocs qui se chevauchent
     * dès qu'on change de format. */
    var footY = g.bottom - u(1);
    var footTop = footY - u(11);

    /* ---------- chiffre héros ---------- */
    var y = g.top + CH * 0.24;
    H.text('distance totale', g.left, y, H.t('label', { color: gris }));

    var num = H.fmt.km(a.distance_km);
    // le corps du chiffre se règle sur la place réelle, unité comprise
    var heroU = 17;
    var probe = H.t('hero', { size: heroU });
    var place = g.width * 0.82;
    var numW = H.measure(num, probe);
    if (numW > place) { heroU = heroU * place / numW; }
    var heroStyle = H.t('hero', { size: heroU, color: o.encre });
    var heroBase = y + heroStyle.size * 0.95;

    H.text(num, g.left, heroBase, heroStyle);
    // l'unité collée au chiffre, à un tiers du corps : le geste éditorial
    numW = H.measure(num, heroStyle);
    H.text('KM', g.left + numW + u(0.8), heroBase, H.t('hero', {
      size: heroU * 0.32, color: alpha(o.encre, 0.75)
    }));

    /* ---------- deux champs secondaires ---------- */
    var rowY = heroBase + CH * 0.055;
    var fieldU = 5;
    H.field('en mouvement', H.fmt.duration(a.duration_s), g.x(0), rowY,
      { color: o.encre, labelColor: gris, size: fieldU, maxWidth: g.w(2) });
    H.field('vitesse moyenne', H.fmt.speed(a.speed_kmh) + ' km/h',
      g.x(3), rowY, { color: o.encre, labelColor: gris, size: fieldU, maxWidth: g.w(2) });
    var rowBottom = rowY + u(fieldU) * 0.98;

    /* ---------- graphique : il occupe ce qui reste ---------- */
    if (o.serie !== 'aucun') {
      var serie = pick(a, o.serie);
      if (serie.values.length > 1) {
        var top = rowBottom + CH * 0.08;
        var box = {
          x: g.left, y: top, w: g.width,
          h: Math.max(CH * 0.12, footTop - u(7) - top)
        };
        var peak = serie.values.indexOf(
          serie.invert ? Math.min.apply(null, serie.values) : Math.max.apply(null, serie.values)
        );

        H.bars(serie.values, box, {
          color: alpha(o.encre, 0.55),
          peak: peak,
          peakColor: o.accent,
          invert: serie.invert,
          min: serie.min          // la puissance se lit depuis 0 W, pas depuis son minimum
        });

        // une seule valeur annotée, au-dessus de la barre concernée
        var bx = box.x + (peak + 0.5) * (box.w / serie.values.length);
        H.text(serie.peakLabel, bx, box.y - u(1.6), H.t('label', {
          color: o.accent, align: bx > box.x + box.w * 0.9 ? 'right' : 'center'
        }));
        H.rule(g.left, box.y + box.h + u(0.6), g.right, { color: alpha(o.encre, 0.16) });
        // pas de légende sous le graphique : le lecteur voit ce que c'est
      }
    }

    /* ---------- pied : dénivelé ---------- */
    H.rule(g.left, footTop, g.right, { color: alpha(o.encre, 0.16) });
    H.text('dénivelé positif', g.left, footY - u(7.4), H.t('label', { color: gris }));
    H.text(H.fmt.int(a.elev_gain_m) + ' M', g.left, footY, H.t('value', {
      size: 8, color: o.encre
    }));
    if (a.hr_avg) {
      H.text(a.hr_avg + ' BPM', g.right, footY, H.t('value', {
        size: 4.6, color: alpha(o.encre, 0.5), align: 'right'
      }));
    }

    /* ================= utilitaires locaux ================= */

    // '#121212' + 0.45  ->  'rgba(18,18,18,.45)'
    function alpha(hex, k) {
      var n = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + k + ')';
    }

    // Ramène n'importe quelle série à ~56 barres : au-delà, elles se collent.
    function resample(values, n) {
      if (values.length <= n) return values.slice();
      var out = [], step = values.length / n;
      for (var i = 0; i < n; i++) {
        var a0 = Math.floor(i * step), b0 = Math.max(a0 + 1, Math.floor((i + 1) * step));
        var slice = values.slice(a0, b0).filter(function (v) { return v != null; });
        out.push(slice.length ? slice.reduce(function (x, y) { return x + y; }, 0) / slice.length : null);
      }
      return out;
    }

    /* L'étiquette du pic doit valoir CE QUE MONTRE la barre qu'elle
     * surmonte. Afficher le maximum réel de la série au-dessus d'une barre
     * qui est une moyenne de 90 secondes, c'est annoter une valeur qui
     * n'est pas là — le lecteur croit lire la barre. */
    function etiquettePic(values, unite) {
      var v = values.filter(function (x) { return x != null && isFinite(x); });
      return v.length ? Math.round(Math.max.apply(null, v)) + unite : '';
    }

    function pick(act, kind) {
      if (kind === 'allure') {
        var p = act.splits.map(function (sp) { return sp.pace_s; });
        var best = Math.min.apply(null, p.filter(function (v) { return v; }));
        return {
          values: p, invert: true,
          caption: 'allure par kilomètre',
          peakLabel: H.fmt.pace(best) + '/KM'
        };
      }
      if (kind === 'puissance') {
        /* Sans capteur, on ne montre pas un graphique vide : on retombe
         * sur l'altitude, que toute sortie possède. */
        if (!act.has_power) return pick(act, 'altitude');
        var w = resample(act.power.data.map(function (p) { return p.w; }), 56);
        return {
          values: w, invert: false, min: 0,
          peakLabel: etiquettePic(w, ' W')
        };
      }
      if (kind === 'fc') {
        var hr = resample(act.track.map(function (t) { return t.hr; }), 56);
        return {
          values: hr, invert: false,
          caption: 'fréquence cardiaque',
          peakLabel: etiquettePic(hr, ' BPM')
        };
      }
      var ele = resample(act.track.map(function (t) { return t.ele; }), 56);
      return {
        values: ele, invert: false,
        caption: 'profil d’altitude',
        peakLabel: etiquettePic(ele, ' M')
      };
    }
  }
});
