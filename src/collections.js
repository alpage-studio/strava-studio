/* collections.js — une collection = une palette nommée.
 *
 * Sans cette couche, chaque template porte ses propres couleurs : changer
 * d'identité voudrait dire toucher quinze fichiers. Ici une collection est
 * choisie une fois et s'applique à tous les templates qui déclarent des
 * options de couleur — c'est ce qui transforme une boîte à outils en
 * signature.
 *
 * Le contrat est volontairement minimal : une collection nomme quatre rôles.
 *   fond    l'aplat ou le haut du dégradé
 *   fond2   le bas du dégradé (vaut fond si absent)
 *   encre   le texte et les traits
 *   accent  l'unique couleur d'emphase
 *
 * La correspondance vers les clés d'option de chaque template est déclarée
 * dans ROLES : un template qui nomme ses options autrement reste libre.
 */
(function (global) {
  'use strict';

  var LIST = [
    { id: 'libre', name: 'Libre — réglages du template' },

    { id: 'ascension', name: 'Ascension',
      fond: '#1B1B3A', fond2: '#E98A7B', encre: '#FFFFFF', accent: '#E8FF54',
      note: 'nuit vers aube, l’encre blanche tient partout' },

    { id: 'papier', name: 'Papier',
      fond: '#F2F0EA', fond2: '#DCD7C9', encre: '#101010', accent: '#E5502D',
      note: 'crème et encre noire, le plus éditorial' },

    { id: 'ardoise', name: 'Ardoise',
      fond: '#14161A', fond2: '#05070B', encre: '#F4F4F2', accent: '#E8FF54',
      note: 'sombre et froid, pour les traces seules' },

    { id: 'moutarde', name: 'Moutarde',
      fond: '#C9B10E', fond2: '#A8930B', encre: '#101010', accent: '#101010',
      note: 'aplat saturé, encre noire — frontal' },

    { id: 'brume', name: 'Brume',
      fond: '#AFC0CE', fond2: '#8899A8', encre: '#101418', accent: '#1F4E6B',
      note: 'bleu délavé, lisible en plein soleil' },

    { id: 'alpage', name: 'Alpage',
      fond: '#F2EFE6', fond2: '#E4DFD2', encre: '#242820', accent: '#A54F37',
      note: 'papier, encre et rouille — la palette de la collection' },

    { id: 'braise', name: 'Braise',
      fond: '#2B0F12', fond2: '#8C2F1E', encre: '#F7EDE4', accent: '#F2A65A',
      note: 'chaud et dense, pour les fins de journée' }
  ];

  /* Quel rôle nourrit quelle option, par template.
   * Une clé absente laisse l'option du template intacte. */
  var ROLES = {
    'sommet-ligne':   { haut: 'fond', bas: 'fond2', encre: 'encre' },
    'sommet-barres':  { haut: 'fond', bas: 'fond2', encre: 'encre' },
    'editorial':      { fond: 'fond', carte: 'fond2', encre: 'encre', accent: 'accent' },
    'trace':          { accent: 'accent' },
    'chiffres':       { papier: 'fond', encre: 'encre', accent: 'accent' },
    'pente':          { fond: 'fond', fond2: 'fond2', encre: 'encre' },
    'radiale':        { fond: 'fond', fond2: 'fond2', encre: 'encre', accent: 'accent' },
    'allumettes':     { fond: 'fond', encre: 'encre', accent: 'accent' },
    /* Les planches ajoutées ensuite. Une collection qui ne piloterait que la
     * moitié du catalogue ne serait plus une signature : changer d'identité
     * laisserait la série et le métro dans l'ancienne. */
    'mots':           { fond: 'fond', encre: 'encre', accent: 'accent' },
    'ressenti':       { fond: 'fond', encre: 'encre', accent: 'accent' },
    'film':           { fond: 'fond', encre: 'encre', accent: 'accent' },
    'serie':          { fond: 'fond', encre: 'encre' },
    'metro':          { fond: 'fond', encre: 'encre' },
    'saisons':        { fond: 'fond', encre: 'encre' },
    'tissage':        { fond: 'fond', encre: 'encre', accent: 'accent' },
    'fresque':        { fond: 'fond', encre: 'encre' },
    'exploration':    { fond: 'fond', encre: 'encre', accent: 'accent' },
    'partition':      { fond: 'fond', encre: 'encre', accent: 'accent' },
    'musee':          { fond: 'fond', encre: 'encre', accent: 'accent' },
    /* Les six planches Alpage. Elles nomment leur papier « papier » et non
     * « fond » : le rôle de collection reste le même, seule la clé change. */
    'encre':          { papier: 'fond', encre: 'encre' },
    'strates':        { papierC: 'fond', encre: 'encre', accentC: 'accent' },
    'empreinte':      { papier: 'fond', encre: 'encre', accentC: 'accent' },
    'atlas':          { papier: 'fond', encre: 'encre', accentC: 'accent' },
    'medaillon':      { accentC: 'accent' },
    'almanac':        { papier: 'fond', encre: 'encre', accentC: 'accent' }
  };

  function get(id) {
    for (var i = 0; i < LIST.length; i++) if (LIST[i].id === id) return LIST[i];
    return LIST[0];
  }

  /* Applique une collection aux valeurs d'options d'un template.
   * Ne touche qu'aux clés déclarées dans ROLES : tout le reste (choix de
   * série, bascules, chiffre héros) reste à l'utilisateur. */
  function apply(templateId, values, collectionId) {
    var col = get(collectionId);
    if (!col || col.id === 'libre') return values;
    var map = ROLES[templateId];
    if (!map) return values;
    var out = {};
    Object.keys(values || {}).forEach(function (k) { out[k] = values[k]; });
    Object.keys(map).forEach(function (optKey) {
      var role = map[optKey];
      var v = col[role] || (role === 'fond2' ? col.fond : null);
      if (v) out[optKey] = v;
    });
    return out;
  }

  /* Les clés qu'une collection pilote : le panneau les grise plutôt que de
   * laisser croire qu'elles sont encore réglables. */
  function driven(templateId, collectionId) {
    var col = get(collectionId);
    if (!col || col.id === 'libre') return {};
    return ROLES[templateId] || {};
  }

  global.Collections = { list: LIST, get: get, apply: apply, driven: driven, ROLES: ROLES };
}(window));
