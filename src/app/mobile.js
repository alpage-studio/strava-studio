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
  var ZONES = {
    /* La sortie vit dans le panneau Style : sans elle, sur un téléphone où la
     * colonne est masquée, il n'y aurait AUCUN moyen d'importer un GPX ni de
     * choisir une activité — l'application serait jolie et inutilisable. */
    style:   ['#section-activite', '#choix-style', '#opt-collection', '#collection-note',
              '#opt-minimal', '#opts', '#section-garder'],
    teintes: ['#opt-teintes', '#opt-photo-nb', '#opt-support', '#opt-voile', '#section-fond', '#opts-couleur'],
    texte:   ['#opts-texte'],
    /* « Garder » rejoint le panneau Style : c'est ce qu'on fait d'une sortie
     * une fois qu'on en a une. Sans cela ces blocs restaient dans la colonne
     * masquée du téléphone — perdus deux fois. */
    /* Format porte aussi les SORTIES : aperçu animé, vidéo, séquence, son.
     * Elles vivaient dans le socle de la colonne — masqué sous 900 px — et
     * devenaient donc introuvables sur téléphone. Un contrôle resté dans un
     * conteneur qu'on cache ne disparaît pas de l'écran : il disparaît de
     * l'application. */
    format:  ['#rangee-format', '#preview-play', '#son', '#export-video',
              '#export-seq', '#video-state']
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
    var titres = { style: 'Style', teintes: 'Teintes', texte: 'Texte', format: 'Format' };
    $('#feuille-titre').textContent = T(titres[z] || '');
    f.classList.toggle('large', z === 'style');
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
  $('#barre-enregistrer').addEventListener('click', function () {
    fermeFeuille();
    $('#export').click();
  });
  /* La bascule se declare ICI, avec le code qu'elle declenche. Elle etait
   * restee dans app.js apres la coupe — un ecouteur separe de ce qu'il
   * appelle, c'est exactement ce que le decoupage doit supprimer. */
  TELEPHONE.addEventListener('change', majDisposition);

  A.majDisposition = majDisposition;
}(window.App));
