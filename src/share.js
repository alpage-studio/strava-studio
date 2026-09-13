/* share.js — livrer un fichier à l'utilisateur.
 *
 * Sur un ordinateur, un lien de téléchargement suffit. Sur iPhone il est
 * capricieux : Safari ouvre parfois le fichier au lieu de l'enregistrer, et
 * rien ne permet d'aller directement dans Stories. La feuille de partage
 * native résout les deux — Enregistrer dans Photos, Instagram, AirDrop.
 *
 * On essaie donc le partage d'abord quand le navigateur le propose POUR CE
 * TYPE DE FICHIER, et on retombe sur le téléchargement sinon.
 */
(function (global) {
  'use strict';

  function telecharger(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
    return 'telechargement';
  }

  /* Renvoie une promesse : 'partage', 'telechargement' ou 'annule'. */
  function file(blob, filename) {
    var f;
    try {
      f = new File([blob], filename, { type: blob.type });
    } catch (e) {
      return Promise.resolve(telecharger(blob, filename));
    }

    // canShare({files}) est le seul test fiable : navigator.share existe sur
    // des navigateurs qui refusent les fichiers
    if (navigator.canShare && navigator.canShare({ files: [f] }) && navigator.share) {
      return navigator.share({ files: [f] })
        .then(function () { return 'partage'; })
        .catch(function (err) {
          // l'utilisateur a fermé la feuille : ce n'est pas une erreur
          if (err && err.name === 'AbortError') return 'annule';
          return telecharger(blob, filename);
        });
    }
    return Promise.resolve(telecharger(blob, filename));
  }

  global.Share = { file: file, telecharger: telecharger };
}(window));
