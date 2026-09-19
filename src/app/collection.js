/* collection.js — l'historique d'exploration et les projets
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;
  /* Même oubli qu'`exports.js` : `SIZES` n'est pas global. Ici il ne tombait
   * qu'en rouvrant un projet enregistré — le format sauvegardé ne pouvait
   * pas être restauré, et la lecture du projet s'arrêtait là. */
  var SIZES = A.SIZES;
  var effective = A.effective;
  var bouton = A.bouton;
  var apresChangement = A.apresChangement;
  var draw = A.draw;
  var nomFichier = A.nomFichier;
  var slug = A.slug;
  var escapeHtml = A.escapeHtml;

  /* ---------- historique d'exploration ----------
   * Stockage LOCAL et explicite : rien n'y entre sans un clic, et « effacer »
   * efface pour de bon. L'empreinte est recalculée puis poussée au moteur —
   * IndexedDB est asynchrone et un draw() ne peut pas l'attendre. */
  function majHistorique(message) {
    if (!window.Historique) return Promise.resolve();
    return Historique.lister().then(function (list) {
      var emp = Historique.empreinte(list);
      E.empreinteCourante = emp.sorties ? emp : null;
      Studio.setHistorique(E.empreinteCourante);
      $('#hist-state').textContent = message || (emp.sorties
        ? emp.sorties + ' ' + T('sorties de référence') + ' · ' + Math.round(emp.km) + ' km · ' +
          emp.cases.toLocaleString('fr-CH') + ' cases'
        : 'Aucun historique — la première importation fera la référence.');
      draw();
    }).catch(function (e) {
      $('#hist-state').textContent = e.message;
    });
  }

  $('#hist-add').addEventListener('click', function () {
    if (!Library.count()) { $('#hist-state').textContent = 'Rien à ajouter.'; return; }
    $('#hist-state').textContent = 'Enregistrement…';
    Historique.ajouter(Library.list().map(function (e) { return e.activity; }))
      .then(function (n) { return majHistorique(n + ' sorties enregistrées dans l’historique.'); })
      .then(function () { setTimeout(function () { majHistorique(); }, 1800); })
      .catch(function (e) { $('#hist-state').textContent = e.message; });
  });

  $('#hist-clear').addEventListener('click', function () {
    /* Une confirmation, parce que c'est irréversible et que le bouton est
     * juste à côté de celui qui ajoute. */
    if (!window.confirm('Effacer tout l’historique d’exploration de ce navigateur ?')) return;
    Historique.vider()
      .then(function () { return majHistorique(T('Historique effacé.')); })
      .then(function () { setTimeout(function () { majHistorique(); }, 1800); })
      .catch(function (e) { $('#hist-state').textContent = e.message; });
  });

  /* ---------- projet : enregistrer, rouvrir ----------
   * Un fichier local, rien d'autre. Rouvrir REMPLACE la bibliothèque : la
   * fusionner donnerait des doublons invisibles au bout de deux essais, et
   * « pourquoi ma fresque a douze contributions » est une question qu'on ne
   * veut jamais avoir à se poser. */
  $('#projet-save').addEventListener('click', function () {
    var note = $('#projet-state');
    if (!Library.count()) { note.textContent = 'Rien à enregistrer.'; return; }
    try {
      Projet.exporter(Library.list(), {
        tpl: $('#tpl').value, size: $('#size').value,
        collection: $('#collection').value, minimal: $('#minimal').checked,
        rendu: $('#rendu').value, photoNb: $('#photo-nb').checked,
        support: $('#support').value, voile: $('#voile').value,
        duree: $('#duree') ? $('#duree').value : null,
        periode: $('#periode').value,
        opts: E.optionValues
      }, 'projet-' + slug() + '.json');
      note.textContent = Library.count() + ' sorties enregistrées.';
    } catch (e) {
      note.textContent = e.message;
    }
  });

  /* Rouvrir REMPLACE la bibliothèque. Partagé entre le fichier choisi par
   * l'utilisateur et l'année de démonstration : deux chemins qui divergent
   * finissent par restaurer deux états différents du même fichier. */
  function appliqueProjet(p) {
    Library.clear();
    p.sorties.forEach(function (so) {
      var entree = Library.add(so.activity);
      if (entree && so.couleur) Library.setColor(entree.id, so.couleur);
    });
    if (p.reglages.opts) E.optionValues = p.reglages.opts;
    /* `Studio.get` ne rend JAMAIS null — il retombe sur le premier template
     * du registre. La garde était donc toujours vraie, et un projet portant
     * un identifiant inconnu posait une valeur que le menu ne connaît pas :
     * `select.value` devient '', et tout le reste retombe silencieusement
     * sur Encre. On compare l'identifiant rendu à celui demandé, comme le
     * fait déjà la restauration depuis le stockage local. */
    if (p.reglages.tpl && Studio.get(p.reglages.tpl).id === p.reglages.tpl) {
      $('#tpl').value = p.reglages.tpl;
    }
    if (p.reglages.size && SIZES[p.reglages.size]) $('#size').value = p.reglages.size;
    if (p.reglages.collection) $('#collection').value = p.reglages.collection;
    if (p.reglages.minimal != null) $('#minimal').checked = !!p.reglages.minimal;
    if (p.reglages.rendu) $('#rendu').value = p.reglages.rendu;
    if (p.reglages.support) $('#support').value = p.reglages.support;
    if (p.reglages.voile) $('#voile').value = p.reglages.voile;
    if (p.reglages.duree && $('#duree')) $('#duree').value = p.reglages.duree;
    /* La période décide QUELLES sorties composent la planche : sans elle, un
     * projet multi-sorties se rouvrait sur une autre sélection que celle
     * qu'on avait enregistrée. C'est le réglage qui change le plus ce qu'on
     * voit, et c'était le seul à manquer à l'appel. */
    if (p.reglages.periode) $('#periode').value = p.reglages.periode;
    /* Le catalogue repart des familles : rester sur les variantes d'une
     * famille qui n'est plus la bonne n'a aucun sens. */
    E.familleOuverte = null;
    if (p.reglages.photoNb != null) $('#photo-nb').checked = !!p.reglages.photoNb;
    $('#opt-photo-nb').hidden = $('#rendu').value !== 'nb';
    E.overrides = {};
    E.chargee = Library.count() > 0;
    apresChangement();
  }

  /* Une année entière, pour Almanac : 106 sorties avec leurs creux, leurs
   * semaines chargées et deux journées hors norme. En GPX il aurait fallu
   * cent fichiers ; le format projet en fait un seul de 90 ko. */
  $('#load-year').addEventListener('click', function () {
    var b = $('#load-year'), avant = b.textContent;
    b.disabled = true; b.textContent = 'Chargement…';
    fetch('exemple-annee.json')
      .then(function (r) { if (!r.ok) throw new Error('indisponible'); return r.text(); })
      .then(function (txt) {
        appliqueProjet(Projet.lire(txt));
        b.textContent = avant;
      })
      .catch(function () { b.textContent = 'Année indisponible'; })
      .then(function () { b.disabled = false; });
  });

  $('#projet-open').addEventListener('change', function (e) {
    var file = e.target.files[0];
    var note = $('#projet-state');
    if (!file) return;
    nomFichier('#projet-open', 'Rouvrir un projet', file.name);
    var reader = new FileReader();
    reader.onload = function () {
      try {
        appliqueProjet(Projet.lire(reader.result));
        note.textContent = Library.count() + ' sorties rouvertes.';
      } catch (err) {
        note.textContent = err.message;
      }
      // sans ça, rouvrir DEUX FOIS le même fichier ne déclenche rien
      e.target.value = '';
    };
    reader.onerror = function () { note.textContent = T('Lecture impossible.'); };
    reader.readAsText(file);
  });

  A.majHistorique = majHistorique;
}(window.App));
