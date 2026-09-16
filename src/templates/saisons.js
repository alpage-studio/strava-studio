/* « Saisons » — le même endroit, plusieurs passages.
 *
 * Deux à quatre passages au même lieu, côte à côte, pour qu'on voie ce qui a
 * changé. C'est une série documentaire, pas un tableau de bord.
 *
 * La règle qui fait tout : LE CADRAGE ET L'ÉCHELLE SONT IDENTIQUES sur tous
 * les panneaux. Une fenêtre carrée, en mètres, centrée sur un point commun,
 * la même pour chacun. Recadrer chaque panneau sur sa propre trace donnerait
 * quatre vignettes séduisantes et incomparables — c'est le piège exact de ce
 * genre de planche.
 *
 * Ce qu'elle n'invente pas :
 *
 *   - AUCUNE SAISON N'EST DÉDUITE. On affiche la date, pas « automne » :
 *     septembre n'est pas la même saison à Fribourg et à Ushuaia, et une
 *     étiquette de saison est une affirmation sur le lieu autant que sur le
 *     temps. Le mot reste à écrire dans la légende, par toi.
 *   - AUCUNE MÉTÉO, AUCUNE VÉGÉTATION, AUCUNE CONDITION. Le GPX ne les
 *     contient pas.
 *   - UN PASSAGE QUI N'EST PAS PASSÉ LÀ LE DIT. Plutôt qu'un panneau vide
 *     dont on croirait que la sortie était courte.
 *
 * Limite assumée : le studio ne porte qu'UNE photo. Elle se pose donc sur un
 * passage choisi ; les autres gardent la vignette cartographique. Sans photo
 * du tout, la planche est complète.
 */
