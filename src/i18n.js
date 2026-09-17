/* i18n.js — la langue de l'interface.
 *
 * PRINCIPE : le code reste écrit en français. Les libellés des templates,
 * les titres de sections, les boutons : tout est déclaré en français dans
 * les fichiers, et c'est cette chaîne-là qui sert de CLÉ.
 *
 * Pourquoi pas des clés abstraites (`opt.thickness`) ? Parce qu'une clé
 * abstraite oblige à tenir deux fichiers pour lire une seule phrase, et
 * qu'un template écrit par quelqu'un d'autre n'aurait plus de libellé du
 * tout tant que personne n'aurait rempli le dictionnaire. Ici, une chaîne
 * absente du dictionnaire s'affiche en français : l'interface reste
 * complète, seulement moins traduite. C'est une dégradation, pas une
 * panne.
 *
 * DEUX CHEMINS, parce qu'il y a deux sortes de texte :
 *   - le texte STATIQUE d'index.html : traduit une fois au chargement, en
 *     parcourant les nœuds de texte (appliquer()) ;
 *   - le texte DYNAMIQUE construit par app.js depuis les templates : il
 *     passe par T() au moment où il est écrit.
 *
 * La langue par défaut est l'ANGLAIS : le studio se partage, et un visiteur
 * qui ne lit pas le français n'a aucun moyen de deviner « Épaisseur par ».
 * Le choix est retenu dans ce navigateur.
 */
