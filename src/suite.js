/* suite.js — la page d'accueil de la suite : le choix papier / sombre.
 *
 * Même clé que le studio et la galerie : un choix fait dans l'un se retrouve
 * dans les autres. Le script vit dans un fichier parce que la politique de
 * sécurité de la page refuse le JavaScript écrit dans le HTML. */
(function () {
  'use strict';
  var CLE = 'strava-studio-theme', actuel = 'papier';
  try { actuel = localStorage.getItem(CLE) || 'papier'; } catch (e) { /* mode privé */ }
  function pose(t) {
    actuel = t;
    if (t === 'sombre') document.documentElement.setAttribute('data-theme', 'sombre');
    else document.documentElement.removeAttribute('data-theme');
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'sombre' ? '#14140F' : '#F7F5EF');
    try { localStorage.setItem(CLE, t); } catch (e) { /* tant pis */ }
  }
  pose(actuel);
  document.getElementById('theme').addEventListener('click', function () { pose(actuel === 'sombre' ? 'papier' : 'sombre'); });
})();
