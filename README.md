# Strava Studio

Générateur de visuels d'activité. Tes données, **tes templates, ton code**.
Aucune dépendance, aucun compte, aucun build : du HTML, du JS et un canvas.

## Démarrer

Double-clique sur `index.html`. C'est tout — ça tourne en `file://`, hors ligne.

Si un jour ton navigateur devient tatillon sur les fichiers locaux :

```bash
node tools/dev-server.js
```

puis <http://127.0.0.1:8777>.

## Mettre en ligne (GitHub Pages)

Tout tourne dans le navigateur : il n'y a **rien à exécuter sur le serveur**,
donc n'importe quel hébergement de fichiers statiques en HTTPS convient. C'est
le HTTPS qui débloque l'installation sur le téléphone.

```bash
git remote add origin https://github.com/alpage-studio/strava-studio.git
git push -u origin main
```

Puis, dans le dépôt : **Settings → Pages → Source : Deploy from a branch →
`main` / `/ (root)`**. Une minute plus tard le studio est sur
`https://alpage-studio.github.io/strava-studio/`.

Trois détails qui font que ça marche du premier coup :

- **Tous les chemins sont relatifs** (`src/…`, `assets/…`, `sw.js`). Un site de
  projet GitHub est servi dans un sous-dossier ; un seul chemin absolu et tout
  casse.
- **`.nojekyll`** empêche GitHub de passer le dossier dans son moteur de blog.
- **`.gitignore`** exclut les sorties de débogage et le canevas d'exploration
  (2 Mo de fichier généré). Les identifiants Strava, eux, n'ont jamais été dans
  le dépôt : ils vivent dans `~/.strava-studio/config.json`.

Ce qui **ne** fonctionnera pas en ligne : la partie Strava, qui a besoin du
serveur local pour tenir le secret client. L'encadré affichera « Strava —
indisponible ». Le GPX, les quinze templates, les collections et les trois
exports fonctionnent entièrement côté navigateur.

## Sur le téléphone

Le studio est installable : icône sur l'écran d'accueil, plein écran, hors
ligne. `manifest.webmanifest` le déclare, `sw.js` met les fichiers en cache.

**Une condition : le HTTPS.** Un service worker ne s'enregistre qu'en contexte
sûr — `https://` ou `localhost`. Servi en clair sur l'IP du réseau local
(`node tools/dev-server.js --lan`), le studio s'ouvre et fonctionne, et iOS
accepte même de le poser sur l'écran d'accueil en plein écran — mais **sans
mode hors ligne**. Pour l'avoir vraiment : déposer le dossier sur un
hébergement statique en HTTPS. Tout tourne côté navigateur, il n'y a rien à
exécuter sur le serveur ; seule l'API Strava resterait sur ta machine.

**Livraison des fichiers.** `src/share.js` essaie d'abord la feuille de partage
native (`navigator.share` avec le fichier) : sur iPhone elle ouvre Enregistrer
dans Photos, Instagram, AirDrop. Elle n'est tentée que si le navigateur déclare
accepter CE type de fichier — `canShare({files})` est le seul test fiable,
`navigator.share` existe sur des navigateurs qui refusent les fichiers. Sinon,
téléchargement classique.

**Stratégie de cache : réseau d'abord.** L'inverse est plus rapide mais
transforme chaque modification en énigme — on recharge et on voit l'ancienne
version. Ici, avec du réseau tu as toujours le dernier code ; sans réseau, la
dernière version vue. En ajoutant un template, pense à l'ajouter à la liste
`SHELL` de `sw.js` et à changer `VERSION`.

## Strava

Une fois connecté, les sorties se chargent depuis l'application : plus d'export
GPX à la main.

**Le secret client ne descend jamais dans la page.** Il vit dans
`~/.strava-studio/config.json`, hors du dossier servi, et toutes les requêtes
partent du serveur local. Un secret dans une page web est lisible par quiconque
l'ouvre.

Première connexion — une seule fois :

1. Sur <https://www.strava.com/settings/api>, mettre le domaine de rappel
   (*Authorization Callback Domain*) à `localhost`.
2. Lancer `node tools/dev-server.js`, ouvrir <http://localhost:8778/connect>,
   autoriser.

La portée demandée est **`activity:read_all`**. La portée `read` seule, celle
d'un jeton créé depuis la page des réglages, ne donne PAS accès aux activités —
c'est l'erreur qui coûte une demi-heure.

