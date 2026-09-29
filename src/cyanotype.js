/* cyanotype.js — LE TIRAGE BLEU, une SURFACE et non une planche.
 *
 * ── POURQUOI CE N'EST PAS UN TEMPLATE ────────────────────────────────
 *
 * Le cyanotype n'est pas une composition : c'est un procédé d'impression.
 * En faire une trente-huitième planche aurait voulu dire redessiner une
 * carte, un profil et un texte — et n'aurait donné le bleu qu'à cette
 * planche-là. Posé comme SURFACE, il s'applique aux trente-sept, comme le
 * papier s'applique aux trente-sept.
 *
 * Il vit donc au même étage que le support et le voile : un réglage global,
 * déclaré une fois, que les templates ignorent complètement.
 *
 * ── CE QU'IL FAIT, ET CE QU'IL N'INVENTE PAS ─────────────────────────
 *
 * Il relit la planche déjà peinte et la retraduit : la luminance devient une
 * quantité de bleu de Prusse. Rien n'est ajouté au dessin — pas une ligne,
 * pas un chiffre. Une planche sans données reste une planche sans données,
 * en bleu.
 *
 * Le HALO est une lampe, pas une mesure. Il imite l'insolation au soleil,
 * plus forte au centre du châssis qu'aux bords. Il n'encode RIEN de la
 * sortie, et l'intitulé du réglage le dit : faire varier un halo avec le
 * dénivelé aurait produit une différence visible que personne n'aurait pu
 * lire, c'est-à-dire un ornement déguisé en donnée.
 *
 * ── LE TIRAGE EST STABLE ─────────────────────────────────────────────
 *
 * Les irrégularités du bain viennent d'un bruit de valeur à graine fixe :
 * la même planche donne le même tirage, à l'écran, dans la vidéo et sur
 * l'A3. Un grain tiré au hasard à chaque rendu aurait fait scintiller la
 * vidéo et rendu l'aperçu menteur.
 *
 * ── LE COÛT ──────────────────────────────────────────────────────────
 *
 * Un passage par pixel sur deux millions de pixels. Le champ de bain est
 * calculé sur une grille grossière puis interpolé : sans cela, trois appels
 * de bruit par pixel coûtaient dix fois plus cher, pour un résultat que
 * l'œil ne distingue pas.
 */
