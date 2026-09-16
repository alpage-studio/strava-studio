/* installe.js — l'enregistrement du service worker.
 *
 * Ces dix lignes étaient dans un <script> en clair au bas d'index.html.
 * Elles en sortent pour une seule raison : une politique de sécurité de
 * contenu qui autorise les scripts en ligne (`'unsafe-inline'`) n'en est
 * plus une. Sortir le dernier script en ligne permet d'écrire
 * `script-src 'self'`, et c'est cette ligne-là qui transforme la promesse
 * « le studio ne charge rien d'un tiers » en refus vérifiable par le
 * navigateur.
 *
 * Le service worker n'a de sens qu'en contexte sûr — HTTPS ou localhost.
 * Ailleurs (file://, une IP du réseau local en clair) on s'en passe : le
 * studio fonctionne, il n'est simplement pas installable.
 */
(function () {
  'use strict';
  if (!('serviceWorker' in navigator) || !window.isSecureContext) return;
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('service worker non enregistré :', e.message);
    });
  });
}());
