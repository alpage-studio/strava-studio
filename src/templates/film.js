/* « Film de sortie » — un générique de quinze secondes, en trois actes.
 *
 * C'est un template comme les autres, et c'est tout l'intérêt : il hérite
 * sans une ligne de plus des formats, des collections, de l'export PNG, de
 * l'export vidéo et de la séquence PNG. Ce qu'il ajoute, c'est une
 * CHRONOLOGIE : il déclare `chrono: 'lineaire'` et `duree`, et lit
 * `s.progress` comme une position dans son récit plutôt que comme une
 * fraction de tracé révélé.
 *
 * L'aperçu animé et l'export lisent la même horloge (Studio.chrono) : ce
 * qu'on regarde est exactement ce qui s'enregistre.
 *
 * Ce que le film n'invente pas :
 *
 *   - LE MOMENT FORT EST EXPLICABLE. Point culminant, plus longue
 *     ascension, ou une position choisie à la main. La légende dit lequel et
 *     donne ses chiffres. Aucun « souvenir », aucune émotion déduite : le
 *     film ne sait pas si la sortie était belle.
 *   - LES TEXTES SONT À TOI. Trois champs libres ; ce qui est proposé par
 *     défaut est factuel (le nom de la sortie, la mesure du moment fort).
 *   - LE BILAN S'ARRÊTE À TROIS CHIFFRES. Un quatrième ferait un tableau de
 *     bord, pas une fin de film.
 *
 * Limite assumée : le studio ne porte qu'UNE photo à la fois. On la place
 * donc sur une scène choisie, pas une par scène. Sans photo, le film est
 * complet — la scène « portrait » se retire toute seule du storyboard.
 */
