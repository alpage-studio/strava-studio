/* apercus-catalogue.js — le CATALOGUE des rendus à produire pour la revue.
 *
 * Il vit à la RACINE et non dans tools/ : le serveur de développement refuse
 * de servir tools/, et la galerie doit pouvoir le charger comme un script.
 *
 * Ce fichier ne dessine rien : il décrit. Le navigateur le lit, rend chaque
 * entrée et la renvoie au serveur de développement, qui l'écrit dans
 * apercus/. La galerie lit le même catalogue pour se construire.
 *
 * Un seul endroit décrit donc ce qui existe : la liste des rendus, leurs
 * options et leur libellé. Décrire deux fois — une pour la génération, une
 * pour la page — garantit qu'un jour l'une dise « Soleil » et l'autre
 * montre autre chose.
 *
 * JEUX DE DONNÉES
 *   formes   quatre parcours : boucle sinueuse, aller-retour, ouvert, huit
 *   semaine  cinq sorties, deux sports, deux portions partagées
 *   regions  deux régions éloignées
 *   annee    106 sorties sur une année
 *   huit     huit semaines, dont une vide et une sortie sans altitude
 *
 * On ne juge PAS toutes les compositions sur la même boucle : une planche
 * qui tient sur un cercle peut s'effondrer sur un aller-retour, et c'est
 * précisément ce qu'une revue doit montrer.
 */
