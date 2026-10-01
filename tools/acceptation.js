/* acceptation.js — le parcours réel, dans un vrai navigateur.
 *
 *   1. lancer le serveur :   node tools/dev-server.js 8783 --debug
 *   2. ouvrir               http://localhost:8783/
 *   3. dans la console, CHARGER ce fichier — ne pas le coller :
 *
 *        var s = document.createElement('script');
 *        s.src = 'tools/acceptation.js';
 *        document.head.appendChild(s);
 *
 *      La page porte une politique de sécurité de contenu en `script-src
 *      'self'` : elle refuse `eval` et `new Function`, donc tout lanceur qui
 *      évalue une chaîne. Une balise vers un fichier de la même origine,
 *      elle, passe. C'est le premier résultat du test : la politique tient.
 *
 *      Les résultats arrivent dans la console et dans `window.__acceptation`.
 *
 * POURQUOI CE N'EST PAS DANS tools/test.js
 *   Le harnais de test tourne dans Node : il lit des fichiers, charge des
 *   modules, éprouve des calculs. Il ne peut pas répondre à « est-ce que le
 *   panneau se ferme », « est-ce que la vignette dessine quelque chose »,
 *   « est-ce que l'export garde l'alpha » — ces questions demandent un
 *   canvas, une mise en page et des événements.
 *
 *   Ce fichier n'est chargé par aucune page : il ne s'exécute que si on le
 *   lui demande. Le serveur de développement refuse de servir tools/, mais
 *   l'hébergement statique, lui, publie tout le dépôt — on peut donc aussi
 *   éprouver le SITE EN LIGNE, ce qui est le seul moyen de vérifier ce qui
 *   y est réellement déployé :
 *
 *     fetch('tools/acceptation.js').then(r => r.text()).then(eval)
 *
 * CE QU'IL VÉRIFIE
 *   Le parcours complet tel qu'un utilisateur le fait : charger une sortie,
 *   choisir un style, changer de variante, passer en noir & blanc, passer en
 *   surcouche, exporter — et sur téléphone, ouvrir et fermer les panneaux.
 *
 * CE QU'IL NE VÉRIFIE PAS
 *   L'aperçu animé et l'export vidéo : ils demandent requestAnimationFrame
 *   et MediaRecorder sur plusieurs secondes. Ils restent à éprouver à la
 *   main, et ce fichier le dit plutôt que de faire semblant.
 */
