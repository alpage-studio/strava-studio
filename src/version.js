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
var STUDIO_VERSION = '3.2';
var STUDIO_DATE = '16.09.2026';

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

