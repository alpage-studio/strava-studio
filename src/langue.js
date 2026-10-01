/* langue.js — les deux langues d'alpage : celle de l'INTERFACE et celle des IMAGES.
 *
 * Deux réglages, pas un. L'interface est ce qu'on lit pour travailler ; les
 * images sont ce qu'on publie. Une personne qui lit l'anglais peut vouloir
 * une affiche en français pour un club romand, et l'inverse. Les deux sont
 * retenus dans ce navigateur et partagés par Trace, Atlas et le Carnet :
 * un choix fait dans l'un se retrouve dans les autres.
 *
 * CE FICHIER EST LE SOCLE, il ne connaît aucun outil.
 *   - la langue de l'interface, lue par i18n.js (son dictionnaire) ;
 *   - la langue des images et de quoi y écrire : un mot (`mot`), un pluriel
 *     (`n`), un nombre, des kilomètres, des mètres, une date, un mois.
 * Les dictionnaires des images sont DÉCLARÉS par les outils (`declarer`) et
 * séparés de celui de l'interface : une étiquette courte d'affiche (« PLAN »,
 * « Papier ») ne se traduit pas forcément comme le même mot dans un menu.
 *
 * LA SOURCE EST LE FRANÇAIS, comme partout dans le code : une clé est la
 * phrase française elle-même, et une clé absente s'écrit en français. C'est
 * une dégradation visible, jamais un trou.
 *
 * LES NOMBRES NE PASSENT PAS PAR Intl : le séparateur des milliers de
 * `toLocaleString('fr-CH')` change selon le moteur (espace fine, espace,
 * apostrophe), et une affiche ne doit pas changer d'un navigateur à l'autre.
 * Les séparateurs sont écrits ici : en français l'espace fine insécable
 * (U+202F), celle que le Carnet emploie depuis le début ; en anglais la virgule.
 * Les NOMS de mois et de jours, eux, viennent d'Intl : ils ne varient pas.
 *
 * Fonctionne dans le navigateur (global `Langue`) et dans Node (le harnais).
 */
