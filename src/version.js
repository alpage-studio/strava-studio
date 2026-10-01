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
var STUDIO_VERSION = '3.17.5';
var STUDIO_DATE = '01.10.2026';

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
  { v: '3.17.5', d: '01.10.2026', points: [
    'EMPREINTE PEUT ENFIN CHOISIR SA PÉRIODE. Ses compositions Triptyque, Collection et Îlots dessinent plusieurs sorties — mais la planche ne déclarait nulle part qu’elle était multi-sorties, et le sélecteur de période ne s’ouvrait jamais pour elle. On composait une Collection sur ce que la bibliothèque contenait, sans pouvoir le restreindre.',
    'Elle ne le déclare pas pour autant en bloc : Sceau, Soleil, Contre-empreinte et Sceau cerclé ne dessinent que la sortie chargée. Leur ouvrir le sélecteur aurait été un réglage sans effet — et pire, l’export d’un Sceau aurait été REFUSÉ quand la période ne retient rien, alors qu’il n’en dépend pas.',
    'Le bloc de période suit maintenant les RÉGLAGES, pas seulement la planche. Il ne se rafraîchissait qu’au changement de composition suivant : on passait de Sceau à Collection, le sélecteur restait caché, puis il apparaissait au réglage d’après. Il était en retard d’un cran.',
    'L’application installée s’annonçait en ANGLAIS. Le manifeste portait « lang: en » avec une description en français, resté de l’époque où l’interface était anglaise — avant la 3.12. Les trois pages, elles, disaient français depuis.',
    'Un contrôle refuse désormais qu’on lise « transparent » ou « multi » sans passer par son résolveur. Les deux peuvent être déclarés comme des fonctions des réglages, et une fonction est toujours vraie : la planche passerait pour transparente, ou multi-sorties, quoi qu’on choisisse. Le piège avait déjà coûté une fois — c’est la seconde.'
  ] },
  { v: '3.17.4', d: '01.10.2026', points: [
    'Rien ne change dans le studio. Le carnet de route gagne l’écran « Le voyage » : le titre, les étapes par leurs lieux — le départ, chaque nuit et son kilomètre, l’arrivée — et les repères du GPX, à renommer, garder ou retirer, avec une proposition de noms français pour ceux que Komoot écrit en anglais.'
  ] },
  { v: '3.17.3', d: '01.10.2026', points: [
    'LE RÉGLAGE « TEXTE » ATTEINT VINGT-CINQ PLANCHES DE PLUS — trente-cinq sur trente-sept au lieu de dix. Les autres gravaient leur titre et leur rangée de mesures quel que soit ton choix : le réglage existait, il ne portait simplement pas jusqu’à elles.',
    'Ce qui se tait est ce que la planche dit D’ELLE : son titre, ses mesures, et — en « Signature » — ses notes de fabrication. Trace, Médaillon et la partition musicale deviennent entièrement muettes ; il ne reste que le dessin.',
    'Ce qui RESTE, et ce n’est pas un oubli : les graduations et les avertissements. L’axe des kilomètres de Ressenti, les jours de la semaine de Tissage, le seuil d’Allumettes — « au-dessus de 280 W » — sans lequel le grand nombre affirmerait une mesure universelle. Et les phrases qui empêchent de mal lire : « hauteur expressive — ce n’est pas une altitude », « ce n’est pas un itinéraire ».',
    'Le grand nombre d’Allumettes ne se tait pas non plus : il EST la planche. En composition « Bandeau » il descend dans le pied avec les mesures — c’est la rangée qui est filtrée, pas supprimée, sinon la planche se vidait d’elle-même.',
    'Partition obéissait à un réglage qu’aucun panneau n’offrait. Sa composition graphique lisait le choix et s’y pliait, mais la planche ne déclarait pas le contrôle : il retombait sur « Signature » et y restait. Un contrôle refuse désormais les deux sens — un réglage lu sans commande, une commande que personne ne lit.',
    'Quatre planches qui honoraient DÉJÀ le réglage le faisaient par endroits seulement. Atlas gravait ses trois totaux, Almanac son titre, ses sorties remarquables et son compte — « 1 SORTIES », au pluriel —, Strates ses dates de couche, Sommet l’altitude du sommet et le dénivelé. C’est un balayage des vingt-trois planches, et non un sondage, qui les a trouvées.',
    'Almanac et Strates déclarent désormais UN SEUL état de réglage. Il était déclaré au fond d’une sous-fonction : partout ailleurs il n’existait pas, et le premier endroit qui s’en servait affichait un message d’erreur À LA PLACE de la planche.',
    'LES HUIT SURCOUCHES ET LES PLANCHES DE CHIFFRES SUIVENT AUSSI, mais pas à la même règle : chez elles le texte EST souvent la composition. Le tri se fait sur ce qu’il y a SOUS les mots.',
    'Celles qui dessinent — Tracé, Profil, Tranche, Sommet — deviennent entièrement muettes : il reste le graphique seul sur ta photo. Mesuré : le parcours de Tracé occupe encore la moitié de l’encre une fois le texte parti, et aucune ne tombe à zéro.',
    'Celles qui portent un chiffre-héros — Héros, Chiffres, Éditorial — gardent ce chiffre ET SON UNITÉ. « 355 » sans « MÈTRES DE DÉNIVELÉ » n’est pas plus sobre, c’est faux. Le nom de la sortie et les mesures secondaires, eux, se taisent.',
    'Filet et Ardoise n’ont pas de héros : leur rangée de statistiques EST la surcouche, et ses petites capitales en sont les unités. Seul le nom de la sortie s’y tait.',
    'MÉTRO ET SAISONS FERMENT LA MARCHE — trente-cinq planches sur trente-sept. Le plan de Métro passe de quarante et un textes à un seul : il ne garde que « RÉSEAUX SÉPARÉS — LES CORRESPONDANCES DEMANDENT UN CADRAGE COMMUN ». Les couleurs des lignes et les pastilles de station restent : c’est le plan.',
    'Saisons garde ses DATES. Quatre vignettes du même lieu sans leur date ne comparent plus rien — la date est l’axe de la comparaison, pas une légende. Restent aussi « NE PASSE PAS ICI » et la taille de la fenêtre, sans laquelle on ne sait pas à quoi on compare.',
    'LE MESSAGE D’UNE PLANCHE SANS SORTIE N’OBÉIT JAMAIS AU RÉGLAGE. « Charge au moins deux sorties » doit s’afficher même en « Sans texte » : une planche vide ET muette ne se distingue pas d’une panne, et c’est le moment où il faut dire quoi faire. Un contrôle le tient désormais pour les trente-sept : aucune ne peut rendre à la fois zéro texte et zéro marque.',
    'Le film et Mots restent dehors, exprès : la dernière scène du film n’est QUE trois chiffres, et les mots de Mots sont ceux que TU tapes. Un réglage global n’a pas à effacer ce que tu as écrit.'
  ] },
  { v: '3.17.2', d: '01.10.2026', points: [
    'Rien ne change dans le studio. Le carnet de route, la seconde application de la suite, ajoute la topo swisstopo d’un bouton — en ligne comme en local — et écrit l’altitude d’un lieu comme celle du chemin à son passage, pas celle du sommet qu’il longe.'
  ] },
  { v: '3.17.1', d: '01.10.2026', points: [
    'Trois constats de relecteurs, restés ouverts. « Recentrer » remettait aussi l’échelle à 100 : on réglait sa taille, on recentrait, et on perdait son réglage sans l’avoir demandé. L’échelle a son propre curseur juste à côté.',
    'Dans la galerie, sept familles s’affichaient toutes sous le nom « Encre ». La page ne chargeait que six fichiers de planche pour douze référencés, et le moteur rend la PREMIÈRE planche quand on lui demande un identifiant inconnu — un repli qui ne dit pas son nom. Les relecteurs en avaient vu cinq ; il y en avait sept.',
    'Les vignettes du catalogue ne portent plus de légende. Rendues en 300 pixels de large et affichées en 144, leur texte tombait à 2,3 pixels à l’écran : une tache, pas une information — et le nom de la planche est déjà sous la carte, en vrai texte.'
  ] },
  { v: '3.17', d: '30.09.2026', points: [
    'LA VIDÉO S’ENCODE IMAGE PAR IMAGE. Elle était filmée pendant que la planche s’animait à l’écran : si l’onglet passait en arrière-plan ou si la machine ralentissait, l’enregistrement se figeait ou saccadait — essayé dans un onglet caché, il a livré une seule image en trois secondes. Chaque image est maintenant dessinée puis encodée à son instant exact : la vidéo est la même sur un ordinateur lent et sur un rapide, onglet visible ou non.',
    'C’est un MP4 H.264 à 30 images par seconde, rangé sans bibliothèque, l’index en tête pour qu’Instagram le lise dès le début. L’encodage va plus vite que la vidéo elle-même.',
    'Deux cas gardent l’enregistrement en direct : une vidéo de fond — sa lecture et son son ne se capturent qu’en temps réel —, et un format trop grand pour l’encodeur du navigateur, qui s’y replie de lui-même.',
    'L’encodeur est désormais partagé avec le carnet de route, la seconde application de la suite. Un lien « Suite » dans l’entête mène à la page qui présente les deux.',
    'Almanac gagne une variante « Cadran nu » : sans les sorties nommées à la périphérie, avec les mesures au centre. Elles nommaient trois sorties sur cent six et prenaient un quart de la feuille pour un échantillon qu’on n’avait pas choisi ; le cadran s’agrandit à leur place.'
  ] },
  { v: '3.16', d: '30.09.2026', points: [
    'L’IMPORT DONNE UNE PLANCHE TOUT DE SUITE. La liste des sorties, obtenue en UNE requête, porte déjà la date, la distance, le dénivelé, la durée et le sport — tout ce qu’Almanac dessine. Une année entière se pose donc instantanément, et les tracés arrivent ensuite, un par un, en fond.',
    'Les tracés ENRICHISSENT les sorties déjà posées au lieu de les remplacer : même couleur, même rang, même place. Sans cela la planche se serait réorganisée sous les yeux de qui la regarde se construire.',
    'Tu peux arrêter l’import. Il dure des minutes sur une année ; la seule sortie était de recharger la page, ce qui perdait tout. Ce qui est chargé avant l’arrêt reste, et relancer reprend où l’on s’était arrêté.',
    'La note de période dit combien de sorties portent un tracé. Une sortie importée en résumé n’en a pas : Almanac et Saisons s’en passent, Atlas, Métro, Fresque et Tissage n’ont alors rien à dessiner pour elle. Sans ce compte, une carte à moitié vide ressemble à une panne.',
    'La planche ne se redessine plus à chaque tracé reçu — trois cents rendus pleine taille — mais au plus une fois toutes les deux secondes.'
  ] },
  { v: '3.15.3', d: '30.09.2026', points: [
    'L’import allait trop vite. intervals.icu répond 429 au bout de quelques dizaines de requêtes rapprochées — et sa réponse 429 ne porte pas d’en-tête CORS, donc le navigateur la bloque AVANT que le statut soit lisible. Vingt-six refus de rythme se comptaient comme vingt-six sorties illisibles.',
    'Une requête à la fois, espacées, et une nouvelle tentative après une pause qui double. Cinq abandons de suite arrêtent l’import : insister sur une limite de rythme ne fait que l’entretenir.',
    'Un refus et une sortie illisible ne se comptent plus ensemble, et le compte rendu dit quoi faire : « intervals.icu limite le rythme. Relance l’import : il reprend où il s’est arrêté. » Ce qui est déjà chargé n’est jamais retéléchargé.'
  ] },
  { v: '3.15.2', d: '30.09.2026', points: [
    'L’import d’une période rendait CINQ sorties, quelle que soit la fenêtre. La cause n’était ni intervals.icu ni ton compte : l’API en rendait 471 sur l’année. C’était une ligne à moi — `limit = limit || 5`, restée en place quand la fenêtre a été ajoutée. L’import demandait « zéro » pour dire « pas de plafond », et cette ligne le changeait en cinq avant le garde-fou censé l’en empêcher.',
    'Le menu déroulant garde ses cinq dernières, l’import prend toute la fenêtre : les deux besoins partagent une fonction, et le plafond se calcule maintenant une seule fois en disant lequel on sert.',
    'Un contrôle éprouve désormais l’appel RÉEL, réseau remplacé, et non une liste injectée. Les cas d’import fournissaient leur propre liste — ce qui les rendait éprouvables sans clé d’API, et contournait la fonction fautive entièrement.'
  ] },
  { v: '3.15.1', d: '30.09.2026', points: [
    'L’import d’une période ne demandait jamais combien de sorties il voulait. `limit` est documenté comme optionnel chez intervals.icu, donc soumis à la valeur par défaut du serveur — laquelle n’est écrite nulle part. Une année entière pouvait ainsi ne rendre que cinq sorties. Il est maintenant envoyé.',
    'Le compte rendu dit d’ABORD combien la période en contenait : « 42 sorties trouvées · 38 chargées · 4 déjà présentes ». Il fallait additionner pour s’apercevoir qu’une fenêtre n’en avait rendu que cinq — et c’est justement le chiffre qu’on cherche quand on soupçonne un plafond.'
  ] },
  { v: '3.15', d: '30.09.2026', points: [
    'TU PEUX IMPORTER UNE PÉRIODE ENTIÈRE. Depuis intervals.icu on ne pouvait charger qu’UNE sortie à la fois, choisie parmi les cinq dernières : les neuf planches multi-sorties n’avaient donc aucun moyen d’être nourries autrement qu’en glissant des GPX un par un. La semaine, le mois, le trimestre ou l’année s’importent maintenant d’un bouton.',
    'Ce que tu as déjà ne se retéléchargé pas. Deux périodes qui se chevauchent auraient doublé chaque sortie commune — l’identifiant de la sortie d’origine est désormais conservé, et il sert à ça.',
    'Le compte rendu dit TOUT : ce qui est entré, ce qui était déjà là, ce qui était illisible, si la période a été tronquée et si l’on s’est arrêté. Une ligne qui n’annoncerait que les chargements laisserait croire que la période n’en comptait pas plus.',
    'Un quota atteint arrête l’import ; une sortie illisible ne l’arrête pas. Continuer après un quota, c’est cent requêtes refusées de plus et un message qui arrive cent fois trop tard.'
  ] },
  { v: '3.14', d: '30.09.2026', points: [
    'TU PEUX CHOISIR LE MOIS. Le menu des périodes ne proposait que des fenêtres relatives — ce mois, le mois dernier — de sorte qu’on ne pouvait composer l’affiche d’août que pendant le mois de septembre, et qu’une planche à l’année ne servait qu’une fois par an. Il liste désormais les mois qui portent vraiment des sorties, avec leur compte : douze affiches d’Almanac pour une année roulée.',
    'Un mois choisi est ABSOLU, pas un recul : « juin 2026 » désignera encore juin 2026 dans six mois. Un projet rouvert retrouve donc la période qu’on avait choisie.',
    'On ne te propose pas un mois vide. Un mois sans sortie n’entre pas dans la liste : offrir « février » à qui n’a pas roulé en février, c’est offrir une affiche vide et la laisser découvrir.',
    'Cela vaut pour les NEUF planches multi-sorties, pas seulement Almanac : la fenêtre est un réglage global, et Strates, Série, Saisons, Tissage, Métro, Atlas, Fresque et Exploration la lisent déjà.',
    'Le studio te dit quand une nouvelle version est prête, au lieu de te laisser recharger pour voir. Le code est servi par génération — une page ne mélange jamais deux versions — et le prix était qu’une version fraîche apparaissait au chargement suivant, sans que rien ne le dise. Un bandeau, un bouton, et la question ne se pose plus.'
  ] },
  { v: '3.13.1', d: '29.09.2026', points: [
    'Si tu es resté bloqué sur une ancienne version, voici pourquoi. Entre la 3.11 et la 3.12, le fichier qui pilote le cache hors ligne n’a pas changé d’un seul octet : seul le numéro avait bougé, dans un fichier qu’il IMPORTE. Or un navigateur décide de remplacer ce fichier en comparant ses octets, et tous ne revérifient pas les imports. Chez ceux-là, la 3.11 servait son propre cache — le numéro compris — et ne pouvait donc plus jamais apprendre qu’une suite existait.',
    'Les huit planches d’Almanac de la galerie étaient l’ÉTAT VIDE, rendu huit fois. Elles avaient été produites sans que l’année de 106 sorties soit chargée ; quatre d’entre elles pesaient exactement le même nombre d’octets. Elles montrent enfin l’année.',
    'Un contrôle refuse désormais que deux entrées de la galerie montrent la même image au bit près. Le seuil d’encre ne pouvait pas l’attraper : une planche vide en porte 0,53 %, et deux planches volontairement sobres — « Fil », « Clairière » — en portent moins.'
  ] },
  { v: '3.13', d: '29.09.2026', points: [
    'Deux planches de plus. « Trame » tisse la sortie : une chaîne, une trame, et le parcours qui les traverse comme un fil — dessus, dessous, dessus. Le tissage se resserre là où l’effort a été fourni, et seulement si la sortie porte la mesure qui le dit.',
    'L’entrelacement de Trame était invisible. Il existait — le banc comptait vingt-trois croisements repeints — mais un brin de chaîne est de l’encre à vingt pour cent, et vingt pour cent de gris posés sur un fil rouille ne se voient pas. Le fil est désormais effacé sous le brin, et l’alternance suit le parcours au lieu de suivre les colonnes.',
    '« Partition » gagne une seconde composition : Graphique. La musicale reste ; celle-ci écrit la sortie dans le TEMPS, sans aucun son, sur papier clair.',
    'Son axe horizontal est le temps écoulé, jamais la distance. C’est ce qui fait qu’une séance de fractionné ne peut pas ressembler à un long col : une descente de dix kilomètres en huit minutes y occupe huit minutes.',
    'Elle se plie vraiment au format : un système en paysage, quatre en portrait, comme une portée passe à la ligne. Et chaque système porte son heure de départ — sans elle, on voyait un rythme sans pouvoir dire à quelle minute il tombait.',
    'Les pauses y sont des trous. Le filet du sol s’interrompt avec le reste : un trait continu dessous recollait le temps que l’arrêt avait coupé.',
    'Le CYANOTYPE, et ce n’est pas une planche : c’est une SURFACE, au même titre que le papier. Elle s’applique aux trente-sept compositions. Trois bains — profond, voilé, négatif — et un halo d’insolation qui n’encode rien, ce que son intitulé dit.',
    'Le tirage ne s’applique jamais sur une photo : un cyanotype est un papier, et repeindre ton image en bleu n’appartient pas au studio. Il cède aussi au noir & blanc, parce que deux réglages qui se contredisent doivent en laisser un gagner pour de bon.',
    'Un export vidéo AVEC tirage sort autour de quinze images par seconde : le procédé relit deux millions de pixels à chaque image. L’image fixe et la séquence PNG n’en souffrent pas.',
    'Sur téléphone, le bouton principal dit « Exporter » et non plus « Enregistrer » : il déclenchait l’export pendant qu’« Enregistrer le projet », deux écrans plus loin, fait tout autre chose.',
    'Un sixième parcours de démonstration, le premier à porter une CADENCE et de vrais ARRÊTS écrits dans l’horodatage. Sans lui, le seuil de détection des pauses n’était relu par aucune donnée.'
  ] },
  { v: '3.12', d: '27.09.2026', points: [
    'LE STUDIO EST EN FRANÇAIS. Il parlait anglais depuis la 3.5, mais les trente-six planches, elles, gravaient leur texte en français — jusque dans le PNG exporté. Douze relecteurs sur douze ont vu le mélange. L’interface rejoint donc la langue dans laquelle tout est écrit.',
    'Le catalogue ne se vide plus quand tu charges ta sortie. Les vignettes se refaisaient AVANT que la sortie soit posée : elles se rendaient sur une activité vide, au moment précis où tu venais de donner ton fichier.',
    'Les vignettes ont la forme du format choisi. Toujours en 9:16, elles mentaient sur la silhouette de l’affiche — et une carte de 583 px ne tenait pas dans une fenêtre de 519. Sur téléphone : deux colonnes, cartes de 314 px, et 1 828 px à faire défiler au lieu de 6 643.',
    'Un projet enregistre enfin le cadrage et l’échelle de la planche, et le rouvrir est retenu — un rechargement juste après restituait la planche précédente.',
    'L’export refuse de livrer une page blanche : quand la période ne retient aucune sortie, il le dit au lieu de télécharger un PNG vide.',
    'Sur iPhone, la vidéo s’annonce impossible AVANT qu’on la tente : Safari n’a ni MediaRecorder ni captureStream. L’image et la séquence PNG, elles, fonctionnent — et le studio t’y renvoie.',
    'La durée d’apparition remonte au-dessus du bouton Exporter, là où on la cherche.'
  ] },
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

