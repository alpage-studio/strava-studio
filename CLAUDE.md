# alpage studio — ce qu'il faut savoir avant de toucher au code

Ce fichier est la mémoire du dépôt. Chaque règle ci-dessous a été apprise en la
cassant : elle est ici pour que la prochaine session ne la rapprenne pas au même
prix. Si tu en découvres une nouvelle, elle s'écrit ici — pas dans un résumé de
conversation qui disparaît.

## Ce que c'est

Un générateur de visuels à partir de traces GPX. HTML, CSS et JavaScript
classique, un canvas 2D. **Aucune dépendance, aucun build, aucun npm.** Ça tourne
en `file://` et c'est une contrainte du produit, pas une préférence : le studio
doit s'ouvrir sur une machine sans rien installer.

Déployé sur GitHub Pages : `https://alpage-studio.github.io/strava-studio/`.

### Zéro dépendance vaut pour le PRODUIT, pas pour la chaîne de contrôle

`src/`, `index.html`, `sw.js` : rien d'extérieur, jamais. En revanche, un
navigateur headless installé dans un runner de CI ne met rien dans le dépôt et ne
change rien à ce que télécharge un visiteur. Confondre les deux bloquerait de
bons contrôles au nom d'une règle qui ne parle pas d'eux.

## La frontière du moteur

Trois rôles, et ils ne se mélangent pas :

- **`src/activity.js`** lit les GPX et produit une activité (points, distances,
  dénivelé, temps). Il ne dessine rien.
- **`src/templates/*.js`** dessinent une planche à partir d'une activité et des
  aides de `src/design.js` (`H.`). Un template ne connaît ni le DOM, ni les
  réglages de l'application, ni les autres templates.
- **`src/studio.js`** compose : il pose l'état global, appelle le template,
  applique le support et le grain.

`src/templates/_squelette.js.txt` est le gabarit d'un nouveau template. Le lire
avant d'en écrire un.

## Les invariants qui cassent en silence

Ceux-là ne produisent pas d'erreur : ils produisent une sortie fausse.

**`poseEtatGlobal()` avant tout rendu.** `Studio.setAchromatique()`,
`setSupport()`, `setLibrary()`, `setMinimal()` sont un état de moteur, pas des
paramètres d'appel. Dessiner sans les avoir posés dessine avec l'état laissé par
le rendu précédent — une vignette peut alors sortir en noir et blanc parce que la
planche d'avant l'était.

**La transparence est une option globale, pas un style.** Quand
`supportSurcouche` est actif, `estTransparent()` devient vrai, `H.fill()` et
`H.grain()` ne font plus rien, et un template qui peint un dégradé doit passer
par `H.surcouche()`. Un template qui peint directement son fond produira une
surcouche opaque — visuellement « ça marche », et la photo dessous a disparu.

**La chaîne française EST la clé i18n.** `src/i18n.js` traduit depuis le texte
source. Renommer un libellé français casse sa traduction sans rien signaler ; un
contrôle du harnais exige que les 33 templates soient traduits. Les libellés
partagés entre templates (« Cadrage », par exemple) sont une seule entrée : la
changer pour l'un la change pour tous.

**Les conteneurs de données utilisateur portent `data-brut`.** La traduction
parcourt les nœuds texte du DOM ; sans cet attribut elle traduirait le nom d'une
sortie ou le titre saisi par l'utilisateur.

**Les `default:` des options restent des littéraux.** Ils sont sérialisés dans
les projets exportés et comparés tels quels : les remplacer par
`Alpage.PALETTE.xxx` casserait la relecture d'un projet enregistré. Partout
ailleurs, les couleurs viennent de `Alpage.PALETTE`.

**Le support ET le voile sont globaux.** `fond` est devenu le choix
« papier / surcouche », `voile` le choix « aucun / bas / haut / centre » — et le
moteur les transmet au vocabulaire propre de chaque template (`optionsFond()`
dans `src/alpage.js`), il ne peint rien lui-même. Si le menu global et les
`choices` d'un template divergent d'un seul mot, la transmission échoue **en
silence** : aucune erreur, aucun voile. Un contrôle compare les deux listes.

**Une variante est un JEU d'options, pas une valeur.** Le catalogue montre par
défaut les valeurs de la première liste déroulante. Quand cet axe unique ment —
« Fragment » de Médaillon est un cadrage *et* un décalage, « Gravity » d'Almanac
combine trois clés — le template déclare `variantes`. Règle : ce que la galerie
de revue montre doit être atteignable dans l'outil, et un contrôle le vérifie.

**Un menu déclaré vide doit être rempli quelque part.** `<select
id="collection">` ne l'a jamais été : huit palettes existaient, s'appliquaient,
et aucune n'était atteignable. Poser une valeur sur un menu vide ne lève rien —
le défaut n'a aucun symptôme. Un contrôle général couvre tous les `<select>`.

