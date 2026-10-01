/* noms.js — des noms de lieux en français, pour les repères Komoot.
 *
 * Komoot écrit ses « highlights » en anglais : « Chanrion Hut », « Mauvoisin
 * Dam », « Hike-a-bike section ». Ce fichier PROPOSE un nom français ; il ne
 * l'impose jamais. L'écran « Le voyage » montre la proposition à côté du nom
 * d'origine, et c'est la personne qui la retient ou non.
 *
 * Les règles sont peu nombreuses et volontairement prudentes : un nom qu'aucune
 * ne reconnaît est rendu TEL QUEL. Mieux vaut un nom anglais juste qu'un nom
 * français inventé — « Monte Mottetta Hut » est un refuge italien, et l'appeler
 * « Cabane » serait faux de l'autre côté de la frontière.
 */
(function (global) {
  'use strict';

  // « de » devant une voyelle s'élide ; devant « Le / Les », il se contracte
  function de(nom) {
    if (/^Le\s/.test(nom)) return 'du ' + nom.slice(3);
    if (/^Les\s/.test(nom)) return 'des ' + nom.slice(4);
    if (/^La\s|^L’|^L'/.test(nom)) return 'de ' + nom;
    if (/^[AEIOUYÂÊÎÔÛÉÈH]/i.test(nom)) return 'd’' + nom;
    return 'de ' + nom;
  }

  // des noms propres qui ont un usage établi en français
  var PROPRES = [
    [/\bGreat St\.? Bernard\b/i, 'Grand-Saint-Bernard'],
    [/\bLittle St\.? Bernard\b/i, 'Petit-Saint-Bernard'],
    [/\bLake Geneva\b/i, 'Léman'],
    [/\bMatterhorn\b/i, 'Cervin']
  ];

  // [motif, fabrique] — le premier qui reconnaît le nom gagne
  var REGLES = [
    [/^hike-?a-?bike( section)?$/i, function () { return 'Portage'; }],
    [/^sos shelter$/i, function () { return 'Abri de secours'; }],
    [/^(view ?point|lookout|panorama)$/i, function () { return 'Point de vue'; }],
    [/^singletrack on the slopes below (.+)$/i, function (m) { return 'Sentier sous ' + article(m[1]); }],
    [/^singletrack(?: to| towards)? (.+)$/i, function (m) { return 'Sentier vers ' + m[1]; }],
    [/^(.+) summit$/i, function (m) { return /^(Mont|Pic|Pointe|Dent|Tête|Aiguille|Piz|Monte|Cima)\b/.test(m[1]) ? m[1] : 'Sommet ' + de(m[1]); }],
    [/^(.+) pass$/i, function (m) { return 'Col ' + de(m[1]); }],
    [/^(.+) hospice$/i, function (m) { return 'Hospice ' + de(m[1]).replace(/^de /, 'du '); }],
    [/^(.+) lakes$/i, function (m) { return 'Lacs ' + de(m[1]); }],
    [/^(.+) lake$/i, function (m) { return 'Lac ' + de(m[1]); }],
    [/^lake (.+)$/i, function (m) { return 'Lac ' + de(m[1]); }],
    [/^(.+) dam$/i, function (m) { return 'Barrage ' + de(m[1]); }],
    [/^(.+) bridge$/i, function (m) { return 'Pont ' + de(m[1]); }],
    [/^(.+) waterfall$/i, function (m) { return 'Cascade ' + de(m[1]); }],
    [/^(.+) gorge$/i, function (m) { return 'Gorges ' + de(m[1]); }],
    [/^(.+) chapel$/i, function (m) { return 'Chapelle ' + de(m[1]); }],
    [/^(.+) church$/i, function (m) { return 'Église ' + de(m[1]); }],
    [/^(.+) castle$/i, function (m) { return 'Château ' + de(m[1]); }],
    // une « hut » n'est une cabane qu'en Suisse romande : un nom italien
    // (Monte, Rifugio, Alpe…) reste un refuge
    [/^(.+) hut$/i, function (m) { return /^(Monte|Rifugio|Alpe|Col|Lago)\b/.test(m[1]) ? 'Refuge ' + de(m[1]) : 'Cabane ' + de(m[1]); }]
  ];

  // « Pointe de Toules » → « la Pointe de Toules » ; un nom sans genre connu reste nu
  function article(nom) {
    if (/^(Pointe|Dent|Tête|Aiguille|Croix|Montagne|Combe|Forêt)\b/.test(nom)) return 'la ' + nom;
    if (/^(Mont|Pic|Col|Lac|Glacier|Bois|Sommet)\b/.test(nom)) return 'le ' + nom;
    return nom;
  }

  function proposer(nom) {
    var n = String(nom || '').trim();
    if (!n) return n;
    PROPRES.forEach(function (p) { n = n.replace(p[0], p[1]); });
    for (var i = 0; i < REGLES.length; i++) {
      var m = REGLES[i][0].exec(n);
      if (m) return REGLES[i][1](m);
    }
    return n;
  }

  var Noms = { proposer: proposer };
  if (typeof module !== 'undefined' && module.exports) module.exports = Noms;
  else global.Noms = Noms;
})(this);
