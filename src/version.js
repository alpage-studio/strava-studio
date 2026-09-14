/* version.js — LE numéro de version, à un seul endroit.
 *
 * Ce fichier est chargé deux fois, dans deux mondes différents :
 *   - par index.html, pour afficher la version dans l'en-tête ;
 *   - par sw.js via importScripts(), pour nommer le cache hors ligne.
 *
 * C'est ce qui évite la dérive classique : un numéro affiché qui dit 1.4
 * pendant que le cache sert encore la 1.2. Changer la ligne ci-dessous
 * met à jour l'affichage ET purge le cache des visiteurs.
 *
 * Un `var` de premier niveau fonctionne dans les deux portées — la fenêtre
 * comme le service worker. Ne pas passer en `const` ou en module.
 */
var STUDIO_VERSION = '1.9';
var STUDIO_DATE = '14.09.2026';
