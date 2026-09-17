/* « Métro » — la semaine en plan de réseau.
 *
 * Chaque sortie devient une ligne, les lieux où deux sorties se sont
 * vraiment croisées deviennent des correspondances, et quelques points
 * remarquables deviennent des stations.
 *
 * Quatre décisions portent toute la planche :
 *
 *   1. UN CADRAGE COMMUN. Toutes les sorties sont projetées dans le MÊME
 *      repère géographique. C'est ce qui rend la proximité lisible : deux
 *      lignes ne se touchent que si elles se sont touchées. Quand une sortie
 *      est trop loin des autres pour tenir dans ce repère sans devenir un
 *      point, la planche le DIT et bascule en réseaux séparés — plutôt que
 *      d'afficher une tache et de laisser croire à une sortie minuscule.
 *
 *   2. LES NŒUDS NE BOUGENT PAS, LES SEGMENTS SE REDRESSENT. On simplifie la
 *      trace, on cale ses nœuds sur une grille, puis on relie deux nœuds
 *      voisins par une diagonale à 45° et un segment d'axe. L'alternative
 *      classique — avancer d'octile en octile en conservant les longueurs —
 *      donne un plus beau plan mais dérive : au bout de vingt segments la
 *      ligne n'est plus là où la sortie est passée, et les correspondances
 *      deviennent décoratives. Ici la position reste vraie.
 *
 *   3. UNE CORRESPONDANCE EST GÉOGRAPHIQUE, PAS VISUELLE. Deux traits qui se
 *      croisent à l'écran ne font pas une correspondance : le croisement
 *      peut être un artefact du redressement. On compare les nœuds en
 *      MÈTRES, sur les coordonnées d'origine.
 *
 *   4. LES ÉTIQUETTES NE SE CHEVAUCHENT PAS. Chaque nom essaie huit
 *      positions autour de sa station et prend la première libre. Un plan de
 *      métro dont les noms se superposent n'est plus un plan.
 */
