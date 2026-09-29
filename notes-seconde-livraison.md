# Trois pistes gardées, pas encore dessinées

Le brief de la deuxième livraison nomme **Sculpture**, **Cernes** et **Trame
vivante**. Elles ne sont pas implémentées : ce fichier existe pour que le
concept ne se reperde pas, et surtout pour que les objections déjà identifiées
soient là le jour où quelqu'un s'y met — c'est-à-dire avant d'avoir écrit
quatre cents lignes.

Rien ici n'est une promesse de calendrier.

---

## Sculpture — le relief comme volume

**L'idée.** Le profil d'altitude n'est plus une ligne mais un objet éclairé :
une face en lumière, une face dans l'ombre, une base qui porte. De loin, un
bloc taillé ; de près, la crête est exactement celle qu'on a montée.

**Ce qui est déjà là.** `Alpage.normales()` donne la perpendiculaire en tout
point, ce qui suffit à décider quelle face prend la lumière. `Alpage.serie()`
borne l'échelle aux centiles 3 et 97, donc un pic isolé ne fera pas une aiguille
absurde.

**L'objection à traiter d'abord.** Un ombrage rend TOUJOURS un volume
convaincant, y compris sur une sortie plate : c'est le piège que
`Gravure d'altitude` a déjà rencontré et résolu en calant la hauteur sur le
dénivelé réel contre une référence fixe (`partReelle`, 900 m). Sculpture doit
partir de cette même règle, sinon une balade de 40 m de D+ sortira en massif.
La question à trancher avant de dessiner : **que montre une sortie plate ?** Une
dalle basse est la réponse honnête, et elle doit rester belle, sans quoi la
tentation d'exagérer reviendra par la porte du goût.

**Coût estimé.** Moyen. Le dessin est simple ; c'est l'échelle qui demande du
soin.

---

## Cernes — les années comme un tronc

**L'idée.** Un cerne par période — semaine, mois, année —, l'épaisseur du cerne
donnée par le volume roulé. Une vie d'entraînement lue comme on lit un arbre.

**Ce qui est déjà là.** `Almanac` sait découper une année et `Strates` sait
empiler des périodes avec des échelles communes ; la logique de période
(semaine ISO, position dans la période) vit dans `src/alpage.js` et ne doit pas
être réécrite.

**Les deux objections.**

1. **Une période vide est une information.** Un tronc sans cerne pour 2024 doit
   se voir comme une absence, pas se refermer silencieusement sur l'année
   suivante. `Strates` a déjà payé cette leçon sur une semaine vide.
2. **Le rayon ment vite.** L'aire d'un anneau croît avec le rayon : à épaisseur
   égale, un cerne extérieur paraît bien plus gros qu'un cerne intérieur. Si
   l'épaisseur encode le volume, l'œil lira une progression qui n'existe pas.
   Il faut soit compenser sur l'aire, soit dire dans la légende que c'est
   l'épaisseur qui compte — et le dire vraiment, pas en petit.

**Coût estimé.** Moyen à élevé, à cause du point 2, qui est une décision de
sens avant d'être un calcul.

---

## Trame vivante — le tissage qui se fait

**L'idée.** L'animation de `Trame` : la navette passe, rangée après rangée, et
l'étoffe se construit sous le fil du parcours.

**Ce qui est déjà là.** Tout, ou presque. `H.progressCount()` tronque n'importe
quel dessin selon l'avancement, et `Trame` s'en sert déjà pour son fil.
L'entrelacement n'est peint qu'une fois le fil complet (`vus >= P.length`).

**L'objection.** L'ordre de tissage est vertical (rangée par rangée) tandis que
le fil suit le parcours : les deux ne progressent pas au même rythme, et une
animation naïve montrerait le fil flotter au-dessus d'un vide avant que
l'étoffe ne le rejoigne. Il faut choisir : soit l'étoffe se fait d'abord et le
fil ensuite (honnête, un peu long), soit les deux avancent ensemble et
l'entrelacement se repeint à chaque image — ce qui coûte, puisque les
croisements se recalculent.

**Coût estimé.** Faible si l'on accepte deux temps ; élevé si l'on veut les deux
simultanés.

---

## Ce qu'aucune des trois ne doit refaire

- **Normaliser sur soi-même.** Deux planches s'y sont fait prendre : une sortie
  plate normalisée par son propre maximum ressemble à un col. L'échelle se cale
  sur des unités réelles contre une référence fixe.
- **Fabriquer une mesure absente.** `Alpage.mesures()` dit ce que CETTE sortie
  porte ; ce qui manque s'écrit, il ne se remplace pas par un motif régulier
  qu'on prendrait pour une donnée.
- **Croire un contrôle vert.** Les trois défauts les plus visibles de la
  livraison précédente — la gravure de puissance qui dessinait l'altitude, le
  voile qui suivait la planche, l'entrelacement invisible — sont passés sous
  des contrôles verts. Chacun a été vu sur une IMAGE. Prévoir une planche
  agrandie, pas seulement une vignette.