Les jetons atterrissent dans `~/.strava-studio/tokens.json` et se rafraîchissent
tout seuls. Quotas Strava : 200 requêtes par quart d'heure, 2 000 par jour ;
charger une sortie en coûte deux.

Les agrégats affichés (distance, temps en mouvement, dénivelé, fréquence
cardiaque) sont ceux de Strava, pas les nôtres recalculés : un écart entre
l'image et l'application serait incompréhensible. Les flux ne servent qu'à la
géométrie — tracé, profil, splits.

## Collections

Une collection est une **palette nommée** : `fond`, `fond2`, `encre`, `accent`.
Choisie une fois, elle s'applique à tous les templates qui déclarent des
couleurs. Sans cette couche, changer d'identité voudrait dire toucher quinze
fichiers.

La correspondance rôle → option vit dans `ROLES`, en tête de
`src/collections.js` : un template qui nomme ses options autrement reste libre,
et les options pilotées se grisent dans le panneau plutôt que de laisser croire
qu'elles sont encore réglables.

Sept collections livrées, dont `libre` qui rend la main aux réglages du
template.

## Vidéo

« Exporter la vidéo » enregistre le tracé qui se dessine tout seul, puis le
texte qui apparaît.

Aucun template ne connaît l'animation : le moteur révèle la géométrie
(`Studio.setProgress`) et `H.route`, `H.profile`, `H.bars` et `H.elevation`
n'en peignent que la portion atteinte. **Tout template utilisant ces helpers
s'anime donc gratuitement**, y compris ceux que tu écriras.

### Poser l'animation sur TA vidéo

Deux chemins, et le premier évite le montage.

**Vidéo de fond, dans le studio.** Charge ta vidéo dans l'encadré Photo, choisis
une surcouche `1a`–`1h`, puis « Exporter la vidéo » : chaque image de ta vidéo
est peinte sous la surcouche, avec **sa piste audio** — un canvas n'a pas de
son, on greffe celle de la vidéo, sinon l'export sort muet et ça ne se remarque
qu'une fois publié. Tu obtiens un MP4 fini. Plafonné à 20 secondes.

**Séquence PNG, pour un vrai montage.** « Exporter la séquence PNG » sort 72
images à 24 im/s, chacune en RVB + alpha, dans une archive ZIP. C'est la seule
façon de transporter une animation **transparente** : aucun format vidéo ne
porte d'alpha — vérifié, y compris le WebM sorti de MediaRecorder. CapCut,
Premiere et Resolve importent ça comme une piste qu'on pose sur n'importe quelle
vidéo. L'archive est écrite sans compression, parce que le PNG l'est déjà et
que le studio ne peut pas charger de bibliothèque externe : il tourne hors ligne.

Le format est du **MP4** quand le navigateur sait l'encoder — le seul que les
Stories acceptent. Sinon WebM, et l'interface le dit franchement plutôt que de
livrer un fichier qu'Instagram refusera.

## Alimenter en données

Sur Strava, ouvre une activité → menu `···` → **Export GPX**. Charge le fichier
dans l'encadré 1. Le moteur en tire distance, temps en mouvement, D+, allure,
splits au kilomètre, fréquence cardiaque, la trace et le profil d'altitude.

Pas de GPX sous la main ? `exemple.gpx` est là pour ça, et le volet
« Corriger ou saisir à la main » permet de tout taper à la main — utile pour un
visuel de séance en salle, où il n'y a pas de trace.

## Ce que les templates affichent — et ce qu'ils n'affichent pas

Le parti pris est celui de l'affiche, pas du tableau de bord : **aucune notice
sur l'image**. Pas de type d'activité, pas de date, pas de coordonnées, pas de
légende expliquant un graphique. Ne restent que le nom de la sortie, les
valeurs, et l'unique annotation du sommet.

Les métriques sont celles du **vélo** : la vitesse en km/h, pas l'allure en
min/km. L'allure reste disponible dans l'option « 3ᵉ donnée » des surcouches
pour qui veut la remettre.

## Écrire un template

Un template est **un fichier, une fonction**. Copie
`src/templates/_squelette.js.txt` en `src/templates/mon-truc.js`, ajoute une
ligne `<script>` dans `index.html`, recharge. Il apparaît dans la liste.

