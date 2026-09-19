/* « Versants » — le rythme de la sortie.
 *
 * Une affiche minérale : le profil devient un bloc, et chaque grande montée,
 * chaque grande descente en devient une FACETTE. Les montées sont hachurées
 * serré, les descentes restent en réserve. Les arêtes séparent les phases,
 * claires sur l'encre, comme les tailles d'une linogravure.
 *
 * ── LES PHASES, PAS LES OSCILLATIONS ─────────────────────────────────
 *
 * Un profil GPS change de sens des centaines de fois : sur vingt kilomètres,
 * le bruit barométrique à lui seul produit deux cents « montées ». Découper
 * là-dessus donnerait une bouillie de facettes d'un pixel, et la planche ne
 * dirait plus rien du rythme de la sortie.
 *
 * On lisse, puis on ne retient un changement de sens que s'il coûte un
 * DÉNIVELÉ MINIMAL — vingt-cinq mètres par défaut, réglable. En dessous, la
 * phase fusionne avec sa voisine. Le seuil est un réglage et non une
 * constante cachée, parce que ce qu'on appelle « une montée » dépend de la
 * sortie : sur un parcours de plaine, vingt-cinq mètres sont un col.
 *
 * ── LES PROPORTIONS SONT CELLES DU TERRAIN ───────────────────────────
 *
 * La largeur d'une facette est sa part de DISTANCE, sa hauteur son dénivelé
 * réel. Rien n'est normalisé par facette : une bosse de cinquante mètres au
 * milieu d'un col de mille reste une bosse. Normaliser chaque phase aurait
 * donné six versants égaux et une sortie qu'on ne reconnaît plus.
 *
 * ── CE QUE LA PENTE NE DIT PAS ───────────────────────────────────────
 *
 * Elle commande la DENSITÉ des hachures, et rien d'autre. Elle ne dit pas la
 * difficulté technique, ni la nature du terrain, ni le nombre de sauts : un
 * GPX ne contient ni la taille des cailloux, ni les racines. Une pente de
 * 18 % peut être une route goudronnée. Aucune de ces choses n'est écrite ici,
 * ni suggérée par une légende.
 */
