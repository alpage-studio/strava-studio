/* « Médaillon » — une fenêtre sur le lieu.
 *
 * Un grand cercle occupe les deux tiers de la largeur. La trace le traverse :
 * pleine à l'intérieur, atténuée à l'extérieur, mais JAMAIS coupée au bord.
 * Le titre suit un arc, un cartouche rassemble la date, la distance, le
 * dénivelé et l'échelle.
 *
 * ── Le fond de terrain : pourquoi il n'y en a pas ────────────────────
 *
 * Le brief demande eau, relief et chemins secondaires. Ils supposent une
 * source de données cartographiques, et le studio n'en a aucune. Deux
 * raisons de ne pas en ajouter une à la légère, et la seconde est
 * rédhibitoire :
 *
 *   1. De vraies courbes de niveau demandent un modèle de terrain. Les
 *      fabriquer à partir des seules altitudes du GPX donnerait un relief
 *      inventé partout où le parcours n'est pas passé — c'est-à-dire
 *      presque partout dans le cercle.
 *
 *   2. Une tuile chargée depuis un autre domaine SOUILLE le canvas. Après
 *      quoi `toBlob` et `toDataURL` lèvent une SecurityError : plus aucun
 *      export ne fonctionne, ni PNG, ni vidéo, ni séquence. Le studio
 *      perdrait sa fonction principale pour gagner un décor.
 *
 * Le médaillon est donc en « tracé seul », et il le dit. Ce qu'il montre en
 * plus vient des coordonnées elles-mêmes : un GRATICULE — les vrais
 * méridiens et parallèles — et une échelle. C'est de la cartographie, et
 * c'est vrai.
 *
 * Si une source de terrain est branchée un jour, elle devra être
 * `crossOrigin` et servie avec les bons en-têtes, et son attribution devra
 * figurer dans l'export comme à l'écran.
 */
