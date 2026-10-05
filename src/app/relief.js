/* relief.js — demander le terrain autour du parcours, et le dire avant.
 *
 * LE SEUL MOMENT OÙ TRACE PARLE AU RÉSEAU.
 *
 * Tout le reste du studio travaille sur le fichier déposé et ne demande rien
 * à personne : c'est la promesse, et elle se tient sans effort tant qu'on ne
 * fait rien. Ici on la met en jeu, donc on la nomme. Ce qui part, ce sont les
 * coordonnées d'un rectangle autour du parcours — ni la trace, ni les photos,
 * ni le nom de la sortie. Ces coordonnées situent pourtant le parcours, et ce
 * serait malhonnête de ne pas le dire : la fenêtre le dit.
 *
 * ON LE DEMANDE AVANT, PAS APRÈS. Une boîte de confirmation avec la taille de
 * la zone, le nombre de requêtes et la durée approximative. Qui refuse ne perd
 * rien : la planche Topographie dessine le parcours sans relief et l'écrit.
 *
 * LE CALCUL EST CELUI DU CARNET, le même fichier (src/carnet/relief.js). Deux
 * reliefs écrits deux fois finiraient par ne pas dire la même chose, et c'est
 * exactement ce que ce studio refuse ailleurs.
 *
 * LE RELIEF NE SURVIT PAS AU RECHARGEMENT, et c'est assumé : une grille fait
 * plusieurs centaines de kilo-octets, le stockage local en tient cinq au
 * total, et un export de projet qui l'emporterait pèserait plus que tout le
 * reste. On le redemande, en vingt secondes. Le panneau le dit.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var changement = A.changement;

  /* `Library.current()` rend l'ACTIVITÉ, pas l'entrée — c'est écrit dans
   * library.js et je l'ai lu de travers une première fois : le bouton ne
   * se montrait jamais, sans la moindre erreur, parce qu'un niveau de trop
   * donnait `undefined` au lieu d'une trace. */
  function courante() {
    var a = window.Library && Library.current ? Library.current() : null;
    return a && a.track && a.track.length > 1 ? a : null;
  }

  /* Le bouton ne se montre que s'il a quelque chose à faire : sans sortie
   * chargée il n'aurait aucun parcours autour duquel demander un terrain. */
  function majRelief() {
    var b = $('#relief-ajouter'), note = $('#relief-state');
    if (!b) return;
    var a = courante();
    b.hidden = !a;
    if (note) note.hidden = !a;
    if (!a) { if (note) note.textContent = ''; return; }
    if (a.relief) {
      b.textContent = T('Redemander le relief');
      if (note) {
        note.textContent = T('{n} courbes · écart médian {e} m avec le GPX · reperdu au rechargement')
          .replace('{n}', a.relief.courbes.length)
          .replace('{e}', a.relief.controle.ecartMedian);
      }
    } else {
      b.textContent = T('Ajouter le relief (swisstopo)');
      if (note) note.textContent = T('Suisse et abords. Le parcours part sous forme de rectangle.');
    }
  }
  A.majRelief = majRelief;

  A.auDemarrage(function () {
    var b = $('#relief-ajouter');
    if (!b) return;
    b.addEventListener('click', function () {
      var a = courante();
      var note = $('#relief-state');
      if (!a) return;
      if (!window.Relief) { if (note) note.textContent = T('Le calcul du relief n’est pas chargé.'); return; }

      var est = Relief.estimer(a.track);
      var ok = window.confirm(
        T('Ajouter le relief swisstopo ?') + '\n\n' +
        T('Le studio va demander à swisstopo (geo.admin.ch) le terrain d’une zone d’environ {l} × {h} km autour du parcours — {r} requêtes, une vingtaine de secondes.')
          .replace('{l}', Math.round(est.kmLarge)).replace('{h}', Math.round(est.kmHaut))
          .replace('{r}', est.requetes) + '\n\n' +
        T('Seules les coordonnées de cette zone partent : ni la trace, ni le nom de la sortie. Elles situent toutefois le parcours.') + '\n\n' +
        T('Le relief couvre la Suisse et ses abords immédiats.'));
      if (!ok) return;

      b.disabled = true;
      Relief.preparer(a.track, {
        progres: function (k) {
          if (note) note.textContent = T('swisstopo… {p} %').replace('{p}', Math.round(k * 100));
        }
      }).then(function (r) {
        a.relief = r;
        majRelief();
        if (changement) changement();
      }).catch(function (e) {
        /* Le calcul REFUSE de lui-même quand la grille ne correspond pas au
         * parcours — hors de Suisse, typiquement. Son message dit l'écart
         * mesuré : on le laisse passer tel quel plutôt que de le remplacer
         * par un « impossible » qui n'apprend rien. */
        if (note) note.textContent = T('Relief impossible : {e}').replace('{e}', e.message);
      }).then(function () {
        b.disabled = false;
      });
    });
    majRelief();
  });
}(window.App));
