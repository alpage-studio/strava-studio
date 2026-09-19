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
       dansExport('#rangee-format') && dansExport('#export-video') &&
       !dansExport('#section-fond'),
       'format ' + dansExport('#rangee-format') + ' · video ' + dansExport('#export-video') +
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
  } else if (!$('#export-video')) {
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
    $('#export-video').click();
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
}());
