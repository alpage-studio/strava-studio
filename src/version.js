/* version.js — LE numéro de version, à un seul endroit.
 *
 * Ce fichier est chargé deux fois, dans deux mondes différents :
 *   - par index.html, pour afficher la version dans l'en-tête ;
 *   - par sw.js via importScripts(), pour nommer le cache hors ligne.
 *
 * C'est ce qui évite la dérive classique : un numéro affiché qui dit 1.4
 * pendant que le cache sert encore la 1.2. Changer la ligne ci-dessous
 * met à jour l'affichage ET purge le cache des visiteurs.
 *
 * Un `var` de premier niveau fonctionne dans les deux portées — la fenêtre
 * comme le service worker. Ne pas passer en `const` ou en module.
 */
var STUDIO_VERSION = '3.11';
var STUDIO_DATE = '20.09.2026';

/* ---------- le journal ----------
 *
 * Il vit ICI, contre le numéro de version, et pas dans un fichier séparé :
 * une note de version qui s'écrit ailleurs finit par décrire une version
 * qui n'est pas celle qu'on sert. Un contrôle du harnais refuse un numéro
 * dont la première entrée ne porte pas le même nom.
 *
 * CE QUI EST ÉCRIT ICI EST CE QUI A ÉTÉ SERVI. Une première version de ce
 * journal découpait la 3.0 en 2.8 et 2.9 — deux numéros qui n'ont jamais
 * quitté la machine. Aucun navigateur ne pouvait avoir vu ces versions, et
 * le découpage rendait impossible de relier une version affichée à un
 * commit. Un journal rétroactif est une reconstitution ; celui-ci suit
 * `git log`.
 *
 * La page compare ce tableau au dernier numéro VU par ce navigateur et
 * montre ce qui s'est ajouté depuis. Rien de neuf : rien ne s'affiche.
 *
 * Ordre : la plus récente en tête.
 */
