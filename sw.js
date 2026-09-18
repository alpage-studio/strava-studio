/* sw.js — le service worker : c'est lui qui rend le studio utilisable hors
 * réseau, une fois posé sur l'écran d'accueil.
 *
 * Stratégie : RÉSEAU D'ABORD, cache en repli. L'inverse — le cache d'abord —
 * est plus rapide mais transforme chaque modification du code en énigme :
 * on recharge et on voit l'ancienne version. Ici, tant qu'il y a du réseau
 * tu as toujours le dernier code ; sans réseau, tu as la dernière version
 * vue. C'est le bon compromis pour un outil qu'on modifie encore.
 */
/* Le numéro vient de src/version.js, chargé ici comme dans la page : une
 * seule ligne à changer met à jour l'affichage ET purge le cache. */
importScripts('./src/version.js');
const VERSION = 'studio-v' + STUDIO_VERSION;

/* Le strict nécessaire pour démarrer hors ligne. Les templates sont listés
 * un par un : en ajouter un demande une ligne ici, et un changement de
 * VERSION pour purger l'ancien cache. */
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/archivo-latin.woff2',
  './assets/archivo-latin-ext.woff2',
  './assets/plexmono-latin.woff2',
  './assets/plexmono-latin-ext.woff2',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/icon-180.png',
  './assets/icon-maskable-512.png',
  // sans l'exemple, un visiteur hors ligne n'a rien à charger
  './exemple.gpx',
  // le jeu multi-sorties : sans lui, les planches « série », « métro »,
  // « saisons », « tissage » et « fresque » n'ont rien à montrer hors ligne
  './exemple-boucle.gpx',
  './exemple-aller.gpx',
  './exemple-ailleurs.gpx',
  './exemple-variante.gpx',
  './exemple-annee.json',
  // les parcours de revue artistique : quatre formes, une semaine partagée,
  // deux régions éloignées
  './demo-boucle.gpx', './demo-aller.gpx', './demo-ouvert.gpx', './demo-croisements.gpx',
  './sem-lun.gpx', './sem-mar.gpx', './sem-jeu.gpx', './sem-ven.gpx', './sem-dim.gpx',
  './loin-a.gpx', './loin-b.gpx',
  './sem-01.gpx', './sem-02.gpx', './sem-03.gpx', './sem-04.gpx',
  './sem-05.gpx', './sem-06.gpx', './sem-07.gpx', './sem-08.gpx',
  './src/version.js',
  './src/i18n.js',
  './src/installe.js',
  './src/activity.js',
  './src/studio.js',
  './src/design.js',
  './src/alpage.js',
  './src/overlay.js',
  './src/library.js',
  './src/projet.js',
  './src/historique.js',
  './src/musee.js',
  './src/partition.js',
  './src/collections.js',
  './src/icu-web.js',
  './src/video.js',
  './src/zip.js',
  './src/share.js',
  './src/app/noyau.js',
  './src/app.js',
  './src/app/theme.js',
  './src/app/mobile.js',
  './src/app/catalogue.js',
  './src/app/storyboard.js',
  './src/app/collection.js',
  './src/app/exports.js',
  './src/app/sources.js',
  './src/app/demarrage.js',
  './src/templates/encre.js',
  './src/templates/strates.js',
  './src/templates/empreinte.js',
  './src/templates/atlas.js',
  './src/templates/medaillon.js',
  './src/templates/almanac.js',
  './src/templates/mots.js',
  './src/templates/ressenti.js',
  './src/templates/film.js',
  './src/templates/serie.js',
  './src/templates/metro.js',
  './src/templates/saisons.js',
  './src/templates/tissage.js',
  './src/templates/fresque.js',
  './src/templates/exploration.js',
  './src/templates/musee.js',
  './src/templates/partition.js',
  './src/templates/allumettes.js',
  './src/templates/pente.js',
  './src/templates/radiale.js',
  './src/templates/sommet.js',
  './src/templates/editorial.js',
  './src/templates/trace.js',
  './src/templates/chiffres.js',
  './src/templates/ov-filet.js',
  './src/templates/ov-profil.js',
  './src/templates/ov-trace.js',
  './src/templates/ov-ardoise.js',
  './src/templates/ov-heros.js',
  './src/templates/ov-tranche.js',
  './src/templates/ov-sommet.js'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION)
      // addAll échoue en bloc si UN fichier manque : on tolère les absents
      .then(function (c) {
        return Promise.all(SHELL.map(function (u) {
          return c.add(u).catch(function () { /* absent : tant pis */ });
        }));
      })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (noms) {
        return Promise.all(noms.filter(function (n) { return n !== VERSION; })
          .map(function (n) { return caches.delete(n); }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  /* L'API Strava et l'écriture d'aperçus ne se mettent jamais en cache.
   *
   * La galerie de revue non plus : trois mégaoctets d'images qu'on regarde
   * une fois n'ont rien à faire dans le stockage hors ligne d'un outil.
   * (Le chiffre disait quatorze : c'était le poids des PNG d'origine, que
   * la galerie ne sert plus depuis qu'elle est en WebP.) */
  if (url.pathname.indexOf('/apercus/') >= 0) return;
  if (url.pathname.startsWith('/api/') ||
      url.pathname.startsWith('/__save') ||
      url.pathname.startsWith('/connect') ||
      url.pathname.startsWith('/exchange_token')) return;

  e.respondWith(
    fetch(req)
      .then(function (res) {
        if (res && res.ok) {
          const copie = res.clone();
          caches.open(VERSION).then(function (c) { c.put(req, copie); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(req).then(function (hit) {
          if (hit) return hit;
          // une navigation hors ligne retombe sur la page d'accueil en cache
          if (req.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
      })
  );
});
