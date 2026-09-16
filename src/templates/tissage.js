/* « Tissage » — plusieurs semaines en une tapisserie.
 *
 * Une bande par semaine, sept colonnes par bande, une par jour. Le relief du
 * jour donne l'ondulation de la trame, le sport donne la couleur, les jours
 * sans activité enregistrée laissent la chaîne nue.
 *
 * Trois exigences décident de la forme :
 *
 *   - DÉTERMINISTE ET STABLE. Aucun hasard, et chaque semaine se calcule
 *     SEULE : ajouter une semaine n'en redessine aucune autre. C'est ce qui
 *     permet d'imprimer la même pièce trois mois de suite en la voyant
 *     s'allonger, et non se réorganiser.
 *
 *   - ÉCHELLE COMMUNE PAR DÉFAUT. L'amplitude d'une ondulation est
 *     proportionnelle au dénivelé réel, avec le même rapport partout : une
 *     semaine plate DOIT paraître plate. La normalisation artistique existe,
 *     mais elle s'annonce en toutes lettres sur la planche — sinon on
 *     compare des reliefs qui ne sont plus comparables.
 *
 *   - TROIS ABSENCES DIFFÉRENTES, TROIS DESSINS DIFFÉRENTS.
 *       · jour sans activité enregistrée  → la chaîne seule
 *       · activité sans altitude          → trame plate, hachurée
 *       · jour hors de la période choisie → rien du tout
 *     Et jamais le mot « repos » : le studio ne sait pas si tu t'es reposé,
 *     il sait qu'il n'a rien reçu ce jour-là.
 */
