/* noyau.js — le contexte que se partagent les morceaux de l'interface.
 *
 * POURQUOI CE FICHIER EXISTE
 *   `src/app.js` a longtemps porté huit sujets dans une seule fermeture de
 *   deux mille lignes. Le découper ne consistait pas à déplacer des lignes :
 *   il fallait d'abord décider CE QUE CHAQUE MORCEAU REÇOIT. Sans cette
 *   décision, chaque fichier extrait aurait redéclaré ses propres variables
 *   d'état et l'interface aurait montré deux vérités différentes selon le
 *   morceau qui répond.
 *
 *   La frontière n'a pas été devinée. On a mesuré, pour chaque section du
 *   fichier, combien de noms elle empruntait au reste : quatorze noms
 *   revenaient partout — `draw`, `save`, `effective`, `chargee`, `canvas`,
 *   `optionValues`… — et le reste était local à sa section. Ces quatorze-là
 *   sont le contexte ; ils vivent ici.
 *
 * L'ÉTAT EST UN OBJET, PAS DES VARIABLES
 *   `App.etat.chargee` et non `chargee`. Ce n'est pas une préférence de style :
 *   un `var` de fermeture ne se partage pas entre fichiers, et une variable
 *   oubliée au moment du découpage aurait continué de fonctionner DANS son
 *   fichier tout en divergeant de celle des autres — un défaut silencieux.
 *   Avec un objet, un oubli lève une ReferenceError au premier chargement :
 *   le découpage échoue bruyamment, ce qui est la seule façon utile d'échouer.
 *
 * L'ORDRE DE CHARGEMENT
 *   noyau.js, puis app.js (le cœur : rendu, options, période, événements),
 *   puis les modules, puis demarrage.js EN DERNIER. Les modules n'agissent pas
 *   au chargement : ils déposent leur mise en route dans `App.auDemarrage()`,
 *   et c'est demarrage.js qui les exécute une fois tout le monde présent. Sans
 *   cette file, un module chargé après le démarrage aurait posé ses écouteurs
 *   trop tard, et l'ordre des balises <script> serait devenu une dépendance
 *   invisible.
 */
