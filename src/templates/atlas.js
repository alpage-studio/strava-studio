/* « Atlas hebdomadaire » — sept jours, un territoire.
 *
 * Une page d'atlas personnel : en haut la semaine, au centre le territoire
 * dans un médaillon, en bas le rythme des sept jours et trois totaux au
 * plus. Faite pour se ranger à côté de celle de la semaine suivante.
 *
 * ── Trois décisions ──────────────────────────────────────────────────
 *
 * 1. LE MÉDAILLON NE COUPE PAS LES PARCOURS. Les traces peuvent déborder du
 *    cercle : à l'intérieur elles sont pleines, à l'extérieur elles
 *    s'atténuent mais continuent, à la MÊME échelle. Rogner au bord aurait
 *    produit des sorties qui s'arrêtent au milieu de nulle part.
 *
 * 2. DES RÉGIONS ÉLOIGNÉES FONT PLUSIEURS MÉDAILLONS. Une semaine avec une
 *    sortie ici et une à trois cents kilomètres, cadrée d'un seul tenant,
 *    donne deux points sur une carte de l'Europe. On regroupe donc les
 *    sorties par proximité et chaque groupe reçoit son cercle et sa propre
 *    échelle, écrite.
 *
 * 3. LES DISQUES DES JOURS SONT PROPORTIONNELS EN SURFACE, pas en rayon.
 *    Doubler le rayon quadruple la tache : un jour deux fois plus long
 *    paraîtrait quatre fois plus gros. Un jour sans activité enregistrée
 *    reçoit un petit repère vide — pas un disque de taille zéro, qui se
 *    confondrait avec une absence de repère.
 *
 * ── Ce qui n'est pas inventé ─────────────────────────────────────────
 * Le temps affiché est le temps EN MOUVEMENT, et c'est écrit. Les sorties
 * sans GPS comptent dans les totaux mais n'entrent pas sur la carte : elles
 * sont listées à part. Aucun chiffre n'est fabriqué pour remplir une zone.
 */