Studio.template({
  id: 'film',
  name: 'Film de sortie — 15 s, trois actes',
  famille: 'affiche',
  duree: 15000,
  chrono: 'lineaire',

  options: [
    { key: 'scenes', type: 'order', label: 'Storyboard',
      default: 'ouverture,fort,arrivee,bilan', min: 3, max: 5,
      items: [['ouverture', 'Départ — le tracé se dessine'],
              ['fort', 'Moment fort'],
              ['portrait', 'Photo plein cadre'],
              ['arrivee', 'Arrivée'],
              ['bilan', 'Bilan — trois chiffres']] },
    { key: 'moment', type: 'select', label: 'Moment fort', default: 'sommet', reflow: true,
      choices: [['sommet', 'Le point culminant'],
                ['ascension', 'La plus longue ascension'],
                ['choisi', 'Une position que je choisis']] },
    { key: 'position', type: 'range', label: 'Position (%)', default: 50, min: 0, max: 100, step: 1 },
    { key: 't1', type: 'text', label: 'Texte — départ', default: '' },
    { key: 't2', type: 'text', label: 'Texte — moment fort', default: '' },
    { key: 't3', type: 'text', label: 'Texte — arrivée', default: '' },
    { key: 'photoSur', type: 'select', label: 'Photo sur', default: 'portrait',
      choices: [['portrait', 'La scène photo'],
                ['fort', 'Le moment fort'],
                ['aucune', 'Nulle part']] },
    { key: 'fond', type: 'color', label: 'Fond', default: '#0B0B0D' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E5502D' }
  ],

  inert: function (a, vals) {
    var morts = [];
    if (!vals || vals.moment !== 'choisi') morts.push('position');
    return morts;
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.5);
    var pts = (a.route && a.route.pts) || [];

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(9) });

    /* ---------- le storyboard effectif ---------- */
    var dispo = { ouverture: 1, fort: 1, portrait: 1, arrivee: 1, bilan: 1 };
    var scenes = String(o.scenes || '').split(',')
      .map(function (x) { return x.trim(); })
      .filter(function (k) { return dispo[k]; });
    // sans photo chargée, la scène portrait n'a rien à montrer : elle sort
    if (!aPhoto()) scenes = scenes.filter(function (k) { return k !== 'portrait'; });
    if (scenes.length < 2) scenes = ['ouverture', 'arrivee', 'bilan'];

    if (!pts.length) { sansTrace(); return; }

    /* ---------- où en est-on ? ---------- */
    var n = scenes.length;
    var pos = Math.max(0, Math.min(0.9999, s.progress)) * n;
    var i = Math.floor(pos);
    var local = pos - i;

    /* Fondu enchaîné sur le dernier sixième de chaque scène. Le fond est
     * peint une seule fois : les scènes ne dessinent QUE leur contenu, ce
     * qui permet de les superposer en transparence sans empiler deux fonds. */
    var SEUIL = 0.84;
    if (local > SEUIL && i < n - 1) {
      var k = (local - SEUIL) / (1 - SEUIL);
      peint(scenes[i], local, 1 - k);
      peint(scenes[i + 1], 0, k);
    } else {
      peint(scenes[i], local, 1);
    }

    // barre de progression du film : discrète, mais on sait où on en est
    ctx.save();
    ctx.fillStyle = melange(ink, 0.14);
    ctx.fillRect(g.left, g.bottom + u(2.5), g.width, u(0.25));
    ctx.fillStyle = o.accent;
    ctx.fillRect(g.left, g.bottom + u(2.5), g.width * Math.min(1, s.progress), u(0.25));
    ctx.restore();

    /* ================= les scènes ================= */

    function peint(cle, t, alpha) {
      ctx.save();
      ctx.globalAlpha = alpha;
      if (cle === 'ouverture') sceneOuverture(t);
      else if (cle === 'fort') sceneFort(t);
      else if (cle === 'portrait') scenePortrait(t);
      else if (cle === 'arrivee') sceneArrivee(t);
      else if (cle === 'bilan') sceneBilan(t);
      ctx.restore();
    }

    /* Acte I — le tracé se dessine, plein cadre. */
    function sceneOuverture(t) {
      var zone = { x: g.left, y: g.top + u(10), w: g.width, h: g.height - u(30) };
      traceCadree(zone, 0.5, 0.5, 1, adouci(t / 0.9), { color: o.accent, width: u(1.1) });
      var titre = String(o.t1 || '').trim() || a.name || 'Sortie';
      ecrit(titre, g.left, g.bottom - u(8), H.t('title', { size: 5.6, color: ink, maxWidth: g.width }),
            entre(t, 0.12, 0.3));
      ecrit('DÉPART', g.left, g.bottom - u(2), H.t('label', { color: faint }), entre(t, 0.2, 0.38));
    }

    /* Acte II — on se rapproche du moment fort. Le cadrage ZOOME, la trace
     * reste entière : ce n'est pas un autre parcours, c'est le même vu de
     * plus près. */
    function sceneFort(t) {
      var m = moment();
      var zone = { x: g.left, y: g.top + u(14), w: g.width, h: g.height - u(42) };
      var z = 1 + 2.1 * adouci(Math.min(1, t / 0.75));
      var c = pts[m.index] || pts[0];
      if (o.photoSur === 'fort') photoFondue(0.32 * Math.min(1, t / 0.4));
      traceCadree(zone, c.x, c.y, z, 1, { color: melange(ink, 0.35), width: u(0.7) });
      marque(zone, c, c.x, c.y, z, o.accent);

      /* Un plan serré perd le spectateur : à fort grossissement, la trace
       * n'est plus qu'un arc sans repère. Le cartouche rappelle le parcours
       * entier et où se situe ce qu'on est en train de regarder. */
      var ins = { x: g.right - u(16), y: g.top + u(1), w: u(16), h: u(16) };
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * entre(t, 0.05, 0.22);
      traceCadree(ins, 0.5, 0.5, 1, 1, { color: melange(ink, 0.3), width: u(0.28) });
      marque(ins, c, 0.5, 0.5, 1, o.accent, 0.42);
      ctx.restore();

      var titre = String(o.t2 || '').trim() || m.titre;
      ecrit(titre, g.left, g.bottom - u(14), H.t('title', { size: 5.2, color: ink, maxWidth: g.width }),
            entre(t, 0.08, 0.26));
      ecrit(m.detail, g.left, g.bottom - u(8), H.t('meta', { size: 3.1, color: melange(o.accent, 0.95), maxWidth: g.width }),
            entre(t, 0.18, 0.36));
      ecrit(m.origine, g.left, g.bottom - u(2), H.t('label', { color: faint, maxWidth: g.width }),
            entre(t, 0.26, 0.44));
    }

    /* La photo, plein cadre, si elle existe. */
    function scenePortrait(t) {
      if (!photoFondue(1)) { sceneArrivee(t); return; }
      ctx.save();
      ctx.fillStyle = H.gradient([[0, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.8)']], 0, h * 0.55, 0, h);
      ctx.fillRect(0, h * 0.55, w, h * 0.45);
      ctx.restore();
      var lg = String(o.t2 || '').trim() || a.name || '';
      ecrit(lg, g.left, g.bottom - u(4), H.t('title', { size: 4.6, color: '#fff', maxWidth: g.width }),
            entre(t, 0.1, 0.3));
    }

    /* Acte III — la trace entière, le point d'arrivée qui bat. */
    function sceneArrivee(t) {
      var zone = { x: g.left, y: g.top + u(10), w: g.width, h: g.height - u(30) };
      var z = 1.14 - 0.14 * adouci(Math.min(1, t / 0.6));   // on s'éloigne
      traceCadree(zone, 0.5, 0.5, z, 1, { color: o.accent, width: u(1.1) });
      var fin = pts[pts.length - 1];
      var battement = 1 + 0.25 * Math.sin(t * Math.PI * 6);
      marque(zone, fin, 0.5, 0.5, z, ink, battement);
      var txt = String(o.t3 || '').trim() || 'Arrivée';
      ecrit(txt, g.left, g.bottom - u(2), H.t('title', { size: 5.2, color: ink, maxWidth: g.width }),
            entre(t, 0.1, 0.3));
    }

    /* La fin : trois chiffres, jamais quatre. */
    function sceneBilan(t) {
      var chiffres = [];
      if (a.distance_km != null) chiffres.push(['distance', H.fmt.km(a.distance_km, 1) + ' km']);
      if (a.duration_s) chiffres.push(['en mouvement', H.fmt.duration(a.duration_s)]);
      if (a.elev_gain_m != null) chiffres.push(['dénivelé', Math.round(a.elev_gain_m) + ' m']);
      chiffres = chiffres.slice(0, 3);

      // la trace reste, très en retrait : le film se referme sur son sujet
      traceCadree({ x: g.left, y: g.top + u(6), w: g.width, h: g.height - u(24) },
                  0.5, 0.5, 1, 1, { color: melange(o.accent, 0.18), width: u(0.9) });

      var y0 = g.top + g.height / 2 - (chiffres.length - 1) * u(13) / 2;
      chiffres.forEach(function (c, k) {
        var app = entre(t, 0.08 + k * 0.12, 0.28 + k * 0.12);
        ecrit(c[0].toUpperCase(), g.left, y0 + k * u(13) - u(5),
              H.t('label', { color: faint }), app);
        ecrit(c[1], g.left, y0 + k * u(13) + u(3),
              H.t('value', { size: 8.4, color: ink, maxWidth: g.width }), app);
      });
      if (!chiffres.length) {
        ecrit('Sortie', g.left, g.top + g.height / 2, H.t('title', { color: ink }), 1);
      }
    }

    function sansTrace() {
      H.text('Charge une sortie avec une trace', g.left, g.top + g.height * 0.48,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('le film se construit à partir du parcours', g.left, g.top + g.height * 0.48 + u(5),
             H.t('label', { color: faint }));
    }

    /* ================= le moment fort ================= */
    /* Trois règles, toutes vérifiables, toutes nommées à l'écran. */
    function moment() {
      var tr = a.track || [];
      if (o.moment === 'choisi' || !tr.length) {
        var k = Math.max(0, Math.min(1, (Number(o.position) || 0) / 100));
        var idx = Math.round(k * (pts.length - 1));
        return {
          index: idx,
          titre: 'Ce point-là',
          detail: tr[idx] && tr[idx].d != null ? 'au km ' + H.fmt.km(tr[idx].d / 1000, 1) : '',
          origine: 'POSITION CHOISIE À LA MAIN'
        };
      }
      if (o.moment === 'ascension') {
        var m = plusLongueAscension(tr);
        if (m) {
          return {
            index: m.sommet,
            titre: 'La plus longue ascension',
            detail: H.fmt.km(m.km, 1) + ' km · +' + Math.round(m.gain) + ' m',
            origine: 'MONTÉE CONTINUE LA PLUS LONGUE DE LA SORTIE'
          };
        }
      }
      var best = -1, hi = -Infinity;
      tr.forEach(function (p, k) { if (p.ele != null && p.ele > hi) { hi = p.ele; best = k; } });
      if (best < 0) {
        return { index: Math.round(pts.length / 2), titre: 'Le milieu de la sortie',
                 detail: '', origine: 'SANS ALTITUDE : POSITION MÉDIANE' };
      }
      return {
        index: Math.min(best, pts.length - 1),
        titre: 'Le point culminant',
        detail: Math.round(hi) + ' m' +
                (tr[best].d != null ? ' · au km ' + H.fmt.km(tr[best].d / 1000, 1) : ''),
        origine: 'ALTITUDE MAXIMALE DE LA TRACE'
      };
    }

    /* Plus longue montée continue, avec une tolérance : un GPS oscille de
     * deux mètres en permanence, et sans tolérance toute ascension se
     * découpe en trois cents micro-montées. */
    function plusLongueAscension(tr) {
      if (tr.length < 3) return null;
      var meilleur = null, debut = null, gain = 0, creux = 0;
      for (var k = 1; k < tr.length; k++) {
        var e0 = tr[k - 1].ele, e1 = tr[k].ele;
        if (e0 == null || e1 == null) continue;
        var d = e1 - e0;
        if (d >= 0) { if (debut == null) debut = k - 1; gain += d; creux = 0; }
        else {
          creux -= d;
          if (creux > 12 && debut != null) {          // 12 m : on a vraiment redescendu
            enregistre(debut, k);
            debut = null; gain = 0; creux = 0;
          }
        }
      }
      if (debut != null) enregistre(debut, tr.length - 1);
      return meilleur;

      function enregistre(d0, d1) {
        var km = (tr[d1].d - tr[d0].d) / 1000;
        if (!isFinite(km) || km <= 0) return;
        if (!meilleur || km > meilleur.km) {
          meilleur = { km: km, gain: Math.max(0, tr[d1].ele - tr[d0].ele), sommet: d1 };
        }
      }
    }

    /* ================= dessin ================= */

    /* Trace cadrée : même projection que H.route, plus un zoom autour d'un
     * point. `jusqua` (0-1) permet de la faire se dessiner. */
    function traceCadree(box, cx, cy, zoom, jusqua, opt) {
      var cote = Math.min(box.w, box.h);
      var ox = box.x + (box.w - cote) / 2, oy = box.y + (box.h - cote) / 2;
      var fin = Math.max(2, Math.ceil(pts.length * Math.max(0, Math.min(1, jusqua))));
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      ctx.beginPath();
      for (var k = 0; k < fin; k++) {
        var X = ox + cote * (0.5 + (pts[k].x - cx) * zoom);
        var Y = oy + cote * (0.5 + (pts[k].y - cy) * zoom);
        if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
      }
      ctx.strokeStyle = opt.color; ctx.lineWidth = opt.width;
      ctx.lineJoin = ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    /* La marque DOIT recevoir le même cadrage que la trace (cx, cy, zoom),
     * sinon le point d'intérêt se pose à côté du tracé dès qu'on zoome. */
    function marque(box, p, cx, cy, zoom, couleur, echelle) {
      var cote = Math.min(box.w, box.h);
      var ox = box.x + (box.w - cote) / 2, oy = box.y + (box.h - cote) / 2;
      var X = ox + cote * (0.5 + (p.x - cx) * zoom);
      var Y = oy + cote * (0.5 + (p.y - cy) * zoom);
      ctx.save();
      ctx.beginPath(); ctx.rect(box.x, box.y, box.w, box.h); ctx.clip();
      ctx.fillStyle = couleur;
      ctx.beginPath();
      ctx.arc(X, Y, u(1.1) * (echelle || 1), 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = melange(couleur, 0.35);
      ctx.lineWidth = u(0.3);
      ctx.beginPath();
      ctx.arc(X, Y, u(2.6) * (echelle || 1), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    function aPhoto() { return o.photoSur !== 'aucune' && H.hasPhoto(); }
    function photoFondue(alpha) {
      if (o.photoSur === 'aucune') return false;
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * Math.max(0, Math.min(1, alpha));
      var ok = H.photo();
      ctx.restore();
      return ok;
    }

    /* ================= utilitaires ================= */
    // apparition : 0 avant `a`, 1 après `b`, adouci entre les deux
    function entre(t, a0, b0) {
      if (t <= a0) return 0;
      if (t >= b0) return 1;
      return adouci((t - a0) / (b0 - a0));
    }
    function adouci(t) { return t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t); }

    function ecrit(str, x, y, style, alpha) {
      if (alpha <= 0) return;
      ctx.save();
      ctx.globalAlpha = ctx.globalAlpha * alpha;
      // léger glissement vers le haut : l'apparition nette fait diaporama
      ctx.translate(0, (1 - alpha) * u(2.2));
      H.text(str, x, y, style);
      ctx.restore();
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