Studio.template({
  id: 'tissage',
  name: 'Tissage — les semaines en tapisserie',
  famille: 'serie',
  multi: true,

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#EFEAE0' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#191713' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#A8431F' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'semaines', type: 'range', label: 'Semaines affichées', default: 8, min: 2, max: 20, step: 1 },
    { key: 'normalise', type: 'toggle', label: 'Normalisation artistique', default: false },
    { key: 'densite', type: 'range', label: 'Densité de la chaîne', default: 22, min: 8, max: 44, step: 2 },
    { key: 'dates', type: 'toggle', label: 'Dates des semaines', default: true },
    { key: 'legende', type: 'toggle', label: 'Légende des absences', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.5), hair = melange(ink, 0.18);

    var avecDate = (s.library || []).filter(function (e) {
      return e.activity && e.activity.date instanceof Date && !isNaN(e.activity.date);
    });

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(7) });

    if (!avecDate.length) {
      H.text('Charge des sorties datées', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('le tissage range les jours en semaines — il lui faut des dates',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- la période ---------- */
    /* On part du LUNDI de la semaine de la dernière sortie et on remonte.
     * Ancrer sur la dernière sortie plutôt que sur aujourd'hui rend la pièce
     * reproductible : la même bibliothèque donne la même tapisserie demain. */
    var jours = {};                     // 'AAAA-MM-JJ' -> [entrées]
    var dernier = null;
    avecDate.forEach(function (e) {
      var d = e.activity.date;
      var cle = jourCle(d);
      (jours[cle] = jours[cle] || []).push(e);
      if (!dernier || d > dernier) dernier = d;
    });

    var nbSemaines = Math.max(2, Math.round(o.semaines));
    var finLundi = lundiDe(dernier);
    var semaines = [];
    for (var k = nbSemaines - 1; k >= 0; k--) {
      var l = new Date(finLundi.getTime() - k * 7 * 86400000);
      semaines.push(l);
    }

    /* ---------- échelle commune ---------- */
    /* Le plafond n'est PAS le maximum brut : une sortie de montagne à
     * 2 400 m écraserait dix semaines de plaine à deux pixels. On prend le
     * 90e centile des journées actives, et ce qui dépasse déborde
     * visiblement — c'est plus honnête qu'un aplatissement général. */
    var denivelesJour = [];
    Object.keys(jours).forEach(function (cle) {
      denivelesJour.push(deniveleJour(jours[cle]));
    });
    var plafond = centile(denivelesJour.filter(function (v) { return v > 0; }), 0.9) || 1;

    /* ---------- disposition ---------- */
    var titre = String(o.titre || '').trim() || 'Tissage';
    H.text(titre, g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(nbSemaines + ' semaines', g.right, g.top + u(3.6),
           H.t('label', { color: faint, align: 'right' }));

    var basLeg = o.legende ? u(12) : u(3);
    var zone = { x: g.left + (o.dates ? u(13) : 0), y: g.top + u(9),
                 w: g.width - (o.dates ? u(13) : 0),
                 h: g.height - u(9) - basLeg };
    var bandeH = zone.h / nbSemaines;
    var colW = zone.w / 7;

    /* entête des jours */
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (j, i) {
      H.text(j, zone.x + colW * (i + 0.5), zone.y - u(2),
             H.t('label', { color: faint, align: 'center' }));
    });

    var sansAltitude = false, journeeVide = false;

    semaines.forEach(function (lundi, r) {
      var y0 = zone.y + r * bandeH;
      var bande = { x: zone.x, y: y0 + bandeH * 0.12, w: zone.w, h: bandeH * 0.76 };

      // la chaîne : les fils verticaux, présents partout, même sans activité
      chaine(bande);

      for (var d = 0; d < 7; d++) {
        var date = new Date(lundi.getTime() + d * 86400000);
        var liste = jours[jourCle(date)];
        var cell = { x: zone.x + d * colW, y: bande.y, w: colW, h: bande.h };
        if (!liste || !liste.length) { journeeVide = true; continue; }
        var prof = profilJour(liste);
        if (!prof) { trameplate(cell, liste[0].couleur); sansAltitude = true; continue; }
        trame(cell, prof, liste[0].couleur, deniveleJour(liste));
      }

      if (o.dates) {
        var fin = new Date(lundi.getTime() + 6 * 86400000);
        H.text(court(lundi) + ' — ' + court(fin), g.left, y0 + bandeH * 0.5 + u(1),
               H.t('label', { color: faint, maxWidth: u(12) }));
      }
    });

    /* ---------- la légende des absences ---------- */
    if (o.legende) {
      var y = g.bottom - u(7.5);
      H.rule(g.left, y - u(3), g.right, { color: hair });
      var items = [
        ['chaîne nue', 'aucune activité enregistrée ce jour-là'],
        ['trame hachurée', 'activité sans altitude'],
        ['amplitude', o.normalise ? 'NORMALISÉE — RELIEFS NON COMPARABLES'
                                  : 'dénivelé réel, échelle commune']
      ];
      items.forEach(function (it, i) {
        H.field(it[0], it[1], g.left + i * (g.width / 3), y + u(1.5), {
          color: i === 2 && o.normalise ? o.accent : ink,
          labelColor: faint, role: 'meta', size: 2.2, gap: u(3.2),
          maxWidth: g.width / 3 - u(2)
        });
      });
      void sansAltitude; void journeeVide;
    }

    /* ================= tissage ================= */

    /* La chaîne : des fils verticaux fins, sur toute la bande. C'est le
     * support ; il est là même les jours sans rien, et c'est justement ce
     * qui distingue « rien enregistré » de « hors période ». */
    function chaine(bande) {
      var n = Math.round(o.densite);
      ctx.save();
      ctx.strokeStyle = melange(ink, 0.13);
      ctx.lineWidth = Math.max(0.6, u(0.07));
      for (var i = 0; i <= n * 7; i++) {
        var x = bande.x + bande.w * (i / (n * 7));
        ctx.beginPath(); ctx.moveTo(x, bande.y); ctx.lineTo(x, bande.y + bande.h); ctx.stroke();
      }
      ctx.restore();
    }

    /* La trame d'un jour : plusieurs passes horizontales qui suivent le
     * profil d'altitude. Plusieurs passes plutôt qu'une seule ligne : c'est
     * ce qui donne la matière textile au lieu d'un graphique. */
    function trame(cell, prof, couleur, deniv) {
      var amp = o.normalise ? 0.42 : Math.min(0.46, 0.46 * (deniv / plafond));
      amp = Math.max(0.06, amp);
      var passes = 7;
      ctx.save();
      ctx.beginPath(); ctx.rect(cell.x, cell.y, cell.w, cell.h); ctx.clip();
      ctx.lineCap = 'round';
      for (var p = 0; p < passes; p++) {
        var t = p / (passes - 1);
        ctx.beginPath();
        for (var i = 0; i < prof.length; i++) {
          var x = cell.x + (i / (prof.length - 1)) * cell.w;
          var base = cell.y + cell.h * (0.18 + 0.64 * t);
          var y = base - (prof[i] - 0.5) * cell.h * amp * 2;
          if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = teinte(couleur, 0.35 + 0.5 * (1 - Math.abs(t - 0.5) * 2));
        ctx.lineWidth = Math.max(0.8, cell.h * 0.035);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* Une activité SANS altitude : trame plate et hachurée. Elle occupe la
     * case — il s'est passé quelque chose — mais son relief n'existe pas, et
     * une ligne droite toute seule se lirait comme « terrain plat ». */
    function trameplate(cell, couleur) {
      ctx.save();
      ctx.beginPath(); ctx.rect(cell.x, cell.y, cell.w, cell.h); ctx.clip();
      ctx.strokeStyle = teinte(couleur, 0.55);
      ctx.lineWidth = Math.max(0.8, cell.h * 0.03);
      var pas = Math.max(u(0.8), cell.w / 9);
      for (var x = cell.x - cell.h; x < cell.x + cell.w; x += pas) {
        ctx.beginPath();
        ctx.moveTo(x, cell.y + cell.h * 0.72);
        ctx.lineTo(x + cell.h * 0.45, cell.y + cell.h * 0.28);
        ctx.stroke();
      }
      ctx.restore();
    }

    /* ================= données ================= */

    /* Profil moyen du jour, rééchantillonné sur 48 points. Deux sorties le
     * même jour se cumulent en une seule trame : la case est le jour, pas
     * l'activité. */
    function profilJour(liste) {
      var N = 48, somme = new Array(N).fill(0), poids = 0;
      liste.forEach(function (e) {
        var p = e.activity.profile;
        if (!p || p.length < 2) return;
        poids++;
        for (var i = 0; i < N; i++) {
          var t = i / (N - 1);
          somme[i] += echantillon(p, t);
        }
      });
      if (!poids) return null;
      return somme.map(function (v) { return v / poids; });
    }

    function echantillon(prof, t) {
      // le profil est { x: 0-1, y: 0-1 } et croissant en x
      var lo = 0, hi = prof.length - 1;
      while (lo < hi - 1) {
        var mid = (lo + hi) >> 1;
        if (prof[mid].x < t) lo = mid; else hi = mid;
      }
      var a = prof[lo], b = prof[hi];
      var k = (b.x - a.x) ? (t - a.x) / (b.x - a.x) : 0;
      return a.y + (b.y - a.y) * Math.max(0, Math.min(1, k));
    }

    function deniveleJour(liste) {
      return liste.reduce(function (t, e) { return t + (e.activity.elev_gain_m || 0); }, 0);
    }

    function centile(arr, p) {
      if (!arr.length) return 0;
      var c = arr.slice().sort(function (a, b) { return a - b; });
      return c[Math.min(c.length - 1, Math.floor(p * c.length))];
    }

    /* ================= dates ================= */
    function jourCle(d) {
      return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
    }
    function pad(n) { return n < 10 ? '0' + n : String(n); }
    /* Lundi de la semaine : getDay() rend 0 pour dimanche, ce qui décale
     * toute la grille d'une semaine si on ne le corrige pas. */
    function lundiDe(d) {
      var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
      var j = (x.getDay() + 6) % 7;
      return new Date(x.getTime() - j * 86400000);
    }
    function court(d) {
      return d.getDate() + '.' + pad(d.getMonth() + 1);
    }

    /* ================= couleurs ================= */
    function teinte(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
    function melange(hex, k) { return teinte(hex, k); }
  }
});
