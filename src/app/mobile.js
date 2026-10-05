/* mobile.js — la barre du telephone et ses panneaux
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;
  var save = A.save;
  var draw = A.draw;
  var TELEPHONE = A.TELEPHONE;

  var changement = A.changement;

  /* ---------- LA BARRE DU TÉLÉPHONE ----------
   *
   * Sous 900 px, la colonne de réglages cède la place à quatre panneaux qui
   * remontent du bas. Une seule décision occupe l'écran à la fois, et
   * l'aperçu reste visible pendant qu'on règle.
   *
   * Les contrôles ne sont pas DUPLIQUÉS : ils sont DÉPLACÉS. `appendChild`
   * sur un nœud existant le déplace avec ses écouteurs et ses références ;
   * les identifiants ne changent pas, donc tout le reste d'app.js continue
   * de les trouver. Dupliquer aurait demandé de tenir deux interfaces en
   * accord — et elles auraient divergé au premier réglage ajouté.
   *
   * Au-dessus de 900 px, tout revient dans la colonne. */
  /* QUATRE PANNEAUX, UNE QUESTION CHACUN — et les mêmes que les titres de la
   * colonne sur grand écran. Avant : « Style » portait l'import du GPX, la
   * photo, le support, le catalogue et ses réglages ; « Teintes » vivait à
   * part alors que ce sont des réglages de la planche comme les autres ; et
   * l'export n'avait aucun titre dans la colonne.
   *
   * Les contrôles ne sont pas DUPLIQUÉS mais DÉPLACÉS — voir plus haut. Une
   * section entière se déplace avec son sous-titre, ce qui évite de lister
   * ses enfants un par un et de les oublier quand elle en gagne un. */
  /* TROIS GROUPES, TROIS QUESTIONS : d'où vient la trace, à quoi ressemble
   * l'image, ce qu'on produit. Et les mêmes mots que les titres de la colonne
   * sur grand écran — un contrôle compare les deux listes.
   *
   * « Texte » avait son onglet alors que c'est un réglage de la planche comme
   * un autre : il obligeait à l'aller-retour entre deux panneaux pour écrire
   * un titre sur l'image qu'on est en train de régler.
   *
   * Les contrôles ne sont pas DUPLIQUÉS mais DÉPLACÉS — voir plus haut. Une
   * section entière se déplace avec son sous-titre, ce qui évite de lister
   * ses enfants un par un et de les oublier quand elle en gagne un. */
  var ZONES = {
    import:  ['#section-activite'],
    planche: ['#section-fond', '#section-support',
              '#choix-style', '#opt-minimal', '#opts',
              '#opt-collection', '#collection-note', '#opt-teintes',
              '#opt-photo-nb', '#opts-couleur', '#opts-texte'],
    /* « Garder » est ici : enregistrer un projet est une sortie, et c'est le
     * seul panneau qui parle de ce qu'on emporte. */
    export:  ['#opt-langue-images', '#rangee-format', '#opt-placement',
              '#opt-sortie', '#opt-duree', '#export', '#preview-play',
              '#son', '#video-state', '#section-garder']
  };
  var placeOrigine = {};        // sélecteur -> { parent, suivant } avant déplacement
  var feuilleOuverte = null;

  function memorisePlace(sel) {
    if (placeOrigine[sel]) return;
    var el = document.querySelector(sel);
    if (!el) return;
    placeOrigine[sel] = { parent: el.parentNode, suivant: el.nextSibling };
  }

  function versPanneaux() {
    Object.keys(ZONES).forEach(function (z) {
      var zone = document.querySelector('#feuille .zone[data-zone="' + z + '"]');
      if (!zone) return;
      ZONES[z].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        memorisePlace(sel);
        zone.appendChild(el);
      });
    });
  }

  function versColonne() {
    Object.keys(ZONES).forEach(function (z) {
      ZONES[z].forEach(function (sel) {
        var el = document.querySelector(sel);
        var p = placeOrigine[sel];
        if (!el || !p || !p.parent) return;
        /* `insertBefore` lève si le voisin mémorisé n'est plus un enfant de ce
         * parent. Ça n'arrive pas aujourd'hui — ces nœuds sont fixes dans la
         * page — mais un échec ici casserait le retour à la colonne au moment
         * d'une rotation, et laisserait l'interface sans ses réglages. On
         * retombe donc sur la fin du parent : l'ordre change, rien ne
         * disparaît. */
        try {
          p.parent.insertBefore(el, p.suivant && p.suivant.parentNode === p.parent
            ? p.suivant : null);
        } catch (e) {
          p.parent.appendChild(el);
        }
      });
    });
  }

  function ouvreFeuille(z) {
    var f = $('#feuille');
    feuilleOuverte = z;
    Array.prototype.forEach.call(document.querySelectorAll('#feuille .zone'), function (el) {
      el.hidden = el.getAttribute('data-zone') !== z;
    });
    /* « Export » et non « Format » : l'onglet et son panneau portent le
     * même mot, sinon on ouvre Export et on arrive dans Format. */
    var titres = { 'import': 'Import', planche: 'Planche', 'export': 'Export' };
    $('#feuille-titre').textContent = T(titres[z] || '');
    /* Planche est le panneau où l'on REGARDE (le catalogue) au lieu de
     * régler : il a droit à presque tout l'écran. */
    f.classList.toggle('large', z === 'planche');
    f.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('#barre button[data-feuille]'),
      function (b) { b.classList.toggle('on', b.getAttribute('data-feuille') === z); });
  }

  function fermeFeuille() {
    feuilleOuverte = null;
    $('#feuille').hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('#barre button[data-feuille]'),
      function (b) { b.classList.remove('on'); });
  }

  function majDisposition() {
    var petit = TELEPHONE.matches;
    $('#barre').hidden = !petit;
    if (petit) versPanneaux();
    else { fermeFeuille(); versColonne(); }
    document.body.classList.toggle('telephone', petit);
  }

  Array.prototype.forEach.call(document.querySelectorAll('#barre button[data-feuille]'),
    function (b) {
      b.addEventListener('click', function () {
        var z = b.getAttribute('data-feuille');
        if (feuilleOuverte === z) fermeFeuille(); else ouvreFeuille(z);
      });
    });
  $('#feuille-fermer').addEventListener('click', fermeFeuille);
  $('#feuille-voile').addEventListener('click', fermeFeuille);
  /* Le pont « bouton de la barre -> #export » a disparu avec le bouton :
   * `#export` est maintenant DANS la feuille, et se presse directement. */
  /* La bascule se declare ICI, avec le code qu'elle declenche. Elle etait
   * restee dans app.js apres la coupe — un ecouteur separe de ce qu'il
   * appelle, c'est exactement ce que le decoupage doit supprimer. */
  TELEPHONE.addEventListener('change', majDisposition);

  A.majDisposition = majDisposition;
}(window.App));
