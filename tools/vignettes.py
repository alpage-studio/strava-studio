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
import io
import os
import re
import sys
import unicodedata

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


def cles_du_catalogue():
    u"""Les identifiants que la galerie declare, lus dans apercus-catalogue.js.

    POURQUOI CE FILTRE EXISTE
        apercus/ est un repertoire de TRAVAIL : les PNG n'y sont pas versionnes,
        et on y depose librement des essais. Ce script convertissait TOUT ce
        qu'il y trouvait, et les WebP, eux, SONT versionnes. Cent quatre essais
        oublies sont ainsi devenus deux cent huit fichiers prets a partir dans
        un commit, pour quatre-vingt-seize megaoctets.

        Le catalogue dit ce que la galerie montre. Le reste reste local.

        Si le catalogue est illisible, on ne filtre RIEN plutot que de
        supprimer en silence ce qu'on n'a pas su lire : un filtre qui se trompe
        de sens efface le travail au lieu de l'epargner.
    """
    chemin = os.path.join(RACINE, 'apercus-catalogue.js')
    if not os.path.exists(chemin):
        return None
    texte = io.open(chemin, encoding='utf-8').read()
    cles = set()
    # les trois libelles d'une entree : f (famille), g (groupe), n (nom)
    for m in re.finditer(r"\{\s*f:\s*'((?:[^'\\]|\\.)*)'\s*,\s*g:\s*'((?:[^'\\]|\\.)*)'"
                         r"\s*,\s*n:\s*'((?:[^'\\]|\\.)*)'", texte):
        brut = m.group(1) + '-' + m.group(2) + '-' + m.group(3)
        brut = brut.replace(chr(92) + "'", "'")
        # meme regle que `cle()` dans apercus-catalogue.js
        sans = unicodedata.normalize('NFD', brut)
        sans = ''.join(c for c in sans if unicodedata.category(c) != 'Mn')
        sans = re.sub(r'[^a-z0-9]+', '-', sans.lower()).strip('-')
        cles.add(sans)
    return cles or None


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

    cles = cles_du_catalogue()
    avant = apres = 0
    faits = ecartes = 0
    for nom in sorted(os.listdir(SOURCE)):
        if not nom.endswith('.png') or IGNORE.match(nom):
            continue
        if cles is not None and nom[:-4] not in cles:
            ecartes += 1
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

    if ecartes:
        print('\n%d PNG hors catalogue laisses en local (essais, comparaisons).'
              % ecartes)

    # Les vignettes qui ne correspondent plus a une entree du catalogue : on les
    # enleve, sinon la galerie publie un rendu qu'elle ne montre nulle part.
    orphelines = []
    for d in (CIBLE, PLEINE):
        for nom in sorted(os.listdir(d)):
            if not nom.endswith('.webp') or nom == 'photo-demo.webp':
                continue
            # LE CATALOGUE SEUL DECIDE, ET JAMAIS LA PRESENCE DU PNG.
            #
            # Les PNG ne sont pas versionnes : sur un depot fraichement
            # clone il n'y en a AUCUN, et une regle qui supprime les WebP
            # sans PNG y effacerait la galerie entiere au premier appel.
            # C'est le genre de faute qu'on ne voit pas sur sa propre
            # machine, ou les fichiers sont tous la.
            #
            # Sans catalogue lisible, on ne supprime rien.
            if cles is None:
                continue
            if nom[:-5] not in cles:
                orphelines.append(os.path.basename(d) + '/' + nom)
                os.remove(os.path.join(d, nom))
    if orphelines:
        print('\nvignettes orphelines supprimées : ' + ', '.join(orphelines))

    # SANS PNG, IL N'Y A RIEN A DIVISER. Sur un depot fraichement clone il
    # n'y en a aucun : le script n'a rien a faire, et il doit le dire
    # plutot que de mourir sur une division par zero au moment du resume.
    if not faits:
        print('\nAucun PNG a convertir. Les %d vignettes publiees sont intactes.'
              % len([n for n in os.listdir(CIBLE) if n.endswith('.webp')]))
        return 0

    print('\n%d vignettes  ·  %.1f Mo → %.1f Mo  (%.0f %% de moins)'
          % (faits, avant / 1048576.0, apres / 1048576.0,
             100 * (1 - apres / float(avant))))
    return 0


if __name__ == '__main__':
    sys.exit(main())
