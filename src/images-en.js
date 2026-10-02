/* images-en.js — CE QUE LES PLANCHES GRAVENT, EN ANGLAIS.
 *
 * POURQUOI UN FICHIER À PART DU DICTIONNAIRE DE L'INTERFACE.
 *
 *   Ce sont deux langues réglables séparément. On peut vouloir le studio en
 *   anglais et des affiches en français — c'est même le cas le plus courant
 *   pour qui roule en Suisse romande et partage à l'étranger. Deux réglages,
 *   deux dictionnaires : `Langue.DICOS` ici, `I18N.DICOS` pour l'interface.
 *
 *   Et les clés s'y contrediraient. « Papier » est un support dans
 *   l'interface ; « PAPIER » pourrait être un mot gravé. Les clés sont
 *   exactes et sensibles à la casse, donc les deux familles ne se marchent
 *   pas dessus — à condition de ne pas les mélanger dans le même objet.
 *
 * LA CLÉ EST LE FRANÇAIS, ET CE N'EST PAS UN HASARD.
 *
 *   `Langue.mot` retombe sur la clé quand elle n'a pas de traduction. Une
 *   planche non encore convertie continue donc d'écrire exactement ce qu'elle
 *   écrivait, et on traduit par groupes sans jamais casser les autres. Le jour
 *   où les trente-sept y sont passées, ce fichier est la liste complète de ce
 *   que le studio grave.
 *
 * CE QU'ON NE MET PAS ICI.
 *
 *   Ni les libellés de réglage — ils sont dans l'interface —, ni les noms des
 *   planches. Rien qui ne soit pas dessiné DANS l'image.
 *
 * LE CARNET DÉCLARE LES SIENNES.
 *
 *   Il a posé une soixantaine de clés avant nous : « KILOMÈTRES », « DÉPART »,
 *   « ARRIVÉE », « ÉTAPE », « NUIT », « PLAN »… Une clé traduite deux fois
 *   différemment est refusée par `Langue.declarer`, qui garde la première et
 *   note l'autre dans `Langue.conflits`. Quand une clé est commune, on reprend
 *   SA traduction : deux outils de la même suite ne peuvent pas appeler la
 *   même chose de deux noms.
 */
