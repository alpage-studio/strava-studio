# -*- coding: utf-8 -*-
"""vignettes.py — fabrique les vignettes WebP de la galerie de revue.

    python tools/vignettes.py

POURQUOI CE SCRIPT EXISTE
    La galerie affiche quarante-six planches. En pleine résolution elles
    pèsent quatorze mégaoctets : sur un téléphone en 4G, la page met une
    minute à se remplir et la revue ne sert plus à rien. Les vignettes
    tombent à un peu plus d'un mégaoctet pour l'ensemble.

    Le clic ouvre toujours le PNG d'origine : on juge une composition sur
    la vignette, un détail sur la planche.

POURQUOI EN PYTHON, DANS UN DÉPÔT SANS DÉPENDANCE
    Le projet n'a aucune dépendance npm, par choix. Redimensionner une
    image demande une bibliothèque ; Pillow est déjà installé sur la
    machine, Node n'a rien ici. Le script reste hors de la chaîne du
    studio : il ne tourne qu'à la revue, jamais dans le navigateur.

L'ALPHA EST CONSERVÉ
    Les variantes « surcouche » sont transparentes par construction :
    c'est justement ce qu'on veut juger. WebP garde le canal alpha — pas
    JPEG, qui l'aurait aplati sur du noir sans rien dire.
"""
import os
import re
import sys

from PIL import Image

# La console Windows est en cp1252 : sans cela, une fleche ou un point
# median fait planter le script APRES avoir ecrit les fichiers.
try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SOURCE = os.path.join(RACINE, 'apercus')
CIBLE = os.path.join(SOURCE, 'v')        # vignettes de la grille
PLEINE = os.path.join(SOURCE, 'p')       # planches publiees, pleine resolution

# 560 px sur le grand côté : deux fois la plus grande colonne de la grille,
# donc net sur un écran à deux pixels physiques par pixel CSS.
COTE = 560
QUALITE = 80
# Pleine resolution, mais en WebP : 12,5 Mo de PNG deviennent 2,8 Mo pour un
# ecart invisible a l'ecran. Les PNG sans perte restent sur le disque, hors
# du depot -- c'est la qu'on juge un grain, pas dans une galerie en ligne.
QUALITE_PLEINE = 88

# Ce qui ne se publie pas : les rendus de la version précédente, gardés en
# local pour comparer, et les planches de synthèse qui n'ont pas d'entrée
# au catalogue.
IGNORE = re.compile(r'^(zz-|photo-demo)')


def vignette(src, dst):
    im = Image.open(src)
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    ech = min(COTE / float(im.width), COTE / float(im.height), 1.0)
    taille = (max(1, int(round(im.width * ech))), max(1, int(round(im.height * ech))))
    im = im.resize(taille, Image.LANCZOS)
    im.save(dst, 'WEBP', quality=QUALITE, method=6)
    return taille


def main():
    if not os.path.isdir(SOURCE):
        print('apercus/ absent — rien à faire.')
        return 1
    for d in (CIBLE, PLEINE):
        if not os.path.isdir(d):
            os.makedirs(d)

    avant = apres = 0
    faits = 0
    for nom in sorted(os.listdir(SOURCE)):
        if not nom.endswith('.png') or IGNORE.match(nom):
            continue
        src = os.path.join(SOURCE, nom)
        dst = os.path.join(CIBLE, nom[:-4] + '.webp')
        t = vignette(src, dst)
        pleine = os.path.join(PLEINE, nom[:-4] + '.webp')
        im = Image.open(src)
        if im.mode != 'RGBA':
            im = im.convert('RGBA')
        im.save(pleine, 'WEBP', quality=QUALITE_PLEINE, method=6)
        avant += os.path.getsize(src)
        apres += os.path.getsize(dst) + os.path.getsize(pleine)
        faits += 1
        print('  %-52s %4dx%-4d %4.0f Ko + %4.0f Ko'
              % (nom[:-4], t[0], t[1], os.path.getsize(dst) / 1024.0,
                 os.path.getsize(pleine) / 1024.0))

    # La photo de démonstration sert de fond CSS aux variantes surcouche :
    # elle est derrière la planche, jamais regardée de près.
    photo = os.path.join(SOURCE, 'photo-demo.png')
    if os.path.exists(photo):
        im = Image.open(photo).convert('RGB')
        im = im.resize((int(im.width * 0.5), int(im.height * 0.5)), Image.LANCZOS)
        im.save(os.path.join(CIBLE, 'photo-demo.webp'), 'WEBP', quality=72, method=6)
        avant += os.path.getsize(photo)
        apres += os.path.getsize(os.path.join(CIBLE, 'photo-demo.webp'))

    # Les vignettes dont la planche a disparu : on les enlève, sinon la
    # galerie affiche un rendu qui n'existe plus au catalogue.
    orphelines = []
    for d in (CIBLE, PLEINE):
        for nom in sorted(os.listdir(d)):
            if not nom.endswith('.webp') or nom == 'photo-demo.webp':
                continue
            if not os.path.exists(os.path.join(SOURCE, nom[:-5] + '.png')):
                orphelines.append(os.path.basename(d) + '/' + nom)
                os.remove(os.path.join(d, nom))
    if orphelines:
        print('\nvignettes orphelines supprimées : ' + ', '.join(orphelines))

    print('\n%d vignettes  ·  %.1f Mo → %.1f Mo  (%.0f %% de moins)'
          % (faits, avant / 1048576.0, apres / 1048576.0,
             100 * (1 - apres / float(avant))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
