/* projet.js — enregistrer une composition, la rouvrir plus tard.
 *
 * La bibliothèque vit le temps d'une session : c'était un choix, et il tient
 * pour une affiche qu'on fait en cinq minutes. Il ne tient plus pour une
 * fresque à plusieurs, qu'on reprend le lendemain avec une contribution de
 * plus.
 *
 * Trois règles :
 *
 *   - UN FICHIER, CHEZ TOI. Le projet est un .json que le navigateur te
 *     donne et que tu ranges où tu veux. Aucune publication, aucun envoi,
 *     aucun compte — le studio ne sait toujours parler à personne.
 *   - CE QU'IL CONTIENT EST ÉCRIT. La trace (lat, lon, altitude, temps), le
 *     nom, la couleur, l'ordre, et les réglages du template. Pas les photos :
 *     une photo dans un JSON le fait passer de cinquante kilo-octets à
 *     quinze mégaoctets, et on ne s'en aperçoit qu'au moment de le partager.
 *   - LES COORDONNÉES SONT ARRONDIES À SIX DÉCIMALES. Onze centimètres au
 *     sol : bien au-delà de ce qu'un GPS de vélo sait faire, et trois fois
 *     plus léger que les quinze décimales que JSON écrirait sinon.
 */
(function (global) {
  'use strict';

  var FORMAT = 1;

  function arrondi(v, n) {
    if (v == null || !isFinite(v)) return null;
    var k = Math.pow(10, n);
    return Math.round(v * k) / k;
  }

  /* --------- écriture --------- */
  function construire(entrees, reglages) {
    return {
      format: FORMAT,
      studio: global.STUDIO_VERSION || '?',
      cree: new Date().toISOString(),
      reglages: reglages || {},
      sorties: entrees.map(function (e) {
        var a = e.activity;
        return {
          nom: a.name || null,
          type: a.type || null,
          couleur: e.couleur,
          date: a.date ? a.date.toISOString() : null,
          distance_m: a.distance_m == null ? null : Math.round(a.distance_m),
          duration_s: a.duration_s == null ? null : Math.round(a.duration_s),
          elev_gain_m: a.elev_gain_m == null ? null : Math.round(a.elev_gain_m),
          /* La trace est stockée en colonnes parallèles plutôt qu'en objets :
           * un tableau de nombres pèse trois fois moins que dix mille
           * {"lat":…,"lon":…}, et se relit aussi simplement. */
          lat: a.track.map(function (p) { return arrondi(p.lat, 6); }),
          lon: a.track.map(function (p) { return arrondi(p.lon, 6); }),
          ele: a.track.map(function (p) { return arrondi(p.ele, 1); }),
          t: a.track.map(function (p) { return p.t ? Math.round(p.t.getTime() / 1000) : null; }),
          w: a.track.map(function (p) { return p.w == null ? null : Math.round(p.w); }),
          hr: a.track.map(function (p) { return p.hr == null ? null : Math.round(p.hr); })
        };
      })
    };
  }

  function exporter(entrees, reglages, nom) {
    var blob = new Blob([JSON.stringify(construire(entrees, reglages))],
                        { type: 'application/json' });
    if (global.Share) return global.Share.file(blob, nom);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nom;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  /* --------- lecture --------- */
  /* On refuse franchement un fichier qu'on ne sait pas lire. Un projet à
   * moitié importé — trois sorties sur cinq, sans le dire — est pire qu'un
   * refus : on le découvre en regardant la fresque, longtemps après. */
  function lire(texte) {
    var j;
    try { j = JSON.parse(texte); }
    catch (e) { throw new Error('Ce fichier n’est pas un projet du studio.'); }
    if (!j || j.format !== FORMAT || !Array.isArray(j.sorties)) {
      throw new Error('Format de projet inconnu (attendu : ' + FORMAT + ').');
    }
    var sorties = j.sorties.map(function (so, i) {
      var n = (so.lat || []).length;
      if (!n) throw new Error('Sortie ' + (i + 1) + ' : trace vide.');
      var track = [];
      for (var k = 0; k < n; k++) {
        track.push({
          lat: so.lat[k], lon: so.lon[k],
          ele: so.ele ? so.ele[k] : null,
          t: (so.t && so.t[k]) ? new Date(so.t[k] * 1000) : null,
          w: so.w ? so.w[k] : null,
          hr: so.hr ? so.hr[k] : null,
          d: 0
        });
      }
      return {
        couleur: so.couleur,
        activity: global.Activity.fromPoints({
          name: so.nom, type: so.type,
          date: so.date ? new Date(so.date) : null,
          distance_m: so.distance_m, duration_s: so.duration_s,
          elev_gain_m: so.elev_gain_m
        }, track)
      };
    });
    return { reglages: j.reglages || {}, sorties: sorties };
  }

  global.Projet = { exporter: exporter, lire: lire, construire: construire, FORMAT: FORMAT };
}(window));
