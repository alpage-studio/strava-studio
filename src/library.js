/* library.js — la bibliothèque de sorties chargées.
 *
 * Le moteur ne tenait qu'UNE activité : `var base` dans app.js. Quatre des
 * planches à venir — plan de métro, saisons, tissage, fresque — en demandent
 * plusieurs. Plutôt que quatre bricolages, une seule liste ordonnée.
 *
 * Ce qu'elle garantit aux templates :
 *   - un ORDRE stable, que l'utilisateur contrôle ;
 *   - une IDENTITÉ stable par sortie (id + couleur), qui ne bouge pas quand
 *     on en ajoute ou en retire une. Une couleur qui se réattribue à chaque
 *     ajout rend toute comparaison mensongère d'une image à l'autre ;
 *   - une sortie COURANTE, pour que les seize templates existants continuent
 *     de fonctionner sans savoir que la bibliothèque existe.
 *
 * Aucune persistance ici : la bibliothèque vit le temps de la session. Le
 * stockage d'un historique est un autre sujet, avec d'autres contraintes
 * (taille, suppression, photos), et il ne doit pas s'inviter par la bande.
 */
(function (global) {
  'use strict';

  /* Palette d'identité. Assez distincte pour se lire côte à côte, et
   * assignée par RANG D'ARRIVÉE, jamais par position dans la liste : on
   * peut réordonner sans que les couleurs dansent. */
  var COULEURS = [
    '#E5502D', '#4EA8DE', '#C8F04E', '#F2A65A',
    '#9B7EDE', '#4ED6A0', '#E86AA6', '#D9CBA3'
  ];

  var entrees = [];
  var courante = null;   // id de la sortie affichée par les templates simples
  var compteur = 0;

  function add(activity) {
    if (!activity) return null;
    compteur++;
    var e = {
      id: 'a' + compteur,
      rang: compteur,                       // fixe la couleur pour toujours
      couleur: COULEURS[(compteur - 1) % COULEURS.length],
      activity: activity
    };
    entrees.push(e);
    if (!courante) courante = e.id;
    return e;
  }

  function list() { return entrees.slice(); }
  function count() { return entrees.length; }

  function get(id) {
    for (var i = 0; i < entrees.length; i++) if (entrees[i].id === id) return entrees[i];
    return null;
  }

  function remove(id) {
    var i = entrees.findIndex(function (e) { return e.id === id; });
    if (i < 0) return;
    entrees.splice(i, 1);
    if (courante === id) courante = entrees.length ? entrees[Math.min(i, entrees.length - 1)].id : null;
  }

  function clear() { entrees = []; courante = null; }

  /* Déplacement d'un cran. La couleur suit l'entrée, pas sa place. */
  function move(id, sens) {
    var i = entrees.findIndex(function (e) { return e.id === id; });
    var j = i + sens;
    if (i < 0 || j < 0 || j >= entrees.length) return;
    var tmp = entrees[i]; entrees[i] = entrees[j]; entrees[j] = tmp;
  }

  function setColor(id, couleur) { var e = get(id); if (e) e.couleur = couleur; }

  function select(id) { if (get(id)) courante = id; }
  function currentId() { return courante; }
  function current() { var e = get(courante); return e ? e.activity : null; }

  /* Le type d'activité que les plateformes collent au nom. On ne le montre
   * nulle part sur les planches — et il mange la place du lieu, qui est la
   * seule chose intéressante dans « Le Mont-sur-Lausanne Mountain Biking ». */
  var TYPES = /(^|\s+)(mountain\s+bikin?g?|road\s+cyclin?g?|gravel\s+ride|virtual\s+ride|e-?bike\s+ride|cycling|ride|velo|vélo|sortie\s+v[ée]lo|workout|training)\s*$/i;

  /* Un nom court, pour les listes et les légendes.
   *
   * Le piège de la troncature par mot : « Le Mont-sur-Lausanne Mountain
   * Biking » coupé à 18 puis rogné jusqu'au dernier espace donnait « Le… ».
   * On ne recule jusqu'à la frontière de mot que si ça laisse encore
   * l'essentiel ; sinon on coupe net, quitte à couper dans un mot. */
  function nomCourt(activity, max) {
    var n = String((activity && activity.name) || 'Sortie').trim();
    max = max || 22;
    var avant;
    do { avant = n; n = n.replace(TYPES, '').trim(); } while (n !== avant && n);
    if (!n) n = 'Sortie';
    if (n.length <= max) return n;
    var brut = n.slice(0, max - 1);
    var mot = brut.replace(/\s+\S*$/, '');
    return (mot.length >= (max - 1) * 0.6 ? mot : brut).trim() + '…';
  }

  global.Library = {
    add: add, list: list, count: count, get: get, remove: remove, clear: clear,
    move: move, setColor: setColor,
    select: select, current: current, currentId: currentId,
    nomCourt: nomCourt, COULEURS: COULEURS
  };
}(window));
