/* theme.js — papier ou sombre : le theme de l'interface
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;
  var draw = A.draw;

  /* ---------- papier ou sombre ----------
   * Le papier est l'accueil : l'interface ressemble alors à ce qu'elle
   * fabrique. Le sombre reste à un doigt, parce qu'une planche nocturne se
   * juge mal sur du papier — c'est un choix de travail, pas une préférence
   * de confort. */
  (function theme() {
    var CLE = 'strava-studio-theme';
    var actuel = 'papier';
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
    $('#theme').addEventListener('click', function () {
      pose(actuel === 'sombre' ? 'papier' : 'sombre');
      draw();                      // le fond de contrôle dépend du thème
    });
  }());

  /* La page statique est traduite AVANT que quoi que ce soit de dynamique
   * ne soit construit : autrement le parcours des nœuds de texte retomberait
   * sur des libellés déjà traduits et n'en reconnaîtrait plus la clé. */
  I18N.appliquer(document.body);

}(window.App));
