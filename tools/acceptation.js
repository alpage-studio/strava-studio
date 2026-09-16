/* acceptation.js — le parcours réel, dans un vrai navigateur.
 *
 *   1. lancer le serveur :   node tools/dev-server.js 8783 --debug
 *   2. ouvrir               http://localhost:8783/
 *   3. coller CE FICHIER dans la console, et lire le tableau.
 *
 * POURQUOI CE N'EST PAS DANS tools/test.js
 *   Le harnais de test tourne dans Node : il lit des fichiers, charge des
 *   modules, éprouve des calculs. Il ne peut pas répondre à « est-ce que le
 *   panneau se ferme », « est-ce que la vignette dessine quelque chose »,
 *   « est-ce que l'export garde l'alpha » — ces questions demandent un
 *   canvas, une mise en page et des événements.
 *
 *   Ce fichier ne part PAS avec le site : il n'est chargé par aucune page,
 *   il vit dans tools/ que le serveur refuse de servir. On le colle.
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

  // ---------- 1. l'accueil ----------
  ok('accueil · une planche est montrée avant tout réglage',
     $('#accueil-planche') && encre($('#accueil-planche')) > 200);
  ok('accueil · aucune sortie n’est inventée dans la bibliothèque',
     Library.count() === 0 && document.body.classList.contains('vide'));

  // ---------- 2. charger ----------
  $('#load-formes').click();
  await attends(2600);
  ok('chargement · quatre parcours de démonstration', Library.count() === 4,
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
    ok('téléphone · Teintes porte le rendu et le support',
       !!document.querySelector('#feuille .zone[data-zone="teintes"] #opt-teintes') &&
       !!document.querySelector('#feuille .zone[data-zone="teintes"] #opt-support'));
    $('#feuille-voile').click();
    await attends(250);
    ok('téléphone · le voile ferme aussi', $('#feuille').hidden);
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
  console.log('NON COUVERT ICI : aperçu animé, export vidéo, séquence PNG.');
  window.__acceptation = resultats;
  return resultats;
}());