Studio.template({
  id: 'medaillon',
  name: 'Médaillon — une fenêtre sur le lieu',
  famille: 'affiche',
  /* La transparence est une OPTION : le médaillon s'exporte sur papier ou en
   * surcouche, et c'est la planche la plus naturelle à poser sur une photo —
   * la fenêtre circulaire s'ouvre alors littéralement sur l'image. */
  transparent: function (o) { return o.fond === 'transparent'; },

  options: [
    { key: 'palette', type: 'select', label: 'Palette', default: 'mineral', reflow: true,
      choices: [['mineral', 'Minéral — papier clair'],
                ['nocturne', 'Nocturne — fond charbon']] },
    { key: 'cadrage', type: 'range', label: 'Cadrage', default: 100, min: 45, max: 260, step: 5 },
    { key: 'decalage', type: 'range', label: 'Décalage horizontal', default: 0, min: -50, max: 50, step: 5 },
    { key: 'decalageY', type: 'range', label: 'Décalage vertical', default: 0, min: -50, max: 50, step: 5 },
    { key: 'graticule', type: 'range', label: 'Graticule', default: 35, min: 0, max: 100, step: 5 },
    /* --- avancé --- */
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'arc', type: 'toggle', label: 'Titre sur l’arc', default: true },
    { key: 'cartouche', type: 'toggle', label: 'Cartouche', default: true },
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A54F37' },
    /* Le médaillon garde SA palette (minéral / nocturne), qui décide de
     * l'encre : on n'ajoute donc que le choix du fond et le voile, pas les
     * quatre réglages du socle. */
    { key: 'fond', type: 'select', label: 'Fond', default: 'papier', reflow: true,
      choices: [['papier', 'Papier — affiche'],
                ['transparent', 'Transparent — à poser sur une photo']] },
    { key: 'voile', type: 'select', label: 'Voile (surcouche)', default: 'aucun',
      choices: [['aucun', 'Aucun'],
                ['bas', 'Depuis le bas'],
                ['haut', 'Depuis le haut'],
                ['centre', 'Autour du centre']] }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var nocturne = o.palette === 'nocturne';
    var papier = nocturne ? '#191B18' : '#F2EFE6';
    var encre = nocturne ? '#E8E4D9' : '#242820';
    var accent = o.accentC;
    var faint = melange(encre, 0.42), hair = melange(encre, 0.16);

    /* Papier ou surcouche : le même dessin, seul le fond change. Le médaillon
     * est même la planche la plus naturelle à poser sur une photo — la
     * fenêtre circulaire s'ouvre alors littéralement sur l'image. */
    var enSurcouche = o.fond === 'transparent';
    Alpage.socle(H, { fond: o.fond, voile: o.voile, papier: papier, encre: encre,
                      grain: !enSurcouche });
    if (!enSurcouche) H.grain(nocturne ? 0.008 : 0.004);
    var g = H.grid({ cols: 6, margin: u(8) });

    var t = (a.track || []).filter(function (p) { return p.lat != null; });
    if (t.length < 3) {
      H.text('Charge une sortie avec une trace', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('le médaillon est une fenêtre sur le lieu parcouru',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint }));
      return;
    }

    /* ---------- le cercle ---------- */
    /* Deux tiers de la LARGEUR, quel que soit le format : c'est ce qui fait
     * qu'une story, un carré et un paysage restent la même affiche. */
    var rayon = Math.min(w * 0.335, (g.height - u(30)) * 0.5);
    var cx = g.left + g.width / 2;
    var cy = g.top + u(9) + rayon;

    /* ---------- la projection ---------- */
    var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
    t.forEach(function (p) {
      if (p.lat < laMin) laMin = p.lat; if (p.lat > laMax) laMax = p.lat;
      if (p.lon < loMin) loMin = p.lon; if (p.lon > loMax) loMax = p.lon;
    });
    var laC = (laMin + laMax) / 2, loC = (loMin + loMax) / 2;
    var cos = Math.cos(laC * Math.PI / 180);
    var etendue = Math.max((loMax - loMin) * cos * 111320, (laMax - laMin) * 110540) || 1000;

    /* Le cadrage : 100 % fait tenir la sortie dans le cercle. Au-delà on
     * s'approche, en dessous on prend du champ — le parcours déborde alors,
     * ce qui est le propos de la planche. */
    var k = (rayon * 1.84) / etendue * (100 / Math.max(45, Number(o.cadrage) || 100));
    var ox = cx + (Number(o.decalage) || 0) / 100 * rayon;
    var oy = cy + (Number(o.decalageY) || 0) / 100 * rayon;
    function proj(p) {
      return { x: ox + (p.lon - loC) * cos * 111320 * k,
               y: oy - (p.lat - laC) * 110540 * k };
    }

    /* ---------- l'intérieur du cercle ---------- */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2);
    /* En surcouche, le disque reste un VOILE : un aplat opaque reboucherait
     * l'alpha et la fenêtre ne s'ouvrirait plus sur rien. */
    ctx.fillStyle = enSurcouche ? melange(encre, 0.10)
                  : (nocturne ? melange(encre, 0.05) : melange(encre, 0.035));
    ctx.fill();
    ctx.restore();

    if (o.graticule > 0) graticule();

    /* ---------- la trace ---------- */
    var reveles = H.progressCount(t.length);
    // dehors : atténuée, mais entière et à la même échelle
    traceur(false, melange(accent, 0.3), u(0.3));
    // dedans : pleine
    traceur(true, accent, u(0.62));

    function traceur(dedans, couleur, largeur) {
      ctx.save();
      if (dedans) { ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2); ctx.clip(); }
      ctx.beginPath();
      for (var i = 0; i < Math.min(t.length, reveles); i++) {
        var q = proj(t[i]);
        if (i === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
      }
      ctx.strokeStyle = couleur;
      ctx.lineWidth = largeur;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // départ et arrivée, à l'intérieur seulement
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2); ctx.clip();
    [[t[0], enSurcouche ? 'rgba(0,0,0,0)' : papier],
     [t[Math.min(t.length, reveles) - 1] || t[0], accent]].forEach(function (d, i) {
      var q = proj(d[0]);
      ctx.beginPath(); ctx.arc(q.x, q.y, u(0.9), 0, Math.PI * 2);
      ctx.fillStyle = d[1]; ctx.fill();
      ctx.strokeStyle = accent; ctx.lineWidth = u(0.22); ctx.stroke();
    });
    ctx.restore();

    /* le bord : extrêmement fin, presque absent */
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2);
    ctx.strokeStyle = melange(encre, 0.18);
    ctx.lineWidth = u(0.08);
    ctx.stroke();
    ctx.restore();

    /* ---------- le titre sur l'arc ---------- */
    var titre = String(o.titre || '').trim() || a.name || 'Sortie';
    if (o.arc) titreArc(titre);
    else H.text(titre, g.left, cy + rayon + u(9), H.t('title', { size: 5, color: encre, maxWidth: g.width }));

    /* ---------- le cartouche ---------- */
    if (o.cartouche) cartouche();

    /* ================= graticule ================= */

    /* Les vrais méridiens et parallèles, aux minutes rondes. C'est la seule
     * information cartographique que le studio possède réellement : elle
     * vient des coordonnées, pas d'un fond acheté. */
    function graticule() {
      var alpha = (Number(o.graticule) || 0) / 100;
      // un pas en minutes d'arc qui donne 3 à 6 lignes dans le cercle
      var etendueDeg = (rayon * 2 / k) / 110540;
      var pas = [0.5, 1, 2, 5, 10, 20, 30, 60].map(function (m) { return m / 60; })
        .filter(function (d) { return etendueDeg / d <= 7; })[0] || 1;

      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2); ctx.clip();
      ctx.strokeStyle = melange(encre, 0.22 * alpha);
      ctx.lineWidth = u(0.06);
      ctx.setLineDash([u(0.5), u(0.5)]);
      var i;
      for (i = -8; i <= 8; i++) {
        var lat = Math.round(laC / pas) * pas + i * pas;
        var y = oy - (lat - laC) * 110540 * k;
        if (Math.abs(y - cy) > rayon) continue;
        ctx.beginPath(); ctx.moveTo(cx - rayon, y); ctx.lineTo(cx + rayon, y); ctx.stroke();
      }
      for (i = -8; i <= 8; i++) {
        var lon = Math.round(loC / pas) * pas + i * pas;
        var x = ox + (lon - loC) * cos * 111320 * k;
        if (Math.abs(x - cx) > rayon) continue;
        ctx.beginPath(); ctx.moveTo(x, cy - rayon); ctx.lineTo(x, cy + rayon); ctx.stroke();
      }
      ctx.restore();
    }

    /* ================= titre sur l'arc ================= */

    /* Le texte suit le haut du cercle. Au-delà d'une longueur d'arc, il
     * repasse en ligne droite sous le médaillon : un titre long étiré sur un
     * arc devient illisible bien avant d'en faire le tour. */
    function titreArc(str) {
      var style = H.t('title', { size: 3.6, color: encre });
      var taille = style.size;
      var larg = H.measureWith(str, style, taille);
      var rArc = rayon + u(5.4);
      var arcDispo = Math.PI * 0.82 * rArc;     // un peu moins d'un demi-tour

      if (larg > arcDispo) {
        H.text(str, cx, cy + rayon + u(9),
               H.t('title', { size: 3.6, color: encre, align: 'center', maxWidth: g.width }));
        return;
      }
      ctx.save();
      ctx.fillStyle = encre;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'alphabetic';
      ctx.font = '600 ' + taille + 'px ' + H.FONT;
      var angleTotal = larg / rArc;
      var depart = -Math.PI / 2 - angleTotal / 2;
      var pos = 0;
      for (var i = 0; i < str.length; i++) {
        var c = str[i];
        var lc = ctx.measureText(c).width;
        var ang = depart + (pos + lc / 2) / rArc;
        ctx.save();
        ctx.translate(cx + Math.cos(ang) * rArc, cy + Math.sin(ang) * rArc);
        ctx.rotate(ang + Math.PI / 2);
        ctx.fillText(c, 0, 0);
        ctx.restore();
        pos += lc;
      }
      ctx.restore();
    }

    /* ================= cartouche ================= */

    function cartouche() {
      var y = g.bottom;
      H.rule(g.left, y - u(11), g.right, { color: hair });

      var champs = [];
      if (a.date) champs.push(['date', a.date.toLocaleDateString('fr-CH',
        { day: '2-digit', month: '2-digit', year: 'numeric' })]);
      if (a.distance_km != null) champs.push(['distance', H.fmt.km(a.distance_km, 1) + ' km']);
      if (a.elev_gain_m != null) champs.push(['dénivelé', Math.round(a.elev_gain_m) + ' m']);
      /* Pas de « 1 cm ≈ … » : la taille physique du tirage n'est pas fixée,
       * et l'affirmation serait fausse dès qu'on imprime autrement. Une
       * BARRE graphique, elle, reste juste quelle que soit la taille — c'est
       * la raison pour laquelle les cartes en portent une. */
      champs.slice(0, 4).forEach(function (c, i) {
        H.field(c[0], c[1], g.left + i * (g.width / Math.min(4, champs.length)), y - u(6.6), {
          color: encre, labelColor: faint, size: 3.6,
          maxWidth: g.width / Math.min(4, champs.length) - u(2)
        });
      });

      /* Sur l'image : deux mots. Le détail de configuration appartient à
       * l'interface, pas à l'affiche — « aucune source de terrain n'est
       * configurée » est une phrase de logiciel, et elle traversait toute
       * la largeur du tirage. */
      H.text('TRACÉ SEUL', g.left, y, H.t('label', { color: melange(encre, 0.4) }));

      /* La barre d'échelle, à droite du cartouche. */
      var metresParPixel = 1 / k;
      var cible = metresParPixel * g.width * 0.22;
      var rond = [100, 200, 500, 1000, 2000, 5000, 10000, 20000]
        .filter(function (v) { return v >= cible; })[0] || 20000;
      var lp = rond / metresParPixel;
      if (lp < g.width * 0.45) {
        ctx.save();
        ctx.strokeStyle = melange(encre, 0.45);
        ctx.lineWidth = u(0.11);
        var bx = g.right - lp, by = y - u(1.2);
        ctx.beginPath();
        ctx.moveTo(bx, by); ctx.lineTo(g.right, by);
        ctx.moveTo(bx, by - u(0.7)); ctx.lineTo(bx, by + u(0.7));
        ctx.moveTo(g.right, by - u(0.7)); ctx.lineTo(g.right, by + u(0.7));
        ctx.stroke();
        ctx.restore();
        H.text(rond >= 1000 ? (rond / 1000) + ' KM' : rond + ' M',
               g.right, y + u(2.6), H.t('label', { color: faint, align: 'right' }));
      }
    }

    function melange(hex, kk) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + kk + ')';
    }
  }
});