Studio.template({
  id: 'versants',
  name: 'Versants — le rythme de la sortie',
  famille: 'affiche',
  transparent: function (o) { return o.fond === 'transparent'; },

  variantes: [
    { nom: 'Bloc', dit: 'facettes hachurées, arêtes claires', o: {} },
    { nom: 'Réserve', dit: 'les montées seules, descentes en blanc',
      o: { composition: 'reserve' } },
    { nom: 'Bloc · accent', dit: 'la plus longue montée en terre cuite',
      o: { accent: true } }
  ],

  options: [
    { key: 'composition', type: 'select', label: 'Composition', default: 'bloc', reflow: true,
      choices: [['bloc', 'Original · Bloc — facettes hachurées'],
                ['reserve', 'Original · Réserve — les montées seules']] },
    { key: 'seuil', type: 'range',
      label: 'Dénivelé minimal d’une phase (m) — en dessous, elle fusionne',
      default: 25, min: 5, max: 120, step: 5 },
    { key: 'densite', type: 'range', label: 'Densité des hachures', default: 55, min: 20, max: 100, step: 5 },
    { key: 'accent', type: 'toggle', label: 'La plus longue montée en accent', default: false },
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A54F37' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' }
  ].concat(Alpage.optionsTexte(), Alpage.optionsFond()),

  draw: function (s) {
    var ctx = s.ctx, a = s.a, o = s.o, H = s.H, u = H.u;
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? null : (o.papier || Alpage.PALETTE.papier);
    var faint = melange(encre, 0.45);
    var g = H.grid({ cols: 6, margin: u(8) });
    var dit = Alpage.dit(o);
    var reserve = o.composition === 'reserve';

    var profil = (a && a.profile) || [];
    var lo = a && a.elev_min_m, hi = a && a.elev_max_m;
    if (profil.length < 8 || lo == null || hi == null || hi - lo < 1) {
      /* AUCUN RELIEF DE REMPLACEMENT. Sans altitude il n'y a pas de versant :
       * la planche le dit et s'arrête. Fabriquer des phases depuis la vitesse
       * serait un modèle déguisé en mesure. */
      H.text('Cette sortie n’a pas d’altitude', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Versants découpe les montées et les descentes : il lui faut un profil',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- du profil aux phases ---------- */
    var span = hi - lo;
    var km = a.distance_km || 0;
    /* on repasse en MÈTRES : le seuil de fusion s'exprime en dénivelé réel,
     * pas en fraction d'une amplitude qui varie d'une sortie à l'autre */
    var brut = profil.map(function (p) { return { x: p.x, e: lo + p.y * span }; });
    var doux = lissePr(brut, Math.max(3, Math.round(brut.length / 90)));
    var phases = decoupe(doux, Math.max(5, o.seuil == null ? 25 : o.seuil));

    if (!phases.length) {
      H.text('Cette sortie est trop régulière pour être découpée',
             g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('Baisse le dénivelé minimal d’une phase, ou choisis une autre planche',
             g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    /* ---------- le cadre ---------- */
    var basTexte = dit.rien ? g.bottom : g.bottom - u(dit.fabrication ? 16 : 12);
    var haut = g.top + u(6);
    var pied = basTexte - u(4);
    var bloc = { x: g.left, y: haut, w: g.width, h: pied - haut };
    /* Le relief remplit la hauteur disponible. C'est la seule normalisation,
     * et elle porte sur l'ENSEMBLE : les phases gardent leurs proportions
     * entre elles, ce que le brief demande. */
    function X(t) { return bloc.x + t * bloc.w; }
    function Y(e) { return bloc.y + bloc.h - (e - lo) / span * bloc.h; }

    var laPlusLongue = null;
    phases.forEach(function (ph) {
      if (ph.montee && (!laPlusLongue || ph.gain > laPlusLongue.gain)) laPlusLongue = ph;
    });

    /* ---------- les facettes ---------- */
    var densite = (o.densite == null ? 55 : o.densite) / 100;
    var vus = H.progressCount ? H.progressCount(phases.length) : phases.length;

    phases.forEach(function (ph, idx) {
      if (idx >= vus) return;
      var pts = doux.slice(ph.i0, ph.i1 + 1);
      if (pts.length < 2) return;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(X(pts[0].x), bloc.y + bloc.h);
      pts.forEach(function (p) { ctx.lineTo(X(p.x), Y(p.e)); });
      ctx.lineTo(X(pts[pts.length - 1].x), bloc.y + bloc.h);
      ctx.closePath();
      ctx.clip();

      var accentuee = o.accent && ph === laPlusLongue;
      var teinte = accentuee ? (o.accentC || Alpage.PALETTE.rouille) : encre;

      if (ph.montee) {
        /* LES MONTÉES SE HACHURENT. La pente serre les traits — et c'est tout
         * ce qu'elle fait : elle ne nomme aucune difficulté. */
        var pente = ph.gain / Math.max(1, ph.metres);      // 0..~0.25
        var pas = u(1.35) * (1 - 0.55 * densite) / (0.55 + 2.6 * Math.min(0.25, pente));
        /* LA DIRECTION ALTERNE D'UNE FACETTE À L'AUTRE.
         *
         * Avec un seul angle, deux montées voisines séparées par une courte
         * descente se confondaient en une seule masse hachurée : l'arête ne
         * suffisait pas à les séparer. L'alternance est un choix GRAPHIQUE —
         * elle ne code aucune grandeur, et la planche ne prétend pas le
         * contraire. C'est la pente, et elle seule, qui serre les traits. */
        hachure(bloc, Math.max(u(0.28), pas), teinte,
                accentuee ? 0.85 : 0.62, idx % 2 ? 0.62 : -0.62);
      } else if (!reserve) {
        /* LES DESCENTES : un aplat léger, ou rien en « Réserve ». */
        ctx.fillStyle = melange(teinte, 0.10);
        ctx.fillRect(bloc.x, bloc.y, bloc.w, bloc.h);
      }
      ctx.restore();

      /* L'ARÊTE, claire sur l'encre : c'est elle qui fait la facette. Sur un
       * fond transparent il n'y a pas de papier à emprunter, on la creuse
       * donc en retirant de la matière. */
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(X(pts[pts.length - 1].x), bloc.y + bloc.h);
      ctx.lineTo(X(pts[pts.length - 1].x), Y(pts[pts.length - 1].e));
      ctx.lineWidth = Math.max(1, u(0.22));
      if (papier) { ctx.strokeStyle = papier; }
      else { ctx.globalCompositeOperation = 'destination-out'; ctx.strokeStyle = '#000'; }
      ctx.stroke();
      ctx.restore();
    });

    /* La ligne de crête, par-dessus tout : c'est la seule mesurée. */
    ctx.save();
    ctx.strokeStyle = encre;
    ctx.lineWidth = Math.max(1.1, u(0.26));
    ctx.lineJoin = 'round';
    ctx.beginPath();
    var fin = phases[Math.min(vus, phases.length) - 1];
    doux.slice(0, (fin ? fin.i1 : doux.length - 1) + 1).forEach(function (p, k) {
      if (k === 0) ctx.moveTo(X(p.x), Y(p.e)); else ctx.lineTo(X(p.x), Y(p.e));
    });
    ctx.stroke();
    ctx.restore();

    /* ---------- le texte ---------- */
    if (dit.rien) return;

    var yTitre = g.bottom - u(dit.fabrication ? 11 : 6);
    var titre = String(o.titre || '').trim() || a.name || 'Sortie';
    H.text(titre, g.left, yTitre, H.t('title', { size: 3.2, color: encre, maxWidth: g.w(4) }));

    /* En Signature : D+ et D− d'abord, la distance en second — c'est une
     * planche de relief, pas une planche de kilomètres. */
    var bouts = [];
    if (a.elev_gain_m != null) bouts.push(Math.round(a.elev_gain_m) + ' M D+');
    if (a.elev_loss_m != null) bouts.push(Math.round(a.elev_loss_m) + ' M D−');
    if (a.distance_km != null) bouts.push(H.fmt.km(a.distance_km, 1) + ' KM');
    if (bouts.length) {
      H.text(bouts.join('  ·  '), g.left, yTitre + u(4.4),
             H.t('label', { color: faint, maxWidth: g.width }));
    }

    if (dit.fabrication) {
      var m = phases.filter(function (p) { return p.montee; }).length;
      H.text(m + ' MONTÉES · ' + (phases.length - m) + ' DESCENTES — PHASES D’AU MOINS ' +
             Math.round(o.seuil == null ? 25 : o.seuil) + ' M · LA PENTE SERRE LES HACHURES, ' +
             'ELLE NE DIT AUCUNE DIFFICULTÉ',
             g.left, yTitre + u(8.2),
             H.t('label', { color: melange(encre, 0.3), maxWidth: g.width }));
    }

    /* ================= les morceaux ================= */

    /* Hachures parallèles couvrant la facette déjà découpée. `pente` est la
     * pente du trait à l'écran, pas celle du terrain : on suit la montée. */
    function hachure(b, pas, couleur, opacite, penteTrait) {
      ctx.strokeStyle = melange(couleur, opacite);
      ctx.lineWidth = Math.max(0.45, u(0.1));
      ctx.beginPath();
      var etendue = b.w + Math.abs(penteTrait) * b.h;
      for (var x = b.x - Math.abs(penteTrait) * b.h; x < b.x + etendue; x += pas) {
        ctx.moveTo(x, b.y + b.h);
        ctx.lineTo(x + penteTrait * b.h, b.y);
      }
      ctx.stroke();
    }

    /* Moyenne glissante sur l'altitude. Le bruit barométrique invente des
     * dizaines de sommets ; sans ce passage, le découpage les prendrait tous
     * pour des phases. */
    function lissePr(pts, fen) {
      if (pts.length < 3 || fen < 1) return pts.slice();
      var out = [];
      for (var i = 0; i < pts.length; i++) {
        var i0 = Math.max(0, i - fen), i1 = Math.min(pts.length - 1, i + fen);
        var so = 0, n = 0;
        for (var j = i0; j <= i1; j++) { so += pts[j].e; n++; }
        out.push({ x: pts[i].x, e: so / n });
      }
      return out;
    }

    /* Découpe en phases : on suit le sens, et on ne VALIDE un retournement
     * que si la phase en cours a coûté au moins `seuil` mètres. Une bosse
     * plus petite est absorbée par sa voisine plutôt que de fabriquer trois
     * facettes illisibles. */
    function decoupe(pts, seuil) {
      var out = [], debut = 0, sens = 0, extreme = pts[0].e;
      for (var i = 1; i < pts.length; i++) {
        var e = pts[i].e;
        if (sens === 0) {
          if (Math.abs(e - pts[debut].e) >= seuil * 0.5) {
            sens = e > pts[debut].e ? 1 : -1;
            extreme = e;
          }
          continue;
        }
        if ((sens > 0 && e > extreme) || (sens < 0 && e < extreme)) { extreme = e; continue; }
        /* on repart dans l'autre sens : est-ce assez pour clore la phase ? */
        if (Math.abs(e - extreme) >= seuil) {
          out.push(faitPhase(pts, debut, indexDe(pts, extreme, debut, i), sens > 0));
          debut = out[out.length - 1].i1;
          sens = e > extreme ? 1 : -1;
          extreme = e;
        }
      }
      if (debut < pts.length - 1 && sens !== 0) {
        out.push(faitPhase(pts, debut, pts.length - 1, sens > 0));
      }
      return out;
    }

    function indexDe(pts, valeur, a0, b0) {
      var best = a0, ecart = Infinity;
      for (var i = a0; i <= b0; i++) {
        var d = Math.abs(pts[i].e - valeur);
        if (d < ecart) { ecart = d; best = i; }
      }
      return best;
    }

    function faitPhase(pts, i0, i1, montee) {
      return {
        i0: i0, i1: i1, montee: montee,
        gain: Math.abs(pts[i1].e - pts[i0].e),
        metres: Math.max(1, (pts[i1].x - pts[i0].x) * km * 1000)
      };
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