Studio.template({
  id: 'atlas',
  name: 'Atlas hebdomadaire — sept jours, un territoire',
  famille: 'serie',
  /* La transparence est une OPTION : la même planche s'exporte sur papier
   * ou en surcouche à poser sur une photo. */
  transparent: function (o) { return o.fond === 'transparent'; },
  multi: true,

  options: [
    { key: 'semaine', type: 'range', label: 'Semaine (0 = la dernière)', default: 0, min: -52, max: 0, step: 1, reflow: true },
    { key: 'composition', type: 'select', label: 'Composition', default: 'complete', reflow: true,
      choices: [['complete', 'Complète — carte, profils, jours'],
                ['epuree', 'Épurée — carte et jours']] },
    { key: 'couleurs', type: 'select', label: 'Couleurs', default: 'encre',
      choices: [['encre', 'Encre commune, une sortie en accent'],
                ['activite', 'Une couleur par sortie — avec légende']] },
    { key: 'accent', type: 'range', label: 'Sortie en accent', default: 0, min: 0, max: 12, step: 1 },
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    /* --- avancé --- */
    /* fond, voile, papier, encre : injectés depuis le socle Alpage */
    { key: 'accentC', type: 'color', label: 'Accent', default: '#A54F37' }
  /* fond · voile · papier · encre : les quatre réglages communs aux six
   * planches Alpage, déclarés une seule fois pour qu'aucune ne dérive. */
  ].concat(Alpage.optionsFond()),

  inert: function (a, vals) {
    return (vals && vals.couleurs === 'activite') ? ['accent', 'accentC'] : [];
  },

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    /* Papier ou surcouche : c'est la MÊME planche. Le socle pose le fond,
     * le voile éventuel, et rend l'encre à utiliser. */
    var socle = Alpage.socle(H, o);
    var encre = socle.encre;
    var papier = socle.transparent ? 'rgba(0,0,0,0)' : (o.papier || o.papierC || '#F2EFE6');
    var faint = melange(encre, 0.45), hair = melange(encre, 0.15);


    var g = H.grid({ cols: 6, margin: u(7) });

    var toutes = (s.library || []).filter(function (e) { return e.activity; });
    if (!toutes.length) {
      H.text('Charge une semaine de sorties', g.left, g.top + g.height * 0.45,
             H.t('title', { color: encre, maxWidth: g.width }));
      H.text('l’Atlas range les sorties du lundi au dimanche',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint }));
      return;
    }

    /* ---------- la semaine ---------- */
    var datees = toutes.filter(function (e) { return e.activity.date instanceof Date && !isNaN(e.activity.date); });
    var ancre = datees.length
      ? datees.reduce(function (m, e) { return (!m || e.activity.date > m) ? e.activity.date : m; }, null)
      : new Date();
    var lundi = Alpage.lundiDe(ancre);
    lundi = new Date(lundi.getTime() + Math.round(o.semaine) * 7 * 86400000);
    var dimanche = new Date(lundi.getTime() + 6 * 86400000);

    var semaine = datees.filter(function (e) {
      var d = e.activity.date;
      return d >= lundi && d.getTime() < lundi.getTime() + 7 * 86400000;
    });
    /* Les sorties non datées ne peuvent être rangées dans aucune semaine :
     * les glisser dans celle qu'on regarde fabriquerait un bilan faux. On
     * les compte à part et on le dit. */
    var sansDate = toutes.length - datees.length;

    var avecGPS = semaine.filter(function (e) { return (e.activity.track || []).some(function (p) { return p.lat != null; }); });
    var sansGPS = semaine.filter(function (e) { return avecGPS.indexOf(e) < 0; });

    /* ---------- en-tête ---------- */
    var noSem = Alpage.semaineISO(lundi);
    H.text(String(o.titre || '').trim() || ('Semaine ' + noSem), g.left, g.top + u(4.4),
           H.t('title', { size: 5.2, color: encre, maxWidth: g.w(4) }));
    H.text(jourMois(lundi) + ' — ' + jourMois(dimanche) + ' ' + dimanche.getFullYear(),
           g.left, g.top + u(9.4), H.t('label', { color: faint, maxWidth: g.width }));
    H.text(fuseau(), g.right, g.top + u(4.4),
           H.t('label', { color: faint, align: 'right' }));

    if (!semaine.length) {
      H.text('aucune sortie enregistrée cette semaine-là',
             g.left, g.top + g.height * 0.45, H.t('title', { color: faint, maxWidth: g.width }));
      H.text('le vide est une donnée : rien n’est fabriqué pour remplir la page',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint, maxWidth: g.width }));
      ligneDesJours(g.bottom - u(22), []);
      return;
    }

    /* ---------- disposition ---------- */
    /* Le rythme vertical, posé du BAS vers le haut. Chaque bande connaît sa
     * hauteur, et la carte prend ce qui reste. Le premier jet posait la
     * carte d'abord puis empilait le reste : les totaux venaient alors
     * s'écrire par-dessus les lettres des sept jours. */
    var complete = o.composition === 'complete' && avecGPS.some(function (e) { return (e.activity.profile || []).length > 3; });
    var rJour = Math.min(g.width / 7 * 0.34, u(5));
    var hTotaux = u(12);                    // filet + trois chiffres + mention
    var hJours  = rJour * 2 + u(13);        // disques + lettres + note
    var hProfils = complete ? u(20) : 0;

    /* En PAYSAGE, on ne comprime pas : on RECOMPOSE. La carte prend la
     * moitié gauche sur toute la hauteur, le reste s'empile à droite. Garder
     * la pile verticale du portrait sur une page deux fois moins haute
     * réduisait le médaillon à un jeton entre deux blocs de texte. */
    /* Le basculement ne se décide pas sur le format nominal mais sur la
     * place qui RESTE à la carte. Un carré n'est pas un paysage, et pourtant
     * la pile verticale n'y tient pas non plus : les bandes du bas sont en
     * unités absolues, elles mangent la même hauteur sur 1080 que sur 1920.
     * On mesure donc, et on recompose dès que le médaillon descend sous 38 %
     * de la page. */
    var hCarteEmpilee = (g.bottom - hTotaux - hJours - u(2) - hProfils - u(3)) - (g.top + u(13));
    var paysage = w > h * 1.25 || hCarteEmpilee < g.height * 0.38;
    var colD = paysage ? g.left + g.width * 0.52 : g.left;
    var largD = paysage ? g.width * 0.48 : g.width;

    var yTotaux  = g.bottom;                        // ligne de mention
    var yJours   = yTotaux - hTotaux - hJours + rJour;   // centre des disques
    var basProfils = yTotaux - hTotaux - hJours - u(2);
    var carte = paysage
      ? { x: g.left, y: g.top + u(13), w: g.width * 0.48, h: g.height - u(15) }
      : { x: g.left, y: g.top + u(13), w: g.width,
          h: (basProfils - hProfils - u(3)) - (g.top + u(13)) };

    /* ---------- la carte ---------- */
    var groupes = regroupe(avecGPS);
    dessineCarte(carte, groupes);

    /* ---------- les profils ---------- */
    if (complete) profils(basProfils - hProfils, basProfils - u(4), colD, largD);

    /* ---------- les sept jours ---------- */
    ligneDesJours(yJours, semaine, colD, largD);

    /* ---------- les totaux ---------- */
    totaux(yTotaux, colD, largD);

    /* ================= carte ================= */

    /* Regroupement par proximité : deux sorties dont les cadres se touchent
     * (à une tolérance près) vont dans le même médaillon. Le critère est
     * géographique, pas le nom ni le jour. */
    function regroupe(list) {
      var vues = list.map(function (e) {
        var v = Alpage.projetteAbs ? null : null;
        return { entree: e, vue: Alpage.projette(e.activity.track) };
      }).filter(function (x) { return x.vue.pts.length > 1; });
      if (!vues.length) return [];

      /* On travaille en degrés pour comparer des sorties centrées ailleurs :
       * la projection locale de chacune a son propre centre. */
      var items = vues.map(function (x) {
        var t = x.entree.activity.track.filter(function (p) { return p.lat != null; });
        var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
        t.forEach(function (p) {
          if (p.lat < laMin) laMin = p.lat; if (p.lat > laMax) laMax = p.lat;
          if (p.lon < loMin) loMin = p.lon; if (p.lon > loMax) loMax = p.lon;
        });
        return { entree: x.entree, laMin: laMin, laMax: laMax, loMin: loMin, loMax: loMax };
      });

      var groupes = [];
      items.forEach(function (it) {
        var cible = null;
        for (var i = 0; i < groupes.length; i++) {
          if (proches(groupes[i], it)) { cible = groupes[i]; break; }
        }
        if (!cible) {
          groupes.push({ items: [it], laMin: it.laMin, laMax: it.laMax, loMin: it.loMin, loMax: it.loMax });
        } else {
          cible.items.push(it);
          cible.laMin = Math.min(cible.laMin, it.laMin); cible.laMax = Math.max(cible.laMax, it.laMax);
          cible.loMin = Math.min(cible.loMin, it.loMin); cible.loMax = Math.max(cible.loMax, it.loMax);
        }
      });
      return groupes;

      /* Tolérance : trois fois l'étendue du groupe, au moins 8 km. Deux
       * sorties de la même vallée se regroupent, deux week-ends à trois
       * cents kilomètres non. */
      function proches(gr, it) {
        var etendue = Math.max(gr.laMax - gr.laMin, (gr.loMax - gr.loMin) * 0.7, 0.03);
        var tol = Math.max(0.072, etendue * 3);   // 0,072° ≈ 8 km
        return !(it.laMin > gr.laMax + tol || it.laMax < gr.laMin - tol ||
                 it.loMin > gr.loMax + tol * 1.4 || it.loMax < gr.loMin - tol * 1.4);
      }
    }

    function dessineCarte(boite, groupes) {
      if (!groupes.length) {
        H.text('aucune trace GPS cette semaine', boite.x, boite.y + boite.h / 2,
               H.t('title', { color: faint, maxWidth: boite.w }));
        return;
      }
      var n = Math.min(groupes.length, 3);
      var cols = n === 1 ? 1 : 2;
      var rows = Math.ceil(n / cols);
      var cw = boite.w / cols, chh = boite.h / rows;

      groupes.slice(0, n).forEach(function (gr, k) {
        var cx = boite.x + (k % cols) * cw + cw / 2;
        var cy = boite.y + Math.floor(k / cols) * chh + chh / 2;
        var rayon = Math.min(cw, chh) * (n === 1 ? 0.46 : 0.40);
        medaillon(gr, cx, cy, rayon, n > 1 ? k : -1);
      });

      if (groupes.length > 3) {
        H.text((groupes.length - 3) + ' AUTRES RÉGIONS NON REPRÉSENTÉES',
               boite.x, boite.y + boite.h, H.t('label', { color: faint }));
      }
    }

    function medaillon(gr, cx, cy, rayon, index) {
      var laC = (gr.laMin + gr.laMax) / 2, loC = (gr.loMin + gr.loMax) / 2;
      var cos = Math.cos(laC * Math.PI / 180);
      var etX = (gr.loMax - gr.loMin) * cos * 111320;
      var etY = (gr.laMax - gr.laMin) * 110540;
      var etendue = Math.max(etX, etY) || 1000;
      var k = (rayon * 1.72) / etendue;          // mètres → pixels
      function proj(p) {
        return { x: cx + (p.lon - loC) * cos * 111320 * k,
                 y: cy - (p.lat - laC) * 110540 * k };
      }

      // le disque du médaillon : un aplat très discret, sans contour appuyé
      ctx.save();
      ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2);
      ctx.fillStyle = melange(encre, 0.045);
      ctx.fill();
      ctx.strokeStyle = melange(encre, 0.13);
      ctx.lineWidth = u(0.07);
      ctx.stroke();
      ctx.restore();

      var reveles = H.progressCount(gr.items.length);
      gr.items.forEach(function (it, i) {
        if (i >= reveles) return;
        var t = it.entree.activity.track.filter(function (p) { return p.lat != null; });
        var couleur = couleurDe(it.entree, i);
        /* Deux passes : hors du cercle en atténué, dedans en pleine encre.
         * Le parcours reste ENTIER et à la même échelle des deux côtés. */
        [[false, 0.28, u(0.22)], [true, 1, u(0.42)]].forEach(function (passe) {
          ctx.save();
          if (passe[0]) { ctx.beginPath(); ctx.arc(cx, cy, rayon, 0, Math.PI * 2); ctx.clip(); }
          ctx.globalAlpha = passe[1];
          ctx.beginPath();
          t.forEach(function (p, j) {
            var q = proj(p);
            if (j === 0) ctx.moveTo(q.x, q.y); else ctx.lineTo(q.x, q.y);
          });
          ctx.strokeStyle = couleur;
          ctx.lineWidth = passe[2];
          ctx.lineJoin = ctx.lineCap = 'round';
          ctx.stroke();
          ctx.restore();
        });
      });

      // l'échelle de CE médaillon : sans elle, deux cercles côte à côte
      // laisseraient croire à une échelle commune
      var kmBarre = choisitPas(etendue / 1000);
      var lp = kmBarre * 1000 * k;
      ctx.save();
      ctx.strokeStyle = melange(encre, 0.45); ctx.lineWidth = u(0.11);
      var by = cy + rayon + u(3.4), bx = cx - lp / 2;
      ctx.beginPath();
      ctx.moveTo(bx, by); ctx.lineTo(bx + lp, by);
      ctx.moveTo(bx, by - u(0.7)); ctx.lineTo(bx, by + u(0.7));
      ctx.moveTo(bx + lp, by - u(0.7)); ctx.lineTo(bx + lp, by + u(0.7));
      ctx.stroke(); ctx.restore();
      H.text(kmBarre + ' KM' + (index >= 0 ? '  ·  RÉGION ' + (index + 1) : ''),
             cx, by + u(3.4), H.t('label', { color: faint, align: 'center' }));
    }

    function choisitPas(km) {
      var candidats = [0.5, 1, 2, 5, 10, 20, 50, 100];
      for (var i = 0; i < candidats.length; i++) if (candidats[i] >= km / 3) return candidats[i];
      return 100;
    }

    /* ================= profils ================= */

    function profils(y0, y1, colX, colW) {
      var avecProfil = avecGPS.filter(function (e) { return (e.activity.profile || []).length > 3; });
      if (!avecProfil.length) return;
      var haut = y1 - y0;
      var larg = colW / avecProfil.length;
      /* Échelle verticale commune : sinon une bosse de 40 m aurait la même
       * allure qu'un col de 1 200. */
      var ampMax = Math.max.apply(null, avecProfil.map(function (e) {
        return e.activity.elev_gain_m || 0;
      })) || 1;
      avecProfil.forEach(function (e, i) {
        var x = colX + i * larg;
        var amp = (e.activity.elev_gain_m || 0) / ampMax;
        var prof = e.activity.profile;
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x, y1);
        prof.forEach(function (p) {
          ctx.lineTo(x + p.x * (larg - u(2)), y1 - p.y * haut * amp);
        });
        ctx.lineTo(x + (larg - u(2)), y1);
        ctx.closePath();
        ctx.fillStyle = melange(encre, 0.14);
        ctx.fill();
        ctx.strokeStyle = couleurDe(e, i);
        ctx.lineWidth = u(0.18);
        ctx.stroke();
        ctx.restore();
      });
      H.text('PROFILS — ÉCHELLE VERTICALE COMMUNE', colX, y1 + u(3.4),
             H.t('label', { color: faint, maxWidth: colW }));
    }

    /* ================= les sept jours ================= */

    function ligneDesJours(y, list, colX, colW) {
      var parJour = [0, 0, 0, 0, 0, 0, 0];
      var compte = [0, 0, 0, 0, 0, 0, 0];
      list.forEach(function (e) {
        var j = (e.activity.date.getDay() + 6) % 7;
        parJour[j] += e.activity.duration_s || 0;
        compte[j]++;
      });
      var max = Math.max.apply(null, parJour) || 1;
      colX = colX == null ? g.left : colX;
      colW = colW == null ? g.width : colW;
      var pas = colW / 7;
      var rMax = Math.min(rJour, pas * 0.34);

      ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(function (lettre, i) {
        var cx = colX + pas * (i + 0.5);
        if (parJour[i] > 0) {
          // SURFACE proportionnelle au temps : d'où la racine carrée
          var r = rMax * Math.sqrt(parJour[i] / max);
          ctx.save();
          ctx.fillStyle = melange(encre, 0.78);
          ctx.beginPath(); ctx.arc(cx, y, Math.max(u(0.8), r), 0, Math.PI * 2);
          ctx.fill(); ctx.restore();
        } else {
          /* Jour sans activité ENREGISTRÉE — pas « jour de repos » : le
           * studio ne sait pas ce qui n'a pas été enregistré. */
          ctx.save();
          ctx.strokeStyle = melange(encre, 0.28);
          ctx.lineWidth = u(0.1);
          ctx.beginPath(); ctx.arc(cx, y, u(0.85), 0, Math.PI * 2);
          ctx.stroke(); ctx.restore();
        }
        H.text(lettre, cx, y + rMax + u(3.6),
               H.t('label', { color: faint, align: 'center' }));
      });
      H.text('SURFACE DES DISQUES ∝ TEMPS EN MOUVEMENT · CERCLE VIDE = AUCUNE ACTIVITÉ ENREGISTRÉE',
             colX, y + rMax + u(7.4), H.t('label', { color: melange(encre, 0.34), maxWidth: colW }));
    }

    /* ================= totaux ================= */

    function totaux(y, colX, colW) {
      H.rule(colX, y - u(8.4), colX + colW, { color: hair });
      var km = semaine.reduce(function (t, e) { return t + (e.activity.distance_km || 0); }, 0);
      var sec = semaine.reduce(function (t, e) { return t + (e.activity.duration_s || 0); }, 0);
      var dp = semaine.reduce(function (t, e) { return t + (e.activity.elev_gain_m || 0); }, 0);
      [['distance', H.fmt.km(km, 0) + ' km'],
       ['en mouvement', H.fmt.duration(sec)],
       ['dénivelé', Math.round(dp) + ' m']].forEach(function (c, i) {
        H.field(c[0], c[1], colX + i * (colW / 3), y - u(5), {
          color: encre, labelColor: faint, size: 5.4, maxWidth: colW / 3 - u(2)
        });
      });

      var mentions = [semaine.length + (semaine.length > 1 ? ' sorties' : ' sortie')];
      if (sansGPS.length) mentions.push(sansGPS.length + ' sans GPS — comptées, hors carte');
      if (sansDate) mentions.push(sansDate + ' sans date — hors semaine');
      H.text(mentions.join('   ·   ').toUpperCase(), colX, y,
             H.t('label', { color: faint, maxWidth: colW }));
    }

    /* ================= utilitaires ================= */

    function couleurDe(e, i) {
      if (o.couleurs === 'activite') return e.couleur || encre;
      var acc = Math.round(o.accent);
      return (acc > 0 && acc - 1 === i) ? o.accentC : melange(encre, 0.8);
    }


    function jourMois(d) {
      return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'short' });
    }

    /* Le fuseau est AFFICHÉ : une semaine « du lundi au dimanche » n'a pas
     * les mêmes bornes à Zurich et à Vancouver, et une sortie du dimanche
     * soir peut basculer. */
    function fuseau() {
      try {
        return (Intl.DateTimeFormat().resolvedOptions().timeZone || 'heure locale').toUpperCase();
      } catch (e) { return 'HEURE LOCALE'; }
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
