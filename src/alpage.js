/* alpage.js — le socle des compositions « Alpage ».
 *
 * Les six planches Encre, Strates, Empreinte, Atlas, Médaillon et
 * Constellation partagent une direction artistique et, surtout, la même
 * géométrie. Ce fichier tient la partie qui ne dessine pas : projeter,
 * rééchantillonner, mesurer une courbure, décaler une polyligne, fabriquer
 * un ruban. Les templates s'occupent des pixels.
 *
 * Pourquoi cette séparation compte ici plus qu'ailleurs : « Fibres »
 * (Encre), les contours d'« Empreinte » et les hachures de « Strates » sont
 * trois usages du MÊME décalage de polyligne. Écrit trois fois, il aurait
 * trois bogues différents aux virages serrés.
 *
 * Une règle traverse tout le fichier : RIEN N'EST ALÉATOIRE. Là où il faut
 * de l'irrégularité — la matière d'une encre, le tremblé d'un contour —
 * elle vient d'un bruit semé par la géométrie de la sortie. Même activité,
 * mêmes réglages, même image, aujourd'hui et dans six mois.
 */
(function (global) {
  'use strict';

  /* ---------- palette ----------
   * Papier, encre, et trois accents. Deux accents au plus par composition :
   * au-delà, une affiche cesse d'avoir un point de fixation. */
  var PALETTE = {
    papier: '#F2EFE6',
    encre:  '#242820',
    rouille:'#A54F37',
    bleu:   '#355E70',
    ocre:   '#C99A32',
    charbon:'#191B18'
  };

  /* ---------- projection locale ----------
   * Équirectangulaire centrée sur la sortie, en MÈTRES. Toutes les mesures
   * de longueur, de courbure et de décalage qui suivent supposent une unité
   * métrique : les faire en degrés donnerait des décalages une fois et demie
   * plus larges en longitude qu'en latitude, à nos latitudes. */
  function projette(track) {
    var pts = (track || []).filter(function (p) { return p.lat != null && isFinite(p.lat); });
    if (pts.length < 2) return { pts: [], centre: null, etendue: 0 };
    var laSum = 0, loSum = 0;
    pts.forEach(function (p) { laSum += p.lat; loSum += p.lon; });
    var laC = laSum / pts.length, loC = loSum / pts.length;
    var cos = Math.cos(laC * Math.PI / 180);
    var out = pts.map(function (p, i) {
      return {
        x: (p.lon - loC) * cos * 111320,
        y: -(p.lat - laC) * 110540,          // y vers le bas, comme le canvas
        ele: p.ele, w: p.w, hr: p.hr, cad: p.cad, t: p.t, d: p.d, i: i
      };
    });
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    out.forEach(function (p) {
      if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
    });
    return {
      pts: out, centre: { lat: laC, lon: loC },
      minX: minX, maxX: maxX, minY: minY, maxY: maxY,
      largeur: maxX - minX, hauteur: maxY - minY,
      etendue: Math.max(maxX - minX, maxY - minY)
    };
  }

  /* ---------- rééchantillonnage par distance ----------
   * Un GPS enregistre au temps, pas à la distance : une montée à 6 km/h pose
   * cinq fois plus de points qu'une descente à 50. Sans ce passage, toute
   * modulation d'épaisseur ou de texture « par point » raconterait la
   * vitesse au lieu de la forme — et personne ne s'en apercevrait. */
  function reechantillonne(pts, pas) {
    if (pts.length < 2 || !(pas > 0)) return pts.slice();

    /* Un CURSEUR avance le long de la polyligne, indépendamment des points
     * émis. C'est la seule façon correcte, et la version naïve — mesurer
     * depuis le dernier point ÉMIS — se trompe silencieusement : sur une
     * portion densément échantillonnée elle recompte à chaque segment la
     * distance déjà parcourue, et sort des pas de 4, 5 puis 9 mètres là où
     * on en demandait 25. Le défaut ne se voit pas sur le dessin — il se voit
     * sur l'épaisseur du trait d'Encre, qui se remet alors à raconter la
     * densité des points GPS, c'est-à-dire la vitesse. */
    var out = [pts[0]];
    var reste = pas;                        // avant la prochaine émission
    var cx = pts[0].x, cy = pts[0].y;       // position du curseur
    for (var i = 1; i < pts.length; i++) {
      var b = pts[i];
      var dx = b.x - cx, dy = b.y - cy;
      var d = Math.hypot(dx, dy);
      if (d < 1e-12) continue;
      while (d >= reste) {
        var t = reste / d;
        cx += dx * t; cy += dy * t;
        var n = { x: cx, y: cy };
        // les mesures sont celles du point d'origine vers lequel on avance
        n.ele = b.ele; n.w = b.w; n.hr = b.hr; n.cad = b.cad; n.t = b.t; n.d = b.d; n.i = b.i;
        out.push(n);
        dx = b.x - cx; dy = b.y - cy; d = Math.hypot(dx, dy);
        reste = pas;
      }
      reste -= d;
      cx = b.x; cy = b.y;
    }
    var dernier = pts[pts.length - 1];
    var f = out[out.length - 1];
    if (Math.hypot(dernier.x - f.x, dernier.y - f.y) > pas * 0.35) out.push(dernier);
    return out;
  }

  /* Lissage par moyenne glissante : indispensable avant de dériver quoi que
   * ce soit d'une trace GPS, dont chaque point porte quelques mètres de
   * bruit. Sans lui, la courbure ci-dessous ne mesure que le bruit. */
  function lisse(pts, fenetre) {
    if (pts.length < 3 || fenetre < 1) return pts.slice();
    var out = [];
    for (var i = 0; i < pts.length; i++) {
      var a = Math.max(0, i - fenetre), b = Math.min(pts.length - 1, i + fenetre);
      var sx = 0, sy = 0, n = 0;
      for (var j = a; j <= b; j++) { sx += pts[j].x; sy += pts[j].y; n++; }
      var q = { x: sx / n, y: sy / n };
      q.ele = pts[i].ele; q.w = pts[i].w; q.hr = pts[i].hr; q.cad = pts[i].cad;
      q.t = pts[i].t; q.d = pts[i].d; q.i = pts[i].i;
      out.push(q);
    }
    return out;
  }

  /* ---------- courbure ----------
   * L'angle entre deux segments consécutifs, normalisé entre 0 et 1. C'est
   * ce qui donne son rythme au trait d'Encre : un virage serré épaissit,
   * une ligne droite s'affine. C'est un choix STYLISTIQUE, jamais présenté
   * comme une mesure — la planche le dit. */
  function courbure(pts, portee) {
    portee = portee || 3;
    var out = new Array(pts.length).fill(0);
    for (var i = portee; i < pts.length - portee; i++) {
      var a = pts[i - portee], b = pts[i], c = pts[i + portee];
      var a1 = Math.atan2(b.y - a.y, b.x - a.x);
      var a2 = Math.atan2(c.y - b.y, c.x - b.x);
      var d = Math.abs(normaliseAngle(a2 - a1));
      out[i] = Math.min(1, d / Math.PI);
    }
    for (var k = 0; k < portee; k++) { out[k] = out[portee]; out[pts.length - 1 - k] = out[pts.length - 1 - portee]; }
    return out;
  }

  function normaliseAngle(a) {
    while (a > Math.PI) a -= 2 * Math.PI;
    while (a < -Math.PI) a += 2 * Math.PI;
    return a;
  }

  /* ---------- normales ----------
   * La perpendiculaire à la trace en chaque point, moyennée sur les deux
   * segments adjacents. Aux extrémités on reprend la voisine : calculer une
   * normale sur un segment inexistant donne un NaN qui se propage dans tout
   * le ruban et fait disparaître la moitié du dessin. */
  function normales(pts) {
    var n = [];
    for (var i = 0; i < pts.length; i++) {
      var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      var dx = b.x - a.x, dy = b.y - a.y;
      var l = Math.hypot(dx, dy) || 1;
      n.push({ x: -dy / l, y: dx / l });
    }
    return n;
  }

  /* ---------- décalage parallèle ----------
   * Sert aux fibres d'Encre, aux contours d'Empreinte et aux hachures de
   * Strates. Décalage par les normales : simple, rapide, et il se replie sur
   * lui-même dans les virages plus serrés que le décalage. C'est acceptable
   * ici — le repli se remplit en nonzero et se lit comme une boucle d'encre,
   * pas comme un défaut. Un vrai offset de polygone (avec suppression des
   * boucles) demanderait dix fois le code pour un gain invisible à ces
   * échelles. */
  function decale(pts, d, norms) {
    var n = norms || normales(pts);
    return pts.map(function (p, i) {
      return { x: p.x + n[i].x * d, y: p.y + n[i].y * d, i: p.i };
    });
  }

  /* ---------- lissage des DIRECTIONS ----------
   *
   * Lisser les positions (`lisse`) arrondit la forme mais laisse des cassures
   * d'orientation : deux points voisins peuvent encore pointer dans des
   * directions très différentes, et c'est l'orientation — pas la position —
   * qui fabrique les normales, donc les bords du ruban.
   *
   * On reconstruit donc la polyligne en intégrant un ANGLE lissé, à pas
   * constant. La courbe qui en sort a une tangente continue par
   * construction : plus de facette, plus de pointe parasite. Le prix est une
   * légère dérive de position sur les longues portions, invisible à côté du
   * défaut qu'elle supprime.
   */
  function lisseDirections(pts, fenetre) {
    if (pts.length < 4) return pts.slice();
    var angles = [], longueurs = [];
    for (var i = 1; i < pts.length; i++) {
      var dx = pts[i].x - pts[i - 1].x, dy = pts[i].y - pts[i - 1].y;
      longueurs.push(Math.hypot(dx, dy));
      angles.push(Math.atan2(dy, dx));
    }
    /* Les angles se déroulent AVANT d'être moyennés : sans ça, un passage de
     * +179° à −179° donne une moyenne de 0° et la courbe repart à l'envers. */
    for (var k = 1; k < angles.length; k++) {
      while (angles[k] - angles[k - 1] > Math.PI) angles[k] -= 2 * Math.PI;
      while (angles[k] - angles[k - 1] < -Math.PI) angles[k] += 2 * Math.PI;
    }
    var lisses = [];
    for (var j = 0; j < angles.length; j++) {
      var a = Math.max(0, j - fenetre), b = Math.min(angles.length - 1, j + fenetre);
      var s = 0, n = 0;
      for (var m = a; m <= b; m++) { s += angles[m]; n++; }
      lisses.push(s / n);
    }
    var out = [{ x: pts[0].x, y: pts[0].y }];
    copie(out[0], pts[0]);
    for (var q = 0; q < lisses.length; q++) {
      var prec = out[out.length - 1];
      var p = { x: prec.x + Math.cos(lisses[q]) * longueurs[q],
                y: prec.y + Math.sin(lisses[q]) * longueurs[q] };
      copie(p, pts[q + 1]);
      out.push(p);
    }
    return out;
  }

  function copie(dest, src) {
    dest.ele = src.ele; dest.w = src.w; dest.hr = src.hr; dest.cad = src.cad;
    dest.t = src.t; dest.d = src.d; dest.i = src.i;
    return dest;
  }

  /* ---------- rayon de courbure local ----------
   *
   * R ≈ ds / dθ. Sert à BORNER la demi-largeur d'un ruban : au-delà de R,
   * le bord intérieur se replie et se croise, et le remplissage `nonzero`
   * annule alors la petite boucle — c'est l'encoche blanche qu'on voyait
   * le long du trait d'Encre. Ce n'est pas un défaut de rendu à masquer
   * avec de la texture : c'est une impossibilité géométrique, et la seule
   * réponse est de ne pas dépasser R.
   */
  function rayonsDeCourbure(pts, portee) {
    portee = portee || 2;
    var R = new Array(pts.length).fill(Infinity);
    for (var i = portee; i < pts.length - portee; i++) {
      var a = pts[i - portee], b = pts[i], c = pts[i + portee];
      var a1 = Math.atan2(b.y - a.y, b.x - a.x);
      var a2 = Math.atan2(c.y - b.y, c.x - b.x);
      var dth = Math.abs(normaliseAngle(a2 - a1));
      var ds = Math.hypot(b.x - a.x, b.y - a.y) + Math.hypot(c.x - b.x, c.y - b.y);
      R[i] = dth > 1e-6 ? ds / dth : Infinity;
    }
    for (var k = 0; k < portee; k++) { R[k] = R[portee]; R[pts.length - 1 - k] = R[pts.length - 1 - portee]; }
    return R;
  }

  /* Borne une série de demi-largeurs par le rayon de courbure, puis la
   * relisse : borner point par point crée une marche, et une marche dans
   * l'épaisseur se voit autant qu'une encoche. */
  function borneParCourbure(demi, pts, marge) {
    var R = rayonsDeCourbure(pts, 3);
    var out = demi.map(function (w, i) {
      return Math.min(w, R[i] * (marge == null ? 0.72 : marge));
    });
    // lissage large : l'épaisseur doit varier LENTEMENT, jamais par à-coups
    var f = Math.max(2, Math.round(pts.length / 40));
    var liss = [];
    for (var i = 0; i < out.length; i++) {
      var a = Math.max(0, i - f), b = Math.min(out.length - 1, i + f), s = 0, n = 0;
      for (var j = a; j <= b; j++) { s += out[j]; n++; }
      liss.push(s / n);
    }
    return liss;
  }

  /* ---------- ruban à épaisseur variable ----------
   * Un côté à l'aller, l'autre au retour : un seul polygone fermé. Rempli en
   * `nonzero`, il traite les croisements de la trace tout seuls — un
   * parcours qui se recoupe donne une tache d'encre pleine, ce qui est
   * exactement ce que fait une plume. Tracer un `stroke` à épaisseur
   * variable aurait demandé un segment par point, avec des raccords visibles
   * à chaque virage serré. */
  function ruban(pts, demiLargeurs) {
    var n = normales(pts);
    var gauche = [], droite = [];
    for (var i = 0; i < pts.length; i++) {
      var w = demiLargeurs[i];
      gauche.push({ x: pts[i].x + n[i].x * w, y: pts[i].y + n[i].y * w });
      droite.push({ x: pts[i].x - n[i].x * w, y: pts[i].y - n[i].y * w });
    }
    return gauche.concat(droite.reverse());
  }

  /* ---------- contours par champ de distance ----------
   *
   * Le décalage par les normales (`decale`) suffit pour trois ou quatre
   * lignes parallèles. Il s'effondre dès qu'on en veut vingt autour d'une
   * forme quelconque : sur une boucle plus étroite que l'écartement, les
   * anneaux intérieurs se croisent et s'empilent en hachure ; aux deux bouts
   * d'une trace ouverte, les normales pivotent et ouvrent un éventail.
   *
   * La méthode robuste passe par un CHAMP DE DISTANCE : pour chaque cellule
   * d'une grille, la distance au parcours le plus proche ; puis on extrait
   * les lignes de niveau. Les anneaux fusionnent alors d'eux-mêmes là où la
   * place manque, s'arrondissent aux extrémités, et contournent proprement
   * un parcours qui se recoupe — exactement ce que fait un anneau de
   * croissance autour d'un nœud.
   *
   * La distance est calculée par PROPAGATION en deux passes (chanfrein)
   * plutôt qu'en comparant chaque cellule à chaque point : 200 × 200 cases
   * contre 400 points feraient seize millions de comparaisons à chaque
   * image. Deux passes coûtent 40 000 opérations et se trompent d'environ
   * 2 % — invisible à l'échelle d'un trait.
   */
  function champDistance(ptsPixels, boite, resolution) {
    var R = resolution || 190;
    var pasX = boite.w / R, pasY = boite.h / R;
    var pas = Math.max(pasX, pasY);
    var INF = 1e9;
    var d = new Float32Array(R * R).fill(INF);

    /* Semis : on marque les cellules traversées, en interpolant entre deux
     * points consécutifs — sinon un segment long saute des cellules et le
     * champ montre des perles au lieu d'une ligne. */
    for (var i = 0; i < ptsPixels.length; i++) {
      var a = ptsPixels[i], b = ptsPixels[i + 1] || a;
      var n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / (pas * 0.7)));
      for (var k = 0; k < n; k++) {
        var t = k / n;
        var gx = Math.round(((a.x + (b.x - a.x) * t) - boite.x) / pasX);
        var gy = Math.round(((a.y + (b.y - a.y) * t) - boite.y) / pasY);
        if (gx < 0 || gy < 0 || gx >= R || gy >= R) continue;
        d[gy * R + gx] = 0;
      }
    }

    var D = 1, D2 = 1.41421356;
    function maj(idx, v) { if (v < d[idx]) d[idx] = v; }
    var x, y, id;
    for (y = 0; y < R; y++) {
      for (x = 0; x < R; x++) {
        id = y * R + x;
        if (y > 0) {
          maj(id, d[id - R] + D);
          if (x > 0) maj(id, d[id - R - 1] + D2);
          if (x < R - 1) maj(id, d[id - R + 1] + D2);
        }
        if (x > 0) maj(id, d[id - 1] + D);
      }
    }
    for (y = R - 1; y >= 0; y--) {
      for (x = R - 1; x >= 0; x--) {
        id = y * R + x;
        if (y < R - 1) {
          maj(id, d[id + R] + D);
          if (x > 0) maj(id, d[id + R - 1] + D2);
          if (x < R - 1) maj(id, d[id + R + 1] + D2);
        }
        if (x < R - 1) maj(id, d[id + 1] + D);
      }
    }
    return { d: d, R: R, boite: boite, pasX: pasX, pasY: pasY,
             // la distance est en cellules : on la rend en pixels
             unite: (pasX + pasY) / 2 };
  }

  /* Marching squares : extrait la ligne de niveau `seuil` (en pixels) du
   * champ. Renvoie une liste de segments, pas de polylignes chaînées — un
   * contour n'a pas besoin d'être parcouru dans l'ordre pour être tracé, et
   * le chaînage est précisément la partie coûteuse et fragile. */
  function ligneDeNiveau(champ, seuilPx) {
    var R = champ.R, d = champ.d, b = champ.boite;
    var seuil = seuilPx / champ.unite;
    var segs = [];
    function px(gx) { return b.x + gx * champ.pasX; }
    function py(gy) { return b.y + gy * champ.pasY; }
    for (var y = 0; y < R - 1; y++) {
      for (var x = 0; x < R - 1; x++) {
        var v0 = d[y * R + x], v1 = d[y * R + x + 1];
        var v2 = d[(y + 1) * R + x + 1], v3 = d[(y + 1) * R + x];
        var c = (v0 > seuil ? 1 : 0) | (v1 > seuil ? 2 : 0) | (v2 > seuil ? 4 : 0) | (v3 > seuil ? 8 : 0);
        if (c === 0 || c === 15) continue;
        // interpolation linéaire sur chaque arête traversée
        var haut = { x: px(x + inter(v0, v1, seuil)), y: py(y) };
        var droite = { x: px(x + 1), y: py(y + inter(v1, v2, seuil)) };
        var bas = { x: px(x + inter(v3, v2, seuil)), y: py(y + 1) };
        var gauche = { x: px(x), y: py(y + inter(v0, v3, seuil)) };
        switch (c) {
          case 1: case 14: segs.push([gauche, haut]); break;
          case 2: case 13: segs.push([haut, droite]); break;
          case 3: case 12: segs.push([gauche, droite]); break;
          case 4: case 11: segs.push([droite, bas]); break;
          case 6: case 9:  segs.push([haut, bas]); break;
          case 7: case 8:  segs.push([gauche, bas]); break;
          // cas ambigus : on trace les deux branches plutôt que d'en choisir
          case 5:  segs.push([gauche, haut], [droite, bas]); break;
          case 10: segs.push([haut, droite], [gauche, bas]); break;
        }
      }
    }
    return segs;
  }

  function inter(a, b, s) {
    var dd = b - a;
    if (Math.abs(dd) < 1e-9) return 0.5;
    return Math.max(0, Math.min(1, (s - a) / dd));
  }

  /* ---------- bruit déterministe ----------
   * Semé par la géométrie : deux sorties différentes ont deux matières
   * différentes, la même sortie a toujours la même. */
  function graine(vue) {
    var s = Math.round((vue.largeur || 1) * 7.31 + (vue.hauteur || 1) * 13.7 + (vue.pts.length || 1) * 3.11);
    return function (i, k) {
      var x = Math.sin((s + i * 12.9898 + (k || 0) * 78.233) * 43758.5453);
      return x - Math.floor(x);
    };
  }

  /* Bruit lisse à une dimension : interpolation cosinus entre des valeurs
   * semées. Un bruit blanc point à point ferait grésiller le contour ;
   * celui-ci ondule. */
  function ondulation(alea, i, echelle, canal) {
    var t = i / echelle;
    var i0 = Math.floor(t), f = t - i0;
    var a = alea(i0, canal), b = alea(i0 + 1, canal);
    var s = (1 - Math.cos(f * Math.PI)) / 2;
    return (a * (1 - s) + b * s) * 2 - 1;      // -1 .. 1
  }

  /* ---------- mesures disponibles ----------
   * Ce qu'on peut réellement lire dans CETTE sortie. La liste nourrit les
   * sélecteurs « épaisseur par mesure » : proposer la puissance sur une
   * sortie sans capteur serait un réglage qui ne fait rien. */
  function mesures(track) {
    var out = [];
    function a(champ) { return (track || []).some(function (p) { return p[champ] != null; }); }
    if (a('ele')) out.push(['ele', 'altitude', 'm']);
    if (a('w')) out.push(['w', 'puissance', 'W']);
    if (a('hr')) out.push(['hr', 'fréquence cardiaque', 'bpm']);
    if (a('cad')) out.push(['cad', 'cadence', 'tr/min']);
    return out;
  }

  /* Série normalisée 0..1 d'une mesure, avec bornage aux centiles : une
   * seule valeur aberrante — un pic de puissance à 1 400 W, un point
   * d'altitude à 8 000 m — écraserait tout le reste du trait. Les données
   * SOURCES ne sont pas touchées : on borne l'échelle, pas la mesure. */
  function serie(pts, champ) {
    var vals = pts.map(function (p) { return p[champ]; });
    var valides = vals.filter(function (v) { return v != null && isFinite(v); });
    if (valides.length < 2) return null;
    var tri = valides.slice().sort(function (a, b) { return a - b; });
    var lo = tri[Math.floor(tri.length * 0.03)];
    var hi = tri[Math.floor(tri.length * 0.97)];
    if (hi - lo < 1e-9) { lo = tri[0]; hi = tri[tri.length - 1]; }
    var span = (hi - lo) || 1;
    var dernier = 0.5;
    return {
      lo: lo, hi: hi,
      min: tri[0], max: tri[tri.length - 1],
      // une donnée absente n'est PAS zéro : elle reprend la dernière connue
      valeurs: vals.map(function (v) {
        if (v == null || !isFinite(v)) return dernier;
        dernier = Math.max(0, Math.min(1, (v - lo) / span));
        return dernier;
      }),
      manquantes: vals.filter(function (v) { return v == null; }).length
    };
  }

  /* ---------- fond : papier ou surcouche ----------
   *
   * Les six planches Alpage s'exportent au choix sur papier ou en SURCOUCHE
   * transparente, à poser sur une photo. C'est le même dessin : seul le fond
   * change, et avec lui l'encre.
   *
   * Le voile fait PARTIE de l'alpha exporté. C'est ce qui rend une surcouche
   * utilisable sur n'importe quelle photo : sans lui, un titre sombre sur un
   * ciel clair disparaît, et on ne s'en aperçoit qu'une fois la story
   * publiée. Un dégradé noir ou blanc, selon la couleur de l'encre — c'est
   * l'encre qui décide, pas un réglage de plus.
   *
   * OPTIONS ATTENDUES : `fond` ('papier' | 'transparent'), `voile`
   * ('aucun' | 'bas' | 'haut' | 'centre'), `papier`, `encre`, `grain`.
   */
  function socle(H, o) {
    var transparent = o.fond === 'transparent';
    if (!transparent) {
      H.fill(o.papier || PALETTE.papier);
      if (o.grain !== false) H.grain(0.013);
      return { transparent: false, encre: o.encre || PALETTE.encre };
    }

    var encre = o.encre || PALETTE.encre;
    var clair = luminance(encre) > 0.5;
    var voile = o.voile || 'aucun';
    if (voile !== 'aucun') {
      var ctx = H.ctx, w = H.w, h = H.h;
      // l'encre claire demande un voile sombre, et réciproquement
      var teinte = clair ? '0,0,0' : '255,255,255';
      ctx.save();
      /* LA COURBE DU VOILE, ET ELLE EST LA SEULE.
       *
       * Deux voiles coexistaient pour un meme reglage : celui-ci, et celui que
       * le moteur peint pour les planches qui n'en declarent pas — avec des
       * opacites et des etalements differents. Un reglage nomme « vers le bas »
       * ne peut pas vouloir dire deux choses selon la planche.
       *
       * ELLE A ETE ALLEGEE. A 0,62 au pied, le voile devenait le sujet : il
       * assombrissait la moitie basse de la photo pour rendre lisibles deux
       * lignes de texte. A 0,40, et en mourant a 42 % de la hauteur au lieu du
       * sommet, il fait son travail sans prendre la place de l'image. */
      if (voile === 'centre') {
        var g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.12,
                                         w / 2, h / 2, Math.max(w, h) * 0.62);
        g.addColorStop(0, 'rgba(' + teinte + ',.34)');
        g.addColorStop(1, 'rgba(' + teinte + ',0)');
        ctx.fillStyle = g;
      } else {
        var haut = voile === 'haut';
        var lg = ctx.createLinearGradient(0, haut ? 0 : h, 0, haut ? h : 0);
        lg.addColorStop(0, 'rgba(' + teinte + ',.40)');
        lg.addColorStop(0.20, 'rgba(' + teinte + ',.16)');
        lg.addColorStop(0.42, 'rgba(' + teinte + ',0)');
        ctx.fillStyle = lg;
      }
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    /* Pas de grain sur une surcouche : une trame posée sur toute la page
     * remplirait l'alpha d'un voile uniforme et la transparence n'en serait
     * plus une. */
    return { transparent: true, encre: encre };
  }

  /* ---------- CE QUE LA PLANCHE DIT D'ELLE-MEME ----------
   *
   * Les planches portaient des phrases qui expliquent leur FABRICATION :
   * « épaisseur : courbure du parcours — effet de style », « parcours tourné,
   * non déformé », « lignes décalées du parcours — ce ne sont pas des courbes
   * d'altitude ». Elles sont justes, et elles ont leur place — dans l'aide du
   * réglage qui les produit, pas imprimées sur une affiche qu'on accroche.
   *
   * TROIS NIVEAUX, ET LE MILIEU EST LE DEFAUT :
   *   aucun      le dessin seul ;
   *   signature  un titre discret et deux mesures — ce qu'on veut lire sur un
   *              mur, et ce qu'un ami reconnait ;
   *   donnees    tout ce que la planche sait, notes de fabrication comprises,
   *              pour qui veut relire ce qu'il a regle.
   *
   * CE QUI RESTE DANS TOUS LES CAS — y compris « sans texte » quand la
   * comprehension en depend : un avertissement qui empeche de MAL LIRE une
   * donnee. « Geste — la mesure n'est qu'une part de l'épaisseur » n'est pas
   * une explication de fabrication, c'est ce qui evite de croire qu'on lit
   * une altitude. Le retirer rendrait la planche jolie et menteuse. */
  function optionsTexte() {
    return [
      { key: 'mentions', type: 'select', label: 'Texte', default: 'signature', reflow: true,
        choices: [['aucun', 'Sans texte — le dessin seul'],
                  ['signature', 'Signature — titre et deux mesures'],
                  ['donnees', 'Données — tout ce que la planche sait']] }
    ];
  }

  /* Ce que la planche a le droit d'ecrire, pour le reglage courant. */
  function dit(o) {
    var m = o && o.mentions ? o.mentions : 'signature';
    return {
      rien: m === 'aucun',
      titre: m !== 'aucun',
      mesures: m !== 'aucun',
      fabrication: m === 'donnees'   // les notes qui expliquent le dessin
    };
  }

  /* Les réglages de fond, identiques sur les six planches. Les déclarer ici
   * évite qu'une planche propose « centre » et une autre « radial ». */
  function optionsFond(encreParDefaut) {
    return [
      { key: 'fond', type: 'select', label: 'Fond', default: 'papier', reflow: true,
        choices: [['papier', 'Papier — affiche'],
                  ['transparent', 'Transparent — à poser sur une photo']] },
      { key: 'voile', type: 'select', label: 'Voile (surcouche)', default: 'aucun',
        choices: [['aucun', 'Aucun'],
                  ['bas', 'Depuis le bas'],
                  ['haut', 'Depuis le haut'],
                  ['centre', 'Autour du centre']] },
      { key: 'papier', type: 'color', label: 'Papier', default: PALETTE.papier },
      { key: 'encre', type: 'color', label: 'Encre', default: encreParDefaut || PALETTE.encre }
    ];
  }

  /* UNE COULEUR HEXA, RENDUE EN RGBA.
   *
   * Cette fonction était recopiée à l'identique dans dix-sept templates,
   * sous le nom `melange`. Seize fois le même corps, quatre lignes chacun,
   * et un dix-septième qui ne différait que par le nom de son paramètre :
   * personne ne l'avait remarqué parce que chacune marchait.
   *
   * Le coût n'est pas la place, c'est qu'une correction — accepter
   * `#abc`, par exemple — aurait demandé dix-sept modifications, ou aurait
   * produit dix-sept comportements. Elle vit ici, où vit déjà la palette.
   *
   * Les templates gardent une fonction `melange` locale d'UNE ligne qui
   * délègue ici : une fonction se hisse, `var melange = …` non, et les
   * appels précèdent la déclaration dans la plupart de ces fichiers. */
  function melange(hex, k) {
    var v = parseInt(String(hex).replace('#', ''), 16);
    return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' +
           (v & 255) + ',' + k + ')';
  }

  function luminance(hex) {
    var v = parseInt(String(hex).replace('#', ''), 16);
    if (!isFinite(v)) return 0;
    return (0.2126 * ((v >> 16) & 255) + 0.7152 * ((v >> 8) & 255) + 0.0722 * (v & 255)) / 255;
  }

  /* ---------- temps ----------
   * Deux règles que trois planches partagent, et qui se trompent facilement.
   *
   * SEMAINE ISO 8601 : la semaine 1 est celle qui contient le premier jeudi
   * de l'année. Compter « le combien de lundi » se trompe une année sur deux
   * au tournant de janvier, et l'erreur ne se voit que fin décembre.
   *
   * POSITION DANS LA PÉRIODE : une fraction entre 0 et 1, qui devient un
   * angle dans Almanac. L'heure ne pèse donc qu'une fraction de jour — c'est
   * voulu : mêler « date » et « heure » donnerait à deux sorties du même
   * jour un écart angulaire de deux semaines.
   */
  /* ---------- une fenêtre de temps ----------
   *
   * « Cette semaine », « le mois dernier », « cette année » : trois phrases
   * ordinaires, trois calculs qu'on rate facilement. Le calcul vit donc ici,
   * seul, sans interface autour, et le harnais l'éprouve sur des dates
   * connues — changement d'année, semaine à cheval, mois de 28 jours.
   *
   * La fenêtre est [debut, fin[ : fin exclue. Deux fenêtres consécutives ne
   * peuvent donc pas revendiquer la même sortie, ce qu'un `<=` aurait permis
   * pour une sortie partie à minuit pile.
   *
   * `recul` recule d'autant d'unités : 0 = en cours, 1 = la précédente.
   */
  function fenetre(mode, recul, maintenant) {
    var ref = maintenant ? new Date(maintenant.getTime()) : new Date();
    recul = recul || 0;
    var debut, fin;

    if (mode === 'semaine') {
      debut = lundiDe(ref);
      debut.setDate(debut.getDate() - 7 * recul);
      fin = new Date(debut.getTime());
      fin.setDate(fin.getDate() + 7);
    } else if (mode === 'mois') {
      debut = new Date(ref.getFullYear(), ref.getMonth() - recul, 1);
      fin = new Date(debut.getFullYear(), debut.getMonth() + 1, 1);
    } else if (mode === 'annee') {
      debut = new Date(ref.getFullYear() - recul, 0, 1);
      fin = new Date(debut.getFullYear() + 1, 0, 1);
    } else {
      return null;                       // « tout ce qui est chargé »
    }
    return { debut: debut, fin: fin };
  }

  function dansLaFenetre(date, f) {
    if (!f) return true;
    if (!date) return false;             // sans date, on ne peut pas répondre oui
    var t = date.getTime();
    return t >= f.debut.getTime() && t < f.fin.getTime();
  }

  function semaineISO(d) {
    var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    var an = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return Math.ceil((((t - an) / 86400000) + 1) / 7);
  }

  function lundiDe(d) {
    var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return new Date(x.getTime() - ((x.getDay() + 6) % 7) * 86400000);
  }

  function positionDansPeriode(date, debut, fin) {
    var duree = fin - debut;
    if (!(duree > 0)) return 0;
    return Math.max(0, Math.min(1, (date - debut) / duree));
  }

  /* ---------- cadrage ----------
   * Ajuste une vue projetée dans une boîte, en conservant les proportions.
   * Le décalage `ancre` place la forme hors centre (0 = centré, ±1 = collé
   * au bord) : c'est ce qui libère la place du titre sans rogner la trace. */
  function cadre(vue, boite, opt) {
    opt = opt || {};
    var marge = opt.marge == null ? 0 : opt.marge;
    var bw = boite.w - 2 * marge, bh = boite.h - 2 * marge;
    var k = Math.min(bw / (vue.largeur || 1), bh / (vue.hauteur || 1));
    if (opt.echelle) k *= opt.echelle;
    var cx = boite.x + boite.w / 2 + (opt.ancreX || 0) * bw / 2;
    var cy = boite.y + boite.h / 2 + (opt.ancreY || 0) * bh / 2;
    var mx = (vue.minX + vue.maxX) / 2, my = (vue.minY + vue.maxY) / 2;
    return {
      k: k,
      point: function (p) { return { x: cx + (p.x - mx) * k, y: cy + (p.y - my) * k }; },
      metres: function (m) { return m * k; }
    };
  }

  global.Alpage = {
    PALETTE: PALETTE,
    projette: projette, reechantillonne: reechantillonne, lisse: lisse,
    courbure: courbure, normales: normales, decale: decale, ruban: ruban,
    lisseDirections: lisseDirections, rayonsDeCourbure: rayonsDeCourbure,
    borneParCourbure: borneParCourbure,
    graine: graine, ondulation: ondulation,
    champDistance: champDistance, ligneDeNiveau: ligneDeNiveau,
    mesures: mesures, serie: serie, cadre: cadre,
    semaineISO: semaineISO,
    fenetre: fenetre,
    dansLaFenetre: dansLaFenetre, lundiDe: lundiDe, positionDansPeriode: positionDansPeriode,
    socle: socle, optionsFond: optionsFond, optionsTexte: optionsTexte,
    dit: dit, luminance: luminance,
    melange: melange
  };
}(window));
