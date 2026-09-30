/* installe.js — l'enregistrement du service worker, et l'annonce d'une
 * nouvelle version.
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
 *
 * ── POURQUOI UNE ANNONCE ─────────────────────────────────────────────
 *
 * Le SHELL est servi par GÉNÉRATION : une page ne mélange jamais deux
 * versions du code, et le prix est qu'une version fraîche apparaît au
 * chargement SUIVANT. Vu de l'extérieur, cela donne « recharge, et si tu vois
 * encore l'ancien numéro, recharge encore » — une consigne qu'on ne peut ni
 * vérifier ni contredire. C'est exactement la question qui s'est posée en
 * 3.13.1, et la réponse ne doit pas être une superstition.
 *
 * Le studio le dit donc lui-même, au moment où il le SAIT : quand un nouveau
 * service worker prend la main sur cette page, le code affiché n'est plus
 * celui qui est installé. Un bandeau, un bouton, et la question ne se pose
 * plus.
 *
 * ── LE PIÈGE DU PREMIER CHARGEMENT ───────────────────────────────────
 *
 * `controllerchange` se déclenche AUSSI la première fois qu'un service worker
 * prend en charge une page qui n'en avait pas — c'est-à-dire à la toute
 * première visite, là où il n'y a rien de neuf à annoncer. On ne retient donc
 * l'événement que si la page était DÉJÀ pilotée au démarrage.
 */
(function (global) {
  'use strict';
  if (!('serviceWorker' in navigator) || !global.isSecureContext) return;

  /* Relevé AVANT tout enregistrement : après, il est trop tard pour savoir si
   * la page était pilotée ou non. */
  var etaitPilotee = !!navigator.serviceWorker.controller;
  var annonceFaite = false;

  global.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function (e) {
      console.warn('service worker non enregistré :', e.message);
    });
  });

  navigator.serviceWorker.addEventListener('controllerchange', function () {
    if (!etaitPilotee) return;            // première prise en charge, pas une mise à jour
    annonce();
  });

  /* LE NUMÉRO EST LU, PAS DEVINÉ.
   *
   * `src/version.js` fait partie du SHELL : le nouveau service worker le sert
   * depuis SON cache, donc cette lecture rend le numéro de la génération qui
   * vient de prendre la main — pas celui de la page affichée, qui est l'ancien.
   * Si la lecture échoue, on annonce sans numéro plutôt que d'en inventer un. */
  function annonce() {
    if (annonceFaite) return;
    annonceFaite = true;
    fetch('src/version.js')
      .then(function (r) { return r.ok ? r.text() : ''; })
      .then(function (txt) {
        var m = /STUDIO_VERSION = '([^']+)'/.exec(txt || '');
        montre(m ? m[1] : null);
      })
      .catch(function () { montre(null); });
  }

  function montre(numero) {
    var boite = document.getElementById('maj');
    if (!boite) return;
    var titre = boite.querySelector('.titre');
    var T = (global.I18N && global.I18N.T) || function (s) { return s; };
    titre.textContent = numero
      ? T('La version') + ' ' + numero + ' ' + T('est prête')
      : T('Une nouvelle version est prête');
    boite.hidden = false;
  }

  document.addEventListener('DOMContentLoaded', function () {
    var recharge = document.getElementById('maj-recharger');
    var fermer = document.getElementById('maj-fermer');
    if (recharge) {
      recharge.addEventListener('click', function () { global.location.reload(); });
    }
    if (fermer) {
      fermer.addEventListener('click', function () {
        document.getElementById('maj').hidden = true;
      });
    }
  });

  /* Le banc d'acceptation ne peut pas fabriquer une vraie mise à jour de
   * service worker en quelques secondes. Il peut, lui, éprouver ce qui casse
   * en silence : le bandeau, son libellé, son bouton. */
  global.__annonceVersion = montre;
}(window));