Studio.template({
  id: 'metro',
  name: 'Métro — plusieurs sorties en réseau',
  famille: 'serie',
  multi: true,

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#F4F1EA' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#16161A' },
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'cadrage', type: 'select', label: 'Cadrage', default: 'auto', reflow: true,
      choices: [['auto', 'Automatique'],
                ['commun', 'Commun — un seul réseau'],
                ['separe', 'Séparé — un réseau par sortie']] },
    { key: 'detail', type: 'range', label: 'Détail du tracé', default: 26, min: 10, max: 46, step: 2 },
    { key: 'seuil', type: 'range', label: 'Correspondance (m)', default: 250, min: 60, max: 900, step: 20 },
    { key: 'stations', type: 'range', label: 'Stations au plus', default: 8, min: 3, max: 14, step: 1 },
    { key: 'noms', type: 'text', label: 'Renommer (dans l’ordre, séparés par ;)', default: '' },
    { key: 'legende', type: 'toggle', label: 'Légende des lignes', default: true },
    { key: 'chiffres', type: 'toggle', label: 'Totaux en pied', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre;
    var faint = melange(ink, 0.45), hair = melange(ink, 0.14);

    var entrees = (s.library || []).filter(function (e) {
      return e.activity && e.activity.track && e.activity.track.length > 3;
    });

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(7) });

    if (entrees.length < 2) {
      H.text('Charge au moins deux sorties', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('un réseau demande plusieurs lignes', g.left, g.top + g.height * 0.45 + u(5),
             H.t('label', { color: faint }));
      return;
    }

    /* ---------- cadrage ---------- */
    var cadre = cadreCommun(entrees);
    var separe = o.cadrage === 'separe' ||
                 (o.cadrage === 'auto' && cadre.eloignees.length > 0);

    /* ---------- zones ---------- */
    var hautPlan = g.top + u(9);
    var basPlan = g.bottom - (o.legende ? u(4.5) * entrees.length + u(8) : u(2)) -
                  (o.chiffres ? u(9) : 0);
    var plan = { x: g.left, y: hautPlan, w: g.width, h: Math.max(u(30), basPlan - hautPlan) };

    /* ---------- en-tête ---------- */
    H.text(String(o.titre || '').trim() || 'Réseau', g.left, g.top + u(3.6),
           H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(entrees.length + ' lignes', g.right, g.top + u(3.6),
           H.t('label', { color: faint, align: 'right' }));

    /* ---------- les lignes ---------- */
    var lignes = [];       // { entree, noeuds: [{x,y,lat,lon,ele,i}], chemin: [[x,y],…] }
    var pasGrille;

    if (separe) {
      var cols = entrees.length <= 2 ? 1 : entrees.length <= 6 ? 2 : 3;
      var rows = Math.ceil(entrees.length / cols);
      var cw = plan.w / cols, chh = plan.h / rows;
      pasGrille = Math.min(cw, chh) / (o.detail * 0.6);
      var reste = entrees.length % cols;
      var decale = reste ? (cols - reste) * cw / 2 : 0;
      var derniere = Math.floor((entrees.length - 1) / cols);
      entrees.forEach(function (e, i) {
        var rangee = Math.floor(i / cols);
        var cell = { x: plan.x + (i % cols) * cw + u(2) + (rangee === derniere ? decale : 0),
                     y: plan.y + rangee * chh + u(2),
                     w: cw - u(4), h: chh - u(10) };
        lignes.push(construit(e, cadrePropre(e), cell, pasGrille, i));
      });
    } else {
      pasGrille = Math.min(plan.w, plan.h) / o.detail;
      entrees.forEach(function (e, i) {
        lignes.push(construit(e, cadre, plan, pasGrille, i));
      });
    }

    /* ---------- stations ---------- */
    var stations = trouveStations(lignes);
    renomme(stations);

    /* ---------- dessin ---------- */
    lignes.forEach(function (l) { traceLigne(l); });
    stations.forEach(function (st) { pastille(st); });
    etiquettes(stations);

    if (separe) {
      lignes.forEach(function (l, i) {
        H.text(Library.nomCourt(l.entree.activity, 22).toUpperCase(),
               l.boite.x, l.boite.y + l.boite.h + u(4),
               H.t('label', { color: faint, maxWidth: l.boite.w }));
      });
      H.text('RÉSEAUX SÉPARÉS — LES CORRESPONDANCES DEMANDENT UN CADRAGE COMMUN',
             g.left, hautPlan - u(3.4), H.t('label', { color: melange(ink, 0.6), maxWidth: g.width }));
    }

    /* ---------- légende ---------- */
    var y = basPlan + u(6);
    if (o.legende) {
      lignes.forEach(function (l) {
        var st = stations.filter(function (x) { return x.lignes.indexOf(l) >= 0; });
        ctx.save();
        ctx.strokeStyle = l.couleur; ctx.lineWidth = u(0.9); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(g.left, y - u(1)); ctx.lineTo(g.left + u(5), y - u(1)); ctx.stroke();
        ctx.restore();
        H.text(Library.nomCourt(l.entree.activity, 26), g.left + u(7), y,
               H.t('label', { color: ink, maxWidth: g.w(4) }));
        H.text(H.fmt.km(l.entree.activity.distance_km, 1) + ' km · ' + st.length + ' stations',
               g.right, y, H.t('label', { color: faint, align: 'right' }));
        y += u(4.5);
      });
    }

    if (o.chiffres) {
      var totKm = entrees.reduce(function (t, e) { return t + (e.activity.distance_km || 0); }, 0);
      var corr = stations.filter(function (x) { return x.lignes.length > 1; }).length;
      H.rule(g.left, g.bottom - u(7.5), g.right, { color: hair });
      [['réseau', H.fmt.km(totKm, 0) + ' km'],
       ['lignes', String(entrees.length)],
       ['correspondances', String(corr)]].forEach(function (c, i) {
        H.field(c[0], c[1], g.left + i * (g.width / 3), g.bottom - u(4),
                { color: ink, labelColor: faint, size: 4.2, maxWidth: g.width / 3 - u(2) });
      });
    }

    /* ================= cadrage ================= */

    /* Repère commun : équirectangulaire, avec la correction en cosinus de la
     * latitude. Sans elle, à 46° nord, un degré de longitude vaut 0,69 degré
     * de latitude et tout le réseau est étiré horizontalement. */
    function cadreCommun(list) {
      var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
      list.forEach(function (e) {
        e.activity.track.forEach(function (p) {
          if (p.lat == null) return;
          if (p.lat < laMin) laMin = p.lat;
          if (p.lat > laMax) laMax = p.lat;
          if (p.lon < loMin) loMin = p.lon;
          if (p.lon > loMax) loMax = p.lon;
        });
      });
      var c = Math.cos((laMin + laMax) / 2 * Math.PI / 180);
      var etX = (loMax - loMin) * c, etY = (laMax - laMin);
      var ech = Math.max(etX, etY) || 1;
      var cadre = {
        proj: function (lat, lon) {
          return { x: 0.5 + ((lon - (loMin + loMax) / 2) * c) / ech,
                   y: 0.5 - (lat - (laMin + laMax) / 2) / ech };
        },
        eloignees: []
      };
      /* Une sortie qui n'occupe presque rien du cadre commun n'est pas
       * lisible : c'est le signe que les sorties ne partagent pas de
       * territoire. On le remonte plutôt que de dessiner une tache. */
      list.forEach(function (e) {
        var ex = etendue(e.activity);
        if (ex / ech < 0.14) cadre.eloignees.push(e.id);
      });
      return cadre;
    }

    function cadrePropre(e) {
      var t = e.activity.track, laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
      t.forEach(function (p) {
        if (p.lat == null) return;
        if (p.lat < laMin) laMin = p.lat;
        if (p.lat > laMax) laMax = p.lat;
        if (p.lon < loMin) loMin = p.lon;
        if (p.lon > loMax) loMax = p.lon;
      });
      var c = Math.cos((laMin + laMax) / 2 * Math.PI / 180);
      var ech = Math.max((loMax - loMin) * c, laMax - laMin) || 1;
      return { proj: function (lat, lon) {
        return { x: 0.5 + ((lon - (loMin + loMax) / 2) * c) / ech,
                 y: 0.5 - (lat - (laMin + laMax) / 2) / ech };
      } };
    }

    function etendue(act) {
      var t = act.track, laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
      t.forEach(function (p) {
        if (p.lat == null) return;
        if (p.lat < laMin) laMin = p.lat;
        if (p.lat > laMax) laMax = p.lat;
        if (p.lon < loMin) loMin = p.lon;
        if (p.lon > loMax) loMax = p.lon;
      });
      if (!isFinite(laMin)) return 0;
      var c = Math.cos(laMin * Math.PI / 180);
      return Math.max((loMax - loMin) * c, laMax - laMin);
    }

    /* ================= construction d'une ligne ================= */

    function construit(e, cadre, boite, pas, rang) {
      var t = e.activity.track.filter(function (p) { return p.lat != null; });
      /* Une maille de marge : le calage sur la grille et le décalage de ligne
       * peuvent pousser un nœud au-delà de la projection, et le plan mordait
       * sur la marge droite de la page. */
      var cote = Math.min(boite.w, boite.h) - 2 * pas;
      var ox = boite.x + (boite.w - cote) / 2, oy = boite.y + (boite.h - cote) / 2;

      var brut = t.map(function (p, i) {
        var q = cadre.proj(p.lat, p.lon);
        return { x: ox + q.x * cote, y: oy + q.y * cote, lat: p.lat, lon: p.lon, ele: p.ele, i: i };
      });

      var simple = douglasPeucker(brut, pas * 0.55);
      // toujours garder le premier et le dernier point réels
      if (simple[0] !== brut[0]) simple.unshift(brut[0]);
      if (simple[simple.length - 1] !== brut[brut.length - 1]) simple.push(brut[brut.length - 1]);

      /* Décalage constant par ligne : deux sorties sur le même chemin se
       * superposeraient au pixel près et l'une effacerait l'autre. Le
       * décalage est petit (un quart de maille) et n'entre JAMAIS dans la
       * détection des correspondances, qui reste géographique. */
      var ang = rang * 2.399963;                    // angle d'or : réparti, déterministe
      var dx = Math.cos(ang) * pas * 0.22, dy = Math.sin(ang) * pas * 0.22;

      var noeuds = simple.map(function (p) {
        return { x: Math.round((p.x - ox) / pas) * pas + ox + dx,
                 y: Math.round((p.y - oy) / pas) * pas + oy + dy,
                 lat: p.lat, lon: p.lon, ele: p.ele, i: p.i };
      });

      return {
        entree: e, couleur: e.couleur, boite: boite, pas: pas,
        noeuds: noeuds, chemin: redresse(noeuds)
      };
    }

    /* Deux nœuds voisins reliés par une diagonale à 45° et un segment d'axe.
     * L'ordre (diagonale d'abord ou axe d'abord) alterne : deux coudes
     * toujours du même côté donnent un escalier, pas un plan. */
    function redresse(noeuds) {
      var out = [[noeuds[0].x, noeuds[0].y]];
      for (var k = 1; k < noeuds.length; k++) {
        var a = noeuds[k - 1], b = noeuds[k];
        var dx = b.x - a.x, dy = b.y - a.y;
        var adx = Math.abs(dx), ady = Math.abs(dy);
        var d = Math.min(adx, ady);
        var sx = dx < 0 ? -1 : 1, sy = dy < 0 ? -1 : 1;
        if (adx === 0 || ady === 0 || adx === ady) { out.push([b.x, b.y]); continue; }
        if (k % 2) {
          // diagonale, puis axe
          out.push([a.x + sx * d, a.y + sy * d]);
        } else {
          // axe, puis diagonale
          if (adx > ady) out.push([a.x + sx * (adx - ady), a.y]);
          else out.push([a.x, a.y + sy * (ady - adx)]);
        }
        out.push([b.x, b.y]);
      }
      return out;
    }

    /* Douglas-Peucker itératif : la version récursive explose la pile sur une
     * trace de vingt mille points. */
    function douglasPeucker(pts, eps) {
      if (pts.length < 3) return pts.slice();
      var garde = new Array(pts.length);
      garde[0] = garde[pts.length - 1] = true;
      var pile = [[0, pts.length - 1]];
      while (pile.length) {
        var seg = pile.pop(), a = seg[0], b = seg[1];
        var max = 0, idx = -1;
        for (var k = a + 1; k < b; k++) {
          var d = distSegment(pts[k], pts[a], pts[b]);
          if (d > max) { max = d; idx = k; }
        }
        if (max > eps && idx > 0) {
          garde[idx] = true;
          pile.push([a, idx], [idx, b]);
        }
      }
      return pts.filter(function (p, i) { return garde[i]; });
    }

    function distSegment(p, a, b) {
      var vx = b.x - a.x, vy = b.y - a.y;
      var l2 = vx * vx + vy * vy;
      if (!l2) return Math.hypot(p.x - a.x, p.y - a.y);
      var t = Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2));
      return Math.hypot(p.x - (a.x + t * vx), p.y - (a.y + t * vy));
    }

    /* ================= stations ================= */

    function trouveStations(lignes) {
      var candidats = [];

      /* 1. Correspondances : des nœuds de DEUX lignes différentes à moins de
       *    `seuil` mètres l'un de l'autre. En mètres et sur les coordonnées
       *    d'origine — le redressement n'a pas voix au chapitre.
       *
       *    En cadrage SÉPARÉ, il n'y en a pas : chaque ligne vit dans sa
       *    propre case, et une correspondance n'aurait aucun endroit où se
       *    poser. Le premier jet en plaçait une au milieu du blanc, entre
       *    deux cases — une pastille qui ne désignait rien. */
      var seuil = Number(o.seuil) || 250;
      for (var i = 0; separe ? false : i < lignes.length; i++) {
        for (var j = i + 1; j < lignes.length; j++) {
          lignes[i].noeuds.forEach(function (na) {
            lignes[j].noeuds.forEach(function (nb) {
              if (metres(na, nb) > seuil) return;
              fusionne(candidats, {
                x: (na.x + nb.x) / 2, y: (na.y + nb.y) / 2,
                lat: na.lat, lon: na.lon,
                lignes: [lignes[i], lignes[j]], role: 'correspondance',
                nom: 'Correspondance', poids: 3
              }, seuil);
            });
          });
        }
      }

      /* 2. Le point culminant de chaque ligne — s'il y a une altitude. */
      lignes.forEach(function (l) {
        var best = null;
        l.noeuds.forEach(function (n) { if (n.ele != null && (!best || n.ele > best.ele)) best = n; });
        if (!best) return;
        fusionne(candidats, {
          x: best.x, y: best.y, lat: best.lat, lon: best.lon,
          lignes: [l], role: 'sommet', nom: Math.round(best.ele) + ' m', poids: 2
        }, seuil);
      });

      /* 3. Départ et arrivée. Une boucle revient à son point de départ : une
       *    seule station, nommée pour les deux. */
      lignes.forEach(function (l) {
        var a = l.noeuds[0], b = l.noeuds[l.noeuds.length - 1];
        var boucle = metres(a, b) < Math.max(seuil, 150);
        fusionne(candidats, {
          x: a.x, y: a.y, lat: a.lat, lon: a.lon, lignes: [l],
          role: boucle ? 'boucle' : 'depart',
          nom: boucle ? 'Départ / Arrivée' : 'Départ', poids: 1
        }, seuil);
        if (!boucle) {
          fusionne(candidats, {
            x: b.x, y: b.y, lat: b.lat, lon: b.lon, lignes: [l],
            role: 'arrivee', nom: 'Arrivée', poids: 1
          }, seuil);
        }
      });

      /* On garde les plus signifiantes : les correspondances d'abord. */
      candidats.sort(function (p, q) {
        return (q.poids - p.poids) || (q.lignes.length - p.lignes.length);
      });
      return candidats.slice(0, Math.max(3, Math.round(o.stations)));
    }

    /* Deux candidats au même endroit n'en font qu'un : sans cette fusion, un
     * départ posé sur une correspondance donne deux pastilles superposées et
     * deux étiquettes qui se disputent la place. */
    function fusionne(liste, cand, seuil) {
      for (var k = 0; k < liste.length; k++) {
        if (metres(liste[k], cand) <= seuil) {
          cand.lignes.forEach(function (l) {
            if (liste[k].lignes.indexOf(l) < 0) liste[k].lignes.push(l);
          });
          if (cand.poids > liste[k].poids) { liste[k].role = cand.role; liste[k].nom = cand.nom; liste[k].poids = cand.poids; }
          return;
        }
      }
      liste.push(cand);
    }

    function metres(a, b) {
      if (a.lat == null || b.lat == null) return Infinity;
      var R = 6371000, r = Math.PI / 180;
      var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
      var x = Math.sin(dLat / 2), y = Math.sin(dLon / 2);
      var c = x * x + Math.cos(a.lat * r) * Math.cos(b.lat * r) * y * y;
      return 2 * R * Math.asin(Math.min(1, Math.sqrt(c)));
    }

    /* Renommage : une liste dans l'ordre des stations, séparée par des
     * points-virgules. Un champ vide garde le nom d'origine, ce qui permet
     * de ne renommer que la troisième sans écrire les deux premières. */
    function renomme(stations) {
      var liste = String(o.noms || '').split(';');
      stations.forEach(function (st, i) {
        var n = (liste[i] || '').trim();
        if (n) st.nom = n;
        st.index = i + 1;
      });
    }

    /* ================= dessin ================= */

    function traceLigne(l) {
      ctx.save();
      ctx.strokeStyle = l.couleur;
      ctx.lineWidth = Math.max(u(0.5), l.pas * 0.22);
      ctx.lineJoin = ctx.lineCap = 'round';
      var vus = H.progressCount(l.chemin.length);
      ctx.beginPath();
      l.chemin.forEach(function (p, i) {
        if (i >= vus) return;
        if (i === 0) ctx.moveTo(p[0], p[1]); else ctx.lineTo(p[0], p[1]);
      });
      ctx.stroke();
      ctx.restore();
    }

    /* Une correspondance se dessine comme dans un vrai plan : un anneau
     * blanc cerclé d'encre, assez gros pour qu'on le lise comme un nœud. */
    function pastille(st) {
      var r = st.lignes.length > 1 ? u(1.5) : u(0.95);
      ctx.save();
      ctx.beginPath(); ctx.arc(st.x, st.y, r, 0, Math.PI * 2);
      ctx.fillStyle = o.fond; ctx.fill();
      ctx.lineWidth = u(0.32);
      ctx.strokeStyle = st.lignes.length > 1 ? ink : st.lignes[0].couleur;
      ctx.stroke();
      ctx.restore();
    }

    /* Huit positions candidates autour de la station ; on prend la première
     * qui ne recouvre aucune étiquette déjà posée. Si aucune n'est libre, on
     * garde la moins mauvaise plutôt que de sauter l'étiquette : une station
     * sans nom est pire qu'un nom un peu serré. */
    function etiquettes(stations) {
      var poses = [];
      var style = H.t('label', { color: ink });
      var pas = u(2.6);
      var DIRS = [[1, -0.2], [1, 1], [-1, -0.2], [-1, 1], [0, -1.3], [0, 1.6], [1, -1.2], [-1, -1.2]];

      stations.forEach(function (st) {
        var txt = st.index + ' · ' + st.nom;
        var larg = H.measureWith(txt.toUpperCase(), style, style.size);
        var haut = style.size * 1.15;
        var best = null, bestMal = Infinity;
        DIRS.forEach(function (d) {
          var x = st.x + d[0] * pas + (d[0] < 0 ? -larg : 0) + (d[0] === 0 ? -larg / 2 : 0);
          var y = st.y + d[1] * pas;
          var r = { x: x, y: y - haut, w: larg, h: haut };
          var mal = debordement(r) + poses.reduce(function (m, p) { return m + chevauche(r, p); }, 0);
          if (mal < bestMal) { bestMal = mal; best = r; }
        });
        poses.push(best);
        H.text(txt, best.x, best.y + haut * 0.82,
               H.t('label', { color: ink, maxWidth: g.width }));
      });

      function chevauche(a, b) {
        var ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        var oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
        return (ox > 0 && oy > 0) ? ox * oy : 0;
      }
      function debordement(r) {
        var d = 0;
        if (r.x < g.left) d += (g.left - r.x) * r.h * 4;
        if (r.x + r.w > g.right) d += (r.x + r.w - g.right) * r.h * 4;
        if (r.y < plan.y - u(4)) d += (plan.y - u(4) - r.y) * r.w * 4;
        if (r.y + r.h > basPlan) d += (r.y + r.h - basPlan) * r.w * 4;
        return d;
      }
    }

    /* délègue à Alpage : une seule définition pour tout le studio */
    function melange(hex, k) { return Alpage.melange(hex, k); }
  }
});
