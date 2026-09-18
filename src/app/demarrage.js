/* demarrage.js — le dernier fichier chargé, et il ne fait qu'une chose.
 *
 * Chaque morceau de l'interface dépose sa mise en route dans la file du noyau
 * plutôt que de s'exécuter au chargement. Ce fichier la vide, une fois que
 * tout le monde est là.
 *
 * POURQUOI CE N'EST PAS UNE LIGNE AU BAS DE app.js
 *   Parce qu'app.js est chargé EN PREMIER des fichiers d'interface. Un
 *   démarrage écrit à sa fin appellerait des morceaux pas encore lus, et le
 *   moindre changement dans l'ordre des balises <script> casserait le studio
 *   sans que rien ne dise pourquoi. Ici, l'ordre a un sens lisible : ce
 *   fichier est le dernier, et il est le seul à démarrer quoi que ce soit.
 *
 * IL DOIT RESTER EN DERNIER dans index.html. Un contrôle du harnais le
 * vérifie — c'est la seule chose qui empêche qu'on l'y remonte un jour par
 * habitude alphabétique.
 */
(function (A) {
  'use strict';
  A.demarre();
}(window.App));