```js
Studio.template({
  id: 'mon-truc',
  name: 'Mon truc',
  options: [ { key: 'accent', type: 'color', label: 'Accent', default: '#FF3B30' } ],
  draw: function (s) {
    var H = s.H, u = H.u;
    H.fill('#000');
    H.route(s.a.route, { x: u(8), y: u(20), w: s.w - u(16), h: s.h * 0.5 }, { color: s.o.accent });
    H.stat(H.fmt.km(s.a.distance_km), 'kilomètres', u(8), s.h - u(12));
  }
});
```

Les `options` que tu déclares deviennent automatiquement des contrôles dans le
panneau : `color`, `select`, `range`, `toggle`, `text`.

Deux règles qui font gagner du temps :

- **Écris tes tailles en `u()`.** `u(1)` vaut 1 % de la plus petite dimension.
  Un template écrit comme ça passe de la story 9:16 au post 4:5 sans retouche —
  les deux rendus de référence l'ont vérifié.
- **`draw()` reçoit un canvas nu.** Les helpers ne sont qu'un raccourci ;
  `ctx` est à toi, tout ce que sait faire Canvas 2D est permis.

La liste complète de ce que reçoit `draw()` — données d'activité et helpers —
est commentée en tête du squelette.

## Les surcouches transparentes

Les templates `1a` à `1f` ne produisent pas une image : ils produisent un **PNG
à canal alpha** qu'on pose sur sa propre photo ou vidéo dans Stories. Ils
viennent du handoff « GPX Transparent Overlay Templates » et en reprennent les
cotes exactes, données dans l'espace d'export 1080 × 1920.

Trois règles les gouvernent, et les enfreindre casse le produit :

- **Aucun fond.** Un template déclare `transparent: true` ; le moteur refuse
  alors `H.photo()`, pour que la photo n'entre jamais dans le canvas. Sans ce
  garde-fou, le PNG exporté perd son alpha sans prévenir.
- **Le voile fait partie de l'alpha.** Le dégradé noir directionnel sous le
  texte n'est pas une commodité d'aperçu : c'est lui qui rend le blanc lisible
  sur une photo claire, et il doit être exporté. Il se lit comme une chute de
  lumière, jamais comme un panneau.
- **L'encre des valeurs est du blanc plein.** Seules les étiquettes
  descendent à `rgba(255,255,255,.6–.85)`. Une valeur jamais.

`1g` et `1h` s'ajoutent aux six du handoff : parcours en haut, profil en bas,
en ligne ou en barres. Elles s'en écartent sur un point, et c'est délibéré —
le parcours flotte au milieu du cadre, là où un voile le couvrirait à moitié.
Il porte donc un **halo noir diffus** plutôt qu'un voile : ça se lit comme une
ombre portée, ça laisse la photo ouverte, et ça fait partie de l'alpha exporté.

Le **fond de contrôle** du panneau (damier, photo, photo claire, photo sombre)
vit *derrière* le canvas, en CSS. Il sert à juger la lisibilité et ne touche
jamais au fichier exporté.

Cotes : `H.px(n)` convertit une cote du handoff en pixels du canvas courant,
`H.py(n)` fait de même sur la verticale. `H.lh()` et `H.bl()` donnent hauteur
de ligne et ligne de base, pour poser un bloc comme le ferait CSS.

### Ce qui a été transposé

Le handoff décrit `TIME / ASCENT / POWER`. Nous n'avons pas de capteur de
puissance : la troisième donnée est un **choix de template** (allure, vitesse,
fréquence cardiaque ou distance), allure par défaut. Les étiquettes sont en
français, comme le reste de l'application — un mot à changer par ligne si tu
préfères l'anglais pour un post.

Deux points restés ouverts, comme dans le handoff : ces six templates sont
dessinés pour le **9:16 uniquement** (ils rendent sans erreur en 1:1 et 4:5,
mais les marges ne sont pas pensées pour), et il n'existe qu'une **variante à
encre blanche** — une variante encre sombre pour photographie très claire est
la suite évidente.

Enfin, la police : le handoff demande Helvetica Neue, absente de Windows. Le
rendu utilise donc **Arial**, la substitution que le handoff prévoit lui-même.
Sur un Mac ou un iPhone le même code afficherait Helvetica Neue.

## Structure

