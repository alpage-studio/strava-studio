/* storyboard.js — le storyboard : une liste de scenes qu'on ordonne
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;

  /* ---------- le storyboard ----------
   * Rendu comme une liste : chaque scène a une case et deux flèches. La
   * valeur produite est la suite ordonnée des clés actives, séparées par des
   * virgules — volontairement la même forme qu'un champ texte, pour que rien
   * dans la chaîne sauvegarde → collection → export n'ait à la connaître.
   *
   * `def.items` = [[clé, libellé], …] · `def.min` / `def.max` bornent le
   * nombre de scènes actives : sous la borne basse, on refuse de décocher.
   */
  function ordonnanceur(def, vals) {
    var boite = document.createElement('div');
    boite.className = 'ordre';
    var libelles = {};
    def.items.forEach(function (it) { libelles[it[0]] = T(it[1]); });

    function lire() {
      return String(vals[def.key] || def.default || '')
        .split(',').map(function (x) { return x.trim(); })
        .filter(function (k) { return libelles[k]; });
    }
    function ecrire(liste) {
      boite.value = liste.join(',');
      boite.dispatchEvent(new Event('input'));
      rendre();
    }

    function rendre() {
      var actives = lire();
      var mini = def.min == null ? 1 : def.min;
      var maxi = def.max == null ? def.items.length : def.max;
      boite.innerHTML = '';
      // les actives dans leur ordre, puis les inactives
      var rangees = actives.concat(def.items.map(function (it) { return it[0]; })
        .filter(function (k) { return actives.indexOf(k) < 0; }));

      rangees.forEach(function (cle) {
        var i = actives.indexOf(cle);
        var on = i >= 0;
        var ligne = document.createElement('div');
        ligne.className = 'ordre-l' + (on ? ' on' : '');

        var coche = document.createElement('input');
        coche.type = 'checkbox';
        coche.checked = on;
        coche.disabled = (on && actives.length <= mini) || (!on && actives.length >= maxi);
        coche.addEventListener('change', function () {
          var l = lire();
          if (on) l.splice(l.indexOf(cle), 1); else l.push(cle);
          ecrire(l);
        });

        var nom = document.createElement('span');
        nom.textContent = libelles[cle];

        ligne.appendChild(coche);
        ligne.appendChild(nom);
        [['↑', -1], ['↓', 1]].forEach(function (b) {
          var bt = document.createElement('button');
          bt.type = 'button'; bt.textContent = b[0];
          bt.disabled = !on || (i + b[1] < 0) || (i + b[1] >= actives.length);
          bt.addEventListener('click', function () {
            var l = lire(), de = l.indexOf(cle), vers = de + b[1];
            if (vers < 0 || vers >= l.length) return;
            var t = l[vers]; l[vers] = l[de]; l[de] = t;
            ecrire(l);
          });
          ligne.appendChild(bt);
        });
        boite.appendChild(ligne);
      });
    }

    boite.value = lire().join(',');
    rendre();
    return boite;
  }

  A.ordonnanceur = ordonnanceur;
}(window.App));