(function (global) {
  'use strict';

  var CLE = 'strava-studio-langue';

  /* ------------------------------------------------------------------ *
   *  ANGLAIS                                                            *
   * ------------------------------------------------------------------ */
  var EN = {
    /* ---------- l'interface ---------- */
    'tes données, tes templates, ton code': 'your data, your templates, your code',
    'Galerie': 'Gallery',
    'Depuis ta dernière visite': 'Since your last visit',
    'Voir': 'See',
    'Masquer': 'Hide',
    'version': 'version',
    'versions': 'versions',
    'Activité': 'Activity',
    'Strava — vérification…': 'Strava — checking…',
    'Rafraîchir la liste': 'Refresh the list',
    'Connecter': 'Connect',
    'Où trouver la clé, et où elle va': 'Where to find the key, and where it goes',
    'Elle se génère dans': 'Generate it in',
    '. Elle reste': '. It stays',
    'dans ce navigateur': 'in this browser',
    ', n’est envoyée qu’à intervals.icu, et disparaît à la fermeture de l’onglet.':
      ', is only ever sent to intervals.icu, and disappears when you close the tab.',
    'Oublier la clé': 'Forget the key',
    'Clé intervals.icu': 'intervals.icu key',
    'Importer une sortie': 'Import a ride',
    'Corriger ou saisir à la main': 'Correct or enter by hand',
    'Distance (km)': 'Distance (km)',
    'D+ (m)': 'Elev. gain (m)',
    'Style': 'Style',
    'Collection': 'Collection',
    'Minimaliste — tracé seul': 'Minimal — route only',
    'Teintes': 'Tones',
    'Couleur': 'Colour',
    'Noir & blanc': 'Black & white',
    'Photo aussi en N&B': 'Photo in B&W too',
    'Support': 'Surface',
    'Fond plein — affiche': 'Solid ground — poster',
    'Papier ou sombre': 'Paper or dark',
    'Sans fond — sur ta photo': 'No ground — over your photo',
    'Ajouter une photo': 'Add a photo',
    'Ajouter une vidéo': 'Add a video',
    'Aperçu sur': 'Preview over',
    'Damier (alpha)': 'Checkerboard (alpha)',
    'Fond clair': 'Light ground',
    'Fond sombre': 'Dark ground',
    'Retirer la photo': 'Remove the photo',
    'Story — 1080 × 1920': 'Story — 1080 × 1920',
    'Post — 1080 × 1350': 'Post — 1080 × 1350',
    'Carré — 1080 × 1080': 'Square — 1080 × 1080',
    'Paysage — 1920 × 1080': 'Landscape — 1920 × 1080',
    'Impression A4 — 2480 × 3508 (300 dpi)': 'Print A4 — 2480 × 3508 (300 dpi)',
    'Impression A3 — 3508 × 4961 (300 dpi)': 'Print A3 — 3508 × 4961 (300 dpi)',
    'Enregistrer l’image': 'Save the image',
    'Enregistrer': 'Save',
    'Lire l’aperçu': 'Play the preview',
    'Arrêter l’aperçu': 'Stop the preview',
    'Aperçu': 'Preview',
    'Arrêter': 'Stop',
    '▶ Écouter': '▶ Listen',
    'Pause': 'Pause',
    'Stop': 'Stop',
    'Exporter le son (WAV)': 'Export the sound (WAV)',
    'Vidéo — le tracé s’anime': 'Video — the route draws itself',
    'Vidéo': 'Video',
    'Séquence PNG — pour le montage': 'PNG sequence — for editing',
    'Séquence': 'Sequence',
    'Donne une forme à tes sorties.': 'Give your rides a shape.',
    'Une trace GPX devient une affiche, une estampe ou une carte.':
      'A GPX trace becomes a poster, a print or a map.',
    'Voir avec une sortie d’exemple': 'See it with a sample ride',
    'Voir d’autres exemples': 'See other examples',
    'Voir avec trois sorties — planches multiples': 'See it with three rides — multi-ride plates',
    'Voir avec huit semaines — tissage': 'See it with eight weeks — weave',
    'Voir une année — Almanac': 'See a whole year — Almanac',
    'Quatre formes de parcours — revue': 'Four route shapes — review set',
    'Une semaine partagée — Atlas': 'A shared week — Atlas',
    'Deux régions éloignées — Archipel': 'Two distant regions — Archipelago',
    'Créer une pièce de musée': 'Create a museum piece',
    'Titre de la pièce': 'Title of the piece',
    'Cartel — quelques lignes, de ta main': 'Wall label — a few lines, in your own words',
    'Sauvegarder la collection': 'Save the collection',
    'Restaurer': 'Restore',
    'Ajouter ces sorties à l’historique': 'Add these rides to the history',
    'Effacer l’historique': 'Clear the history',
    'Enregistrer le projet': 'Save the project',
    'Rouvrir un projet': 'Reopen a project',
    'Réglages fins': 'Fine settings',

    /* ---------- réglages communs ---------- */
    'Composition': 'Composition',
    'Titre': 'Title',
    'Titre (facultatif)': 'Title (optional)',
    'Temps': 'Time',
    'Fond': 'Ground',
    'Papier': 'Paper',
    'Encre': 'Ink',
    'Grain': 'Grain',
    'Grain du papier': 'Paper grain',
    'Papier — affiche': 'Paper — poster',
    'Transparent — à poser sur une photo': 'Transparent — to lay over a photo',
    'Voile (surcouche)': 'Scrim (overlay)',
    'Voile': 'Scrim',
    'Aucun': 'None',
    'Aucune': 'None',
    'Depuis le bas': 'From the bottom',
    'Depuis le haut': 'From the top',
    'Autour du centre': 'Around the centre',
    'Échelle': 'Scale',
    'Échelles': 'Scales',
    'Mode': 'Mode',
    'Vue': 'View',
    'Photo': 'Photo',
    'Distance': 'Distance',
    'Dénivelé': 'Elevation gain',
    'Durée': 'Duration',
    'Vitesse': 'Speed',
    'Puissance': 'Power',
    'Allure': 'Pace',
    'Fréquence cardiaque': 'Heart rate',
    'Fréquence card.': 'Heart rate',
    'Automatique': 'Automatic',
    'Centré': 'Centred',
    'Rotation': 'Rotation',
    'Volume': 'Volume',
    'Carte': 'Map',
    'Graphique': 'Chart',
    'Accent': 'Accent',
    'Dégradé': 'Gradient',
    'Photo en fond': 'Photo as ground',
    'Afficher la date': 'Show the date',
    'Afficher les chiffres': 'Show the numbers',
    'Orientation': 'Orientation',
    'Nord en haut': 'North up',
    'Diagonale — rotation artistique': 'Diagonal — artistic rotation',
    'Au mieux du format': 'Best fit for the format',
    'Nombre de lignes': 'Number of lines',
    'Espacement': 'Spacing',
    'Écartement': 'Spread',
    'Palette': 'Palette',
    'Cadrage': 'Framing',
    'Cadrage — sous 100, la trace déborde': 'Framing — below 100, the route spills out',
    'Décalage horizontal': 'Horizontal offset',
    'Décalage vertical': 'Vertical offset',
    'Période': 'Period',
    'Portions': 'Segments',
    'Position (%)': 'Position (%)',
    'Seuil (% FTP)': 'Threshold (% FTP)',
    'Durée min. (s)': 'Min. duration (s)',
    'Durée (s)': 'Duration (s)',

    /* ---------- Encre ---------- */
    'Encre — le geste du terrain': 'Ink — the gesture of the terrain',
    'Original · Trait — ruban plein': 'Original · Stroke — solid ribbon',
    'Original · Fibres — filaments': 'Original · Fibres — filaments',
    'Original · Réserve — parcours en clair': 'Original · Reserve — route left blank',
    'Exploration · Fil — un seul trait net': 'Exploration · Thread — a single clean line',
    'Exploration · Courant — lignes qui s’ouvrent': 'Exploration · Current — lines that open and close',
    'Exploration · Pinceau — le geste': 'Exploration · Brush — the gesture',
    'Épaisseur': 'Thickness',
    'Matière': 'Texture',
    'Épaisseur par': 'Thickness driven by',
    'Courbure — un choix de style': 'Curvature — a stylistic choice',
    'Altitude — mesurée': 'Altitude — measured',
    'Puissance — mesurée': 'Power — measured',
    'Fréquence cardiaque — mesurée': 'Heart rate — measured',
    'Cadence — mesurée': 'Cadence — measured',
    'Épaisseur constante': 'Constant thickness',

    /* ---------- Strates ---------- */
    'Strates — les profils en massif': 'Strata — profiles as a massif',
    'Original · Gravure — reliefs en tiges': 'Original · Engraving — relief in stems',
    'Original · Papier découpé — aplats': 'Original · Cut paper — flat shapes',
    'Exploration · Massif — couches rapprochées': 'Exploration · Massif — layers packed close',
    'Exploration · Gravure continue — lignes déployées': 'Exploration · Continuous engraving — unfurled lines',
    'Exploration · Horizons — bandes fines': 'Exploration · Horizons — thin bands',
    'Comparer — échelles communes': 'Compare — shared scales',
    'Composer — largeurs normalisées': 'Compose — normalised widths',
    'Axe vertical': 'Vertical axis',
    'Variation depuis le départ': 'Change since the start',
    'Altitude absolue': 'Absolute altitude',
    'Couche en accent': 'Accented layer',
    'Dates en marge': 'Dates in the margin',

    /* ---------- Empreinte ---------- */
    'Empreinte — le sceau d’une sortie': 'Imprint — the seal of a ride',
    'Original · Sceau': 'Original · Seal',
    'Original · Triptyque': 'Original · Triptych',
    'Original · Collection': 'Original · Collection',
    'Exploration · Soleil — disque décentré': 'Exploration · Sun — off-centre disc',
    'Exploration · Îlots — trois aplats': 'Exploration · Islets — three flat shapes',
    'Exploration · Contre-empreinte — contours seuls': 'Exploration · Counter-imprint — contours only',
    'Exploration · Sceau cerclé': 'Exploration · Ringed seal',
    'Aplat': 'Flat shape',
    'Décalé en haut à gauche': 'Offset top left',
    'Décalé en bas à droite': 'Offset bottom right',
    'Aucun aplat': 'No flat shape',
    'Taille de l’aplat': 'Size of the flat shape',
    'Titre et date': 'Title and date',
    'Mention « pas des courbes »': 'Note: “not contour lines”',
    'Ordre (série)': 'Order (series)',
    'Chronologique': 'Chronological',
    'Ordre de la bibliothèque': 'Library order',
    'Échelle (collection)': 'Scale (collection)',
    'Taille uniforme — composition': 'Uniform size — composition',
    'Échelle géographique commune': 'Shared geographic scale',

    /* ---------- Atlas ---------- */
    'Atlas hebdomadaire — sept jours, un territoire': 'Weekly atlas — seven days, one territory',
    'Semaine (0 = la dernière)': 'Week (0 = the latest)',
    'Original · Complète — carte, profils, jours': 'Original · Full — map, profiles, days',
    'Original · Épurée — carte et jours': 'Original · Spare — map and days',
    'Exploration · Territoire — la carte domine': 'Exploration · Territory — the map dominates',
    'Exploration · Carnet — carte et fiches': 'Exploration · Notebook — map and cards',
    'Exploration · Archipel — un médaillon par région': 'Exploration · Archipelago — one medallion per region',
    'Couleurs': 'Colours',
    'Encre commune, une sortie en accent': 'Shared ink, one ride accented',
    'Une couleur par sortie — avec légende': 'One colour per ride — with a legend',
    'Sortie en accent': 'Accented ride',
    'Noms des régions (séparés par ;)': 'Region names (separated by ;)',

    /* ---------- Médaillon ---------- */
    'Médaillon — une fenêtre sur le lieu': 'Medallion — a window onto the place',
    'Minéral — papier clair': 'Mineral — light paper',
    'Nocturne — fond charbon': 'Nocturne — charcoal ground',
    'Graticule': 'Graticule',
    'Titre sur l’arc': 'Title along the arc',
    'Cartouche': 'Cartouche',

    /* ---------- Almanac ---------- */
    'Almanac — la forme d’une année': 'Almanac — the shape of a year',
    'Mois — une rotation, un mois': 'Month — one rotation, one month',
    'Année — une rotation, une année': 'Year — one rotation, one year',
    'Années — plusieurs systèmes côte à côte': 'Years — several systems side by side',
    'Orbite (rayon)': 'Orbit (radius)',
    'Taille (surface)': 'Size (area)',
    'À la périphérie': 'At the periphery',
    'Les plus longues': 'The longest',
    'Les plus montagneuses': 'The most mountainous',
    'Les plus longues en temps': 'The longest in time',
    'Monochrome — la forme dit le sport': 'Monochrome — shape tells the sport',
    'Une teinte par sport': 'One hue per sport',
    'Période (0 = la dernière)': 'Period (0 = the latest)',
    'Orbites de référence': 'Reference orbits',
    'Taille des symboles': 'Symbol size',

    /* ---------- Mots ---------- */
    'Sans chiffres — trois mots': 'No numbers — three words',
    'Trace seule': 'Route only',
    'Photo dominante': 'Photo-led',
    'Affiche typographique': 'Typographic poster',
    'Premier mot': 'First word',
    'Deuxième mot': 'Second word',
    'Troisième mot': 'Third word',

    /* ---------- Ressenti ---------- */
    'Relief ressenti — vécu contre mesuré': 'Felt relief — lived against measured',
    'Diptyque — réel et ressenti': 'Diptych — real and felt',
    'Relief ressenti seul': 'Felt relief only',
    'Relief réel seul': 'Real relief only',
    'Portion 1': 'Segment 1',
    'Portion 2': 'Segment 2',
    'Portion 3': 'Segment 3',
    'Portion 4': 'Segment 4',
    'Portion 5': 'Segment 5',
    'Suggérer depuis l’effort mesuré': 'Suggest from the measured effort',

    /* ---------- Film ---------- */
    'Film de sortie — 15 s, trois actes': 'Ride film — 15 s, three acts',
    'Storyboard': 'Storyboard',
    'Départ — le tracé se dessine': 'Start — the route draws itself',
    'Moment fort': 'High point',
    'Photo plein cadre': 'Full-frame photo',
    'Arrivée': 'Finish',
    'Bilan — trois chiffres': 'Summary — three figures',
    'Le point culminant': 'The highest point',
    'La plus longue ascension': 'The longest climb',
    'Une position que je choisis': 'A position I choose',
    'Texte — départ': 'Text — start',
    'Texte — moment fort': 'Text — high point',
    'Texte — arrivée': 'Text — finish',
    'Photo sur': 'Photo on',
    'La scène photo': 'The photo scene',
    'Le moment fort': 'The high point',
    'Nulle part': 'Nowhere',

    /* ---------- Série ---------- */
    'Série — grille de sorties': 'Series — a grid of rides',
    'Commune — tailles comparables': 'Shared — comparable sizes',
    'Par case — chaque trace remplit': 'Per cell — each route fills it',
    'Couleur par sortie': 'Colour per ride',
    'Distance et D+': 'Distance and elevation',

    /* ---------- Métro ---------- */
    'Métro — plusieurs sorties en réseau': 'Metro — several rides as a network',
    'Commun — un seul réseau': 'Shared — a single network',
    'Séparé — un réseau par sortie': 'Separate — one network per ride',
    'Détail du tracé': 'Route detail',
    'Correspondance (m)': 'Interchange (m)',
    'Stations au plus': 'Stations at most',
    'Renommer (dans l’ordre, séparés par ;)': 'Rename (in order, separated by ;)',
    'Légende des lignes': 'Line legend',
    'Totaux en pied': 'Totals at the foot',

    /* ---------- Saisons ---------- */
    'Saisons — le même endroit, plusieurs fois': 'Seasons — the same place, several times',
    'Diptyque': 'Diptych',
    'Grille de quatre': 'Grid of four',
    'Fondu animé — un seul cadre': 'Animated fade — a single frame',
    'Point de comparaison': 'Point of comparison',
    'Le lieu le plus partagé': 'The most shared place',
    'Le départ de la première sortie': 'The start of the first ride',
    'Le point culminant de la première': 'The high point of the first',
    'Position sur la 1re (%)': 'Position on the 1st (%)',
    'Fenêtre (m)': 'Window (m)',
    'Légendes (séparées par ;)': 'Captions (separated by ;)',
    'Photo sur le passage n°': 'Photo on pass no.',

    /* ---------- Tissage ---------- */
    'Tissage — les semaines en tapisserie': 'Weave — weeks as a tapestry',
    'Semaines affichées': 'Weeks shown',
    'Normalisation artistique': 'Artistic normalisation',
    'Densité de la chaîne': 'Warp density',
    'Dates des semaines': 'Week dates',
    'Légende des absences': 'Legend for empty weeks',

    /* ---------- Fresque ---------- */
    'Fresque collective — les traces bout à bout': 'Collective frieze — routes end to end',
    'Automatique — selon le format': 'Automatic — follows the format',
    'Fresque horizontale': 'Horizontal frieze',
    'Affiche verticale — en serpentin': 'Vertical poster — serpentine',
    'Commune — les longueurs restent comparables': 'Shared — lengths stay comparable',
    'Égale — chaque trace occupe autant de place': 'Equal — each route takes the same room',
    'Prénoms (séparés par ;)': 'First names (separated by ;)',
    'Marquer les raccords': 'Mark the joins',

    /* ---------- Exploration ---------- */
    'Territoires blancs — ce qui est nouveau': 'Blank territories — what is new',
    'Nouveau': 'New',
    'Carte de la période': 'Map of the period',
    'Vignette — la zone découverte': 'Vignette — the discovered area',
    'Discrétion du connu': 'Restraint of the known',
    'Kilomètres nouveaux': 'New kilometres',

    /* ---------- Musée ---------- */
    'Musée personnel — la collection': 'Personal museum — the collection',
    'Galerie — le mur': 'Gallery — the wall',
    'Cartel — une seule pièce': 'Wall label — a single piece',
    'Pièce n°': 'Piece no.',
    'Titre de l’exposition': 'Title of the exhibition',
    'Cartels sous les pièces': 'Wall labels under the pieces',

    /* ---------- Partition ---------- */
    'Partition — la sortie en musique': 'Score — the ride as music',
    'Ambiance': 'Mood',
    'Nappe — douce et tenue': 'Pad — soft and sustained',
    'Pincé — court, net': 'Plucked — short, clean',
    'Cloche — harmonique': 'Bell — harmonic',
    'Tracé en regard': 'Route alongside',

    /* ---------- Allumettes, Pente, Radiale, Sommet ---------- */
    'Allumettes': 'Matchsticks',
    'Pied — compte au-dessus': 'Foot — count above',
    'Angle — compte à droite': 'Corner — count to the right',
    'Bandeau — le graphique domine': 'Band — the chart dominates',
    'Relief derrière': 'Relief behind',
    'Pente': 'Gradient',
    'Fond — haut': 'Ground — top',
    'Fond — bas': 'Ground — bottom',
    'Seuil de saturation (%)': 'Saturation threshold (%)',
    'Radiale': 'Radial',
    'Anneau': 'Ring',
    'Barres radiales': 'Radial bars',
    'Aire pleine': 'Filled area',
    'Parcours au centre': 'Route at the centre',
    'Sommet · ligne': 'Summit · line',
    'Sommet · barres': 'Summit · bars',
    'Repères de distance': 'Distance markers',
    'Halo sur le parcours': 'Halo on the route',

    /* ---------- Éditorial, Trace, Chiffres ---------- */
    'Éditorial': 'Editorial',
    'Profil d’altitude': 'Elevation profile',
    'Puissance (3 s)': 'Power (3 s)',
    'Allure par km': 'Pace per km',
    'Trace': 'Route',
    'Aplat sombre': 'Dark flat',
    'Titre de la sortie': 'Ride title',
    'Chiffres': 'Figures',
    'Chiffre héros': 'Hero figure',
    'Barres des kilomètres': 'Kilometre bars',

    /* ---------- surcouches ---------- */
    '1a · Filet': '1a · Hairline',
    'Claire (photo sombre)': 'Light (dark photo)',
    'Sombre (photo claire)': 'Dark (light photo)',
    '3ᵉ donnée': '3rd figure',
    '1b · Profil': '1b · Profile',
    '1c · Trace': '1c · Route',
    '1d · Ardoise': '1d · Slate',
    '1e · Héros': '1e · Hero',
    '1f · Tranche': '1f · Slice',
    '1g · Sommet ligne': '1g · Summit line',
    '1h · Sommet barres': '1h · Summit bars',

    /* ---------- messages de l'application ---------- */
    'Ta prochaine création commence par une sortie.':
      'Your next piece starts with a ride.',
    '— choisir une sortie —': '— choose a ride —',
    'intervals.icu — connecté': 'intervals.icu — connected',
    'intervals.icu — connecté depuis ce navigateur': 'intervals.icu — connected from this browser',
    'Strava — connecté': 'Strava — connected',
    'Historique effacé.': 'History cleared.',
    'Pièce créée.': 'Piece created.',
    'Pièce retirée.': 'Piece removed.',
    'Pièce ajoutée — le cartel reste à écrire.': 'Piece added — the wall label is still to write.',
    'Lecture impossible.': 'Playback failed.',
    'intervals.icu — clé refusée.': 'intervals.icu — key refused.',
    'Lecture…': 'Playing…',
    'Pièce': 'Piece',
    'sorties de référence': 'reference rides',
    'cases': 'cells',

    /* ---------- la période ---------- */
    'Tout ce qui est chargé': 'Everything loaded',
    'Cette semaine': 'This week',
    'La semaine dernière': 'Last week',
    'Il y a deux semaines': 'Two weeks ago',
    'Ce mois': 'This month',
    'Le mois dernier': 'Last month',
    'Cette année': 'This year',
    'L’an dernier': 'Last year',
    'sorties': 'rides',
    'aucune sortie dans cette période': 'no ride in this period',

    /* ---------- le choix de style ---------- */
    'Cartes': 'Maps',
    'Reliefs et données': 'Relief and data',
    'Souvenirs': 'Keepsakes',
    'Films et son': 'Films and sound',
    'Surcouches': 'Overlays',
    'Autres': 'Others',
    'Toutes les familles': 'All families',
    'Texte': 'Text',
    'Format': 'Format',
    'Voir le résultat': 'See the result',

    /* ---------- familles du sélecteur ---------- */
    'Affiches': 'Posters',
    'Surcouches transparentes': 'Transparent overlays',
    'Séries — plusieurs sorties': 'Series — several rides'
  };

  var DICOS = { en: EN, fr: null };

  var langue = 'en';
  try {
    var retenue = localStorage.getItem(CLE);
    if (retenue === 'fr' || retenue === 'en') langue = retenue;
  } catch (e) { /* mode privé : anglais par défaut */ }

  /* La traduction d'UNE chaîne. Absente du dictionnaire : on rend le
   * français tel quel — mieux vaut un mot non traduit qu'un trou. */
  function T(s) {
    if (typeof s !== 'string') return s;
    var d = DICOS[langue];
    if (!d) return s;
    var v = d[s];
    if (v) return v;
    /* Le même texte écrit sur trois lignes dans le HTML arrive ici avec ses
     * retours et son indentation : sans cette normalisation, une phrase
     * parfaitement présente au dictionnaire ne serait jamais reconnue. */
    var plat = s.replace(/\s+/g, ' ').trim();
    if (plat !== s && d[plat]) return d[plat];
    /* Les libellés composés « Quelque chose — explication » : si la phrase
     * entière est inconnue, on tente au moins sa tête. Cela rattrape les
     * variantes d'un même réglage sans doubler le dictionnaire. */
    var i = s.indexOf(' — ');
    if (i > 0 && d[s.slice(0, i)]) return d[s.slice(0, i)] + s.slice(i);
    return s;
  }

  /* Le texte statique de la page. On parcourt les nœuds de TEXTE plutôt que
   * d'annoter chaque balise : aucune balise à maintenir, et un texte ajouté
   * demain sera traduit sans qu'on ait pensé à le marquer. */
  function appliquer(racine) {
    if (!DICOS[langue]) return;
    var racines = racine || document.body;
    /* Ni le code ni les styles : un commentaire de script qui contiendrait
     * par hasard une clé du dictionnaire se ferait traduire, et on aurait
     * traduit du code. Les champs de saisie non plus — leur contenu est
     * celui de l'utilisateur. */
    var it = document.createTreeWalker(racines, NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) {
        var p = n.parentNode;
        var nom = p && p.nodeName;
        if (nom === 'SCRIPT' || nom === 'STYLE' || nom === 'TEXTAREA') {
          return NodeFilter.FILTER_REJECT;
        }
        /* Exclure par NOM DE BALISE ne suffit pas : le nom d'une sortie, un
         * titre saisi, un libellé venu de l'API sont des nœuds de texte
         * ordinaires. Aujourd'hui rien n'en contient au moment où l'on
         * traduit — appeler() ne tourne qu'une fois, avant tout chargement —
         * mais le jour où on retraduira un sous-arbre, une sortie nommée
         * « Cartes » ou « Format » se ferait traduire.
         *
         * Tout conteneur portant data-brut est donc écarté, et les endroits
         * qui reçoivent de la donnée le déclarent. */
        for (var a = p; a && a !== document.documentElement; a = a.parentNode) {
          if (a.nodeType === 1 && a.hasAttribute('data-brut')) {
            return NodeFilter.FILTER_REJECT;
          }
        }
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    var noeuds = [];
    while (it.nextNode()) noeuds.push(it.currentNode);
    noeuds.forEach(function (n) {
      var brut = n.nodeValue;
      var net = brut.trim();
      if (!net) return;
      var t = T(net);
      /* Remplacement par FONCTION : avec une chaîne, `$&`, `` $` `` et `$1`
       * dans la traduction seraient interprétés comme des références. Le
       * dictionnaire est de nous, donc rien ne casse aujourd'hui — mais une
       * traduction contenant un dollar n'a pas à être un piège. */
      if (t !== net) n.nodeValue = brut.replace(net, function () { return t; });
    });
    ['placeholder', 'title', 'aria-label'].forEach(function (attr) {
      Array.prototype.forEach.call(racines.querySelectorAll('[' + attr + ']'), function (el) {
        var v = el.getAttribute(attr);
        var t = T(v);
        if (t !== v) el.setAttribute(attr, t);
      });
    });
    document.documentElement.lang = langue;
  }

  /* Changer de langue RECHARGE la page. Retraduire à chaud demanderait de
   * connaître le texte d'origine de chaque nœud déjà traduit : on le
   * retrouverait à l'envers, et une seule erreur laisserait un mot figé
   * dans la mauvaise langue. Un rechargement est déterministe. */
  function setLangue(l) {
    if (l !== 'fr' && l !== 'en') return;
    try { localStorage.setItem(CLE, l); } catch (e) { /* tant pis */ }
    location.reload();
  }

  global.I18N = {
    /* Le dictionnaire est expose : le harnais s'en sert pour distinguer
     * « meme mot dans les deux langues » de « jamais traduit », ce que T()
     * seul ne permet pas de savoir. */
    DICOS: DICOS,
    T: T,
    appliquer: appliquer,
    setLangue: setLangue,
    langue: function () { return langue; }
  };
  global.T = T;                       // raccourci, très utilisé dans app.js
}(window));