**Une seule `melange()`.** La conversion hexa → rgba vit dans `src/alpage.js`.
Elle a été recopiée vingt fois avant d'y arriver, sous trois noms différents
(`melange`, `alpha`, `teinte`) : accepter `#abc` un jour aurait demandé vingt
modifications, ou produit vingt comportements. Chaque template en garde une
**délégation d'une ligne, déclarée en `function`** — pas en `var` — parce que les
appels précèdent souvent la déclaration dans ces fichiers. Un contrôle refuse la
vingt et unième copie, et il regarde le **corps**, pas le nom.

**En mobile, les nœuds sont DÉPLACÉS, jamais dupliqués.** `ZONES`,
`versPanneaux()`, `versColonne()` et `majDisposition()` dans `src/app.js`
déplacent les mêmes éléments entre la colonne et les panneaux
(`appendChild`). Dupliquer créerait deux éléments de même `id` et les écouteurs
ne suivraient qu'un seul. Un contrôle vérifie que chaque sélecteur de `ZONES`
existe et n'est réclamé que par une zone.

**L'icône et l'entête partagent un tracé.** Le `d` du SVG dans `index.html` et
`GESTE` dans `tools/icones.py` sont les mêmes coordonnées. Retoucher la marque
sans relancer `python tools/icones.py` fait diverger les deux — c'est arrivé le
jour même où l'avertissement a été écrit. Un contrôle compare les dix points.

**Le numéro de version purge le cache.** `src/version.js` est chargé par la page
*et* par `sw.js` via `importScripts` ; `VERSION = 'studio-v' + STUDIO_VERSION`
nomme le cache hors ligne. Modifier un fichier du `SHELL` sans monter le numéro
laisse les visiteurs sur l'ancien cache, sans erreur et sans signe. Le journal
`STUDIO_JOURNAL` vit dans le même fichier, et **il ne décrit que des versions
réellement servies** — pas de numéro rétroactif qu'aucun navigateur n'a vu.

## Le style

Le code est écrit en français : noms, commentaires, libellés. Un commentaire dit
**pourquoi**, jamais quoi — et de préférence ce qui a été essayé avant. C'est le
ton de tout le dépôt ; le tenir n'est pas décoratif, c'est ce qui rend les
avertissements lisibles quand ils comptent.

JavaScript classique : `var`/`function` dans `src/`, pas de modules ES, pas de
`class`, rien qui demande une transpilation. La politique de sécurité de contenu
interdit `eval` et `new Function` dans la page.

## Les contrôles

```bash
node tools/test.js            # 146 cas, sort en 1 si un seul échoue
node tools/acceptation-tete-nue.js   # le parcours réel, navigateur headless
python tools/icones.py        # redessine les icônes depuis la marque
```

`tools/acceptation.js` est le même parcours, chargé à la main dans la console
d'un vrai navigateur — c'est ainsi qu'on éprouve **le site en ligne**.

**Un constat sans témoin est une opinion.** Un contrôle qu'on ajoute doit avoir
été vu échouer sur le défaut qu'il prétend attraper. Et un contrôle qui dépend de
la latence — un `sleep` fixe — ne contrôle pas ce qu'il prétend : attendre une
condition, jamais une durée.

## Le déploiement

`main` est protégée et se déploie par la CI : les contrôles passent, puis Pages
publie. Voir `.github/workflows/publication.yml`. Ne jamais publier sans que le
harnais ET l'acceptation soient verts.

## Ce qui est délibérément laissé de côté

- **`src/app.js` fait ~2 000 lignes pour huit sujets.** Le découper demande de
  décider d'une interface interne, pas de déplacer des lignes. Reporté sciemment.
- **Médaillon « Topographie » et « Rives »** : il faut une source de terrain, et
  des tuiles d'une autre origine *tainteraient* le canvas — tous les exports
  casseraient. Bloqué, pas oublié.
- **L'aperçu animé et l'export MP4** ne sont pas couverts par l'acceptation :
  ils demandent `requestAnimationFrame` et `MediaRecorder` sur plusieurs
  secondes. À éprouver à la main, et les fichiers le disent plutôt que de faire
  semblant.

## Deux pièges d'environnement

- Le rendu du navigateur ne se déclenche pas sans peinture : les images en
  chargement paresseux et `requestAnimationFrame` restent au repos tant qu'on ne
  capture pas l'écran. Mesurer après avoir forcé une capture.
- Les fichiers de ce dépôt sont pleins d'apostrophes françaises : les écrire avec
  un outil d'écriture de fichier, jamais par un heredoc de shell.
