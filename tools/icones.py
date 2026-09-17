# -*- coding: utf-8 -*-
"""icones.py — les icônes de l'application, depuis la marque.

    python tools/icones.py

La marque est dessinée une fois, en SVG, dans l'entête de index.html. Les
icônes de l'écran d'accueil ne peuvent pas la référencer : iOS et Android
veulent des PNG carrés. Ce script les redessine donc À PARTIR DES MÊMES
COORDONNÉES, recopiées ci-dessous depuis la grille 24 × 24 du SVG.

Sans ce fichier, la marque et l'icône divergent à la première retouche —
et l'icône est précisément ce qu'on ne regarde plus une fois posée.

LA MARQUE
    Un seul geste : il monte, redescend, puis revient vers la gauche en
    croisant sa propre montée. Le croisement fabrique la contreforme du A,
    le trajet fabrique le chemin.

    Charbon sur papier clair, occupant environ les deux tiers du carré. La
    reconnaissance tient en noir et blanc : c'est la condition qu'on s'est
    donnée, et c'est pourquoi la marque n'emprunte rien à l'accent rouille.

POURQUOI PILLOW PLUTÔT QU'UN RENDU DU SVG
    Aucun moteur SVG n'est installé ici, et faire venir une chaîne de rendu
    complète pour quatre carrés serait disproportionné. Les courbes sont
    échantillonnées à la main — vingt lignes.
"""
import os
import sys

from PIL import Image, ImageDraw

try:
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
except Exception:
    pass

RACINE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(RACINE, 'assets')

PAPIER = (242, 239, 230)    # le papier des planches
CHARBON = (37, 40, 32)      # --ink

# La marque, en segments cubiques de la grille 24 × 24 :
# (depart, controle1, controle2, arrivee) — recopiés du `d` de index.html.
GESTE = [
    ((5.7, 20.4), (7.2, 14.3), (9.5, 8.5), (12.4, 4.5)),
    ((12.4, 4.5), (14.5, 9.3), (16.4, 14.7), (17.9, 19.8)),
    ((17.9, 19.8), (16.6, 19.2), (13.3, 17.0), (6.7, 16.5)),
]

# UN SEUL DESSIN, UN SEUL POIDS.
#
# L'entête trace ce même chemin à la même épaisseur. Deux poids auraient été
# deux marques à tenir d'accord, pour un écart que personne ne voit d'un
# support à l'autre — on ne compare jamais une icône d'accueil et un logo
# d'entête côte à côte. Si un jour le très petit demande du renfort, c'est
# ce nombre-ci, et le même dans index.html.
EPAISSEUR = 2.1

# Le symbole occupe près des trois quarts du carré. À deux tiers il paraissait
# timide : une icône d'accueil est regardée à quarante pixels au milieu
# d'autres, et la marge y coûte de la présence. Une icône masquable en garde
# davantage, parce que le rognage circulaire d'Android mange les coins.
PART = 0.73
PART_MASQUABLE = 0.58


def cubique(p0, p1, p2, p3, n=28):
    pts = []
    for i in range(n + 1):
        t = i / float(n)
        u = 1 - t
        x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
        y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
        pts.append((x, y))
    return pts


def dessine(taille, part, fond, encre):
    S = 4                                    # suréchantillonnage, pour l'antialiasing
    px = taille * S
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    if fond:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * 0.22), fill=fond)

    cote = px * part
    dep = (px - cote) / 2.0
    k = cote / 24.0

    def P(p):
        return (dep + p[0] * k, dep + p[1] * k)

    # LE TRAIT EST TAMPONNÉ, PAS TRACÉ.
    #
    # `ImageDraw.line(…, joint='curve')` laisse de fines coutures claires là
    # où deux segments se rejoignent : à 512 px elles se voient, et une marque
    # qui se voit mal dessinée ne vaut pas mieux qu'une marque mal dessinée.
    # On pose donc un rond à chaque point échantillonné, assez serrés pour se
    # recouvrir : c'est exactement ce que fait un stroke-linecap rond, et il
    # n'y a plus de joint du tout.
    pts = []
    for seg in GESTE:
        pts.extend(cubique(*seg, n=240))
    r = EPAISSEUR * k / 2.0
    for q in pts:
        c = P(q)
        d.ellipse([c[0] - r, c[1] - r, c[0] + r, c[1] + r], fill=encre)

    return im.resize((taille, taille), Image.LANCZOS)


def main():
    if not os.path.isdir(ASSETS):
        print('assets/ absent')
        return 1
    sorties = [
        ('icon-192.png', 192, PART, PAPIER, CHARBON),
        ('icon-512.png', 512, PART, PAPIER, CHARBON),
        ('icon-180.png', 180, PART, PAPIER, CHARBON),
        ('icon-maskable-512.png', 512, PART_MASQUABLE, PAPIER, CHARBON),
    ]
    for nom, taille, part, fond, encre in sorties:
        im = dessine(taille, part, fond, encre)
        if nom == 'icon-180.png':
            # iOS n'aime ni la transparence ni les coins arrondis fournis
            plat = Image.new('RGB', im.size, fond)
            plat.paste(im, mask=im.split()[3])
            im = plat
        im.save(os.path.join(ASSETS, nom))
        print('  %-26s %4d px  %5.0f Ko' % (nom, taille,
              os.path.getsize(os.path.join(ASSETS, nom)) / 1024.0))
    print('\nicônes redessinées depuis la marque')
    return 0


if __name__ == '__main__':
    sys.exit(main())