(function (global) {
  'use strict';

  /* Les trois bains. Chaque nombre a un rôle :
   *   seuil / pente   la courbe de tirage — où le papier bascule dans le bleu
   *   papier / encre  les deux bouts de la rampe
   *   grain           l'amplitude des irrégularités du bain
   *   bord            la largeur de la réserve laissée par le pinceau */
  var BAINS = {
    /* LE PAPIER N'EST PAS BLANC. Un premier réglage laissait le fond à la
     * teinte du papier d'origine : la planche sortait en encre bleue sur
     * papier crème, et le banc le disait — bleu moins rouge, moins un. Or un
     * cyanotype est un papier INSOLÉ : toute la feuille a pris le bain, et
     * c'est le sujet qui reste clair. Les trois bains partent donc d'un bleu
     * pâle, pas d'un blanc. */
    profond: { seuil: 0.20, pente: 1.9, grain: 0.14, bord: 0.045, negatif: false,
               papier: [188, 209, 226], encre: [8, 30, 66] },
    voile:   { seuil: 0.44, pente: 1.4, grain: 0.20, bord: 0.075, negatif: false,
               papier: [225, 235, 242], encre: [72, 118, 158] },
    negatif: { seuil: 0.40, pente: 2.0, grain: 0.12, bord: 0.030, negatif: true,
               papier: [232, 240, 244], encre: [8, 32, 68] }
  };

  /* ---------- un bruit de valeur, déterministe ---------- */
  function alea(i, j, graine) {
    var n = (i * 374761393 + j * 668265263 + graine * 1442695040888963407) | 0;
    n = (n ^ (n >> 13)) * 1274126177;
    return ((n ^ (n >> 16)) >>> 0) / 4294967295;
  }

  /* Le champ du bain : une grille grossière, lissée par interpolation. Deux
   * échelles superposées — les grandes coulées et le grain fin — parce
   * qu'une seule échelle donne une moquette régulière, qui ne ressemble à
   * aucun bain. */
  function champ(w, h, cote) {
    var cols = Math.max(2, Math.ceil(w / cote) + 1);
    var lignes = Math.max(2, Math.ceil(h / cote) + 1);
    var g = new Float32Array(cols * lignes);
    for (var j = 0; j < lignes; j++) {
      for (var i = 0; i < cols; i++) {
        g[j * cols + i] = alea(i, j, 7) * 0.68 + alea(i >> 1, j >> 1, 19) * 0.32;
      }
    }
    return { g: g, cols: cols, lignes: lignes, cote: cote };
  }

  /* Le champ d'une ligne entière. On mélange les deux rangées de la grille
   * une fois pour la ligne, puis on avance le long de x par incréments : la
   * même courbe que `lis()`, sans en refaire le calcul deux mille fois. */
  function remplitLigne(c, y, w, sortie) {
    var fy = y / c.cote;
    var j = fy | 0;
    if (j >= c.lignes - 1) j = c.lignes - 2;
    var ty = fy - j;
    ty = ty * ty * (3 - 2 * ty);
    var haut = j * c.cols, bas = (j + 1) * c.cols;
    for (var i = 0; i < c.cols - 1; i++) {
      var a = c.g[haut + i] + (c.g[bas + i] - c.g[haut + i]) * ty;
      var b = c.g[haut + i + 1] + (c.g[bas + i + 1] - c.g[haut + i + 1]) * ty;
      var x0 = i * c.cote, x1 = x0 + c.cote;
      if (x0 >= w) break;
      if (x1 > w) x1 = w;
      for (var x = x0; x < x1; x++) {
        var tx = (x - x0) / c.cote;
        tx = tx * tx * (3 - 2 * tx);
        sortie[x] = a + (b - a) * tx;
      }
    }
  }

  /* ---------- le tirage ---------- */
  function applique(ctx, w, h, opts) {
    var o = opts || {};
    var B = BAINS[o.bain] || BAINS.profond;
    var img;
    try {
      img = ctx.getImageData(0, 0, w, h);
    } catch (e) {
      /* un canvas taché par une image d'origine étrangère refuse d'être relu.
       * On renonce au tirage plutôt que de laisser passer une exception qui
       * viderait la planche — et l'appelant l'apprend. */
      return false;
    }
    var d = img.data;
    var petit = champ(w, h, Math.max(24, Math.round(Math.min(w, h) / 22)));
    var cx = w / 2, cy = h / 2;
    var rayon = Math.sqrt(cx * cx + cy * cy);
    var halo = o.halo ? 0.22 : 0;
    var bordX = w * B.bord, bordY = h * B.bord;

    /* ── TOUT CE QUI PEUT SE CALCULER UNE FOIS L'EST ──────────────────
     *
     * La première version appelait Math.exp, Math.hypot et une interpolation
     * complète PAR PIXEL : cent millisecondes sur deux millions de pixels.
     * Le rendu tenait, l'export vidéo non — trente images par seconde
     * laissent trente-trois millisecondes pour tout, tirage compris, et rien
     * dans la chaîne n'aurait signalé des images perdues.
     *
     * Trois tables et deux vecteurs suffisent : la courbe d'insolation, la
     * rampe de couleur, la réserve en x, la réserve en y, et le halo indexé
     * sur le carré de la distance — ce qui évite une racine par pixel. */
    /* La courbe rend directement l'index de la rampe : garder une fraction
     * obligeait à la remultiplier par 255 sur chaque pixel. */
    var COURBE = 1024;
    var courbe = new Uint8Array(COURBE);
    for (var q = 0; q < COURBE; q++) {
      courbe[q] = 255 / (1 + Math.exp(-B.pente * 4 * ((q / (COURBE - 1)) * 1.5 - B.seuil)));
    }
    /* LA RAMPE EST EMPAQUETÉE. Trois écritures d'octet par pixel deviennent
     * une seule de trente-deux bits — six millions d'écritures en deux
     * millions. L'ordre des octets suit celui de la machine, relevé une fois
     * plutôt que supposé : une plateforme gros-boutiste aurait sinon rendu
     * des tirages orange. */
    var rampe32 = new Uint32Array(256);
    var sonde = new Uint32Array(1);
    new Uint8Array(sonde.buffer)[0] = 1;
    var petitBoutiste = sonde[0] === 1;
    for (var c2 = 0; c2 < 256; c2++) {
      var f2 = c2 / 255;
      var rr = B.papier[0] + (B.encre[0] - B.papier[0]) * f2;
      var gg = B.papier[1] + (B.encre[1] - B.papier[1]) * f2;
      var bb = B.papier[2] + (B.encre[2] - B.papier[2]) * f2;
      rampe32[c2] = petitBoutiste
        ? ((bb & 255) << 16) | ((gg & 255) << 8) | (rr & 255)
        : ((rr & 255) << 24) | ((gg & 255) << 16) | ((bb & 255) << 8);
    }
    var resX = new Float32Array(w);
    for (var x2 = 0; x2 < w; x2++) {
      var v2 = Math.min(1, Math.min(x2, w - 1 - x2) / bordX);
      resX[x2] = v2 * v2 * (3 - 2 * v2);
    }
    var resY = new Float32Array(h);
    for (var y2 = 0; y2 < h; y2++) {
      var u2 = Math.min(1, Math.min(y2, h - 1 - y2) / bordY);
      resY[y2] = u2 * u2 * (3 - 2 * u2);
    }
    var HALO = 512;
    var haloT = new Float32Array(HALO);
    for (var q2 = 0; q2 < HALO; q2++) {
      haloT[q2] = 1 + halo * (0.5 - Math.sqrt(q2 / (HALO - 1)));
    }
    var r2max = rayon * rayon;

    /* le champ du bain, ligne par ligne : une interpolation le long de x
     * plutôt qu'un appel complet par pixel */
    var ligne = new Float32Array(w);

    /* La luminance par tables. Trois multiplications flottantes par pixel,
     * c'est six millions d'opérations pour une planche ; trois lectures de
     * table donnent le même octet. */
    var lumR = new Float32Array(256), lumG = new Float32Array(256), lumB = new Float32Array(256);
    for (var c3 = 0; c3 < 256; c3++) {
      lumR[c3] = 0.2126 * c3 / 255;
      lumG[c3] = 0.7152 * c3 / 255;
      lumB[c3] = 0.0722 * c3 / 255;
    }

    var px = new Uint32Array(img.data.buffer);
    var masqueAlpha = petitBoutiste ? 0xFF000000 : 0x000000FF;
    var negatif = B.negatif;
    var grain2 = 2 * B.grain;

    for (var y = 0; y < h; y++) {
      var ry = resY[y];
      remplitLigne(petit, y, w, ligne);
      var dy2 = (y - cy) * (y - cy);
      var base = y * w;
      for (var x = 0; x < w; x++) {
        var k = (base + x) * 4;
        /* LA TRANSPARENCE RESTE TRANSPARENTE. Le tirage est un papier : là où
         * la planche ne pose rien, il n'y a rien à insoler. */
        if (d[k + 3] === 0) continue;

        var lum = lumR[d[k]] + lumG[d[k + 1]] + lumB[d[k + 2]];
        var t = negatif ? lum : 1 - lum;

        var bain = 1 + (ligne[x] - 0.5) * grain2;
        if (halo) {
          var dx2 = (x - cx) * (x - cx);
          bain *= haloT[((dx2 + dy2) / r2max * (HALO - 1)) | 0];
        }

        var idx = (t * bain * 682) | 0;      // 1023 / 1,5
        var ci = courbe[idx < 0 ? 0 : idx > COURBE - 1 ? COURBE - 1 : idx];

        /* LA RÉSERVE DU PINCEAU. Le bain n'atteint pas le bord de la feuille —
         * et son bord n'est pas droit. Une bordure purement géométrique
         * donnait un halo de studio photo, régulier au pixel près sur les
         * quatre côtés : c'était une vignette, pas un coup de pinceau. On la
         * fait donc onduler avec le champ du bain, qui varie à la même
         * échelle qu'une brosse. */
        var reserve = ry < resX[x] ? ry : resX[x];
        if (reserve < 1) {
          reserve = (reserve - 0.42 * (ligne[x] - 0.5)) * 1.18;
          if (reserve > 1) reserve = 1; else if (reserve < 0) reserve = 0;
          ci = (ci * reserve) | 0;
        }

        var p32 = base + x;
        px[p32] = (px[p32] & masqueAlpha) | rampe32[ci];
      }
    }
    ctx.putImageData(img, 0, 0);
    return true;
  }

  global.Cyanotype = { applique: applique, BAINS: BAINS };
}(window));