(function (global) {
  'use strict';

  var LANGUES = ['en', 'fr'];
  var NOMS = { en: 'English', fr: 'Français' };
  var CLES = { interface: 'alpage-langue-interface', images: 'alpage-langue-images' };

  /* LA LANGUE PAR DÉFAUT EST L'ANGLAIS, pour l'interface et pour les images
   * (décision d'OZ, 01.10.2026 : « tout en anglais »). Le français reste au
   * choix dans le sélecteur.
   *
   * LE PIÈGE CONNU : de la 3.5 à la 3.11, une interface anglaise a produit des
   * affiches françaises, et douze relecteurs sur douze ont vu le mélange. Ce
   * défaut existe de nouveau pour toute image qui n'écrit pas encore par
   * Langue.mot : elle reste en français. Les traduire toutes est le travail
   * des lots 4 (Trace, Atlas) et 5 (Carnet). */
  var DEFAUT_INTERFACE = 'en';

  var LOCALES = { en: 'en-GB', fr: 'fr-CH' };
  var SEP = { en: { mille: ',', dec: '.' }, fr: { mille: ' ', dec: ',' } };

  function valide(v) { return LANGUES.indexOf(v) >= 0 ? v : null; }
  function lire(quoi) {
    try { return valide(global.localStorage && global.localStorage.getItem(CLES[quoi])); }
    catch (e) { return null; /* mode privé, stockage bloqué */ }
  }
  function ecrire(quoi, v) {
    try { global.localStorage.setItem(CLES[quoi], v); } catch (e) { /* tant pis : la session garde le choix */ }
  }

  var etat = { interface: lire('interface') || DEFAUT_INTERFACE };
  /* Sans choix explicite, les images suivent l'interface. */
  etat.images = lire('images') || etat.interface;

  /* ---------- les dictionnaires des images ---------- */

  var DICOS = { en: {} };
  /* Un outil déclare ses traductions : Langue.declarer('en', { 'Départ': 'Start' }).
   * Deux outils peuvent déclarer la même clé ; une traduction DIFFÉRENTE de
   * la même clé n'écrase pas la première — la seconde changerait en silence
   * les images de l'autre outil. Elle est notée dans `conflits`, que le
   * harnais exige vide. On ne lève pas d'erreur : un conflit ne doit pas
   * empêcher la page de s'ouvrir chez quelqu'un. */
  var conflits = [];
  function declarer(langue, dico) {
    var d = DICOS[langue] || (DICOS[langue] = {});
    Object.keys(dico).forEach(function (k) {
      if (d[k] != null && d[k] !== dico[k]) {
        conflits.push(langue + ' · « ' + k + ' » : « ' + d[k] + ' » puis « ' + dico[k] + ' »');
        if (global.console) global.console.error('Langue.declarer : traduction en conflit — ' + conflits[conflits.length - 1]);
        return;
      }
      d[k] = dico[k];
    });
  }

  /* Un mot ou une phrase des images, avec ses emplacements :
   *   Langue.mot('De {a} à {b}', { a: '831 m', b: '2 787 m' })
   * Les emplacements évitent de recoller des morceaux traduits un à un —
   * l'ordre des mots n'est pas le même dans les deux langues. */
  function mot(cle, valeurs, langue) {
    var l = langue || etat.images;
    var d = DICOS[l];
    var s = (d && d[cle] != null) ? d[cle] : cle;
    if (!valeurs) return s;
    return s.replace(/\{(\w+)\}/g, function (tout, k) {
      return valeurs[k] != null ? String(valeurs[k]) : tout;
    });
  }

  /* Un pluriel. Le français met 0 et 1 au singulier, l'anglais seul 1 :
   *   Langue.n(0, '{n} sortie', '{n} sorties') → « 0 sortie » / « 0 rides ».
   * Les deux formes sont des clés françaises, traduites chacune. */
  function n(nombre, un, plusieurs, valeurs, langue) {
    var l = langue || etat.images;
    var regle = categorie(nombre, l);
    var v = { n: nombre };
    if (valeurs) Object.keys(valeurs).forEach(function (k) { v[k] = valeurs[k]; });
    return mot(regle === 'one' ? un : plusieurs, v, l);
  }
  function categorie(nombre, l) {
    try { return new Intl.PluralRules(l).select(nombre); }
    catch (e) { return l === 'fr' ? (Math.abs(nombre) < 2 ? 'one' : 'other') : (nombre === 1 ? 'one' : 'other'); }
  }

  /* ---------- les nombres ---------- */

  function nombre(x, dec, langue) {
    if (x == null || !isFinite(x)) return '—';
    var s = SEP[langue || etat.images];
    var t = Math.abs(x).toFixed(dec || 0).split('.');
    var ent = t[0].replace(/\B(?=(\d{3})+(?!\d))/g, s.mille);
    return (x < 0 ? '−' : '') + ent + (t[1] ? s.dec + t[1] : '');
  }
  function km(x, dec, langue) { return x == null ? '—' : nombre(x, dec == null ? 1 : dec, langue) + ' km'; }
  function m(x, langue) { return x == null ? '—' : nombre(Math.round(x), 0, langue) + ' m'; }

  /* ---------- les dates ---------- */

  function locale(langue) { return LOCALES[langue || etat.images]; }
  function date(d, options, langue) {
    if (!d) return '';
    var l = langue || etat.images;
    var s = d.toLocaleDateString(LOCALES[l], options || { day: 'numeric', month: 'long', year: 'numeric' });
    // le français ne met pas de virgule après le jour de la semaine
    return l === 'fr' ? s.replace(',', '') : s;
  }
  function mois(i, court, langue) {
    var d = new Date(2001, i, 15);
    return d.toLocaleDateString(LOCALES[langue || etat.images], { month: court ? 'short' : 'long' }).replace(/\.$/, '');
  }

  /* ---------- choisir ---------- */

  var abonnes = [];
  /* Un outil écoute le changement de langue des IMAGES pour se redessiner.
   * Celle de l'INTERFACE recharge la page : le texte statique n'est traduit
   * qu'une fois, au chargement, et recharger est la seule façon sûre de ne
   * rien laisser dans l'ancienne langue. */
  function surChangement(f) { abonnes.push(f); }
  function choisir(quoi, v) {
    v = valide(v);
    if (!v || !CLES[quoi] || etat[quoi] === v) return false;
    ecrire(quoi, v);
    etat[quoi] = v;
    // sans choix explicite, les images suivent l'interface (lu au rechargement)
    if (quoi === 'interface') {
      if (global.location && global.location.reload) global.location.reload();
    } else {
      abonnes.forEach(function (f) { try { f(v); } catch (e) { /* un abonné cassé n'empêche pas les autres */ } });
    }
    return true;
  }

  /* Un sélecteur prêt à poser dans un entête : <select> EN / FR. */
  function selecteur(quoi, libelle) {
    var doc = global.document;
    var s = doc.createElement('select');
    s.className = 'langue-choix';
    s.setAttribute('aria-label', libelle || (quoi === 'images' ? 'Langue des images' : 'Langue'));
    s.setAttribute('data-brut', ''); // i18n.js ne traduit pas « English » / « Français »
    LANGUES.forEach(function (l) {
      var o = doc.createElement('option');
      o.value = l;
      o.textContent = quoi === 'images' ? l.toUpperCase() : NOMS[l];
      if (etat[quoi] === l) o.selected = true;
      s.appendChild(o);
    });
    s.addEventListener('change', function () { choisir(quoi, s.value); });
    return s;
  }

  /* Une page pose un emplacement, le socle y met le sélecteur :
   *   <span data-langue="interface"></span>   <span data-langue="images"></span>
   * Rien d'autre à écrire dans la page — et la politique de sécurité, qui
   * refuse le JavaScript écrit dans le HTML, n'a rien à autoriser. */
  function monter() {
    var doc = global.document;
    Array.prototype.forEach.call(doc.querySelectorAll('[data-langue]'), function (el) {
      var quoi = el.getAttribute('data-langue');
      if (!CLES[quoi] || el.querySelector('select')) return;
      el.appendChild(selecteur(quoi));
    });
  }
  if (global.document) {
    if (global.document.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', monter);
    else monter();
  }

  var Langue = {
    LANGUES: LANGUES, CLES: CLES, DEFAUT_INTERFACE: DEFAUT_INTERFACE, DICOS: DICOS, conflits: conflits,
    interface: function () { return etat.interface; },
    images: function () { return etat.images; },
    choisir: choisir, surChangement: surChangement, selecteur: selecteur, monter: monter,
    declarer: declarer, mot: mot, n: n,
    nombre: nombre, km: km, m: m, date: date, mois: mois, locale: locale
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = Langue;
  else global.Langue = Langue;
})(this);