Studio.template({
  id: 'saisons',
  name: 'Saisons — le même endroit, plusieurs fois',
  famille: 'serie',
  multi: true,
  duree: 9000,
  chrono: 'lineaire',

  options: [
    { key: 'compo', type: 'select', label: 'Composition', default: 'auto', reflow: true,
      choices: [['auto', 'Automatique'],
                ['diptyque', 'Diptyque'],
                ['grille', 'Grille de quatre'],
                ['fondu', 'Fondu animé — un seul cadre']] },
    { key: 'lieu', type: 'select', label: 'Point de comparaison', default: 'commun', reflow: true,
      choices: [['commun', 'Le lieu le plus partagé'],
                ['depart', 'Le départ de la première sortie'],
                ['sommet', 'Le point culminant de la première'],
                ['manuel', 'Une position que je choisis']] },
    { key: 'position', type: 'range', label: 'Position sur la 1re (%)', default: 50, min: 0, max: 100, step: 1 },
    { key: 'rayon', type: 'range', label: 'Fenêtre (m)', default: 900, min: 150, max: 4000, step: 50 },
    { key: 'legendes', type: 'text', label: 'Légendes (séparées par ;)', default: '' },
    { key: 'photoSur', type: 'range', label: 'Photo sur le passage n°', default: 0, min: 0, max: 4, step: 1 },
    { key: 'fond', type: 'color', label: 'Fond', default: '#111113' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'chiffres', type: 'toggle', label: 'Afficher les chiffres', default: true },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ],

  inert: function (a, vals) {
    var morts = [];
    if (!vals || vals.lieu !== 'manuel') morts.push('position');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.5), hair = melange(ink, 0.16);

    var tous = (s.library || []).filter(function (e) {
      return e.activity && e.activity.track && e.activity.track.some(function (p) { return p.lat != null; });
    });
    var passages = tous.slice(0, 4);

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(7) });

    if (passages.length < 2) {
      H.text('Charge deux à quatre sorties', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('cette planche compare des passages au même endroit',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- le point de comparaison ---------- */
    var centre = pointDeComparaison();
    var rayon = Math.max(60, Number(o.rayon) || 900);   // demi-côté de la fenêtre, en mètres

    /* ---------- composition ---------- */
    var compo = o.compo;
    if (compo === 'auto') compo = passages.length <= 2 ? 'diptyque' : 'grille';

    var titre = String(o.titre || '').trim() || 'Le même endroit';
    H.text(titre, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(passages.length + ' passages', g.right, g.top + u(3.6),
           H.t('label', { color: faint, align: 'right' }));

    var haut = g.top + u(9);
    var bas = g.bottom - u(6);
    var zone = { x: g.left, y: haut, w: g.width, h: bas - haut };

    if (compo === 'fondu') fondu();
    else grille(compo === 'diptyque' ? 1 : 2);

    /* la fenêtre est écrite : sans elle, on ne sait pas à quoi on compare */
    H.text('FENÊTRE DE ' + Math.round(rayon * 2) + ' M DE CÔTÉ · MÊME CADRAGE SUR TOUS LES PANNEAUX',
           g.left, g.bottom, H.t('label', { color: faint, maxWidth: g.width }));

    /* ================= compositions ================= */

    /* Le panneau est un CARRÉ collé à sa légende, et le bloc est centré dans
     * sa case. Le premier jet plaçait le carré en haut et la légende tout en
     * bas de la case : sur une story, cela creusait vingt pour cent de vide
     * entre une image et le texte qui la nomme. */
    function grille(cols) {
      var rows = Math.ceil(passages.length / cols);
      var cw = zone.w / cols, chh = zone.h / rows;
      var legende = o.chiffres ? u(11) : u(7);
      var cote = Math.min(cw - u(3), chh - legende - u(3));
      var reste = passages.length % cols;
      var decale = reste ? (cols - reste) * cw / 2 : 0;
      var derniere = Math.floor((passages.length - 1) / cols);

      passages.forEach(function (e, i) {
        var rangee = Math.floor(i / cols);
        var cx = zone.x + (i % cols) * cw + (rangee === derniere ? decale : 0);
        var cy = zone.y + rangee * chh;
        var ox = cx + (cw - cote) / 2;
        var oy = cy + (chh - cote - legende) / 2;
        panneau(e, i, { x: ox, y: oy, w: cote, h: cote }, 1);
        pied(e, i, ox, oy + cote + u(5), cote);
      });
    }

    /* Le fondu : un seul cadre, les passages s'y succèdent. C'est la même
     * fenêtre, donc le fondu montre littéralement ce qui a bougé. */
    function fondu() {
      var n = passages.length;
      var pos = Math.max(0, Math.min(0.9999, s.progress)) * n;
      var i = Math.floor(pos), local = pos - i;
      var boite = { x: zone.x, y: zone.y, w: zone.w, h: zone.h - u(12) };
      var SEUIL = 0.7;
      if (local > SEUIL && i < n - 1) {
        var k = (local - SEUIL) / (1 - SEUIL);
        dessine(i, 1 - k); dessine(i + 1, k);
      } else {
        dessine(i, 1);
      }
      function dessine(j, alpha) {
        ctx.save(); ctx.globalAlpha = alpha;
        panneau(passages[j], j, boite, alpha);
        pied(passages[j], j, zone.x, zone.y + zone.h - u(5), zone.w);
        ctx.restore();
      }
    }

    /* ================= un panneau ================= */

    function panneau(e, i, boite, alpha) {
      var cote = Math.min(boite.w, boite.h);
      var ox = boite.x + (boite.w - cote) / 2, oy = boite.y + (boite.h - cote) / 2;

      // cadre : c'est lui qui dit « même fenêtre »
      ctx.save();
      ctx.strokeStyle = hair; ctx.lineWidth = u(0.12);
      ctx.strokeRect(ox, oy, cote, cote);
      ctx.restore();

      /* La photo, si elle est affectée à CE passage. Elle occupe le cadre,
       * la trace se dessine par-dessus : la comparaison reste possible. */
      if (Number(o.photoSur) === i + 1 && H.hasPhoto()) {
        ctx.save();
        ctx.beginPath(); ctx.rect(ox, oy, cote, cote); ctx.clip();
        H.photo({ x: ox, y: oy, w: cote, h: cote });
        ctx.fillStyle = 'rgba(0,0,0,.35)';
        ctx.fillRect(ox, oy, cote, cote);
        ctx.restore();
      }

      var segments = portionDansFenetre(e.activity, centre, rayon);
      if (!segments.length) {
        H.text('ne passe pas ici', ox + cote / 2, oy + cote / 2,
               H.t('label', { color: faint, align: 'center' }));
        return;
      }

      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, cote, cote); ctx.clip();
      // la croix du centre : le même point sur chaque panneau
      ctx.strokeStyle = melange(ink, 0.22); ctx.lineWidth = u(0.1);
      ctx.beginPath();
      ctx.moveTo(ox + cote / 2 - u(1.4), oy + cote / 2); ctx.lineTo(ox + cote / 2 + u(1.4), oy + cote / 2);
      ctx.moveTo(ox + cote / 2, oy + cote / 2 - u(1.4)); ctx.lineTo(ox + cote / 2, oy + cote / 2 + u(1.4));
      ctx.stroke();

      ctx.strokeStyle = e.couleur;
      ctx.lineWidth = Math.max(u(0.35), cote * 0.012);
      ctx.lineJoin = ctx.lineCap = 'round';
      /* Chaque passage dans la fenêtre est un trait à part. Relier deux
       * entrées séparées par une heure de sortie ailleurs dessinerait un
       * chemin qui n'a jamais existé. */
      ctx.beginPath();
      segments.forEach(function (sg) {
        var vus = H.progressCount(sg.length);
        sg.forEach(function (p, k) {
          if (k >= vus) return;
          var X = ox + (0.5 + p.dx / (2 * rayon)) * cote;
          var Y = oy + (0.5 - p.dy / (2 * rayon)) * cote;
          if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
        });
      });
      ctx.stroke();
      ctx.restore();
      void alpha;
    }

    function pied(e, i, x, y, larg) {
      var a = e.activity;
      var leg = (String(o.legendes || '').split(';')[i] || '').trim();
      H.text(leg || dateLisible(a.date), x, y,
             H.t('title', { size: 3.4, color: ink, maxWidth: larg }));
      if (o.chiffres) {
        var bouts = [];
        if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' km');
        if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' m');
        H.text(bouts.join(' · '), x, y + u(4),
               H.t('label', { color: faint, maxWidth: larg }));
      }
      if (leg && a.date) {
        H.text(dateLisible(a.date), x + larg, y,
               H.t('label', { color: faint, align: 'right' }));
      }
    }

    /* La date, sans nommer de saison. */
    function dateLisible(d) {
      if (!d) return 'Sans date';
      return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    /* ================= géométrie ================= */

    /* Le lieu le plus partagé : on cherche le point de la première sortie
     * dont le voisinage contient le plus d'AUTRES sorties. « Le plus de
     * points » serait trompeur — une sortie qui tourne longtemps au même
     * endroit gagnerait toujours. Ici chaque sortie compte pour une. */
    function pointDeComparaison() {
      var ref = passages[0].activity.track.filter(function (p) { return p.lat != null; });
      if (o.lieu === 'depart') return ref[0];
      if (o.lieu === 'manuel') {
        return ref[Math.round(Math.max(0, Math.min(1, (Number(o.position) || 0) / 100)) * (ref.length - 1))];
      }
      if (o.lieu === 'sommet') {
        var best = ref[0];
        ref.forEach(function (p) { if (p.ele != null && (best.ele == null || p.ele > best.ele)) best = p; });
        return best;
      }
      var meilleur = ref[0], score = -1;
      var pas = Math.max(1, Math.floor(ref.length / 160));   // 160 essais suffisent
      for (var i = 0; i < ref.length; i += pas) {
        var c = 0;
        for (var j = 1; j < passages.length; j++) {
          if (passeA(passages[j].activity, ref[i], Number(o.rayon) || 900)) c++;
        }
        if (c > score) { score = c; meilleur = ref[i]; }
      }
      return meilleur;
    }

    function passeA(act, centre, r) {
      var t = act.track;
      for (var i = 0; i < t.length; i += 3) {
        if (t[i].lat == null) continue;
        if (metres(t[i], centre) <= r) return true;
      }
      return false;
    }

    /* Portion de la trace tombant dans la fenêtre, en mètres relatifs au
     * centre. On garde les coupures : deux passages séparés dans la fenêtre
     * ne doivent pas être reliés par un trait qui n'a pas eu lieu. */
    function portionDansFenetre(act, centre, r) {
      var segments = [], courant = null;
      var cosLat = Math.cos(centre.lat * Math.PI / 180);
      act.track.forEach(function (p) {
        if (p.lat == null) return;
        var dx = (p.lon - centre.lon) * cosLat * 111320;
        var dy = (p.lat - centre.lat) * 110540;
        var dedans = Math.abs(dx) <= r * 1.08 && Math.abs(dy) <= r * 1.08;
        if (!dedans) { courant = null; return; }
        if (!courant) { courant = []; segments.push(courant); }
        courant.push({ dx: dx, dy: dy });
      });
      return segments.filter(function (sg) { return sg.length > 1; });
    }

    function metres(a, b) {
      var R = 6371000, r = Math.PI / 180;
      var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
      var x = Math.sin(dLat / 2), y = Math.sin(dLon / 2);
      var c = x * x + Math.cos(a.lat * r) * Math.cos(b.lat * r) * y * y;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(c)));
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