var STUDIO_JOURNAL = [
  { v: '3.11', d: '20.09.2026', points: [
    'La planche se PLACE sur la photo : tu la prends, tu la poses où tu veux, un curseur la redimensionne et un bouton la recentre. Le titre tombait parfois sur la zone la plus chargée de l’image — le voile la rendait lisible, la déplacer règle le problème autrement.',
    'Le placement vaut pour les trente-six planches : il est posé par le moteur, une fois, et aucune n’a eu à être modifiée.',
    'Il se garde en fractions du cadre, jamais en pixels : le même placement décidé sur l’aperçu vaut en story et en A3 à 300 dpi. En pixels, une planche calée dans un coin aurait sauté ailleurs au changement de format.',
    'Le voile, lui, reste ancré au cadre : il protège une zone de l’IMAGE, pas de la planche. Sans cela il partait avec elle et posait un rectangle sombre de travers sur la photo.',
    'Sur fond plein, le réglage n’apparaît pas : la feuille se déplacerait avec l’encre et laisserait une bande vide au bord.'
  ] },
  { v: '3.10', d: '20.09.2026', points: [
    'UN SEUL bouton pour exporter, et le format devient un choix : image, vidéo ou séquence PNG. Ils étaient trois boutons côte à côte, dont un seul en couleur — trois façons de produire LA MÊME planche présentées comme trois fonctions différentes. Et « Enregistrer l’image » voisinait avec « Enregistrer un projet », qui ne fait pas du tout la même chose.',
    'Le réglage de durée disparaît quand on choisit l’image fixe : il n’y a rien à animer, et un réglage sans effet apprend à ne plus lire les réglages.',
    'Le catalogue montre enfin quelque chose avant qu’on ait chargé un fichier. Les trente-six vignettes se rendaient sur une sortie VIDE — des tirets à la place des chiffres, aucun parcours — alors que c’est le premier écran qu’on voit. Elles utilisent désormais l’exemple embarqué.',
    'Cet exemple n’entre pas dans ta bibliothèque et les cartes le disent : « Exemple — charge une sortie pour voir la tienne ». Sans cette ligne, on prendrait ses 60 km pour les siens.'
  ] },
  { v: '3.9', d: '19.09.2026', points: [
    'Une planche de plus : « Gravure d’altitude ». Le profil d’une sortie devient le sujet — une crête, et sous elle une vingtaine de lignes qui la reprennent. Deux compositions : Frise, qui traverse la feuille, et Massif, un bloc serré.',
    'Une sortie plate y reste plate. Le profil du studio est normalisé entre 0 et 1 : dessiné tel quel, une boucle de plaine de dix-sept mètres aurait la même montagne qu’un col de mille. La hauteur se calcule donc sur les MÈTRES réels.',
    'Les lignes secondaires ne sont PAS des courbes de niveau, et la planche ne le laisse pas croire : ce sont des copies du même profil. De vraies courbes demanderaient l’altitude du terrain autour du chemin, qu’un GPX ne contient pas. Seule la ligne du haut est mesurée — elle est tracée plus sombre.',
    'Sans altitude, rien n’est inventé : la planche le dit et s’arrête.',
    'L’export vidéo remarche. Il ne produisait plus rien depuis la 3.3.1 : le bouton se pressait, aucun fichier ne sortait, aucun message ne s’affichait. La séquence PNG tombait de la même façon, et rouvrir un projet perdait son format.',
    'La durée de l’apparition se règle : 1,5 s, 3 s, 5 s ou 8 s. Elle était figée à 4,2 s dans le moteur. Les planches qui racontent une chronologie — le film, la partition, l’almanach — gardent la leur, et le menu disparaît chez elles.',
    'Un GPX livre enfin sa PUISSANCE. Le lecteur demandait l’altitude, le cœur et la cadence, jamais les watts : un fichier qui les portait était lu comme s’il n’en avait pas, et Allumettes comptait ses efforts sur la fréquence cardiaque sans le dire.',
    '« Gravure de puissance » : la sœur de Gravure d’altitude, pour les watts. Même dessin, mêmes deux compositions — et une échelle ABSOLUE, pleine hauteur à 400 W ou à ton FTP quand il est connu. Une sortie facile occupe peu de hauteur, une séance dure en occupe beaucoup, et deux affiches se comparent pour de bon.',
    'Le pied du dessin est zéro watt, pas le minimum de la sortie : ne pas pédaler est une descente, pas une absence de mesure.',
    '« Sous-bois » : la sortie en carte déssinée à l’encre, trait fin légèrement tremblé, sapins en marge et beaucoup de papier. Jusqu’à trois repères que TU places — un col, un refuge, un souvenir. Le studio n’en invente aucun : il ne connaît que des coordonnées.',
    'Les sapins sont décoratifs et la planche le dit. Un GPX ne porte aucune information de couvert végétal ; ils se posent dans les marges, jamais sur le chemin.',
    '« Versants » : le rythme de la sortie en bloc minéral. Chaque grande montée devient une facette hachurée, chaque descente un aplat, avec les proportions réelles de distance et de dénivelé. Une phase compte à partir de vingt-cinq mètres, réglable — sinon le bruit du baromètre fabriquerait deux cents « montées ».',
    'La pente serre les hachures, et rien de plus : ni difficulté technique, ni nature du terrain, ni nombre de sauts. Un GPX ne contient ni les racines ni la taille des cailloux.'
  ] },
  { v: '3.8', d: '19.09.2026', points: [
    'Un réglage de texte commun aux planches Alpage : Sans texte, Signature ou Données. Signature est le défaut — un titre discret et deux mesures.',
    'Les phrases qui expliquaient la FABRICATION quittent les affiches : « épaisseur : courbure du parcours — effet de style », « parcours tourné, non déformé », le fuseau horaire. Elles restent en « Données ».',
    'Ce qui empêche de MAL LIRE une donnée reste : une mesure absente, des sorties sans altitude, des contours qu’on prendrait pour des courbes de niveau. Ces phrases raccourcissent, elles ne disparaissent pas.'
  ] },
  { v: '3.7.1', d: '19.09.2026', points: [
    'Rien de visible : la chaîne de publication ne se trompe plus sur elle-même — elle attend que le site serve la bonne version avant de le contrôler, et trois vérifications qui ne s’exécutaient jamais s’exécutent.'
  ] },
  { v: '3.7', d: '18.09.2026', points: [
    'Le studio part de ce qu’il est : une planche posée sur une photo ou une vidéo. Le support « sans fond » est le défaut, le papier devient le cas particulier.',
    'La vidéo de fond s’affiche enfin dans l’aperçu. Elle n’existait que dans le fichier exporté : on réglait à l’aveugle et on découvrait le cadrage après coup.',
    'La photo se choisit juste après la sortie, avant le style — et non repliée au bas de la colonne.',
    'Un voile par défaut : sans lui, le titre d’une planche tombe sur une zone sombre de la photo et disparaît.',
    'Le catalogue et l’écran d’accueil montrent les planches sur une image, plus sur un damier : une surcouche se juge sur une photo.'
  ] },
  { v: '3.6.4', d: '18.09.2026', points: [
    'Sur ordinateur, la colonne de réglages respire selon la place au lieu d’être figée à 330 px, et les familles de styles passent à la ligne au lieu d’être coupées en plein mot.'
  ] },
  { v: '3.6.3', d: '18.09.2026', points: [
    'Le studio retrouve son apparence au-dessus de 400 px de large — grand iPhone, tablette, ordinateur. Une accolade jamais refermée enfermait toute la feuille de style dans une règle réservée aux petits écrans : au-dessus, la page n’avait ni police, ni couleurs, ni barre du bas.',
    'Dans la galerie, le bouton de retour vers le studio passait sous l’encoche : on ne pouvait plus revenir.'
  ] },
  { v: '3.6.2', d: '18.09.2026', points: [
    'Le numéro de version s’affiche aussi sur téléphone. Il était caché avec la baseline de l’entête — aucun moyen de savoir quelle version on regardait, ce qui est justement la question qu’on se pose quand l’écran surprend.'
  ] },
  { v: '3.6.1', d: '18.09.2026', points: [
    'Correction d’un affichage casse sur téléphone : le studio pouvait charger la moitié de ses fichiers dans une version et l’autre moitié dans une autre, et le résultat ne ressemblait à aucune des deux — barre du bas disparue, mise en page du grand écran écrasée sur l’écran du téléphone.'
  ] },
  { v: '3.6', d: '18.09.2026', points: [
    'Le voile protège enfin les TRENTE-DEUX planches. Il n’en atteignait que quinze : les dix-sept autres se posaient sur une photo sans rien pour rendre leur texte lisible, et la note de la 3.3 annonçait le contraire.'
  ] },
  { v: '3.5.1', d: '18.09.2026', points: [
    'La galerie est en anglais, comme le studio — et avec le MÊME dictionnaire : les compositions y portent mot pour mot le nom que le menu leur donne.'
  ] },
  { v: '3.5', d: '18.09.2026', points: [
    'Teintes ne porte plus que des couleurs : le support et le voile sont partis dans Export, où l’on choisit déjà la photo. Un panneau, une question.',
    'L’interface est en anglais, sans choix : le sélecteur FR/EN proposait une alternative que personne ne prenait et qu’il fallait tenir dans deux états.',
    'La galerie porte enfin la même identité que le studio — même papier, même encre, mêmes polices, même marque, et le même choix clair/sombre.',
    'Le sombre est repris sur deux mesures : les panneaux ne se détachaient plus du fond (1,06 contre 1,10 en clair), et l’accent passait de la rouille à l’or — une autre marque, pas une variante nocturne.'
  ] },
  { v: '3.4', d: '18.09.2026', points: [
    'Les réglages suivent enfin le même ordre partout : Activité, Style, Teintes, Texte, Export — sur téléphone comme sur grand écran.',
    'La photo et la vidéo de fond ont rejoint l’Export : on choisit une image au moment de produire la sortie, pas au moment de régler une couleur.',
    '« Collection » désignait trois choses ; la palette s’appelle désormais Palette, et elle vit avec les couleurs.',
    'Le musée personnel est retiré : il demandait de curer une collection quand tout le reste du studio demande de faire une affiche. Le catalogue passe de 33 à 32 planches.'
  ] },
  { v: '3.3.1', d: '18.09.2026', points: [
    'Rien de visible : le cœur de l’interface, qui portait huit sujets dans un seul fichier de deux mille lignes, est désormais en neuf morceaux qui se nomment. Les réglages, eux, n’ont pas bougé.'
  ] },
  { v: '3.3', d: '17.09.2026', points: [
    'Les collections sont enfin accessibles : le menu existait, il n’avait jamais reçu une seule entrée. Huit palettes nommées, Ascension à Braise.',
    'Les variantes cachées sortent au jour : « Fragment », « Gravity », « Massif · accent » demandaient plusieurs réglages à la fois et n’avaient donc aucune carte. Ce que la galerie montre est désormais atteignable en un clic.',
    'Un voile global : sans fond, une planche claire sur une photo claire était illisible. Les trente-trois peuvent maintenant protéger leur texte, pas seulement les huit de la famille « sur photo ».',
    'Cette famille s’appelle d’ailleurs « Voile compris » : ce qui la distingue n’est plus la transparence, que tout le monde a.'
  ] },
  { v: '3.2.1', d: '17.09.2026', points: [
    'Une directive de sécurité qui ne servait à rien est retirée : un navigateur ignore `frame-ancestors` quand la politique vient d’une balise, et le dit à chaque chargement.'
  ] },
  { v: '3.2', d: '17.09.2026', points: [
    'Une marque : un seul geste qui monte, redescend et revient — le croisement fait le A, le trajet fait le chemin.',
    'Charbon sur papier, la même dans l’entête et sur l’écran d’accueil.',
    'Rangement : vingt copies d’une même fonction de couleur réunies en une, et le code mort que trois revues avaient listé.'
  ] },
  { v: '3.1', d: '16.09.2026', points: [
    'Trois revues — code, sécurité, mise en page — et leurs corrections : boutons illisibles au survol, musée et projets enfermés dans l’écran d’accueil, planche cachée par la barre d’outils.',
    'Une politique de sécurité de contenu : le studio ne PEUT plus charger quoi que ce soit d’un tiers, ce n’est plus seulement une promesse.',
    'Le serveur de développement ne laisse plus sortir une trace réelle sur le réseau local — trois contournements refermés.',
    'Encre · Pinceau dit désormais que son épaisseur est un geste, pas une mesure.'
  ] },
  { v: '3.0', d: '16.09.2026', points: [
    'L’interface prend la matière des planches : papier, charbon, rouille. Le sombre reste à un doigt.',
    'Le studio s’appelle alpage studio, et son interface est en anglais par défaut (sélecteur FR / EN dans l’entête).',
    'Il tient dans un téléphone : une barre d’outils en bas, des panneaux qui remontent, l’aperçu toujours visible.',
    'Le style se choisit en deux temps — une famille, puis sa variante — avec des vignettes rendues depuis TES sorties.',
    'Toute planche peut se poser sur une photo : le support « Transparent » vaut pour les trente-trois.',
    'Les planches multi-sorties se composent par PÉRIODE au lieu de cocher des fichiers.',
    'Atlas, Almanac, Strates, Encre et Médaillon : défauts de mise en page corrigés, Massif, Courant, Pinceau et Fragment retravaillés.'
  ] },
  { v: '2.7.2', d: '16.09.2026', points: [
    'Première passe téléphone : la page défile, l’aperçu reste à l’écran, le socle d’export se pose en bas.'
  ] },
  { v: '2.7.1', d: '16.09.2026', points: [
    'La galerie des compositions est en ligne, et pèse trois mégaoctets au lieu de quatorze.'
  ] },
  { v: '2.7', d: '16.09.2026', points: [
    'Alpage V2 : Encre, Strates, Empreinte et Atlas gagnent leurs Explorations.',
    'Un rendu « Noir & blanc » global, qui suit dans les exports.'
  ] }
];