```
index.html                     interface + liste des templates chargés
assets/                        la police variable, servie en local
src/activity.js                GPX  ->  objet activité (aucun graphisme)
src/studio.js                  registre, helpers de dessin, rendu, export PNG
src/design.js                  échelle typographique, grille, carte, histogramme
src/overlay.js                 socle des surcouches : voiles, cotes 1080, colonne verticale
src/collections.js             les palettes nommées et leur correspondance d'options
src/video.js                   enregistrement MP4 de l'animation du tracé
src/templates/pente.js         parcours et profil colorés par la déclivité
src/templates/radiale.js       la sortie enroulée sur un cercle
tools/strava.js                OAuth et appels API — côté serveur uniquement
src/templates/sommet.js        parcours en haut + profil en bas (ligne / barres)
src/templates/ov-*.js          les surcouches transparentes (1a à 1f, plus 1g/1h)
src/templates/editorial.js     exemple : carte encartée, grille stricte
src/templates/trace.js         exemple : photo, tracé GPS, stats
src/templates/chiffres.js      exemple : typographique, barres des splits
src/templates/_squelette.js.txt  à copier pour les tiens
tools/make-sample-gpx.js       régénère exemple.gpx
tools/dev-server.js            serveur local + POST /__save (débogage)
```

Le moteur ne décide d'aucun pixel, les templates ne parsent aucune donnée.
Tant que cette frontière tient, tes templates survivront aux évolutions du reste.

## Le socle graphique

`src/design.js` ajoute ce qui sépare un tableau de bord d'une page de magazine.
Trois outils, et la discipline de ne pas les contourner.

**L'échelle typographique.** Cinq rôles, pas cinquante tailles :
`hero`, `value`, `title`, `label`, `meta`. Chacun porte sa graisse, son
interlettrage et sa chasse. Écris `H.t('label')` plutôt que
`{size: u(2.1), weight: 700, tracking: u(0.35)}` — c'est ce qui rend un jeu de
templates cohérent entre eux. L'interlettrage y est proportionnel au corps,
donc le même rôle tient du micro-label au chiffre géant.

```js
H.text('distance totale', g.left, y, H.t('label', { color: gris }));
H.text('17,18', g.left, y2, H.t('hero', { size: 15, color: '#111' }));
```

**La grille.** `var g = H.grid({ box: card, cols: 6 })` puis `g.x(3)`,
`g.w(2)`, `g.left`, `g.bottom`. Plus aucun nombre magique : toute position
sort de la grille, donc tout s'aligne avec tout par construction.

**La carte.** `H.card(box, {fill, radius, shadow})`. Le fond perdu est le
réflexe par défaut ; la carte encartée est ce qui donne l'air éditorial.

S'y ajoutent `H.field(label, valeur, x, y)` — étiquette **au-dessus**, jamais à
côté, c'est ce qui permet d'aligner plusieurs blocs sur une même ligne de base —
`H.bars(valeurs, box, {peak, peakColor, invert})` pour un histogramme à une
seule valeur mise en avant, `H.rule()` et `H.coords(track)`.

Une règle de composition qui évite le défaut le plus courant : **pose l'ancre
du bas avant de couler le contenu depuis le haut**, et ne mélange jamais des
positions en fractions de hauteur avec des décalages absolus. C'est ce mélange
qui faisait se chevaucher le chiffre héros et la ligne de stats au premier jet.

### Police

**Archivo** (variable, SIL OFL) est servie depuis `assets/`, sans appel réseau.
Axes : graisse 100–900, chasse 62–125 % — accessible dans un template via
`H.t('hero', { stretch: 'condensed' })` (mots-clés CSS uniquement :
`condensed`, `semi-condensed`, `expanded`…).

Pour en changer, dépose ton `.woff2` dans `assets/`, déclare le `@font-face`
dans `index.html` et change `FAMILY` en tête de `src/design.js`. Le rendu
attend `document.fonts.ready` avant le premier tracé : sans cette attente, le
canvas fige la pile de repli et ta fonte n'apparaît jamais.

## Ensuite

Brancher l'API Strava pour supprimer l'export GPX manuel : créer une app sur
<https://www.strava.com/settings/api>, flux OAuth sur `localhost`, puis
`/athlete/activities` et `/activities/{id}/streams`. Les streams remplacent le
GPX point par point — `activity.js` reste le seul fichier à toucher, et aucun
template n'en saura rien.