(async function acceptation() {
  'use strict';

  var resultats = [];
  /* PUBLIÉS AVANT D'ÊTRE COMPLETS, exprès : si la suite s'interrompt, ce qui a
   * déjà été mesuré doit survivre. Voir le filet, tout en bas. */
  window.__acceptationPartiel = resultats;
  var $ = function (s) { return document.querySelector(s); };
  var attends = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };

  /* ATTENDRE UNE CONDITION, PAS UNE DURÉE.
   *
   * Les premières versions dormaient 2 600 ms après avoir cliqué « charger ».
   * C'était large en local et trop court en ligne : quatre GPX sur le réseau
   * prennent plus de temps que quatre GPX sur la machine. Le test rapportait
   * alors « 0 sortie chargée » sur un site qui fonctionnait parfaitement —
   * un échec qui ne parlait que de ma patience.
   *
   * Un contrôle qui dépend de la latence ne contrôle pas ce qu'il prétend. */
  async function jusqua(condition, limite) {
    var t0 = Date.now();
    while (Date.now() - t0 < (limite || 15000)) {
      try { if (condition()) return true; } catch (e) { /* pas encore prêt */ }
      await attends(120);
    }
    return false;
  }

  function ok(nom, condition, detail) {
    /* Le dernier cas ATTEINT, pas le dernier réussi : c'est lui qui localise
     * une interruption, et il ne sert qu'à ça. */
    window.__acceptationDernier = nom;
    resultats.push({ cas: nom, verdict: condition ? 'ok' : 'ÉCHEC',
                     detail: condition ? '' : (detail || '') });
  }

  /* Combien de pixels non transparents dans ce canvas ? Un échantillon
   * suffit : on cherche « a-t-on dessiné », pas « quoi exactement ». */
  function encre(cv) {
    var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
    var n = 0;
    for (var i = 3; i < d.length; i += 4 * 61) if (d[i] > 12) n++;
    return n;
  }

  /* ---------- 0. LA FEUILLE DE STYLE EST-ELLE APPLIQUEE ? ----------
   *
   * Le cas qui manquait, et son absence a coute trois versions.
   *
   * Une accolade jamais refermee avait avale cent quarante-six regles dans un
   * bloc `@media (max-width: 400px)`. Sous 400 px tout s'appliquait — la
   * largeur des essais — et au-dessus, rien : ni police, ni couleurs, ni barre
   * du bas. Pendant ce temps, tous les cas passaient : ils lisaient le DOM, et
   * le DOM etait intact.
   *
   * UN CONTROLE QUI NE REGARDE QUE LA STRUCTURE NE VOIT PAS UNE PAGE SANS
   * APPARENCE. Ceux-ci lisent des styles CALCULES que seule la feuille peut
   * produire : s'ils tombent, c'est qu'elle n'est pas arrivee. */
  (function () {
    var cs = getComputedStyle(document.body);
    ok('style · la police du studio est appliquee  (' + cs.fontFamily.split(',')[0] + ')',
       /Archivo/.test(cs.fontFamily));
    ok('style · le papier est le fond  (' + cs.backgroundColor + ')',
       cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent');
    var g = $('.lien-galerie');
    if (g) {
      ok('style · les liens ne sont pas soulignés par defaut',
         getComputedStyle(g).textDecorationLine === 'none',
         'la feuille de style n’est pas appliquee a cette largeur');
    }
    var h = document.querySelector('header');
    ok('style · l’entete est une rangee', getComputedStyle(h).display === 'flex');
    /* Le nombre de regles vues par le navigateur : une accolade manquante ne
     * rend pas la feuille invalide, elle la REDUIT, et sans rien signaler. */
    var n = 0;
    try { n = document.styleSheets[0].cssRules.length; } catch (e) { n = -1; }
    ok('style · la feuille porte toutes ses regles  (' + n + ')', n >= 100 || n === -1);
  }());

  // ---------- 1. l'accueil ----------
  var planche = await jusqua(function () {
    return $('#accueil-planche') && encre($('#accueil-planche')) > 200;
  }, 8000);
  ok('accueil · une planche est montrée avant tout réglage', planche);
  ok('accueil · aucune sortie n’est inventée dans la bibliothèque',
     Library.count() === 0 && document.body.classList.contains('vide'));

  // ---------- 2. charger ----------
  $('#load-formes').click();
  var charge = await jusqua(function () { return Library.count() === 4; });
  await attends(400);                       // le temps du premier rendu
  ok('chargement · quatre parcours de démonstration', charge,
     Library.count() + ' chargés');
  ok('chargement · la scène dessine', encre($('#canvas')) > 200);

  /* ---------- LES PÉRIODES SE CONSTRUISENT SUR LES SORTIES ----------
   *
   * Le menu ne proposait que des fenêtres RELATIVES — ce mois, le mois
   * dernier. On ne pouvait donc composer l'affiche d'août que pendant le mois
   * de septembre, et une planche à l'année ne servait qu'une fois par an.
   *
   * Le contrôle compare le menu à ce que la BIBLIOTHÈQUE porte vraiment, et
   * non à un nombre attendu : un menu qui proposerait un mois vide, ou qui en
   * oublierait un, échoue dans les deux sens. */
  (function () {
    var sel = $('#periode');
    var reels = {};
    Library.list().forEach(function (e) {
      var d = e.activity && e.activity.date;
      if (!d) return;
      var k = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2);
      reels[k] = (reels[k] || 0) + 1;
    });
    var attendus = Object.keys(reels).sort().reverse();
    var proposes = Array.prototype.map.call(
      sel.querySelectorAll('optgroup option[value^="m:"]'),
      function (o) { return o.value.slice(2); });
    ok('période · le menu propose exactement les mois qui portent des sorties  (' +
       proposes.length + ')',
       proposes.length > 0 && proposes.join() === attendus.join(),
       'proposés : ' + proposes.join(' ') + ' — réels : ' + attendus.join(' '));

    if (proposes.length) {
      var k = proposes[0];
      sel.value = 'm:' + k;
      sel.dispatchEvent(new Event('change'));
      ok('période · choisir un mois retient le bon nombre de sorties  (' +
         App.entreesRetenues().length + '/' + reels[k] + ')',
         App.entreesRetenues().length === reels[k]);

      /* ELLE NE DOIT PAS DÉRIVER. Un recul relatif enregistré désignerait un
       * autre mois le mois suivant ; une période nommée désigne le même. */
      ok('période · un mois nommé est absolu, pas un recul',
         /^m:\d{4}-\d{2}$/.test(sel.value));

      sel.value = 'tout';
      sel.dispatchEvent(new Event('change'));
    }
  }());

  // ---------- 3. le catalogue de styles ----------
  var cartes = document.querySelectorAll('#choix-style .carte-style');
  ok('catalogue · des familles sont proposées', cartes.length >= 4,
     cartes.length + ' cartes');
  var dessinees = 0;
  Array.prototype.forEach.call(document.querySelectorAll('#choix-style .carte-style canvas'),
    function (cv) { if (encre(cv) > 40) dessinees++; });
  ok('catalogue · les vignettes sont de vrais rendus  (' + dessinees + '/' + cartes.length + ')',
     dessinees >= cartes.length - 2, 'trop de vignettes vides');

  // choisir une famille ouvre ses variantes
  cartes[0].click();
  await attends(500);
  var variantes = document.querySelectorAll('#choix-style .variantes .carte-style');
  ok('catalogue · choisir une famille montre ses variantes', variantes.length >= 2,
     variantes.length + ' variantes');
  /* On clique une variante qui n'est PAS déjà celle en cours : le réglage
   * précédent est retenu d'une visite à l'autre, et prendre « la deuxième »
   * tombait parfois sur celle qui était active — le test échouait alors
   * pour avoir demandé un changement qui n'en était pas un. */
  var autre = null;
  Array.prototype.forEach.call(variantes, function (v) {
    if (!autre && v.className.indexOf('on') < 0) autre = v;
  });
  if (autre) {
    var avant = $('#canvas').toDataURL();
    autre.click();
    await attends(700);
    ok('catalogue · changer de variante change la planche',
       $('#canvas').toDataURL() !== avant);
  } else {
    resultats.push({ cas: 'catalogue · changement de variante', verdict: 'sauté',
                     detail: 'une seule variante dans cette famille' });
  }
  var retour = document.querySelector('.retour-familles');
  if (retour) { retour.click(); await attends(300); }
  ok('catalogue · on revient aux familles',
     document.querySelectorAll('#choix-style .familles .carte-style').length >= 4);

  // ---------- 4. les réglages globaux ----------
  $('#rendu').value = 'nb';
  $('#rendu').dispatchEvent(new Event('change'));
  await attends(500);
  var cv = $('#canvas');
  var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  var ecartMax = 0;
  for (var i = 0; i < d.length; i += 4 * 211) {
    if (d[i + 3] < 200) continue;
    var mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
    if (mx - mn > ecartMax) ecartMax = mx - mn;
  }
  ok('teintes · en noir & blanc, l’écart RVB est nul  (' + ecartMax + ')', ecartMax === 0);
  $('#rendu').value = 'couleur';
  $('#rendu').dispatchEvent(new Event('change'));
  await attends(400);

  $('#support').value = 'surcouche';
  $('#support').dispatchEvent(new Event('change'));
  await attends(600);
  var d2 = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  var opaques = 0, total = 0;
  for (var j = 3; j < d2.length; j += 4 * 61) { total++; if (d2[j] === 255) opaques++; }
  ok('support · en surcouche, la planche n’est pas un aplat  (' +
     Math.round(100 * opaques / total) + ' % opaque)', opaques / total < 0.8);
  $('#support').value = 'papier';
  $('#support').dispatchEvent(new Event('change'));
  await attends(400);

  /* ---------- UN BOUTON FAIT CE QU'IL DIT ----------
   *
   * LE DÉFAUT : « Recentrer » remettait aussi l'échelle à 100. On réglait sa
   * taille, on recentrait, et on perdait son réglage sans l'avoir demandé.
   * L'échelle a son propre curseur juste à côté : la ramener à 100 était déjà
   * un geste direct, qui n'avait pas à être caché dans un autre. */
  if ($('#recentrer') && $('#echelle')) {
    var supportAvant = $('#support').value;
    $('#support').value = 'surcouche';
    $('#support').dispatchEvent(new Event('change'));
    await attends(400);

    $('#echelle').value = 160;
    $('#echelle').dispatchEvent(new Event('input'));
    App.etat.placement.x = 0.2;
    App.etat.placement.y = -0.15;
    await attends(300);

    $('#recentrer').click();
    await attends(400);

    ok('placement · recentrer ramène bien la planche au centre  (' +
       App.etat.placement.x + ', ' + App.etat.placement.y + ')',
       App.etat.placement.x === 0 && App.etat.placement.y === 0);
    ok('placement · recentrer ne touche PAS à l’échelle  (' + $('#echelle').value + ')',
       String($('#echelle').value) === '160',
       'le bouton dit une chose et en faisait deux');

    $('#echelle').value = 100;
    $('#echelle').dispatchEvent(new Event('input'));
    $('#support').value = supportAvant;
    $('#support').dispatchEvent(new Event('change'));
    await attends(300);
  }

  /* ---------- UNE VIGNETTE NE PORTE PAS DE LÉGENDE ----------
   *
   * LE DÉFAUT, MESURÉ : la vignette est rendue en 300 pixels de large et
   * affichée en 144. Le texte d'une planche étant proportionnel à sa largeur,
   * la légende tombait à 2,3 pixels à l'écran — une tache, pas une
   * information.
   *
   * CE CONTRÔLE NE DEMANDE PAS L'ABSENCE DE TOUT TEXTE. Cinq planches SONT du
   * texte : Métro, Saisons et ov-heros tombent à zéro pour cent d'encre si on
   * le supprime. Il vérifie que la vignette reçoit bien le réglage « sans
   * texte », ce qui silence les légendes des dix planches qui le lisent. */
  if (App.construitChoixStyle) {
    var vuMentions = [];
    var vraiRender = Studio.render;
    Studio.render = function (cv, id, a, o, taille) {
      if (taille && taille[0] <= 400) vuMentions.push(o && o.mentions);
      return vraiRender.apply(this, arguments);
    };
    try {
      App.construitChoixStyle();
      await attends(900);
    } finally {
      Studio.render = vraiRender;
    }
    ok('catalogue · les vignettes ont été rendues  (' + vuMentions.length + ')',
       vuMentions.length >= 4,
       'à zéro vignette, le cas suivant serait vert sans rien avoir regardé');
    ok('catalogue · une vignette est rendue sans ses mentions',
       vuMentions.length > 0 && vuMentions.every(function (m) { return m === 'aucun'; }),
       'vu : ' + Array.from(new Set(vuMentions)).join(', '));
  }

  /* ---------- UN PNG D'IMPRESSION DIT SA RÉSOLUTION ----------
   *
   * LE DÉFAUT RÉEL : A4 et A3 sont CALCULÉS à 300 points par pouce — 2480×3508
   * et 3508×4961 pixels — mais le PNG produit par `toBlob` ne porte aucun bloc
   * `pHYs`. Sans résolution déclarée, les logiciels d'impression posent le
   * fichier à 72 dpi : l'A3 sortait plus de quatre fois trop grand, et rien ne
   * le disait. Le calcul était juste, son résultat illisible pour une
   * imprimante.
   *
   * ON RELIT LES OCTETS, pas le code. Un bloc mal formé — mauvais CRC,
   * mauvaise place — produit un fichier qu'aucun lecteur n'ouvre, et seul un
   * lecteur peut le dire : le dernier cas repasse donc le PNG au décodeur du
   * navigateur. */
  if (Studio.posePhys) {
    var cvP = document.createElement('canvas');
    cvP.width = 300; cvP.height = 420;
    var cxP = cvP.getContext('2d');
    cxP.fillStyle = '#F7F5EF'; cxP.fillRect(0, 0, 300, 420);
    cxP.fillStyle = '#111'; cxP.fillRect(40, 40, 220, 340);
    var brut = new Uint8Array(await (await new Promise(function (r) {
      cvP.toBlob(r, 'image/png');
    })).arrayBuffer());

    function lisPhys(oct) {
      var vue = new DataView(oct.buffer, oct.byteOffset, oct.byteLength);
      var pos = 8, avantIdat = true, trouve = null, combien = 0;
      while (pos + 8 <= oct.length) {
        var taille = vue.getUint32(pos);
        var type = String.fromCharCode(oct[pos + 4], oct[pos + 5], oct[pos + 6], oct[pos + 7]);
        if (type === 'pHYs') {
          combien++;
          trouve = { x: vue.getUint32(pos + 8), y: vue.getUint32(pos + 12),
                     unite: oct[pos + 16], avantIdat: avantIdat };
        }
        if (type === 'IDAT') avantIdat = false;
        if (type === 'IEND') break;
        pos += 12 + taille;
      }
      return { phys: trouve, combien: combien };
    }

    ok('impression · un PNG de canvas ne déclare aucune résolution',
       lisPhys(brut).phys === null,
       'sans ce point de départ, le cas suivant pourrait être vert sans rien avoir posé');

    var avec = Studio.posePhys(brut, 300);
    var lu = lisPhys(avec);
    /* 300 points par pouce = 300 / 0,0254 pixels par mètre */
    ok('impression · 300 dpi s’écrivent 11811 pixels par mètre, avant le premier IDAT  (' +
       (lu.phys ? lu.phys.x + ', unité ' + lu.phys.unite : 'aucun') + ')',
       !!lu.phys && lu.phys.x === 11811 && lu.phys.y === 11811 &&
       lu.phys.unite === 1 && lu.phys.avantIdat === true);

    ok('impression · l’appliquer deux fois n’empile pas deux blocs  (' +
       lisPhys(Studio.posePhys(avec, 300)).combien + ')',
       lisPhys(Studio.posePhys(avec, 300)).combien === 1);

    /* LE FICHIER DOIT RESTER LISIBLE. Un CRC faux passe inaperçu à la lecture
     * des octets et arrête net un vrai décodeur. */
    var urlP = URL.createObjectURL(new Blob([avec], { type: 'image/png' }));
    var imP = new Image();
    var relu = false;
    try {
      await new Promise(function (o, n) { imP.onload = o; imP.onerror = n; imP.src = urlP; });
      relu = imP.naturalWidth === 300 && imP.naturalHeight === 420;
    } catch (e) { relu = false; }
    URL.revokeObjectURL(urlP);
    ok('impression · le PNG reste lisible par un vrai décodeur  (' +
       imP.naturalWidth + 'x' + imP.naturalHeight + ')', relu,
       'un CRC faux ne se voit pas dans les octets, seulement à l’ouverture');

    /* LE CÂBLAGE : qui reçoit quelle résolution. Une story n'a pas de taille
     * physique ; lui inventer 300 dpi serait aussi faux que de taire celle
     * d'un A3. */
    var vraiExport = Studio.exportPNG;
    var recus = [];
    Studio.exportPNG = function (cv, nom, dpi) { recus.push({ nom: nom, dpi: dpi || null }); };
    try {
      var tailleAvant = $('#size').value;
      var sortieAvant = $('#sortie') ? $('#sortie').value : null;
      if ($('#sortie')) $('#sortie').value = 'image';
      ['a3', 'a4', 'story'].forEach(function (f) {
        $('#size').value = f;
        $('#size').dispatchEvent(new Event('change'));
        $('#export').click();
      });
      $('#size').value = tailleAvant;
      $('#size').dispatchEvent(new Event('change'));
      if ($('#sortie') && sortieAvant) $('#sortie').value = sortieAvant;
    } finally {
      Studio.exportPNG = vraiExport;
    }
    ok('impression · A3 et A4 partent à 300 dpi, une story sans résolution  (' +
       recus.map(function (r) { return r.dpi === null ? 'aucune' : r.dpi; }).join(' / ') + ')',
       recus.length === 3 && recus[0].dpi === 300 && recus[1].dpi === 300 &&
       recus[2].dpi === null,
       JSON.stringify(recus));
  }

  /* ---------- AUCUNE PLANCHE N'ÉCRIT CE QU'ELLE N'A PAS MESURÉ ----------
   *
   * LE DÉFAUT RÉEL, RAPPORTÉ PAR DOUZE RELECTEURS : sur une sortie sans
   * altitude, Atlas et Série écrivaient « 0 m », Almanac « 0 M D+ », et Pente
   * dessinait un ruban uniformément plat sous « PENTE MAX 0,0 % ».
   *
   * UN ZÉRO N'EST PAS UNE ABSENCE. Une sortie de plaine avec baromètre dit
   * « 0 m » à juste titre ; une sortie sans capteur ne dit rien. La cause était
   * partout la même : `t + (e.activity.elev_gain_m || 0)` additionne sans
   * distinguer « zéro mètre » de « pas de mesure ».
   *
   * ON INTERCEPTE LE TEXTE AU NIVEAU DU CANVAS, pas dans les helpers : on voit
   * ainsi ce qui est RÉELLEMENT peint, quel que soit le chemin qui l'a produit.
   * Relire les templates aurait manqué tout ce qui passe autrement.
   *
   * La sortie d'épreuve est fabriquée à partir du vrai tracé chargé, privé de
   * son altitude : un parcours plausible, sans profil. */
  (function () {
    var base = App.etat.base;
    if (!base || !base.track || base.track.length < 10 || !window.Activity.fromPoints) {
      resultats.push({ cas: 'honnêteté · zéros fabriqués', verdict: 'sauté',
                       detail: 'pas de tracé à dénuder' });
      return;
    }
    var pts = base.track.map(function (p) { return { lat: p.lat, lon: p.lon, t: p.t }; });
    var nue = window.Activity.fromPoints({ name: 'Sans altitude', type: 'Ride' }, pts);
    ok('honnêteté · la sortie d’épreuve n’a effectivement pas d’altitude  (' +
       (nue.elev_gain_m === null ? 'null' : nue.elev_gain_m) + ')',
       nue.elev_gain_m == null && (nue.profile || []).length < 4,
       'sans cela, ce contrôle serait vert en n’ayant rien éprouvé');

    /* trois entrées, pour que les planches multi-sorties aient de quoi dessiner */
    var biblio = [1, 2, 3].map(function (n) {
      return { id: 'nu' + n, rang: n, couleur: Library.COULEURS[n - 1], activity: nue };
    });

    var proto = CanvasRenderingContext2D.prototype;
    var vraiFill = proto.fillText, vraiStroke = proto.strokeText;
    var capture = [];
    proto.fillText = function (t) { capture.push(String(t)); return vraiFill.apply(this, arguments); };
    proto.strokeText = function (t) { capture.push(String(t)); return vraiStroke.apply(this, arguments); };

    /* Un zéro suivi d'une UNITÉ : c'est l'affirmation d'une mesure. Un « 0 »
     * nu — un compteur, une graduation d'axe — n'affirme rien. */
    var suspect = /(^|[^\d,.])0([,.]0+)?\s*(%|m\b|m\s*d\+|km|w\b|bpm)/i;
    var fautives = [];
    var rendues = 0;
    try {
      Studio.all().forEach(function (tpl) {
        capture = [];
        try {
          Studio.setSupport(false); Studio.setVoile('aucun');
          Studio.setAchromatique(false);
          if (Studio.setSurface) Studio.setSurface('papier');
          Studio.setLibrary(biblio);
          var cv = document.createElement('canvas');
          Studio.render(cv, tpl.id, nue, { mentions: 'donnees' }, [540, 675]);
          rendues++;
        } catch (e) { return; }
        var d = capture.filter(function (t) { return suspect.test(t); });
        if (d.length) fautives.push(tpl.id + ' : « ' + d[0] + ' »');
      });
    } finally {
      proto.fillText = vraiFill;
      proto.strokeText = vraiStroke;
    }

    /* Le compte doit être plausible : à zéro planche rendue, ce contrôle serait
     * vert en n'ayant rien regardé. */
    ok('honnêteté · toutes les planches ont été rendues sans altitude  (' +
       rendues + '/' + Studio.all().length + ')',
       rendues >= Studio.all().length - 1);
    ok('honnêteté · aucune planche n’écrit une mesure que la sortie ne porte pas',
       fautives.length === 0,
       fautives.join(' | ') + ' — un zéro affirme une mesure nulle, ' +
       'une absence ne s’écrit pas avec un chiffre');

    Studio.setLibrary(App.entreesRetenues ? App.entreesRetenues() : Library.list());
  }());


  /* ---------- COUPER LE TEXTE NE VIDE PAS LA PLANCHE ----------
   *
   * Trente-trois planches sur trente-sept obéissent au réglage « Texte ». Deux
   * choses pouvaient mal tourner, et aucune ne lève d'erreur :
   *
   *   1. Une planche dont TOUT le texte se tait sans rien avoir dessiné rend
   *      une feuille blanche. Les surcouches y étaient exposées : elles sont
   *      transparentes, et une surcouche muette qui ne dessine pas exporte un
   *      PNG vide. Une mesure à la main l'a écarté une fois ; une mesure à la
   *      main ne tient pas.
   *
   *   2. Une planche multi-sorties sans sortie ne rend QUE son message — « Charge
   *      au moins deux sorties ». Si ce message obéissait au réglage, l'écran
   *      deviendrait vide et muet au moment précis où il doit dire quoi faire.
   *
   * LES DEUX SE DISENT D'UNE SEULE RÈGLE : aucune planche, bibliothèque pleine
   * OU vide, ne doit rendre à la fois zéro texte et zéro encre. Vide et muet ne
   * se distingue pas d'une panne.
   *
   * Une première version de ce contrôle posait autre chose : « ce qui parle en
   * Données avec une bibliothèque vide doit parler en Sans texte ». Elle
   * dénonçait dix-sept planches innocentes — les MONO-SORTIE, qui dessinent la
   * sortie chargée quelle que soit la bibliothèque et n'ont donc aucun état
   * vide. Leur encre valait 5 976 : elles n'étaient pas blanches du tout.
   *
   * Il compte ses planches : à zéro rendue il serait vert sans avoir regardé. */
  (function () {
    var base = App.etat.base;
    if (!base) {
      resultats.push({ cas: 'texte · couper le texte ne vide pas la planche',
                       verdict: 'sauté', detail: 'aucune sortie chargée' });
      return;
    }
    var pleine = Library.list();
    if (pleine.length < 2) {
      resultats.push({ cas: 'texte · couper le texte ne vide pas la planche',
                       verdict: 'sauté', detail: 'moins de deux sorties' });
      return;
    }

    var proto = CanvasRenderingContext2D.prototype;
    var vraiFill = proto.fillText, vraiStroke = proto.strokeText;
    var nTextes = 0;

    /* `encre()` compte l'ALPHA, et une feuille blanche OPAQUE a l'alpha au
     * maximum partout : elle passerait pour pleine. On compte donc ce qui
     * DIFFÈRE du pixel du coin — la définition marche des deux côtés, pour le
     * papier comme pour une surcouche transparente. */
    function marques(cv) {
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      var r0 = d[0], v0 = d[1], b0 = d[2], a0 = d[3];
      var n = 0;
      for (var i = 0; i < d.length; i += 4 * 17) {
        if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - v0) +
            Math.abs(d[i + 2] - b0) + Math.abs(d[i + 3] - a0) > 24) n++;
      }
      return n;
    }

    function rend(id, biblio, mentions) {
      nTextes = 0;
      proto.fillText = function (t) { if (String(t).trim()) nTextes++; return vraiFill.apply(this, arguments); };
      proto.strokeText = function (t) { if (String(t).trim()) nTextes++; return vraiStroke.apply(this, arguments); };
      var cv = document.createElement('canvas');
      var pose = null;
      try {
        Studio.setSupport(false); Studio.setVoile('aucun');
        Studio.setAchromatique(false);
        if (Studio.setSurface) Studio.setSurface('papier');
        Studio.setLibrary(biblio);
        Studio.render(cv, id, base, { mentions: mentions, voile: false }, [540, 675]);
        pose = { textes: nTextes, encre: marques(cv) };
      } catch (e) { pose = null; }
      proto.fillText = vraiFill;
      proto.strokeText = vraiStroke;
      return pose;
    }

    var blanches = [], muettes = [], rendues = 0, parlantes = 0;
    try {
      Studio.all().forEach(function (tpl) {
        /* 1. bibliothèque pleine : la planche doit rester visible. */
        var p = rend(tpl.id, pleine, 'aucun');
        if (!p) return;
        rendues++;
        if (p.textes === 0 && p.encre === 0) blanches.push(tpl.id);

        /* 2. bibliothèque VIDE : les multi-sorties y tombent sur leur message.
         *    Il est tout ce qu'elles rendent — s'il se tait, il ne reste rien. */
        var sans = rend(tpl.id, [], 'aucun');
        if (!sans) return;
        parlantes++;
        if (sans.textes === 0 && sans.encre === 0) muettes.push(tpl.id);
      });
    } finally {
      proto.fillText = vraiFill;
      proto.strokeText = vraiStroke;
    }

    ok('texte · toutes les planches ont été rendues sans texte  (' +
       rendues + '/' + Studio.all().length + ', et ' + parlantes + ' aussi sans bibliothèque)',
       rendues >= Studio.all().length - 1 && parlantes >= Studio.all().length - 1,
       'à zéro planche rendue, les deux cas suivants seraient verts pour rien');

    ok('texte · aucune planche ne rend une feuille blanche quand le texte se tait',
       blanches.length === 0,
       blanches.join(', ') + ' — une surcouche muette qui ne dessine rien exporte un PNG vide');

    ok('texte · sans aucune sortie, la planche dit encore quoi faire',
       muettes.length === 0,
       muettes.join(', ') + ' — vide ET muet ne se distingue pas d’une panne, ' +
       'et c’est là qu’il faut dire quoi faire');

    Studio.setLibrary(App.entreesRetenues ? App.entreesRetenues() : Library.list());
  }());

  /* ---------- CE QUE L'APPEL RÉEL RAMÈNE ----------
   *
   * LE DÉFAUT QUE CE CAS AURAIT ATTRAPÉ, ET QUE RIEN N'A ATTRAPÉ :
   * `activities()` commençait par `limit = limit || 5`. L'import appelait
   * `activities(0, 365)` — zéro pour dire « pas de plafond » — et cette ligne
   * le changeait en CINQ avant le garde-fou d'en bas. Une année entière
   * rendait cinq sorties quand l'API en rendait 471.
   *
   * POURQUOI LE BANC NE L'A PAS VU. Les cas d'import injectent leur `liste` :
   * c'est ce qui les rend éprouvables sans clé d'API, et c'est aussi ce qui
   * contournait `activities()` ENTIÈREMENT. L'injection avait rendu le code
   * testable et laissé l'implémentation réelle sans témoin. Ici, on remplace
   * le réseau et non la fonction : c'est elle qu'on mesure.
   *
   * La clé de l'utilisateur est sauvée puis remise à l'identique — un banc
   * n'a pas à laisser de trace dans le navigateur de quelqu'un. */
  if (window.IcuWeb) {
    var vraiFetch = window.fetch;
    var vraieCle = null;
    try { vraieCle = sessionStorage.getItem('icu-key'); } catch (e) { /* mode privé */ }
    var urls = [];
    try {
      sessionStorage.setItem('icu-key', 'cle-du-banc');
      window.fetch = function (url) {
        urls.push(String(url));
        var faux = [];
        for (var i = 0; i < 400; i++) {
          faux.push({ id: 'b' + i, name: 'Fabriquée', type: 'Ride',
                      start_date_local: '2026-05-01T08:00:00',
                      distance: 20000, moving_time: 3600, total_elevation_gain: 100 });
        }
        return Promise.resolve({
          ok: true, status: 200,
          json: function () { return Promise.resolve(faux); }
        });
      };

      var fen = await IcuWeb.activities(0, 365);
      ok('icu · une fenêtre demandée se rend ENTIÈRE  (' + fen.length + ' sur 400)',
         fen.length === 400,
         'un plafond s’applique encore à une fenêtre qui n’en demandait pas');

      var menu = await IcuWeb.activities(5);
      ok('icu · le menu déroulant garde son plafond de cinq  (' + menu.length + ')',
         menu.length === 5,
         'les deux besoins partagent une fonction : l’un ne doit pas manger l’autre');

      ok('icu · la fenêtre et le plafond partent bien à l’API',
         /oldest=/.test(urls[0]) && /newest=/.test(urls[0]) && /limit=/.test(urls[0]),
         urls[0] || '(aucune requête)');
    } catch (e) {
      ok('icu · l’appel réel se déroule sans lever', false, e.message);
    } finally {
      window.fetch = vraiFetch;
      try {
        if (vraieCle == null) sessionStorage.removeItem('icu-key');
        else sessionStorage.setItem('icu-key', vraieCle);
      } catch (e) { /* mode privé */ }
    }
    ok('icu · le banc remet la clé et le réseau en place',
       window.fetch === vraiFetch);
  }

  /* ---------- IMPORTER UNE PÉRIODE ----------
   *
   * Le chemin réseau vers intervals.icu n'est pas éprouvé ici, et ce n'est pas
   * une négligence : il demanderait une clé d'API personnelle. Ce qui EST
   * éprouvé, avec une source fabriquée, c'est tout ce qui peut se tromper sans
   * le réseau — la boucle, le dédoublonnage, l'arrêt sur quota, le plafond, et
   * le compte rendu. C'est là que vivent les fautes, pas dans le `fetch`.
   *
   * Chaque cas part d'une bibliothèque REMISE À ZÉRO puis restaurée : sans
   * cela, l'import laisserait des sorties fabriquées dans tous les cas
   * suivants, qui se mettraient à mesurer autre chose que ce qu'ils disent. */
  if (window.App && App.importePeriode) {
    var avantImport = Library.list().slice();

    function fausseSortie(n) {
      return {
        detail: { id: 'f' + n, name: 'Fabriquée ' + n, type: 'Ride',
                  start_date_local: '2026-0' + (1 + (n % 9)) + '-15T08:00:00',
                  distance: 20000 + n * 100, moving_time: 3600,
                  total_elevation_gain: 300 + n },
        streams: []
      };
    }

    /* 1. DEUX PHASES : les résumés d'abord, les tracés ensuite.
     *
     * La liste porte déjà date, distance, dénivelé, durée et sport — tout ce
     * qu'Almanac dessine. Les poser immédiatement rend la planche utilisable
     * en UNE requête, là où une année demandait trois cents appels et
     * plusieurs minutes avant de montrer quoi que ce soit.
     *
     * On constate l'ordre, pas seulement le résultat : au moment où
     * `apresResumes` se déclenche, les trois sorties doivent Être LÀ, et
     * aucune ne doit encore porter de tracé. */
    var auMomentDesResumes = null;
    var r1 = await App.importePeriode({
      jours: 31, front: 1, pause: 0,
      dors: function () { return Promise.resolve(); },
      liste: function () {
        return Promise.resolve([{ id: 'f1', name: 'Résumée', type: 'Ride',
                                 start_date_local: '2026-03-02T08:00:00',
                                 distance: 30000, moving_time: 3600,
                                 total_elevation_gain: 500 },
                                { id: 'f2' }, { id: 'f3' }]);
      },
      apresResumes: function () {
        /* ON NE REGARDE QUE LES NOUVELLES, et on relit le résumé ICI : quatre
         * sorties de démonstration portent déjà un tracé, et l'enrichissement
         * remplacera ces résumés avant la fin de l'import. Mesurer après coup,
         * c'est mesurer autre chose. */
        var neuves = Library.list().slice(avantImport.length);
        var a0 = neuves[0] && neuves[0].activity;
        auMomentDesResumes = {
          entrees: neuves.length,
          avecTrace: neuves.filter(function (e) {
            return e.activity && e.activity.track && e.activity.track.length > 1;
          }).length,
          resume: a0 && {
            km: a0.distance_km, deniv: a0.elev_gain_m, duree: a0.duration_s,
            date: !!a0.date, sansTrace: a0.sans_trace === true
          }
        };
      },
      charge: function (id) { return Promise.resolve(fausseSortie(+String(id).slice(1))); }
    });
    ok('import · les résumés sont posés AVANT le premier tracé  (' +
       (auMomentDesResumes ? auMomentDesResumes.entrees + ' entrées, ' +
        auMomentDesResumes.avecTrace + ' avec tracé' : 'jamais appelé') + ')',
       !!auMomentDesResumes && auMomentDesResumes.entrees === 3 &&
       auMomentDesResumes.avecTrace === 0);
    var res0 = auMomentDesResumes && auMomentDesResumes.resume;
    ok('import · un résumé porte ce qu’Almanac dessine  (' +
       (res0 ? res0.km + ' km · ' + res0.deniv + ' m · ' + res0.duree + ' s' : '—') + ')',
       !!res0 && res0.km === 30 && res0.deniv === 500 && res0.duree === 3600 &&
       res0.date && res0.sansTrace,
       'date, distance, dénivelé, durée — et le marquage « sans tracé »');
    ok('import · les tracés ENRICHISSENT, ils n’ajoutent pas  (' +
       (Library.count() - avantImport.length) + ' entrées pour 3 sorties)',
       r1.charges === 3 && Library.count() === avantImport.length + 3,
       'retirer puis réajouter changerait la couleur et le rang');

    /* 2. CE QU'ON A DÉJÀ NE SE RETÉLÉCHARGE PAS. Sans ce filtre, réimporter une
     *    période chevauchante repayait chaque sortie commune et la comptait
     *    deux fois dans la bibliothèque. */
    var appels = 0;
    var r2 = await App.importePeriode({
      jours: 31, front: 3,
      liste: function () {
        return Promise.resolve([{ id: 'f1' }, { id: 'f2' }, { id: 'f9' }]);
      },
      charge: function (id) { appels++; return Promise.resolve(fausseSortie(9)); }
    });
    ok('import · ce qui est déjà là n’est pas rechangé  (' + r2.ignorees +
       ' ignorée(s), ' + appels + ' appel(s))',
       r2.ignorees === 2 && appels === 1 && r2.charges === 1);

    /* 3. UN REFUS DE RYTHME SE RETENTE, PUIS RENONCE.
     *
     * intervals.icu répond 429 au bout de quelques dizaines de requêtes
     * rapprochées, et sa réponse 429 NE PORTE PAS d'en-tête CORS : le
     * navigateur la bloque avant que le statut soit lisible, et l'appel lève
     * « RESEAU ». Vingt-six refus se comptaient donc comme vingt-six sorties
     * illisibles. Ici on vérifie les deux moitiés de la règle : le refus est
     * retenté, et cinq abandons de suite arrêtent l'import.
     *
     * `dors` est neutralisé : on éprouve la logique d'attente, pas la
     * patience du banc. */
    var essais = 0;
    var r3 = await App.importePeriode({
      jours: 365, front: 1, pause: 0, essais: 3,
      dors: function () { return Promise.resolve(); },
      liste: function () {
        var l = [];
        for (var i = 20; i < 40; i++) l.push({ id: 'q' + i });
        return Promise.resolve(l);
      },
      charge: function () {
        essais++;
        return Promise.reject(new Error('RESEAU'));
      }
    });
    ok('import · un refus de rythme est retenté avant d’être compté  (' +
       essais + ' appels pour 5 sorties abandonnées)',
       essais === 15 && r3.refusees === 5,
       'trois essais par sortie, cinq sorties avant de renoncer');
    ok('import · cinq refus de suite arrêtent l’import  (' + r3.arret + ')',
       r3.arret === 'RYTHME' && r3.echoues === 0,
       'insister sur une limite de rythme ne fait que l’entretenir');

    /* 3 bis. UNE SORTIE VRAIMENT ILLISIBLE N'ARRÊTE RIEN et ne se retente
     *        pas : ce n'est pas le réseau qui a fléchi. */
    var appelsIl = 0;
    var r3b = await App.importePeriode({
      jours: 7, front: 1, pause: 0,
      dors: function () { return Promise.resolve(); },
      liste: function () { return Promise.resolve([{ id: 'z1' }, { id: 'z2' }]); },
      charge: function (id) {
        appelsIl++;
        if (String(id) === 'z1') return Promise.reject(new Error('illisible'));
        return Promise.resolve(fausseSortie(77));
      }
    });
    ok('import · une sortie illisible est comptée sans être retentée  (' +
       appelsIl + ' appels pour 2 sorties)',
       appelsIl === 2 && r3b.echoues === 1 && r3b.charges === 1 && !r3b.arret);

    /* 4. LE PLAFOND EST DIT. Une année peut compter des centaines de sorties ;
     *    en tronquer en silence ferait une affiche incomplète sans le dire. */
    var r4 = await App.importePeriode({
      jours: 365, front: 2, plafond: 2,
      liste: function () {
        var l = [];
        for (var i = 50; i < 60; i++) l.push({ id: 'p' + i });
        return Promise.resolve(l);
      },
      charge: function (id) { return Promise.resolve(fausseSortie(+String(id).slice(1))); }
    });
    ok('import · au-delà du plafond, la période est tronquée ET annoncée  (' +
       r4.charges + ')', r4.charges === 2 && r4.total === 10);

    /* 4 bis. ON PEUT L'ARRÊTER. Un import d'année dure des minutes ; sans
     *        bouton, la seule sortie était de recharger la page et de perdre
     *        ce qui était déjà entré. Ce qui est chargé avant l'arrêt RESTE. */
    var avantArret = Library.count();
    var demande = false;
    var chargesFaits = 0;
    var r5 = await App.importePeriode({
      jours: 31, front: 1, pause: 0,
      dors: function () { return Promise.resolve(); },
      liste: function () {
        var l = [];
        for (var i = 0; i < 10; i++) l.push({ id: 's' + i });
        return Promise.resolve(l);
      },
      stop: function () { return demande; },
      charge: function (id) {
        chargesFaits++;
        if (chargesFaits >= 3) demande = true;
        return Promise.resolve(fausseSortie(60 + chargesFaits));
      }
    });
    ok('import · l’arrêt est entendu, et ce qui est chargé reste  (' +
       r5.charges + ' tracés sur 10, ' + r5.resumes + ' résumés posés)',
       r5.arret === 'ARRET' && r5.charges === 3 && r5.resumes === 10 &&
       Library.count() === avantArret + 10,
       'les dix résumés restent, trois seulement ont leur tracé');

    /* 5. LE COMPTE RENDU DIT TOUT. Une ligne qui n'annoncerait que les
     *    chargements laisserait croire que la période n'en comptait pas plus. */
    App.ditImport({ etat: 'fini', charges: 3, resumes: 5, ignorees: 2, echoues: 1,
                    refusees: 4, total: 6, tronquee: true });
    var ligne = $('#icu-progres').textContent;
    ok('import · le compte rendu dit ce qui est entré, ignoré, raté et refusé  (' +
       ligne + ')',
       /3/.test(ligne) && /2/.test(ligne) && /1/.test(ligne) && /4/.test(ligne));
    /* IL DIT QUOI FAIRE. « 26 refusées » laisse devant un mur ; l'import est
     * repartable, et c'est le seul renseignement qui serve ici. */
    ok('import · devant un refus de rythme, il dit que l’import se relance',
       /reprend/.test(ligne), ligne);
    /* LE NOMBRE TROUVÉ EST ÉCRIT, ET EN TÊTE. Sans lui, une période qui ne rend
     * que cinq sorties oblige à additionner pour s'en apercevoir — et c'est
     * exactement le chiffre qu'on cherche quand on soupçonne un plafond. */
    ok('import · il dit d’abord combien la période en contenait',
       /^6 sorties trouvées/.test(ligne), ligne);
    $('#icu-progres').textContent = '';

    /* On rend la bibliothèque telle qu'on l'a trouvée. */
    Library.replace ? Library.replace(avantImport)
                    : (function () {
                        while (Library.count() > avantImport.length) {
                          Library.remove(Library.list()[Library.count() - 1].id);
                        }
                      }());
    ok('import · le banc rend la bibliothèque telle qu’il l’a trouvée  (' +
       Library.count() + ')', Library.count() === avantImport.length);
    if (App.syncBibliotheque) App.syncBibliotheque();
  } else {
    resultats.push({ cas: 'import · période', verdict: 'sauté',
                     detail: 'point d’entrée absent' });
  }

  /* ---------- L'ANNONCE D'UNE NOUVELLE VERSION ----------
   *
   * Le banc ne peut pas fabriquer une vraie mise à jour de service worker en
   * quelques secondes, et prétendre le contraire serait le contrôle qui ne
   * contrôle pas ce qu'il dit. Il éprouve ce qui casse EN SILENCE : le
   * bandeau, son libellé, son numéro, et le fait que le bouton existe.
   * Le déclenchement, lui, est gardé statiquement par le harnais. */
  var maj = $('#maj');
  ok('mise à jour · le bandeau est absent tant qu’il n’y a rien à annoncer',
     !!maj && maj.hidden);
  if (maj && window.__annonceVersion) {
    window.__annonceVersion('9.9.9');
    await attends(120);
    ok('mise à jour · annoncée, elle se montre et porte le numéro  (' +
       maj.querySelector('.titre').textContent + ')',
       !maj.hidden && /9\.9\.9/.test(maj.querySelector('.titre').textContent));
    ok('mise à jour · le bouton qui recharge est là',
       !!$('#maj-recharger') && $('#maj-recharger').offsetParent !== null);
    /* SANS NUMÉRO, ON N'EN INVENTE PAS. La lecture de src/version.js peut
     * échouer — hors ligne, cache vidé — et le bandeau doit alors rester
     * vrai plutôt que d'afficher « undefined ». */
    window.__annonceVersion(null);
    await attends(120);
    ok('mise à jour · sans numéro lisible, elle n’en invente pas',
       !/undefined|null|9\.9\.9/.test(maj.querySelector('.titre').textContent));
    $('#maj-fermer').click();
    await attends(120);
    ok('mise à jour · la croix la ferme', maj.hidden);
  } else {
    resultats.push({ cas: 'mise à jour · annonce', verdict: 'sauté',
                     detail: 'bandeau ou point d’entrée absent' });
  }

  /* ---------- LE CYANOTYPE, UNE SURFACE ----------
   *
   * Quatre questions, et chacune peut échouer séparément :
   *   le réglage du bain n'apparaît QUE pour la surface qui le porte ;
   *   la planche vire réellement au bleu — mesuré, pas constaté à l'œil ;
   *   les trois bains ne donnent pas la même planche ;
   *   et sur une photo, le tirage ne s'applique PAS, parce qu'un tirage est
   *   un papier et que le studio n'a pas à repeindre la photo de quelqu'un.
   *
   * La bleuité se mesure comme un ÉCART entre canaux, pas comme une valeur
   * absolue : une planche déjà sombre ferait passer « beaucoup de bleu »
   * pour un tirage alors qu'elle est simplement noire. */
  function bleuite() {
    var c = $('#canvas');
    var im = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    var r = 0, b = 0, n = 0;
    for (var q = 0; q < im.length; q += 4 * 97) {
      if (im[q + 3] < 200) continue;
      r += im[q]; b += im[q + 2]; n++;
    }
    return n ? Math.round((b - r) / n) : 0;
  }

  var bleuPapier = bleuite();
  ok('cyanotype · le bain est caché tant qu’on n’a pas choisi le tirage',
     $('#opt-bain').hidden && $('#opt-halo').hidden);

  $('#support').value = 'cyanotype';
  $('#support').dispatchEvent(new Event('change'));
  await attends(700);
  ok('cyanotype · choisir le tirage fait apparaître le bain et le halo',
     !$('#opt-bain').hidden && !$('#opt-halo').hidden);

  var bleuProfond = bleuite();
  ok('cyanotype · la planche vire au bleu  (' + bleuPapier + ' → ' + bleuProfond + ')',
     bleuProfond - bleuPapier > 15,
     'le bleu doit dépasser le rouge nettement plus qu’avant le tirage');

  var avantBain = $('#canvas').toDataURL();
  $('#bain').value = 'negatif';
  $('#bain').dispatchEvent(new Event('change'));
  await attends(700);
  ok('cyanotype · changer de bain change la planche',
     $('#canvas').toDataURL() !== avantBain);

  /* SUR PHOTO, PAS DE TIRAGE. Sans ce cas, la règle tenait dans un `&&` que
   * personne n'aurait relu. */
  $('#support').value = 'surcouche';
  $('#support').dispatchEvent(new Event('change'));
  await attends(700);
  var bleuSurcouche = bleuite();
  ok('cyanotype · sur une photo, le tirage ne s’applique pas  (' + bleuSurcouche + ')',
     bleuSurcouche - bleuPapier < 15,
     'la surcouche est repeinte en bleu alors qu’un tirage est un papier');

  $('#support').value = 'papier';
  $('#support').dispatchEvent(new Event('change'));
  await attends(500);


  // ---------- 4 bis. la collection, les variantes, le voile ----------

  /* LA COLLECTION. Le menu était VIDE — déclaré sans option dans le HTML et
   * rempli nulle part — alors que huit palettes existaient et s'appliquaient
   * correctement. Poser une valeur sur un menu vide ne lève rien : le défaut
   * n'avait aucun symptôme, sinon un réglage qui ne faisait jamais rien. */
  var selColl = $('#collection');
  ok('collection · le menu propose les palettes  (' + selColl.options.length + ')',
     selColl.options.length >= 5,
     'menu vide ou presque : ' + selColl.options.length + ' entrée(s)');

  if (selColl.options.length > 2) {
    var avantColl = $('#canvas').toDataURL();
    selColl.value = selColl.options[2].value;
    selColl.dispatchEvent(new Event('change'));
    await attends(700);
    ok('collection · en choisir une change la planche',
       $('#canvas').toDataURL() !== avantColl);
    ok('collection · sa note s’affiche',
       ($('#collection-note').textContent || '').length > 4);
    selColl.value = 'libre';
    selColl.dispatchEvent(new Event('change'));
    await attends(500);
  }

  /* LES VARIANTES. Le catalogue n'ouvrait qu'un seul axe — la première liste
   * déroulante — et tout ce qui demandait une combinaison restait invisible :
   * « Fragment » de Médaillon est un cadrage ET un décalage. Le contrôle vise
   * donc une famille qui déclare ses variantes, pas une famille quelconque. */
  var famille = null;
  var groupes = document.querySelectorAll('.groupes-style button');
  for (var g = 0; g < groupes.length && !famille; g++) {
    groupes[g].click();
    await attends(320);
    var cartes = document.querySelectorAll('#choix-style .familles .carte-style');
    for (var c = 0; c < cartes.length; c++) {
      cartes[c].click();
      await attends(420);
      if ($('#tpl').value === 'medaillon') { famille = true; break; }
      var retourF = document.querySelector('.retour-familles');
      if (retourF) { retourF.click(); await attends(260); }
    }
  }
  if (!famille) {
    resultats.push({ cas: 'variantes · Médaillon', verdict: 'sauté',
                     detail: 'famille introuvable dans le catalogue' });
  } else {
    await attends(500);
    var vCartes = document.querySelectorAll('#choix-style .variantes .carte-style');
    var noms = Array.prototype.map.call(vCartes, function (x) {
      return (x.querySelector('.nom') || {}).textContent || '';
    });
    ok('variantes · Médaillon en propose au moins trois  (' + noms.join(' · ') + ')',
       vCartes.length >= 3);

    var fragment = null;
    Array.prototype.forEach.call(vCartes, function (x) {
      if (!fragment && /Fragment/i.test(x.textContent)) fragment = x;
    });
    if (!fragment) {
      ok('variantes · « Fragment » a sa carte', false,
         'les variantes visibles sont : ' + noms.join(' · '));
    } else {
      var avantV = $('#canvas').toDataURL();
      fragment.click();
      await attends(900);
      ok('variantes · « Fragment » change la planche',
         $('#canvas').toDataURL() !== avantV);
      ok('variantes · la carte choisie est marquée',
         /Fragment/i.test((document.querySelector(
           '#choix-style .variantes .carte-style.on') || {}).textContent || ''));
    }
    var retour2 = document.querySelector('.retour-familles');
    if (retour2) { retour2.click(); await attends(300); }
  }

  /* LE VOILE. Sans lui, une planche claire posée sur une photo claire est
   * illisible : huit planches apportaient le leur, les vingt-cinq autres
   * étaient transparentes sans être utilisables. */
  ok('voile · le réglage est caché tant qu’on est sur fond plein',
     $('#opt-voile').hidden);
  $('#support').value = 'surcouche';
  $('#support').dispatchEvent(new Event('change'));
  await attends(600);
  ok('voile · il apparaît dès qu’on passe en surcouche', !$('#opt-voile').hidden);

  function couverture() {
    var cvv = $('#canvas');
    var dd = cvv.getContext('2d').getImageData(0, 0, cvv.width, cvv.height).data;
    var n = 0, t = 0;
    for (var k = 3; k < dd.length; k += 4 * 61) { t++; if (dd[k] > 12) n++; }
    return n / t;
  }
  /* LE VOILE, SUR LES TRENTE-DEUX PLANCHES — PAS SUR UN ECHANTILLON.
   *
   * Ce cas mesurait la planche qui se trouvait la, au hasard du parcours. Il a
   * d'abord semble un defaut de WebKit, puis un cas fragile ; une fois qu'il a
   * nomme son sujet, il a trouve autre chose : « sommet-barres, 6 % → 6 % ».
   * Le voile dit global n'atteignait en fait que les quinze planches qui
   * declaraient la cle. J'avais verifie six d'entre elles et conclu pour les
   * trente-deux — l'erreur exacte qu'on reproche a un controle qui echantillonne
   * et affirme. Celui-ci les parcourt toutes.
   *
   * Deux facons d'etre protege, et les deux comptent : le voile CHANGE la
   * planche, ou la planche couvre DEJA le cadre (la famille « sur photo »
   * apporte le sien, Editorial reste une carte). */
  function couvertureCanvas() {
    var cvv = $('#canvas');
    var dd = cvv.getContext('2d').getImageData(0, 0, cvv.width, cvv.height).data;
    var n = 0, t = 0;
    for (var k = 3; k < dd.length; k += 4 * 61) { t++; if (dd[k] > 12) n++; }
    return n / t;
  }
  async function couvertureDe(tpl, v) {
    var avant = $('#canvas').toDataURL();
    $('#tpl').value = tpl;
    $('#tpl').dispatchEvent(new Event('change'));
    $('#voile').value = v;
    $('#voile').dispatchEvent(new Event('change'));
    await jusqua(function () { return $('#canvas').toDataURL() !== avant; }, 8000);
    return couvertureCanvas();
  }

  /* LE BALAYAGE NE SE FAIT QU'UNE FOIS PAR MOTEUR, sur la passe large.
   * Trente-deux planches en deux rendus chacune, c'est le cas le plus cher du
   * fichier ; le refaire en 390 px ne dirait rien de plus — le voile n'est pas
   * une affaire de mise en page. */
  var nus = [];
  var tousIds = petit ? [] : Studio.all().map(function (x) { return x.id; });
  for (var ti = 0; ti < tousIds.length; ti++) {
    var sansV = await couvertureDe(tousIds[ti], 'aucun');
    var avecV = await couvertureDe(tousIds[ti], 'bas');
    /* protegee si le voile agit, OU si la planche couvre deja le cadre */
    if (!(avecV > sansV + 0.2 || sansV >= 0.30)) {
      nus.push(tousIds[ti] + ' ' + Math.round(sansV * 100) + '→' + Math.round(avecV * 100) + ' %');
    }
  }
  if (!tousIds.length) {
    resultats.push({ cas: 'voile · balayage des planches', verdict: 'sauté',
                     detail: 'fait sur la passe large' });
  } else {
    ok('voile · les ' + tousIds.length + ' planches sont protegeables sur une photo',
       nus.length === 0,
       'sans protection : ' + nus.join(' | '));
  }

  $('#voile').value = 'aucun';
  $('#voile').dispatchEvent(new Event('change'));
  $('#support').value = 'papier';
  $('#support').dispatchEvent(new Event('change'));
  await attends(500);

  // ---------- 5. l'export garde ce qu'on voit ----------
  var blob = await new Promise(function (r) { $('#canvas').toBlob(r, 'image/png'); });
  ok('export · le PNG se fabrique  (' + Math.round(blob.size / 1024) + ' Ko)',
     blob && blob.size > 4000);

  // ---------- 6. le téléphone ----------
  var petit = window.matchMedia('(max-width: 900px)').matches;
  if (!petit) {
    resultats.push({ cas: 'téléphone · panneaux', verdict: 'sauté',
                     detail: 'fenêtre large — rétrécir sous 900 px pour ce bloc' });
  } else {
    ok('téléphone · la barre d’outils est là', !$('#barre').hidden);
    ok('téléphone · la colonne est masquée',
       getComputedStyle(document.querySelector('aside')).display === 'none');
    $('#barre button[data-feuille="style"]').click();
    await attends(400);
    ok('téléphone · le panneau s’ouvre', !$('#feuille').hidden);
    ok('téléphone · il contient de quoi choisir une sortie',
       !!document.querySelector('#feuille .zone[data-zone="style"] #section-activite'));
    $('#feuille-fermer').click();
    await attends(300);
    ok('téléphone · le panneau se ferme', $('#feuille').hidden);
    $('#barre button[data-feuille="teintes"]').click();
    await attends(300);
    /* CHAQUE PANNEAU REPOND A UNE SEULE QUESTION.
     *
     * Ce cas exigeait que Teintes porte le rendu ET le support. Il a echoue le
     * jour ou le support est parti dans Export — a juste titre : le support ne
     * decide d'aucune couleur, il decide du fond. Le cas ne verifie donc plus
     * qu'une presence, mais un PARTAGE : ce qui est de la couleur d'un cote,
     * ce qui est du fond de l'autre, et rien des deux a la fois. */
    var dansTeintes = function (sel) {
      return !!document.querySelector('#feuille .zone[data-zone="teintes"] ' + sel);
    };
    ok('téléphone · Teintes ne porte que des couleurs',
       dansTeintes('#opt-teintes') && dansTeintes('#opt-collection') &&
       !dansTeintes('#opt-support') && !dansTeintes('#opt-voile'),
       'rendu ' + dansTeintes('#opt-teintes') + ' · palette ' + dansTeintes('#opt-collection') +
       ' · support (ne devrait pas) ' + dansTeintes('#opt-support'));
    $('#feuille-voile').click();
    await attends(250);
    $('#barre button[data-feuille="format"]').click();
    await attends(300);
    var dansExport = function (sel) {
      return !!document.querySelector('#feuille .zone[data-zone="format"] ' + sel);
    };
    ok('téléphone · Export ne porte que la sortie',
       dansExport('#rangee-format') && dansExport('#opt-sortie') &&
       !dansExport('#section-fond'),
       'format ' + dansExport('#rangee-format') + ' · sortie ' + dansExport('#opt-sortie') +
       ' · photo (ne devrait plus y etre) ' + dansExport('#section-fond'));
    /* LA PHOTO OUVRE LE PANNEAU STYLE. On choisit l'image, puis la planche qui
     * va dessus — l'inverse revenait a regler une surcouche sans voir ce qu'il
     * y avait dessous. */
    $('#feuille-voile').click();
    await attends(250);
    $('#barre button[data-feuille="style"]').click();
    await attends(300);
    ok('téléphone · la photo et le support ouvrent le panneau Style',
       !!document.querySelector('#feuille .zone[data-zone="style"] #section-fond') &&
       !!document.querySelector('#feuille .zone[data-zone="style"] #opt-support'));
    $('#feuille-voile').click();
    await attends(250);
    ok('téléphone · le voile ferme aussi', $('#feuille').hidden);

    /* LA PLANCHE N'EST PAS CACHÉE PAR LA BARRE.
     *
     * Ce cas existe parce que le défaut a été commis deux fois de suite :
     * `height: 100%` reprend la marge basse du parent quand box-sizing est
     * en border-box, et `flex: 1` ne divise rien quand la page défile.
     * Dans les deux cas le bas de la planche — son titre, sa mention —
     * passait sous la barre d'outils. Ça ne se voit pas dans le DOM : il
     * faut mesurer. */
    await attends(300);
    var scene = $('#stage').getBoundingClientRect();
    var barre = $('#barre').getBoundingClientRect();
    ok('téléphone · la planche s’arrête au-dessus de la barre  (' +
       Math.round(barre.top - scene.bottom) + ' px)',
       scene.bottom <= barre.top + 1,
       'la scène passe de ' + Math.round(scene.bottom - barre.top) + ' px sous la barre');

    var legende = $('#stage-caption');
    if (legende && legende.textContent) {
      var lc = legende.getBoundingClientRect();
      ok('téléphone · la légende de la planche reste lisible',
         lc.bottom <= barre.top + 1 && lc.top >= 0);
    }

    /* Rien ne doit déborder en largeur, à aucune largeur d'écran. */
    ok('téléphone · aucun débordement horizontal  (' + innerWidth + ' px)',
       document.documentElement.scrollWidth <= innerWidth);
  }

  // ---------- 6 ter. LA PUISSANCE, DEPUIS UN GPX ----------
  /* Tout existait en aval — la série, les allumettes, le FTP — mais le
   * parseur GPX ne demandait jamais la puissance. Un fichier qui contenait
   * ses watts donnait `has_power = false`, et Allumettes retombait sur la
   * fréquence cardiaque en annonçant quand même ses allumettes : la bonne
   * réponse à la mauvaise question. */
  (function () {
    function trkpt(i, w) {
      return '<trkpt lat="46.5' + String(i).padStart(3, '0') + '" lon="7.100">' +
             '<ele>' + (500 + i) + '</ele>' +
             '<time>2026-06-01T06:00:' + String(i % 60).padStart(2, '0') + 'Z</time>' +
             '<extensions><power>' + w + '</power></extensions></trkpt>';
    }
    var pts = '';
    for (var i = 0; i < 40; i++) pts += trkpt(i, 200 + (i % 7) * 25);
    var gpx = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">' +
      '<trk><name>watts</name><trkseg>' + pts + '</trkseg></trk></gpx>';
    try {
      var a = Activity.build(Activity.parseGPX(gpx));
      ok('puissance · un GPX qui porte des watts les livre  (' +
         (a.power && a.power.max) + ' W max)',
         a.has_power === true && a.power.data.length === 40 && a.power.max >= 200,
         'has_power=' + a.has_power + ' points=' + (a.power && a.power.data.length));
      /* ET LA MESURE DOIT ÊTRE LA BONNE. Sans ce second contrôle, un repli
       * silencieux sur le cardio passerait pour un succès : c'est exactement
       * ce qui se produisait. */
      var f = a.burned ? a.burned({ ftp: 220 }) : null;
      ok('puissance · les allumettes se comptent sur les watts, pas sur le cœur',
         !!f && f.source === 'puissance', 'source = ' + (f && f.source));
    } catch (e) {
      ok('puissance · un GPX qui porte des watts les livre', false, e.message);
    }
    /* Un GPX SANS watts doit rester sans puissance — sinon le contrôle
     * ci-dessus passerait au vert sur n'importe quoi. */
    var nu = '<?xml version="1.0" encoding="UTF-8"?>' +
      '<gpx version="1.1" xmlns="http://www.topografix.com/GPX/1/1">' +
      '<trk><trkseg><trkpt lat="46.5" lon="7.1"><ele>500</ele></trkpt>' +
      '<trkpt lat="46.6" lon="7.2"><ele>520</ele></trkpt></trkseg></trk></gpx>';
    try {
      var b = Activity.build(Activity.parseGPX(nu));
      ok('puissance · sans watts, rien n’est inventé', b.has_power === false);
    } catch (e) {
      ok('puissance · sans watts, rien n’est inventé', false, e.message);
    }
  }());

  // ---------- 6 quater. L'EXPORT VIDÉO ----------
  /* IL N'ÉTAIT PAS COUVERT, ET IL ÉTAIT CASSÉ.
   *
   * `exports.js` employait `SIZES` et `canvas` sans les déclarer : depuis le
   * découpage de app.js, ces deux noms n'existent plus dans la portée d'un
   * morceau. L'export vidéo et la séquence PNG mouraient sur leur première
   * ligne, avant même d'écrire un message d'état. Deux cent un cas verts
   * au-dessus d'un bouton qui ne faisait rien — parce que ce fichier
   * annonçait lui-même ne pas le couvrir.
   *
   * La raison invoquée — « MediaRecorder sur plusieurs secondes » — ne tient
   * plus : la durée est devenue un réglage, et 1,5 s suffisent à prouver
   * qu'un fichier sort. Ce qui coûtait trop cher à éprouver, c'était une
   * constante qu'on ne pouvait pas changer. */
  if (!window.MediaRecorder || !Video.pickMime()) {
    resultats.push({ cas: 'vidéo · export', verdict: 'sauté',
                     detail: 'ce navigateur ne sait pas enregistrer' });
  } else if (!$('#export') || !$('#sortie')) {
    resultats.push({ cas: 'vidéo · export', verdict: 'sauté', detail: 'bouton absent' });
  } else {
    var sauveVraie = Video.save;
    var sortie = null;
    Video.save = function (blob, nom) { sortie = { taille: blob.size, nom: nom }; };
    var dureeAvant = $('#duree') ? $('#duree').value : null;
    if ($('#duree')) {
      $('#duree').value = '1500';
      $('#duree').dispatchEvent(new Event('change'));
    }
    /* UN SEUL BOUTON : le format se choisit dans le menu. Ce cas cliquait
     * `#export-video`, qui n'existe plus — et sans cette mise a jour il se
     * serait SAUTE en silence, en annoncant « bouton absent ». Un cas qui
     * s'esquive proprement est un cas qui ne prouve plus rien. */
    $('#sortie').value = 'video';
    $('#sortie').dispatchEvent(new Event('change'));
    $('#export').click();
    var fini = await jusqua(function () { return !!sortie; }, 40000);
    Video.save = sauveVraie;
    if (dureeAvant && $('#duree')) {
      $('#duree').value = dureeAvant;
      $('#duree').dispatchEvent(new Event('change'));
    }
    /* UN FICHIER, ET UN FICHIER QUI PÈSE. Un blob vide s'enregistre aussi
     * bien qu'un plein : sans le seuil, le contrôle serait vert sur zéro
     * octet, ce qui est précisément la panne qu'on veut voir. */
    ok('vidéo · l’export rend un fichier  (' +
       (sortie ? Math.round(sortie.taille / 1024) + ' ko' : 'rien') + ')',
       fini && sortie && sortie.taille > 10000,
       'état : ' + ($('#video-state') ? $('#video-state').textContent : '—'));
    ok('vidéo · le fichier porte une extension jouable',
       !!sortie && /[.](mp4|webm)$/.test(sortie.nom), sortie && sortie.nom);
  }

  // ---------- 6 quinquies. PLACER LA PLANCHE SUR LA PHOTO ----------
  /* Une transformation posee autour de `draw` deplace l'encre des trente-six
   * planches. Trois choses doivent rester vraies, et chacune s'est deja
   * trompee une fois pendant l'ecriture :
   *
   *   1. en surcouche, le placement DEPLACE ;
   *   2. sur papier, il ne fait RIEN — sinon il emporterait le fond avec lui
   *      et laisserait une bande vide au bord ;
   *   3. le VOILE reste ancre au cadre. Quinze planches le peignent dans
   *      `Alpage.socle()`, donc dans la transformation : la premiere version
   *      le promenait avec l'encre et posait un rectangle sombre de travers
   *      sur la photo. Ce n'est pas un controle qui l'a vu, c'est l'image.
   */
  (function () {
    /* Le barycentre de l'encre, en fractions du cadre : comparable d'un
     * format a l'autre, ce qu'une mesure en pixels ne serait pas. */
    function centre(o, place) {
      window.Studio.setVoile('aucun');
      window.Studio.setPlacement(place);
      var cv = document.createElement('canvas');
      window.Studio.render(cv, 'encre', window.App.etat.base, o || {}, [540, 960]);
      var d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      var sx = 0, sy = 0, n = 0;
      for (var y = 0; y < cv.height; y += 2) {
        for (var x = 0; x < cv.width; x += 2) {
          if (d[(y * cv.width + x) * 4 + 3] > 40) { sx += x / cv.width; sy += y / cv.height; n++; }
        }
      }
      return n ? { x: sx / n, y: sy / n, n: n } : null;
    }

    var supportAvant = document.querySelector('#support').value;

    window.Studio.setSupport(true);
    var a = centre({}, { x: 0, y: 0, echelle: 1 });
    var b = centre({}, { x: -0.25, y: -0.2, echelle: 1 });
    ok('placement · en surcouche, la planche se deplace  (' +
       (a && b ? (a.x - b.x).toFixed(2) + ' / ' + (a.y - b.y).toFixed(2) : '—') + ')',
       !!a && !!b && (a.x - b.x) > 0.1 && (a.y - b.y) > 0.08);

    var petit = centre({}, { x: 0, y: 0, echelle: 0.6 });
    /* L'aire suit le CARRE de l'echelle : 0,6 doit rendre environ 36 % de
     * l'encre. Sans cette borne haute, une echelle ignoree passerait au vert. */
    ok('placement · l’echelle reduit vraiment  (' +
       (a && petit ? Math.round(100 * petit.n / a.n) + ' %' : '—') + ')',
       !!a && !!petit && petit.n < a.n * 0.55 && petit.n > a.n * 0.2);

    /* LE VOILE RESTE EN BAS DU CADRE. On compare l'obscurite de la bande
     * basse a celle de la bande haute : un voile « vers le bas » doit
     * assombrir le bas, meme quand la planche est montee a gauche. */
    window.Studio.setSupport(true);
    window.Studio.setVoile('bas');
    window.Studio.setPlacement({ x: -0.25, y: -0.2, echelle: 1 });
    var cv2 = document.createElement('canvas');
    window.Studio.render(cv2, 'encre', window.App.etat.base, {}, [540, 960]);
    var d2 = cv2.getContext('2d').getImageData(0, 0, cv2.width, cv2.height).data;
    function alphaMoyen(y0, y1) {
      var s = 0, k = 0;
      for (var y = y0; y < y1; y += 2) {
        for (var x = 0; x < cv2.width; x += 3) { s += d2[(y * cv2.width + x) * 4 + 3]; k++; }
      }
      return k ? s / k : 0;
    }
    var bas = alphaMoyen(Math.floor(cv2.height * 0.86), cv2.height);
    var haut = alphaMoyen(0, Math.floor(cv2.height * 0.14));
    ok('placement · le voile reste ancre au cadre, planche deplacee  (bas ' +
       bas.toFixed(0) + ' contre haut ' + haut.toFixed(0) + ')',
       bas > haut + 12,
       'un voile qui suit la planche laisse un rectangle de travers sur la photo');

    /* SUR PAPIER, RIEN. Deux rendus identiques a l'octet pres. */
    window.Studio.setSupport(false);
    window.Studio.setVoile('aucun');
    function papier(place) {
      window.Studio.setPlacement(place);
      var cv = document.createElement('canvas');
      window.Studio.render(cv, 'encre', window.App.etat.base, {}, [420, 525]);
      return cv.toDataURL('image/png');
    }
    ok('placement · sur papier, il n’a aucun effet',
       papier({ x: 0, y: 0, echelle: 1 }) === papier({ x: -0.25, y: -0.2, echelle: 0.6 }),
       'le deplacer emporterait le fond et laisserait une bande vide au bord');

    /* On rend l'etat au reste du parcours. */
    window.Studio.setPlacement({ x: 0, y: 0, echelle: 1 });
    window.Studio.setSupport(supportAvant === 'surcouche');
  }());

  // ---------- 6 sexies. LE CATALOGUE MONTRE LA SORTIE CHARGEE ----------
  /* LE DEFAUT REEL : des qu'on importait sa sortie, les trente-six vignettes
   * se vidaient — tirets a la place des chiffres, aucun parcours. La cause
   * etait un ORDRE : `syncBibliotheque()` reconstruisait le catalogue AVANT
   * de poser `E.base` et `E.chargee`, donc les vignettes se rendaient sur une
   * activite vide, au moment precis ou l'on venait de donner son fichier.
   *
   * Trois relecteurs l'ont trouve. Aucun controle ne le voyait : ils
   * verifiaient que le catalogue se reconstruit, jamais AVEC QUOI. */
  (function () {
    var cartes = document.querySelectorAll('#choix-style canvas');
    if (!cartes.length) {
      resultats.push({ cas: 'catalogue · vignettes apres import', verdict: 'sauté',
                       detail: 'catalogue absent a cette largeur' });
      return;
    }
    /* On compare la vignette a ce que la MEME planche donne sur une activite
     * VIDE. Si les deux se ressemblent, c'est que la vignette ne voit pas la
     * sortie — quel que soit le nombre de pixels qu'elle affiche. */
    var id = $('#tpl') ? $('#tpl').value : 'encre';
    var cv = document.createElement('canvas');
    window.Studio.render(cv, id, Activity.build({}), {}, [300, 400]);
    var vide = cv.toDataURL().length;
    var cv2 = document.createElement('canvas');
    window.Studio.render(cv2, id, window.App.etat.base, {}, [300, 400]);
    var pleine = cv2.toDataURL().length;
    ok('catalogue · la vignette se rend sur la sortie chargee, pas sur du vide  (' +
       pleine + ' contre ' + vide + ')',
       window.App.etat.chargee && pleine > vide * 1.15,
       'une vignette aussi pauvre qu’une activite vide n’a pas vu la sortie');

    /* ET L'ORDRE, nommement : l'etat doit etre pose avant la reconstruction. */
    ok('catalogue · l’etat est pose avant que les vignettes se refassent',
       !!(window.App.etat.base && (window.App.etat.base.track || []).length > 50),
       'E.base doit porter la trace au moment ou le catalogue se reconstruit');
  }());

  // ---------- 6 septies. L'EXPORT NE LIVRE PAS LE VIDE ----------
  /* Une planche multi-sorties dont le filtre de periode ne retient AUCUNE
   * sortie dessine une page blanche. Le bouton l'exportait quand meme : un
   * PNG de 1080x1920 sans rien dedans, sans un mot — alors que le filtre
   * annonce « 0 / 3 » juste au-dessus. */
  (function () {
    if (!$('#periode') || !$('#tpl')) {
      resultats.push({ cas: 'export · refus du vide', verdict: 'sauté', detail: 'reglages absents' });
      return;
    }
    var tplAvant = $('#tpl').value, perAvant = $('#periode').value;
    var sorti = null;
    var vraiPNG = window.Studio.exportPNG;
    window.Studio.exportPNG = function (cv, nom) { sorti = nom; };
    $('#tpl').value = 'serie';
    $('#tpl').dispatchEvent(new Event('change'));
    $('#periode').value = 'annee:1';          // une annee sans aucune sortie
    $('#periode').dispatchEvent(new Event('change'));
    var retenues = window.App.entreesRetenues ? window.App.entreesRetenues().length : -1;
    $('#export').click();
    var message = $('#video-state') ? $('#video-state').textContent : '';
    window.Studio.exportPNG = vraiPNG;
    ok('export · aucune sortie retenue ⇒ aucun fichier, et on dit pourquoi  (' +
       retenues + ' retenue(s))',
       retenues === 0 && sorti === null && /aucune sortie|no ride/i.test(message),
       'fichier=' + sorti + ' · message « ' + String(message).slice(0, 70) + ' »');
    /* on rend l'etat au reste du parcours */
    $('#periode').value = perAvant; $('#periode').dispatchEvent(new Event('change'));
    $('#tpl').value = tplAvant; $('#tpl').dispatchEvent(new Event('change'));
  }());

  // ---------- 7. le bandeau ----------
  var bandeau = $('#nouveautes');
  if (bandeau && !bandeau.hidden) {
    $('#nouveautes-fermer').click();
    await attends(200);
    ok('bandeau · la croix ferme vraiment',
       getComputedStyle(bandeau).display === 'none');
  } else {
    resultats.push({ cas: 'bandeau · fermeture', verdict: 'sauté',
                     detail: 'rien de neuf depuis la dernière visite' });
  }

  var echecs = resultats.filter(function (r) { return r.verdict === 'ÉCHEC'; });
  console.table(resultats);
  console.log(resultats.length - echecs.length + ' / ' +
              resultats.filter(function (r) { return r.verdict !== 'sauté'; }).length +
              ' cas passés · ' + echecs.length + ' échec(s)');
  console.log('NON COUVERT ICI : aperçu animé, séquence PNG. L’export vidéo, lui, est éprouvé — il était cassé et personne ne le voyait.');
  window.__acceptation = resultats;
  return resultats;
}()).catch(function (e) {
  /* ---------- LE FILET ----------
   *
   * LE DÉFAUT RÉEL : cette suite était une fonction asynchrone sans `catch`.
   * Une seule exception, où que ce soit, et `window.__acceptation` n'était
   * jamais posé — le lanceur attendait cinq minutes, puis annonçait
   * « l'acceptation n'a pas rendu de résultats ». Aucun nom, aucune trace,
   * aucune des soixante mesures déjà faites. Un incident intermittent
   * devenait un silence de cinq minutes, indiscernable d'une lenteur.
   *
   * Le filet ne rattrape RIEN : il ne rend pas la suite plus verte, il la rend
   * lisible. L'interruption devient un cas en échec qui porte son message et
   * le nom du dernier cas atteint, et tout ce qui précède est conservé. */
  var partiel = window.__acceptationPartiel || [];
  partiel.push({
    cas: 'la suite s’est interrompue après « ' +
         (window.__acceptationDernier || 'aucun cas') + ' »',
    verdict: 'ÉCHEC',
    detail: ((e && e.message) || String(e)) +
            ((e && e.stack) ? ' — ' + String(e.stack).split('\n')[1] : '')
  });
  console.error('acceptation interrompue :', e);
  window.__acceptation = partiel;
  return partiel;
});