(function (global) {
  'use strict';

  if (!global.Langue) return;   // socle absent : les planches gardent le français

  global.Langue.declarer('en', {
    /* ---------- les mesures, partagées par presque toutes les planches ---------- */
    'distance': 'distance',
    'distance totale': 'total distance',
    'en mouvement': 'moving time',
    'dénivelé': 'elevation gain',
    'dénivelé positif': 'elevation gain',
    'vitesse': 'speed',
    'vitesse moyenne': 'average speed',
    'pente max': 'max gradient',
    'total': 'total',
    'coût total': 'total cost',
    'd+': 'elev. gain',
    'D+': 'ELEV. GAIN',
    'Temps': 'Time',
    'temps': 'time',
    'Vitesse': 'Speed',
    'FC moy.': 'avg HR',
    'date': 'date',
    'KM': 'KM',

    /* « m D+ » colle au chiffre : c'est l'unité, pas une phrase. Le gabarit
     * garde le nombre à sa place, et l'anglais dit « m climbed » là où le
     * français dit « m D+ ». Recoller « + ' m D+' » aurait rendu la chose
     * intraduisible. */
    '{n} m D+': '{n} m climbed',
    '{n} D+': '{n} CLIMBED',

    /* ---------- les pluriels ----------
     * Zéro est SINGULIER en français (« 0 sortie ») et PLURIEL en anglais
     * (« 0 rides »). C'est `Intl.PluralRules` qui tranche, pas un `> 1`. */
    '{n} sortie': '{n} ride',
    '{n} sorties': '{n} rides',
    '{n} ligne': '{n} line',
    '{n} lignes': '{n} lines',
    '{n} station': '{n} stop',
    '{n} stations': '{n} stops',
    '{n} semaine': '{n} week',
    '{n} semaines': '{n} weeks',
    '{n} passage': '{n} passage',
    '{n} passages': '{n} passages',
    '{n} couche': '{n} layer',
    '{n} couches': '{n} layers',
    '{n} contribution': '{n} contribution',
    '{n} contributions': '{n} contributions',

    /* ---------- ce qui dit QUOI FAIRE quand la planche n'a rien à dessiner ----
     * Ces messages ne se taisent jamais — voir le réglage « Texte ». Les
     * traduire est donc d'autant plus nécessaire : ce sont eux qu'on lit quand
     * on ne comprend pas ce qui se passe. */
    'Charge une sortie': 'Load a ride',
    'Charge une sortie avec une trace': 'Load a ride with a route',
    'Charge plusieurs sorties': 'Load several rides',
    'Charge au moins deux sorties': 'Load at least two rides',
    'Charge deux à quatre sorties': 'Load two to four rides',
    'Charge des sorties datées': 'Load rides with dates',
    'Charge des traces': 'Load routes',
    'Charge une semaine de sorties': 'Load a week of rides',
    'Charge la période à analyser': 'Load the period to analyse',

    'cette planche en assemble deux ou plus': 'this plate joins two or more',
    'cette planche compare des passages au même endroit':
      'this plate compares passages through the same place',
    'un réseau demande plusieurs lignes': 'a network needs several lines',
    'le tissage range les jours en semaines — il lui faut des dates':
      'the weave sorts days into weeks — it needs dates',
    'chacune prolongera la précédente': 'each one continues the last',
    'le médaillon est une fenêtre sur le lieu parcouru':
      'the medallion is a window onto the place you rode',
    'le film se construit à partir du parcours': 'the film is built from the route',
    'la partition se lit dans le relief et la cadence':
      'the score is read from the terrain and the cadence',
    'l’Atlas range les sorties du lundi au dimanche':
      'the Atlas sorts rides from Monday to Sunday',
    'Almanac dessine la structure d’une période, pas une sortie':
      'Almanac draws the shape of a period, not of one ride',
    'elle sera comparée à l’historique de ce navigateur':
      'it will be compared with this browser’s history',

    /* ---------- ce qui dit POURQUOI la planche refuse ---------- */
    'Cette sortie n’a pas d’altitude': 'This ride has no elevation',
    'Cette sortie n’a pas de trace': 'This ride has no route',
    'Cette sortie n’a pas de puissance': 'This ride has no power',
    'Cette sortie n’a pas d’horodatage': 'This ride has no timestamps',
    'Cette sortie est trop régulière pour être découpée':
      'This ride is too even to be cut up',
    'Encre dessine le parcours, pas ses chiffres':
      'Ink draws the route, not its figures',
    'Empreinte fabrique son sceau à partir du parcours':
      'Imprint builds its seal from the route',
    'Sous-bois dessine le chemin parcouru : il lui faut des coordonnées':
      'Undergrowth draws the path you rode: it needs coordinates',
    'Trame tisse le parcours : il lui faut des coordonnées':
      'Weft weaves the route: it needs coordinates',
    'Pente lit la déclivité point par point : sans profil, elle n’a rien à montrer':
      'Gradient reads the slope point by point: without a profile it has nothing to show',
    'Versants découpe les montées et les descentes : il lui faut un profil':
      'Slopes cuts climbs from descents: it needs a profile',
    'Gravure d’altitude a besoin d’un profil : capteur barométrique ou GPS':
      'Elevation engraving needs a profile: barometric or GPS',
    'Il faut un capteur de puissance — depuis un GPX, les watts doivent y être écrits':
      'A power meter is needed — in a GPX, the watts must be written in',
    'Baisse le dénivelé minimal d’une phase, ou choisis une autre planche':
      'Lower the minimum climb of a phase, or pick another plate',
    'La partition graphique écrit le TEMPS : sans horloge, elle n’a pas d’axe':
      'The graphic score writes TIME: without a clock it has no axis',

    /* ---------- ce qui empêche de MAL LIRE : jamais tu, toujours traduit ---- */
    'PARCOURS TOURNÉ, NON DÉFORMÉ': 'ROUTE ROTATED, NOT DISTORTED',
    'COPIES DU MÊME PROFIL — PAS DES COURBES DE NIVEAU':
      'COPIES OF THE SAME PROFILE — NOT CONTOUR LINES',
    'PROFILS — ÉCHELLE VERTICALE COMMUNE': 'PROFILES — SHARED VERTICAL SCALE',
    'RÉSEAUX SÉPARÉS — LES CORRESPONDANCES DEMANDENT UN CADRAGE COMMUN':
      'SEPARATE NETWORKS — INTERCHANGES NEED A SHARED FRAME',
    'SANS ALTITUDE — EXCLUES DES PROFILS': 'NO ELEVATION — LEFT OUT OF THE PROFILES',
    'SAPINS DÉCORATIFS — AUCUNE POSITION RÉELLE · TRACÉ ET REPÈRES EXACTS':
      'DECORATIVE FIRS — NO REAL POSITION · ROUTE AND MARKERS EXACT',
    'TRACÉ SEUL': 'ROUTE ONLY',
    'GAMME PENTATONIQUE · LE SON NE DÉMARRE QUE SI TU LE DEMANDES':
      'PENTATONIC SCALE · SOUND ONLY STARTS IF YOU ASK',
    'NOUVEAU DANS TON HISTORIQUE CHARGÉ — LE STUDIO NE CONNAÎT QUE CE QUE TU LUI AS DONNÉ':
      'NEW IN THE HISTORY YOU LOADED — THE STUDIO ONLY KNOWS WHAT YOU GAVE IT',
    'AJOUTE CES SORTIES À L’HISTORIQUE, PUIS REVIENS AVEC LA SEMAINE SUIVANTE':
      'ADD THESE RIDES TO THE HISTORY, THEN COME BACK WITH THE NEXT WEEK',
    'CERCLE POINTILLÉ = MESURE NON RENSEIGNÉE · LES VIDES SONT DES VIDES RÉELS':
      'DOTTED CIRCLE = MEASURE NOT RECORDED · THE GAPS ARE REAL GAPS',
    'COMPOSITION GRAPHIQUE — LES TRACES SONT DÉPLACÉES, TOURNÉES ET MISES À L’ÉCHELLE. CE N’EST PAS UN ITINÉRAIRE.':
      'GRAPHIC COMPOSITION — THE ROUTES ARE MOVED, ROTATED AND SCALED. THIS IS NOT AN ITINERARY.',
    'sans altitude exploitable : seul le paysage ressenti est dessiné':
      'no usable elevation: only the felt landscape is drawn',
    'aucune sortie enregistrée cette semaine-là': 'no ride recorded that week',
    'le vide est une donnée : rien n’est fabriqué pour remplir la page':
      'emptiness is data: nothing is invented to fill the page',
    'aucune trace GPS cette semaine': 'no GPS route this week',
    'ne passe pas ici': 'does not pass here',
    'aucun historique : cette importation devient la référence':
      'no history: this import becomes the reference',

    /* ---------- les légendes qui nomment ce que le dessin encode ---------- */
    'chaîne nue': 'bare warp',
    'trame hachurée': 'hatched weft',
    'amplitude': 'amplitude',
    'pulsation': 'pulse',
    'mélodie': 'melody',
    'pauses': 'stops',
    'réseau': 'network',
    'lignes': 'lines',
    'correspondances': 'interchanges',
    'nouveaux': 'new',
    'sur': 'of',
    'référence': 'reference',
    'allumettes': 'matches',
    'allumettes brûlées': 'matches burned',
    'DISTANCE RÉELLE, EN KM · ': 'REAL DISTANCE, IN KM · ',
    'FENÊTRE DE ': 'WINDOW OF ',
    'TROIS MOTS, À TOI': 'THREE WORDS, YOURS',

    /* ---------- les titres par défaut ----------
     * Ce ne sont pas des noms propres : ce sont les mots que la planche se
     * donne quand l'auteur n'en a pas choisi. Ils se traduisent. */
    'Réseau': 'Network',
    'Le même endroit': 'The same place',
    'Le relief': 'The terrain',
    'Ce que ça a coûté': 'What it cost',
    'Semaine {n}': 'Week {n}',
    'Territoires blancs': 'Blank territories',
    'La référence': 'The reference',

    /* ---------- les unités écrites en toutes lettres ---------- */
    'kilomètres': 'kilometres',
    'mètres D+': 'metres climbed',
    'mètres de dénivelé': 'metres of climbing',
    'de mouvement': 'of moving time',
    'kilomètres parcourus': 'kilometres ridden',

    /* ---------- les huit mises en page venues de design/ ---------- */
    'Sortie': 'Ride',
    'allure moyenne': 'average pace',
    'altitude max': 'max elevation',
    'm D+': 'm climbed',
    'M': 'M',
    '{n} M': '{n} M',

    /* ---------- Métro : les stations ---------- */
    'Départ / Arrivée': 'Start / Finish',
    'Départ': 'Start',
    'Arrivée': 'Finish',

    /* ---------- Almanac : les sports ---------- */
    'vélo de route': 'road cycling',
    'vtt': 'mountain biking',
    'course à pied': 'running',
    'randonnée': 'hiking',
    'ski': 'skiing',
    'autre': 'other',

    /* ---------- Gravure, Allumettes ---------- */
    'COPIES DU MÊME PROFIL — PAS DES COURBES DE NIVEAU · VERTICALE EXAGÉRÉE':
      'COPIES OF THE SAME PROFILE — NOT CONTOUR LINES · VERTICAL EXAGGERATED',
    '{bas} À {haut} M': '{bas} TO {haut} M',
    'aucune donnée d’effort sur cette sortie': 'no effort data on this ride',

    /* ---------- Almanac : la légende du cadran ---------- */
    'distance (km)': 'distance (km)',
    'dénivelé (m)': 'climbing (m)',
    'durée (h)': 'duration (h)',

    /* ---------- Strates : l'axe et la nature du dessin ---------- */
    'ALTITUDE ABSOLUE · {bas} À {haut} M': 'ABSOLUTE ELEVATION · {bas} TO {haut} M',
    'VARIATION DEPUIS LE DÉPART · ±{n} M': 'CHANGE FROM THE START · ±{n} M',
    'TRAITEMENT GRAPHIQUE DES PROFILS, PAS UN RELIEF EN TROIS DIMENSIONS':
      'GRAPHIC TREATMENT OF THE PROFILES, NOT A THREE-DIMENSIONAL TERRAIN',
    'COMPOSITION DE PROFILS SUPERPOSÉS': 'COMPOSITION OF STACKED PROFILES',
    'ANGLE : POSITION DANS LA PÉRIODE · RAYON : {r} (ÉCHELLE LINÉAIRE) · SURFACE : {s}':
      'ANGLE: POSITION IN THE PERIOD · RADIUS: {r} (LINEAR SCALE) · AREA: {s}',
    '{n} MARQUES SE CHEVAUCHENT — RÉDUIS LA PÉRIODE OU FILTRE PAR SPORT':
      '{n} MARKS OVERLAP — SHORTEN THE PERIOD OR FILTER BY SPORT',

    /* ---------- Tissage, Partition : ce que la légende nomme ---------- */
    'aucune activité enregistrée ce jour-là': 'no activity recorded that day',
    'activité sans altitude': 'activity without elevation',
    'dénivelé réel, échelle commune': 'real climbing, shared scale',
    'pulsation conventionnelle — un choix, pas une mesure':
      'conventional pulse — a choice, not a measurement',
    'altitude de la trace': 'elevation of the route',
    'identifiées par l’horodatage': 'found from the timestamps',
    'non identifiables': 'not identifiable',

    /* ---------- les derniers avertissements ---------- */
    'SAPINS DÉCORATIFS — AUCUNE POSITION RÉELLE · TRAIT LÉGÈREMENT TREMBLÉ':
      'DECORATIVE FIRS — NO REAL POSITION · SLIGHTLY SHAKEN LINE',
    'LIGNES DÉCALÉES DU PARCOURS — CE NE SONT PAS DES COURBES D’ALTITUDE':
      'LINES OFFSET FROM THE ROUTE — THESE ARE NOT CONTOUR LINES',
    'Il faut un capteur de puissance — depuis un GPX, Strava ou intervals.icu':
      'A power meter is needed — from a GPX, Strava or intervals.icu',
    '{m} MONTÉES · {d} DESCENTES — PHASES D’AU MOINS {s} M · LA PENTE SERRE LES HACHURES, ELLE NE DIT AUCUNE DIFFICULTÉ':
      '{m} CLIMBS · {d} DESCENTS — PHASES OF AT LEAST {s} M · GRADIENT TIGHTENS THE HATCHING, IT SAYS NOTHING OF DIFFICULTY',

    /* ---------- Ressenti : le diptyque et son avertissement ---------- */
    'RELIEF RÉEL': 'REAL TERRAIN',
    'altitude mesurée': 'measured elevation',
    'RELIEF RESSENTI': 'FELT TERRAIN',
    'hauteur expressive — ce n’est pas une altitude':
      'expressive height — this is not an elevation',

    /* ---------- phrases dont le nombre est AU MILIEU ----------
     * « FENÊTRE DE » + nombre + « M DE CÔTÉ » donnait, en anglais,
     * « WINDOW OF 1800 M DE CÔTÉ » : une moitié traduite. */
    'FENÊTRE DE {m} M DE CÔTÉ · MÊME CADRAGE SUR TOUS LES PANNEAUX':
      '{m} M WINDOW · SAME FRAME ON EVERY PANEL',
    'SURFACE DES DISQUES ∝ TEMPS EN MOUVEMENT · CERCLE VIDE = AUCUNE ACTIVITÉ ENREGISTRÉE':
      'DISC AREA ∝ MOVING TIME · EMPTY CIRCLE = NO ACTIVITY RECORDED',
    'TRAIT NET — ÉPAISSEUR CONSTANTE': 'CLEAN LINE — CONSTANT WIDTH',
    'ÉPAISSEUR CONSTANTE': 'CONSTANT WIDTH',
    'ÉPAISSEUR : COURBURE DU PARCOURS — EFFET DE STYLE':
      'WIDTH: CURVATURE OF THE ROUTE — A STYLE EFFECT',
    'ÉCHELLES COMMUNES — LES LARGEURS ET LES HAUTEURS SE COMPARENT':
      'SHARED SCALES — WIDTHS AND HEIGHTS COMPARE',
    'LARGEURS NORMALISÉES — LES DISTANCES NE SE COMPARENT PAS':
      'WIDTHS NORMALISED — DISTANCES DO NOT COMPARE'
  });
}(window));
