/* « Strates » — la semaine devenue massif.
 *
 * Chaque sortie donne une silhouette d'altitude, posée sur son propre plan.
 * Les plans se décalent légèrement, comme des feuilles de papier découpées
 * empilées sur une table. Pas de perspective spectaculaire, pas d'ombre
 * portée : un décalage régulier suffit à dire « l'un derrière l'autre ».
 *
 * ── La décision qui compte : DEUX LECTURES, JAMAIS UNE TROISIÈME ──────
 *
 * « Comparer » — échelles horizontale ET verticale communes. Une sortie
 * deux fois plus longue est deux fois plus large ; cent mètres de dénivelé
 * font la même hauteur partout. Un datum vertical commun est tracé, et les
 * décalages de présentation restent visibles pour qu'on ne les confonde
 * pas avec du relief.
 *
 * « Composer » — chaque silhouette occupe toute la largeur de son plan.
 * C'est plus beau et les distances ne se comparent plus : la planche
 * l'écrit en toutes lettres.
 *
 * Le piège de ce genre de composition est la normalisation SILENCIEUSE :
 * tout ramener à la même largeur et la même hauteur donne sept jolis
 * massifs équivalents, et une semaine plate ressemble alors aux Alpes. Les
 * deux modes existent précisément pour que le choix soit dit.
 *
 * ── Ce qui n'est pas inventé ─────────────────────────────────────────
 * Une sortie sans altitude n'est PAS une ligne plate : elle reçoit une
 * vignette distincte, hachurée, et le pied de planche la compte à part.
 */