(function (global) {
  'use strict';

  var SURCOUCHE = { fond: 'transparent', voile: 'bas', encre: '#F2EFE6' };

  var CATALOGUE = [
    /* ---------------- ENCRE ---------------- */
    { f: 'Encre', g: 'Original', n: 'Trait', d: 'ruban plein, épaisseur modulée',
      t: 'encre', o: {}, j: 'formes', i: 0 },
    { f: 'Encre', g: 'Original', n: 'Fibres', d: 'faisceau serré',
      t: 'encre', o: { interpretation: 'fibres' }, j: 'formes', i: 0 },
    { f: 'Encre', g: 'Original', n: 'Réserve', d: 'le parcours en papier',
      t: 'encre', o: { interpretation: 'reserve' }, j: 'formes', i: 3 },
    { f: 'Encre', g: 'Exploration', n: 'Fil', d: 'un seul trait net',
      t: 'encre', o: { interpretation: 'fil' }, j: 'formes', i: 2 },
    /* Sur une boucle très sinueuse, la borne de courbure plafonne l'écart
     * partout et la houle ne se voit pas : on la montre sur le parcours
     * ouvert, où elle a la place de s'ouvrir puis de revenir. */
    { f: 'Encre', g: 'Exploration', n: 'Courant', d: 'lignes qui s’ouvrent et se referment',
      t: 'encre', o: { interpretation: 'courant' }, j: 'formes', i: 2 },
    { f: 'Encre', g: 'Exploration', n: 'Pinceau', d: 'le geste, sur un aller-retour',
      t: 'encre', o: { interpretation: 'pinceau' }, j: 'formes', i: 1 },
    { f: 'Encre', g: 'Exploration', n: 'Pinceau · ouvert', d: 'deux extrémités franches',
      t: 'encre', o: { interpretation: 'pinceau' }, j: 'formes', i: 2 },
    { f: 'Encre', g: 'Support', n: 'Trait · surcouche', d: 'sur photo',
      t: 'encre', o: SURCOUCHE, j: 'formes', i: 0, photo: true },
    { f: 'Encre', g: 'Support', n: 'Trait · noir & blanc', d: 'rendu achromatique',
      t: 'encre', o: {}, j: 'formes', i: 0, nb: true },

    /* ---------------- STRATES ---------------- */
    { f: 'Strates', g: 'Original', n: 'Gravure', d: 'tiges verticales, échelles communes',
      t: 'strates', o: {}, j: 'huit' },
    { f: 'Strates', g: 'Original', n: 'Papier découpé', d: 'aplats sobres',
      t: 'strates', o: { finition: 'papier' }, j: 'huit' },
    { f: 'Strates', g: 'Exploration', n: 'Massif', d: 'couches rapprochées, aplats opaques',
      t: 'strates', o: { finition: 'massif' }, j: 'huit' },
    { f: 'Strates', g: 'Exploration', n: 'Massif · accent', d: 'une couche en rouille',
      t: 'strates', o: { finition: 'massif', accent: 3 }, j: 'huit' },
    { f: 'Strates', g: 'Exploration', n: 'Gravure continue', d: 'lignes déployées',
      t: 'strates', o: { finition: 'continue' }, j: 'huit' },
    { f: 'Strates', g: 'Exploration', n: 'Horizons', d: 'bandes fines, une partition',
      t: 'strates', o: { finition: 'horizons' }, j: 'huit' },
    { f: 'Strates', g: 'Support', n: 'Horizons · paysage', d: 'format large',
      t: 'strates', o: { finition: 'horizons' }, j: 'huit', taille: [1920, 1080] },

    /* ---------------- EMPREINTE ---------------- */
    { f: 'Empreinte', g: 'Original', n: 'Sceau', d: 'disque et contours',
      t: 'empreinte', o: {}, j: 'formes', i: 0 },
    { f: 'Empreinte', g: 'Original', n: 'Triptyque', d: 'trois sorties',
      t: 'empreinte', o: { composition: 'triptyque' }, j: 'formes' },
    { f: 'Empreinte', g: 'Original', n: 'Collection', d: 'chronologique',
      t: 'empreinte', o: { composition: 'collection' }, j: 'semaine' },
    { f: 'Empreinte', g: 'Exploration', n: 'Soleil', d: 'disque petit et décentré',
      t: 'empreinte', o: { composition: 'soleil' }, j: 'formes', i: 0 },
    { f: 'Empreinte', g: 'Exploration', n: 'Îlots', d: 'rouille, ocre, bleu',
      t: 'empreinte', o: { composition: 'ilots' }, j: 'formes' },
    { f: 'Empreinte', g: 'Exploration', n: 'Contre-empreinte', d: 'contours seuls',
      t: 'empreinte', o: { composition: 'contre' }, j: 'formes', i: 0 },
    { f: 'Empreinte', g: 'Exploration', n: 'Contre-empreinte · huit', d: 'un parcours qui se recoupe',
      t: 'empreinte', o: { composition: 'contre' }, j: 'formes', i: 3 },
    { f: 'Empreinte', g: 'Exploration', n: 'Sceau cerclé', d: 'cadre et titre sur l’arc',
      t: 'empreinte', o: { composition: 'cercle' }, j: 'formes', i: 0 },
    { f: 'Empreinte', g: 'Support', n: 'Contre · fond sombre', d: 'clair sur charbon',
      t: 'empreinte', o: { composition: 'contre', papier: '#191B18', encre: '#E8E4D9' },
      j: 'formes', i: 0 },
    { f: 'Empreinte', g: 'Support', n: 'Sceau · surcouche', d: 'sur photo',
      t: 'empreinte', o: { fond: 'transparent', voile: 'centre', encre: '#F2EFE6' },
      j: 'formes', i: 0, photo: true },

    /* ---------------- ATLAS ---------------- */
    { f: 'Atlas', g: 'Original', n: 'Complète', d: 'carte, profils, sept jours',
      t: 'atlas', o: {}, j: 'semaine' },
    { f: 'Atlas', g: 'Original', n: 'Épurée', d: 'carte et jours',
      t: 'atlas', o: { composition: 'epuree' }, j: 'semaine' },
    { f: 'Atlas', g: 'Exploration', n: 'Territoire', d: 'la carte domine, traits distincts',
      t: 'atlas', o: { composition: 'territoire' }, j: 'semaine' },
    { f: 'Atlas', g: 'Exploration', n: 'Carnet', d: 'cinq fiches d’activité',
      t: 'atlas', o: { composition: 'carnet' }, j: 'semaine' },
    { f: 'Atlas', g: 'Exploration', n: 'Archipel', d: 'un médaillon par région',
      t: 'atlas', o: { composition: 'archipel' }, j: 'regions' },
    { f: 'Atlas', g: 'Support', n: 'Territoire · paysage', d: 'recomposé en deux colonnes',
      t: 'atlas', o: { composition: 'territoire' }, j: 'semaine', taille: [1920, 1080] },
    { f: 'Atlas', g: 'Support', n: 'Complète · surcouche', d: 'sur photo',
      t: 'atlas', o: SURCOUCHE, j: 'semaine', photo: true },

    /* ---------------- MÉDAILLON ---------------- */
    { f: 'Médaillon', g: 'Original', n: 'Minéral', d: 'papier clair, tracé seul',
      t: 'medaillon', o: {}, j: 'formes', i: 0 },
    { f: 'Médaillon', g: 'Original', n: 'Nocturne', d: 'fond charbon',
      t: 'medaillon', o: { palette: 'nocturne' }, j: 'formes', i: 0 },
    { f: 'Médaillon', g: 'Original', n: 'Fragment', d: 'la trace déborde du cercle',
      t: 'medaillon', o: { cadrage: 58, decalage: -15 }, j: 'formes', i: 2 },
    { f: 'Médaillon', g: 'Support', n: 'Nocturne · surcouche', d: 'la fenêtre s’ouvre sur la photo',
      t: 'medaillon', o: { palette: 'nocturne', fond: 'transparent', voile: 'bas' },
      j: 'formes', i: 0, photo: true },

    /* ---------------- ALMANAC ---------------- */
    { f: 'Almanac', g: 'Original', n: 'Année', d: 'orbite = distance · surface = D+',
      t: 'almanac', o: {}, j: 'annee' },
    { f: 'Almanac', g: 'Original', n: 'Mois', d: 'une rotation, un mois',
      t: 'almanac', o: { echelleTemps: 'mois' }, j: 'annee' },
    { f: 'Almanac', g: 'Exploration', n: 'Gravity', d: 'orbite = D+ · surface = durée',
      t: 'almanac', o: { orbite: 'deniv', taille: 'duree', remarquables: 'deniv' }, j: 'annee' },
    { f: 'Almanac', g: 'Exploration', n: 'Une teinte par sport', d: 'la forme reste première',
      t: 'almanac', o: { couleur: 'sport' }, j: 'annee' },
    { f: 'Almanac', g: 'Support', n: 'Année · paysage', d: 'mémoires en colonne',
      t: 'almanac', o: {}, j: 'annee', taille: [1920, 1080] },
    { f: 'Almanac', g: 'Support', n: 'Année · carré', d: 'mémoires en colonne',
      t: 'almanac', o: {}, j: 'annee', taille: [1080, 1080] },
    { f: 'Almanac', g: 'Support', n: 'Année · noir & blanc', d: 'rampe de gris régulière',
      t: 'almanac', o: {}, j: 'annee', nb: true },
    { f: 'Almanac', g: 'Support', n: 'Année · surcouche', d: 'sur photo',
      t: 'almanac', o: { fond: 'transparent', voile: 'centre', encre: '#F2EFE6' },
      j: 'annee', photo: true }
  ];

  /* Un identifiant de fichier stable, dérivé du libellé : la galerie et la
   * génération le calculent de la même façon, donc ils ne peuvent pas
   * diverger. */
  function cle(e) {
    return (e.f + '-' + e.g + '-' + e.n)
      .toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  var JEUX = {
    formes:  ['demo-boucle.gpx', 'demo-aller.gpx', 'demo-ouvert.gpx', 'demo-croisements.gpx'],
    semaine: ['sem-lun.gpx', 'sem-mar.gpx', 'sem-jeu.gpx', 'sem-ven.gpx', 'sem-dim.gpx'],
    regions: ['sem-lun.gpx', 'sem-jeu.gpx', 'loin-a.gpx', 'loin-b.gpx'],
    huit:    ['sem-01.gpx', 'sem-02.gpx', 'sem-03.gpx', 'sem-04.gpx',
              'sem-05.gpx', 'sem-06.gpx', 'sem-07.gpx', 'sem-08.gpx'],
    annee:   null                       // chargé depuis exemple-annee.json
  };

  global.Apercus = { CATALOGUE: CATALOGUE, JEUX: JEUX, cle: cle };
}(typeof window !== 'undefined' ? window : globalThis));

if (typeof module !== 'undefined') module.exports = globalThis.Apercus;