(function (global) {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };

  var SIZES = {
    story: [1080, 1920],
    post: [1080, 1350],
    carre: [1080, 1080],
    paysage: [1920, 1080],
    /* Formats d'impression, en 300 points par pouce. Le tissage et la fresque
     * sont faits pour être tirés sur papier, et une story de 1080 pixels de
     * large donne une bouillie en A3. L'A3 fait 17 mégapixels : c'est lourd
     * mais tenable pour un PNG. L'export vidéo, lui, reste absurde à cette
     * taille — le verrou d'export s'en charge en pratique, l'utilisateur
     * repasse en story pour animer. */
    a4: [2480, 3508],
    a3: [3508, 4961]
  };

  /* L'état partagé. Chaque champ porte ce qu'il est, pas ce qu'il vaut. */
  var etat = {
    base: Activity.empty(),   // activité telle que lue dans le GPX
    overrides: {},            // corrections manuelles
    optionValues: {},         // { templateId: { key: valeur } }
    current: null,
    photoURL: null,           // pour le fond de contrôle, hors canvas
    photoFile: null,          // le fichier lui-même, pour le musée
    empreinteCourante: null,  // l'historique d'exploration aplati
    photoImg: null,           // la même, pour composer la vidéo
    bgVideo: null,            // vidéo de fond, pour graver la surcouche dessus
    chargee: false,           // une vraie sortie a-t-elle été fournie ?
    exportEnCours: false,     // un export occupe le canvas

    /* CES DEUX-LÀ SONT ICI PARCE QU'ELLES CHANGENT.
     * Un module qui recopierait `var enLecture = A.enLecture` en garderait
     * la valeur du chargement — false pour toujours — et l'aperçu animé
     * croirait ne jamais tourner. Une valeur qui change se partage par
     * l'objet, jamais par copie. */
    enLecture: false,         // l'aperçu animé tourne
    familleOuverte: null,     // catalogue : null = on regarde les familles
    /* L'exemple embarque, parse une fois au demarrage. Il sert de modele
     * aux vignettes du catalogue tant qu'aucune sortie n'est chargee ; il
     * n'entre jamais dans la bibliotheque. */
    exemple: null,
    /* Ou la planche se pose sur la photo, en fractions du cadre. Le moteur
     * en est la reference ; ceci n'est que ce que le geste construit entre
     * deux rendus. Voir Studio.setPlacement. */
    placement: { x: 0, y: 0 }
  };

  var file = [];

  /* QUEL OUTIL SERT CETTE PAGE ?
   *
   * Le même moteur sert deux portes : Trace (une sortie → une œuvre) et
   * l'Atlas (une période → une lecture). Ce n'est pas une copie du studio :
   * `atlas.html` charge exactement les mêmes fichiers et pose ce drapeau
   * AVANT eux. Dupliquer le moteur aurait créé deux vérités à tenir à jour.
   *
   * Le défaut est Trace : `index.html` ne pose rien, et la racine du site
   * reste ce qu'elle a toujours été pour qui l'a installée ou mise en favori. */
  var outil = (function () {
    if (global.ALPAGE_OUTIL === 'atlas') return 'atlas';
    /* `atlas.html` ne recopie pas le studio — elle en porte l'ADRESSE et
     * redirige ici en passant le mode dans la requête. Voir le commentaire
     * de cette page : recopier 1384 lignes de markup aurait créé deux
     * interfaces à tenir à jour, et rien pour dire quand elles divergent. */
    try {
      if (/(^|[?&])outil=atlas(&|$)/.test(global.location.search)) return 'atlas';
    } catch (e) { /* pas de location : on reste sur le défaut */ }
    return 'trace';
  }());

  /* L'OUTIL SE VOIT. Posé sur <html>, AVANT que la page s'affiche : une
   * couleur d'accent qui changerait après coup se verrait changer. */
  try { global.document.documentElement.setAttribute('data-outil', outil); }
  catch (e) { /* pas de document : rien à teinter */ }

  global.App = {
    $: $,
    SIZES: SIZES,
    etat: etat,
    outil: outil,
    canvas: $('#canvas'),

    /* Déposer une mise en route. Elle s'exécutera quand tous les fichiers
     * seront chargés, dans l'ordre où elle a été déposée. */
    auDemarrage: function (fn) { file.push(fn); },

    /* CETTE PLANCHE A-T-ELLE SA PLACE DANS CET OUTIL ?
     *
     * Atlas  : tout ce qui PEUT demander plusieurs sorties, même si son
     *          réglage par défaut n'en demande qu'une.
     * Trace  : tout ce qui se contente d'une sortie À SON DÉFAUT.
     *
     * Empreinte est dans les deux, et c'est voulu : Sceau pour une sortie,
     * Collection pour plusieurs. Aucune planche n'est absente des deux —
     * une garde du harnais le vérifie, parce qu'une planche qui disparaîtrait
     * des deux portes ne lèverait aucune erreur. */
    dansLOutil: function (tpl) {
      if (typeof tpl === 'string') tpl = global.Studio.get(tpl);
      if (!tpl) return false;
      if (outil === 'atlas') return global.Studio.peutEtreMulti(tpl);
      var defauts = {};
      (tpl.options || []).forEach(function (d) { defauts[d.key] = d.default; });
      return !global.Studio.estMulti(tpl, defauts);
    },

    /* Une VARIANTE d'une planche partagée. Empreinte montre Sceau, Soleil,
     * Contre-empreinte et Sceau cerclé dans Trace ; Triptyque, Collection
     * et Îlots dans l'Atlas. Montrer les sept des deux côtés rendrait la
     * séparation décorative. */
    varianteDansLOutil: function (tpl, o) {
      if (typeof tpl === 'string') tpl = global.Studio.get(tpl);
      if (!tpl) return false;
      var vals = {};
      (tpl.options || []).forEach(function (d) { vals[d.key] = d.default; });
      Object.keys(o || {}).forEach(function (k) { vals[k] = o[k]; });
      return global.Studio.estMulti(tpl, vals) === (outil === 'atlas');
    },

    /* Appelé par demarrage.js, une seule fois. */
    demarre: function () {
      var f = file;
      file = [];
      f.forEach(function (fn) { fn(); });
    }
  };
}(window));