Studio.template({
  id: 'strates',
  name: 'Strates — les profils en massif',
  famille: 'serie',
  /* La transparence est une OPTION : la même planche s'exporte sur papier
   * ou en surcouche à poser sur une photo. */
  transparent: function (o) { return o.fond === 'transparent'; },
  multi: true,

  options: [
    { key: 'finition', type: 'select', label: 'Composition', default: 'gravure', reflow: true,
      choices: [['gravure', 'Original · Gravure — reliefs en tiges'],
                ['papier', 'Original · Papier découpé — aplats'],
                ['massif', 'Exploration · Massif — couches rapprochées'],
                ['continue', 'Exploration · Gravure continue — lignes déployées'],
                ['horizons', 'Exploration · Horizons — bandes fines']] },
    { key: 'echelle', type: 'select', label: 'Échelles', default: 'comparer', reflow: true,
      choices: [['comparer', 'Comparer — échelles communes'],
                ['composer', 'Composer — largeurs normalisées']] },
    { key: 'altitude', type: 'select', label: 'Axe vertical', default: 'variation',
      choices: [['variation', 'Variation depuis le départ'],
                ['absolue', 'Altitude absolue']] },
    { key: 'espacement', type: 'range', label: 'Espacement', default: 55, min: 15, max: 100, step: 5 },
    { key: 'accent', type: 'range', label: 'Couche en accent', default: 0, min: 0, max: 7, step: 1 },
    /* --- avancé --- */
    { key: 'annotations', type: 'toggle', label: 'Dates en marge', default: true },
    /* fond, voile, papier, encre : injectés depuis le socle Alpage */
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A54F37' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsFond()),

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    /* Papier ou surcouche : c'est la MÊME planche. Le socle pose le fond,
     * le voile éventuel, et rend l'encre à utiliser. */
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || o.papierC || '#F2EFE6');
    var faint = melange(encre, 0.45), hair = melange(encre, 0.16);


    var g = H.grid({ cols: 6, margin: u(8) });

    /* ---------- ce qu'on a ---------- */
    var toutes = (s.library || []).slice(0, 7);
    var avecRelief = toutes.filter(function (e) { return (e.activity.profile || []).length > 3; });
    var sansRelief = toutes.filter(function (e) { return (e.activity.profile || []).length <= 3; });

    if (!toutes.length) {
      vide('Charge deux à sept sorties', 'Strates empile leurs profils d’altitude');
      return;
    }
    if (!avecRelief.length) {
      vide('Aucune de ces sorties n’a d’altitude',
           'Strates ne fabrique pas de relief : il lui faut des données barométriques ou GPS');
      return;
    }

    var titre = String(o.titre || '').trim() || periode(avecRelief);
    H.text(titre, g.left, g.top + u(3.6), H.t('title', { color: encre, maxWidth: g.w(4) }));
    H.text(avecRelief.length + (avecRelief.length > 1 ? ' couches' : ' couche'),
           g.right, g.top + u(3.6), H.t('label', { color: faint, align: 'right' }));

    /* ---------- les données de chaque couche ---------- */
    /* Le profil du studio est déjà normalisé 0..1 en x et en y. Pour
     * comparer il faut revenir aux unités : on rend à chaque couche sa
     * longueur en kilomètres et son amplitude en mètres. */
    var couches = avecRelief.map(function (e, i) {
      var a = e.activity;
      var prof = a.profile;
      var eles = (a.track || []).filter(function (p) { return p.ele != null; }).map(function (p) { return p.ele; });
      var lo = eles.length ? Math.min.apply(null, eles) : 0;
      var hi = eles.length ? Math.max.apply(null, eles) : 1;
      var depart = eles.length ? eles[0] : 0;
      return {
        entree: e, activity: a, prof: prof, rang: i,
        km: a.distance_km || 0,
        eleMin: lo, eleMax: hi, depart: depart,
        amplitude: hi - lo
      };
    });

    var kmMax = Math.max.apply(null, couches.map(function (c) { return c.km; })) || 1;
    var comparer = o.echelle === 'comparer';

    /* En « absolue », l'échelle verticale couvre toutes les altitudes
     * rencontrées ; en « variation », l'écart maximal au point de départ. */
    var vBas, vHaut;
    if (o.altitude === 'absolue') {
      vBas = Math.min.apply(null, couches.map(function (c) { return c.eleMin; }));
      vHaut = Math.max.apply(null, couches.map(function (c) { return c.eleMax; }));
    } else {
      var ecarts = couches.map(function (c) {
        return Math.max(c.eleMax - c.depart, c.depart - c.eleMin);
      });
      vHaut = Math.max.apply(null, ecarts) || 1;
      vBas = -vHaut * 0.22;
    }
    var vSpan = (vHaut - vBas) || 1;

    /* ---------- disposition ---------- */
    var n = couches.length;
    var basPied = g.bottom - (sansRelief.length ? u(13) : u(8));
    var zone = { x: g.left + u(11), y: g.top + u(11), w: g.width - u(11), h: basPied - u(6) - (g.top + u(11)) };

    /* Le décalage : chaque couche monte d'un cran et glisse d'un cran vers
     * la droite. Le pas s'adapte au nombre de couches pour qu'AUCUNE ne
     * disparaisse derrière une autre, quel que soit le réglage. */
    /* MASSIF rapproche fortement les plans pour former un ensemble ; HORIZONS
     * les étale au contraire, comme une partition de paysages. Les deux
     * jouent sur le même paramètre, avec des bornes différentes. */
    var compo = o.finition;
    var brut = (Number(o.espacement) || 50) / 100;      // le curseur, tel quel
    var force = brut;
    if (compo === 'massif') force = 0.02 + 0.13 * force;
    else if (compo === 'horizons') force = 0.78 + 0.22 * force;

    /* Le RECOUVREMENT : de combien chaque plan monte par rapport au
     * précédent, en fraction de la hauteur d'une couche.
     *
     * Le massif l'empruntait aux autres compositions — 0,45 — et le résultat
     * restait une pile de profils distincts posés les uns au-dessus des
     * autres. Un massif, c'est l'inverse : les plans se CHEVAUCHENT, et
     * chaque couche ne montre plus que sa crête. On descend donc à ~0,25
     * par défaut, la moitié. Le curseur couvre 0,05 à 0,41 : l'ancienne
     * disposition reste atteignable en le poussant à droite. */
    var recouvrement = compo === 'massif' ? (0.05 + 0.36 * brut)
                                          : (0.42 + 0.38 * force);
    var hauteurCouche = zone.h / (1 + (n - 1) * recouvrement);
    var pasY = (zone.h - hauteurCouche) / Math.max(1, n - 1);
    var pasX = Math.min(u(4), zone.w * 0.05) * force;
    var largeurUtile = zone.w - pasX * (n - 1);

    /* ---------- dessin : de l'arrière vers l'avant ---------- */
    var reveles = H.progressCount(n);
    var accent = Math.round(o.accent);

    for (var k = n - 1; k >= 0; k--) {
      if (k >= reveles) continue;
      var c = couches[k];
      var base = { x: zone.x + k * pasX, y: zone.y + zone.h - k * pasY };
      var larg = comparer ? largeurUtile * (c.km / kmMax) : largeurUtile;
      var estAccent = (accent > 0 && accent - 1 === k);
      dessineCouche(c, base, larg, hauteurCouche, estAccent, k);
    }

    /* ---------- le datum ----------
     * En mode Comparer, une ligne de référence par couche montre d'où part
     * chaque silhouette : sans elle, les décalages de présentation se
     * confondraient avec du relief. */
    if (comparer && compo !== 'massif') {
      ctx.save();
      ctx.setLineDash([u(0.4), u(0.7)]);
      ctx.strokeStyle = melange(encre, 0.18);
      ctx.lineWidth = u(0.07);
      for (var d = 0; d < Math.min(n, reveles); d++) {
        var y = zone.y + zone.h - d * pasY;
        ctx.beginPath();
        ctx.moveTo(g.left + u(2), y);
        ctx.lineTo(zone.x + d * pasX + largeurUtile, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ---------- pied ---------- */
    piedDePlanche();

    /* ================= une couche ================= */

    function dessineCouche(c, base, larg, haut, estAccent, k) {
      var couleur = estAccent ? o.accentC : encre;
      /* Une progression discrète d'encres : la couche la plus ancienne est
       * la plus pâle. Jamais plus de deux couleurs sur la planche — les
       * autres couches ne sont que la MÊME encre, plus ou moins dense. */
      var densite = 0.32 + 0.58 * (k / Math.max(1, n - 1));
      var teinte = estAccent ? couleur : melange(encre, densite);

      var pts = silhouette(c, base, larg, haut);
      if (!pts.length) return;

      if (compo === 'massif') {
        /* MASSIF — des aplats OPAQUES. La couche de devant masque proprement
         * celle de derrière : c'est ce qui fait un massif plutôt qu'une
         * superposition de graphiques translucides. Chaque silhouette garde
         * sa crête visible, puisque les plans montent d'un cran. */
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.lineTo(base.x + larg, base.y);
        ctx.closePath();
        /* Trois ou quatre tons cohérents, pas n dégradés : au-delà, les
         * plans cessent de se distinguer et l'ensemble redevient plat. */
        var tons = [0.86, 0.70, 0.55, 0.41];
        ctx.fillStyle = estAccent ? o.accentC
          : melangeOpaque(encre, papier, tons[k % tons.length]);
        ctx.fill();
        ctx.strokeStyle = estAccent ? o.accentC : melangeOpaque(encre, papier, 0.96);
        ctx.lineWidth = u(0.16);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      } else if (compo === 'continue') {
        /* GRAVURE CONTINUE — des lignes qui se déploient de la crête vers la
         * base, au lieu de tiges verticales indépendantes. Chacune est une
         * copie du profil, écrasée : elles se répondent donc au lieu de
         * hachurer. Ce n'est PAS une représentation du terrain en trois
         * dimensions — c'est un traitement graphique du profil, et le pied
         * de planche le dit. */
        var lignes = Math.max(6, Math.min(22, Math.round(13 * (0.6 + 0.8 * force))));
        ctx.save();
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        for (var L = 0; L < lignes; L++) {
          var f = L / (lignes - 1);
          ctx.beginPath();
          pts.forEach(function (p, idx) {
            var y = base.y - (base.y - p.y) * (1 - f);
            if (idx === 0) ctx.moveTo(p.x, y); else ctx.lineTo(p.x, y);
          });
          ctx.strokeStyle = estAccent ? melange(o.accentC, 0.45 + 0.55 * (1 - f))
                                      : melange(encre, Math.min(1, (0.35 + densite) * (0.45 + 0.55 * (1 - f))));
          ctx.lineWidth = Math.max(0.6, u(0.13));
          ctx.stroke();
        }
        ctx.restore();
      } else if (compo === 'horizons') {
        /* HORIZONS — la crête seule, presque sans remplissage. Une partition
         * de paysages : c'est le vide entre les bandes qui fait la planche. */
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.lineTo(base.x + larg, base.y);
        ctx.closePath();
        ctx.fillStyle = melange(encre, 0.045);
        ctx.fill();
        ctx.restore();
        ctx.save();
        ctx.beginPath();
        pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.strokeStyle = estAccent ? o.accentC : melange(encre, Math.min(1, densite + 0.22));
        ctx.lineWidth = u(0.22);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      } else if (compo === 'papier') {
        // aplat : le papier découpé, avec un liseré plus dense au sommet
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(base.x, base.y);
        pts.forEach(function (p) { ctx.lineTo(p.x, p.y); });
        ctx.lineTo(base.x + larg, base.y);
        ctx.closePath();
        ctx.fillStyle = estAccent ? melange2(o.accentC, 0.88) : melange(encre, densite * 0.5);
        ctx.fill();
        ctx.strokeStyle = teinte;
        ctx.lineWidth = u(0.22);
        ctx.stroke();
        ctx.restore();
      } else {
        /* GRAVURE — des traits verticaux qui descendent du profil vers la
         * ligne de base. Leur espacement est constant ; c'est la HAUTEUR du
         * profil qui fait la densité visuelle. Une trame indépendante des
         * données aurait décoré une montagne qui n'existe pas. */
        ctx.save();
        ctx.strokeStyle = teinte;
        ctx.lineWidth = Math.max(0.6, u(0.09));
        var pasTrait = Math.max(u(0.55), larg / 130);
        for (var x = base.x; x <= base.x + larg; x += pasTrait) {
          var t = (x - base.x) / (larg || 1);
          var y = hauteurA(pts, t, base, larg);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x, base.y);
          ctx.stroke();
        }
        ctx.restore();
        // la crête, plus nette que la trame
        ctx.save();
        ctx.beginPath();
        pts.forEach(function (p, i) { if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y); });
        ctx.strokeStyle = estAccent ? o.accentC : melange(encre, Math.min(1, densite + 0.25));
        ctx.lineWidth = u(0.28);
        ctx.lineJoin = 'round';
        ctx.stroke();
        ctx.restore();
      }

      if (o.annotations) annote(c, base, k, estAccent);
    }

    /* La silhouette en pixels. En « variation », l'altitude est comptée
     * depuis le départ de CETTE sortie ; en « absolue », depuis le plancher
     * commun. Le libellé du pied dit lequel. */
    function silhouette(c, base, larg, haut) {
      var out = [];
      var prof = c.prof;
      var ampl = c.amplitude || 1;
      for (var i = 0; i < prof.length; i++) {
        var ele = c.eleMin + prof[i].y * ampl;
        var v = o.altitude === 'absolue' ? ele : ele - c.depart;
        var t = Math.max(0, Math.min(1, (v - vBas) / vSpan));
        out.push({ x: base.x + prof[i].x * larg, y: base.y - t * haut });
      }
      return out;
    }

    function hauteurA(pts, t, base, larg) {
      var x = base.x + t * larg;
      // recherche binaire : les profils font plusieurs milliers de points
      var lo = 0, hi = pts.length - 1;
      while (lo < hi - 1) {
        var mid = (lo + hi) >> 1;
        if (pts[mid].x < x) lo = mid; else hi = mid;
      }
      var a = pts[lo], b = pts[hi];
      var f = (b.x - a.x) ? (x - a.x) / (b.x - a.x) : 0;
      return a.y + (b.y - a.y) * Math.max(0, Math.min(1, f));
    }

    /* La date en marge, reliée par un filet court : c'est ce qui transforme
     * un empilement en planche documentée. */
    function annote(c, base, k, estAccent) {
      if (s.fade <= 0.02) return;
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, s.fade));
      ctx.strokeStyle = hair;
      ctx.lineWidth = u(0.07);
      ctx.beginPath();
      ctx.moveTo(g.left + u(9.4), base.y - u(0.8));
      ctx.lineTo(base.x - u(0.6), base.y - u(0.8));
      ctx.stroke();
      ctx.restore();
      H.text(courte(c.activity.date), g.left, base.y,
             H.t('label', { color: estAccent ? o.accentC : faint, maxWidth: u(9) }));
    }

    /* ================= pied ================= */

    function piedDePlanche() {
      var y = g.bottom - (sansRelief.length ? u(5.5) : u(0));
      H.rule(g.left, y - u(4), g.right, { color: hair });

      var lecture = comparer
        ? 'ÉCHELLES COMMUNES — LES LARGEURS ET LES HAUTEURS SE COMPARENT'
        : 'LARGEURS NORMALISÉES — LES DISTANCES NE SE COMPARENT PAS';
      var axe = o.altitude === 'absolue'
        ? 'ALTITUDE ABSOLUE · ' + Math.round(vBas) + ' À ' + Math.round(vHaut) + ' M'
        : 'VARIATION DEPUIS LE DÉPART · ±' + Math.round(vHaut) + ' M';
      var nature = compo === 'continue'
        ? ' · TRAITEMENT GRAPHIQUE DES PROFILS, PAS UN RELIEF EN TROIS DIMENSIONS'
        : compo === 'massif' ? ' · COMPOSITION DE PROFILS SUPERPOSÉS' : '';
      H.text(lecture + ' · ' + axe + nature, g.left, y,
             H.t('label', { color: faint, maxWidth: g.width }));

      if (comparer) {
        // une réglette de distance : sans elle, « échelles communes » n'est
        // qu'une affirmation
        var lr = largeurUtile * (Math.min(10, kmMax) / kmMax);
        ctx.save();
        ctx.strokeStyle = melange(encre, 0.4); ctx.lineWidth = u(0.12);
        ctx.beginPath();
        ctx.moveTo(g.right - lr, y - u(7.6)); ctx.lineTo(g.right, y - u(7.6));
        ctx.moveTo(g.right - lr, y - u(8.4)); ctx.lineTo(g.right - lr, y - u(6.8));
        ctx.moveTo(g.right, y - u(8.4)); ctx.lineTo(g.right, y - u(6.8));
        ctx.stroke(); ctx.restore();
        H.text(Math.min(10, Math.round(kmMax)) + ' KM', g.right, y - u(9.4),
               H.t('label', { color: faint, align: 'right' }));
      }

      if (sansRelief.length) {
        /* Les sorties sans altitude ne disparaissent pas : elles reçoivent
         * une vignette hachurée et sont nommées. Les transformer en ligne
         * plate aurait dit « terrain plat », ce qui est faux. */
        var x = g.left;
        var yv = g.bottom - u(1.2);
        sansRelief.slice(0, 4).forEach(function (e) {
          ctx.save();
          ctx.strokeStyle = melange(encre, 0.3); ctx.lineWidth = u(0.09);
          for (var i = 0; i < 5; i++) {
            ctx.beginPath();
            ctx.moveTo(x + i * u(0.7), yv);
            ctx.lineTo(x + i * u(0.7) + u(2.4), yv - u(3.2));
            ctx.stroke();
          }
          ctx.strokeRect(x - u(0.4), yv - u(3.4), u(5.6), u(3.6));
          ctx.restore();
          H.text(Library.nomCourt(e.activity, 16), x + u(6.6), yv,
                 H.t('label', { color: faint, maxWidth: u(22) }));
          x += u(30);
        });
        H.text('SANS ALTITUDE — EXCLUES DES PROFILS', g.right, yv,
               H.t('label', { color: faint, align: 'right' }));
      }
    }

    /* ================= utilitaires ================= */

    function vide(t1, t2) {
      H.text(t1, g.left, g.top + g.height * 0.45, H.t('title', { color: encre, maxWidth: g.width }));
      H.text(t2, g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    function courte(d) {
      if (!d) return 'sans date';
      return d.toLocaleDateString('fr-CH', { day: '2-digit', month: 'short' });
    }

    function periode(list) {
      var dates = list.map(function (e) { return e.activity.date; }).filter(Boolean)
        .sort(function (a, b) { return a - b; });
      if (!dates.length) return 'Strates';
      if (dates.length === 1) return courte(dates[0]);
      return courte(dates[0]) + ' — ' + courte(dates[dates.length - 1]);
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
    function melange2(hex, k) { return melange(hex, k * 0.42); }

    /* Un mélange OPAQUE de deux couleurs. Le massif ne peut pas utiliser
     * l'alpha : une couche translucide laisse voir celle de derrière, et
     * c'est exactement ce qu'on veut supprimer. On calcule donc la teinte
     * intermédiaire et on la pose pleine. */
    function melangeOpaque(a1, a2, k) {
      var x = parseInt(String(a1).replace('#', ''), 16);
      var y = parseInt(String(a2).replace('#', ''), 16);
      if (!isFinite(x) || !isFinite(y)) return a1;
      function c(v, dec) { return (v >> dec) & 255; }
      var r = Math.round(c(y, 16) + (c(x, 16) - c(y, 16)) * k);
      var v2 = Math.round(c(y, 8) + (c(x, 8) - c(y, 8)) * k);
      var b = Math.round(c(y, 0) + (c(x, 0) - c(y, 0)) * k);
      return 'rgb(' + r + ',' + v2 + ',' + b + ')';
    }
  }
});
