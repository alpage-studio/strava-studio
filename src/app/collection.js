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
        bain: $('#bain') ? $('#bain').value : null,
        halo: $('#halo') ? $('#halo').checked : false,
        duree: $('#duree') ? $('#duree').value : null,
        /* LE PLACEMENT FAIT PARTIE DE LA PLANCHE, pas de la session.
         * Sans ces deux lignes, un projet rouvert reprenait le cadrage et
         * l'echelle de la session en cours : on retrouvait sa composition
         * a un endroit qu'on n'avait pas choisi. */
        placement: E.placement,
        echelle: $('#echelle') ? $('#echelle').value : null,
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
  function appliqueProjet(p, texte) {
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
    /* UN PROJET D'ATLAS ROUVERT DANS TRACE NE SE PERD PLUS EN SILENCE.
     *
     * Les deux outils partagent le moteur mais pas leur liste de planches.
     * Un projet enregistré sur Almanac, rouvert dans Trace, désignait donc
     * une planche absente du menu : `select.value` devenait '' et tout
     * retombait sur la première. On ouvrait son projet et on obtenait autre
     * chose, sans un mot.
     *
     * On ne bascule pas d'autorité : rouvrir un projet ne doit pas changer
     * d'outil sous les pieds. On le DIT, et on donne le lien — et le lien
     * EMPORTE LE PROJET : il le pose dans la session de l'onglet, et l'autre
     * outil le rouvre en arrivant (voir « un projet qui arrive » plus bas).
     * Sans ça, il fallait rouvrir le fichier une seconde fois à la main. */
    var dansLOutil = !A.dansLOutil || A.dansLOutil(p.reglages.tpl);
    if (p.reglages.tpl && Studio.get(p.reglages.tpl).id === p.reglages.tpl && dansLOutil) {
      $('#tpl').value = p.reglages.tpl;
    } else if (p.reglages.tpl && Studio.get(p.reglages.tpl).id === p.reglages.tpl) {
      var ailleurs = A.outil === 'atlas' ? 'index.html' : 'atlas.html';
      /* atlas.html redirige sans garder la requête : on vise directement la
       * page que la redirection ouvrirait. */
      if (texte && poseTransfert(texte)) {
        ailleurs = A.outil === 'atlas' ? 'index.html?projet=transfert' : 'index.html?outil=atlas&projet=transfert';
      }
      var nomOutil = A.outil === 'atlas' ? 'Trace' : 'Atlas';
      var note = $('#projet-state');
      if (note) {
        note.textContent = '';
        note.appendChild(document.createTextNode(
          I18N.T('Ce projet utilise') + ' « ' + Studio.get(p.reglages.tpl).name.split(' — ')[0] +
          ' », ' + I18N.T('qui vit dans') + ' '));
        var a = document.createElement('a');
        a.href = ailleurs;
        a.textContent = nomOutil;
        a.setAttribute('data-brut', '');
        note.appendChild(a);
        note.appendChild(document.createTextNode('. ' + I18N.T('Tes sorties sont chargées.')));
        /* ET ON OUVRE LE REPLI QUI LE CONTIENT.
         *
         * `#projet-state` vit sous « Garder », un <details> fermé. Le
         * message disait donc pourquoi la planche n'a pas changé, et le
         * lien emportait le projet — dans un panneau que personne
         * n'ouvre. Charger l'année dans Trace donnait 106 sorties, une
         * planche inchangée, et aucune explication visible.
         *
         * On n'ouvre QUE pour le lien : un simple compte de sorties ne
         * justifie pas de déplier un panneau sous les doigts. */
        var repli = note.closest ? note.closest('details') : null;
        if (repli) repli.open = true;
      }
    }
    if (p.reglages.size && SIZES[p.reglages.size]) $('#size').value = p.reglages.size;
    if (p.reglages.collection) $('#collection').value = p.reglages.collection;
    if (p.reglages.minimal != null) $('#minimal').checked = !!p.reglages.minimal;
    if (p.reglages.rendu) $('#rendu').value = p.reglages.rendu;
    if (p.reglages.support) $('#support').value = p.reglages.support;
    if (p.reglages.bain && $('#bain')) $('#bain').value = p.reglages.bain;
    if ($('#halo')) $('#halo').checked = !!p.reglages.halo;
    if (p.reglages.voile) $('#voile').value = p.reglages.voile;
    if (p.reglages.duree && $('#duree')) $('#duree').value = p.reglages.duree;
    if (p.reglages.placement) {
      E.placement.x = Number(p.reglages.placement.x) || 0;
      E.placement.y = Number(p.reglages.placement.y) || 0;
    }
    if (p.reglages.echelle && $('#echelle')) $('#echelle').value = p.reglages.echelle;
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
    /* ET ON RETIENT. `apresChangement()` redessine mais n'enregistre pas :
     * un rechargement juste apres avoir rouvert un projet restituait donc
     * la planche d'AVANT, avec le sentiment d'avoir perdu son travail. */
    if (A.save) A.save();
  }

  /* ---------- un projet qui passe d'un outil à l'autre ----------
   * sessionStorage et pas localStorage : le projet ne vit que le temps de
   * l'onglet, et il est effacé dès qu'il est relu — il ne doit pas revenir
   * à chaque ouverture d'Atlas. Un projet trop gros pour la session (rare :
   * une année en fait 90 Ko) laisse simplement le lien nu. */
  var CLE_TRANSFERT = 'alpage-projet-transfert';
  function poseTransfert(texte) {
    try { sessionStorage.setItem(CLE_TRANSFERT, texte); return true; }
    catch (e) { return false; }
  }
  A.auDemarrage(function () {
    if (!/(^|[?&])projet=transfert(&|$)/.test(location.search)) return;
    var texte = null;
    try { texte = sessionStorage.getItem(CLE_TRANSFERT); sessionStorage.removeItem(CLE_TRANSFERT); } catch (e) { /* rien */ }
    /* l'adresse redevient celle de l'outil : un rechargement ne doit pas
     * chercher un projet qui a déjà été relu */
    try {
      history.replaceState(null, '', location.pathname + (A.outil === 'atlas' ? '?outil=atlas' : '') + location.hash);
    } catch (e) { /* tant pis : la clé est déjà effacée */ }
    if (!texte) return;
    var note = $('#projet-state');
    try {
      appliqueProjet(Projet.lire(texte));
      // même garde que sur #projet-open : un message qui porte un lien prime sur le compte
      if (note && !note.querySelector('a')) note.textContent = sortiesRouvertes();
    } catch (err) {
      if (note) note.textContent = err.message;
    }
  });
  function sortiesRouvertes() {
    var n = Library.count();
    // le singulier : 0 et 1 en français, 1 seul en anglais
    var un = I18N.langue() === 'fr' ? n < 2 : n === 1;
    return I18N.T(un ? '{n} sortie rouverte.' : '{n} sorties rouvertes.').replace('{n}', n);
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
        /* `txt` et pas seulement l'objet lu : sans lui le lien vers Atlas
         * s'affiche mais n'emporte rien, et le clic ouvre Atlas vide.
         * C'est le chemin le PLUS emprunté — « Charger l'année » est un
         * bouton, rouvrir un projet demande un fichier sous la main. */
        appliqueProjet(Projet.lire(txt), txt);
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
        appliqueProjet(Projet.lire(reader.result), reader.result);
        /* le message du lien vers l'autre outil prime : il dit pourquoi la
         * planche n'a pas changé */
        if (!note.querySelector('a')) note.textContent = sortiesRouvertes();
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
