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
var STUDIO_VERSION = '3.0';
var STUDIO_DATE = '16.09.2026';

/* ---------- le journal ----------
 *
 * Il vit ICI, contre le numéro de version, et pas dans un fichier séparé :
 * une note de version qui s'écrit ailleurs finit par décrire une version
 * qui n'est pas celle qu'on sert. Changer le numéro sans ajouter sa ligne
 * se voit immédiatement — la liste s'arrête au numéro précédent.
 *
 * La page compare ce tableau au dernier numéro VU par ce navigateur et
 * montre ce qui s'est ajouté depuis. Rien de neuf : rien ne s'affiche.
 *
 * Ordre : la plus récente en tête.
 */
var STUDIO_JOURNAL = [
  { v: '3.0', d: '16.09.2026', points: [
    'Le studio se tient dans un téléphone : une barre d’outils en bas, des panneaux qui remontent, l’aperçu toujours visible.',
    'Le style se choisit en deux temps — une famille, puis sa variante — avec des vignettes rendues depuis TES sorties.',
    'Un écran d’accueil qui montre une planche avant de demander quoi que ce soit.',
    'Encre · Pinceau devient un geste : pression sur de longues portions, attaques amincies, bords dissymétriques.'
  ] },
  { v: '2.9', d: '16.09.2026', points: [
    'L’interface prend la matière des planches : papier, charbon, rouille. Le sombre reste à un doigt.',
    'Le studio s’appelle alpage studio.',
    'Atlas · Archipel : la mention ne traverse plus les totaux, et les médaillons gagnent un quart.',
    'Almanac : la légende passe à la ligne au lieu de sortir de l’image ; graduations plus présentes, taille des symboles réglable.',
    'Strates · Massif devient un vrai massif : les couches se chevauchent.',
    'Encre · Courant respire enfin — il s’ouvre puis revient sur le parcours.',
    'Médaillon · Fragment déborde vraiment du cercle ; encre crème par défaut sur une photo.'
  ] },
  { v: '2.8', d: '16.09.2026', points: [
    'L’interface est en anglais par défaut, avec un sélecteur FR / EN dans l’entête.',
    'Toute planche peut se poser sur une photo : le support « Transparent » est devenu un réglage global, et vaut pour les trente-trois templates.',
    'Les réglages sont repliés : trois essentiels visibles, le reste sous « Réglages fins ».',
    'Les planches multi-sorties se composent par PÉRIODE — cette semaine, la précédente, ce mois, cette année — au lieu de cocher des fichiers.',
    'La galerie dit sous chaque vignette où la régler dans l’outil.',
    'Nouvelle marque, et une palette prise sur les planches elles-mêmes.'
  ] },
  { v: '2.7.2', d: '16.09.2026', points: [
    'Le studio tient dans un téléphone : la page défile, l’aperçu reste à l’écran, le socle d’export se pose en bas.'
  ] },
  { v: '2.7.1', d: '16.09.2026', points: [
    'La galerie des compositions est en ligne, et pèse trois mégaoctets au lieu de quatorze.'
  ] },
  { v: '2.7', d: '16.09.2026', points: [
    'Alpage V2 : Encre, Strates, Empreinte et Atlas gagnent leurs Explorations.',
    'Un rendu « Noir & blanc » global, qui suit dans les exports.',
    'Encre : encoches, chapelet et pointes parasites corrigés — c’était de la géométrie, pas du rendu.'
  ] }
];
