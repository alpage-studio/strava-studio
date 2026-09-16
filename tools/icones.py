# -*- coding: utf-8 -*-
"""icones.py — les icônes de l'application, depuis la marque.

    python tools/icones.py

La marque est dessinée une fois, en SVG, dans l'entête de index.html. Les
icônes de l'écran d'accueil ne peuvent pas la référencer : iOS et Android
veulent des PNG carrés. Ce script les redessine donc À PARTIR DES MÊMES
COORDONNÉES, listées ci-dessous dans la grille 24 × 24 du SVG.

Sans ce fichier, la marque et l'icône divergent à la première retouche —
et l'icône est précisément ce qu'on ne regarde plus une fois posée.

Pourquoi Pillow plutôt qu'un rendu du SVG : aucun moteur SVG n'est installé
ici, et faire venir une chaîne de rendu complète pour quatre carrés serait
disproportionné. Les courbes sont échantillonnées à la main — vingt lignes.
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

FOND = (10, 10, 9)          # --bg
TRAIT = (140, 137, 124)     # --mut
ACCENT = (201, 154, 50)     # --acc

# Les deux courbes de la marque, en segments cubiques de la grille 24 × 24 :
# (depart, controle1, controle2, arrivee)
LIGNE_HAUTE = [
    ((5.6, 16.4), (7.7, 16.4), (8.2, 13.2), (9.9, 13.2)),
    ((9.9, 13.2), (11.4, 13.2), (11.8, 15.2), (13.2, 15.2)),
    ((13.2, 15.2), (14.8, 15.2), (15.3, 11.1), (17.0, 11.1)),
]
LIGNE_BASSE = [
    ((5.6, 19.2), (8.2, 19.2), (8.7, 17.1), (10.5, 17.1)),
    ((10.5, 17.1), (12.1, 17.1), (12.5, 18.4), (13.9, 18.4)),
    ((13.9, 18.4), (15.4, 18.4), (15.9, 15.8), (18.4, 15.8)),
]
SOMMET = (17.0, 11.1, 1.15)

# Les épaisseurs de la marque sont données pour un affichage à 24 px. À 512,
# la MÊME proportion devient massive : ce qui se lit comme un trait fin sur
# une puce se lit comme un boudin sur une icône. On les affine donc ici, et
# c'est le seul écart assumé avec le SVG.
EP_PLAQUE = 0.9
EP_LIGNE = 0.95
EP_LIGNE_BASSE = 0.8

# Les courbes de la marque occupent le bas de la grille : c'est juste dans
# une puce de 24 px posee a cote d'un titre, ou l'oeil lit la ligne de base.
# Seules, dans un carre, elles laissent un vide en haut. On les remonte.
DECALAGE_Y = -2.2


def cubique(p0, p1, p2, p3, n=24):
    pts = []
    for i in range(n + 1):
        t = i / float(n)
        u = 1 - t
        x = u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
        y = u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
        pts.append((x, y))
    return pts


def dessine(taille, marge, fond=True):
    """`marge` en unités de la grille 24 : une icône masquable garde de la
    place pour le rognage circulaire d'Android, qui mange les coins."""
    S = 4                                    # suréchantillonnage, pour l'antialiasing
    px = taille * S
    im = Image.new('RGBA', (px, px), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)

    # le fond, arrondi comme la plaque
    if fond:
        d.rounded_rectangle([0, 0, px - 1, px - 1], radius=int(px * 0.22), fill=FOND)

    utile = 24.0 + 2 * marge
    k = px / utile

    def P(p):
        return ((p[0] + marge) * k, (p[1] + marge + DECALAGE_Y) * k)

    # la plaque
    d.rounded_rectangle([P((2.6, 2.6 - DECALAGE_Y))[0], P((2.6, 2.6 - DECALAGE_Y))[1],
                         P((21.4, 21.4 - DECALAGE_Y))[0], P((21.4, 21.4 - DECALAGE_Y))[1]],
                        radius=int(3.4 * k), outline=TRAIT, width=max(1, int(EP_PLAQUE * k)))

    for courbe, couleur, ep in ((LIGNE_BASSE, (146, 114, 44), EP_LIGNE_BASSE),
                                (LIGNE_HAUTE, ACCENT, EP_LIGNE)):
        pts = []
        for seg in courbe:
            pts.extend(cubique(*seg))
        d.line([P(p) for p in pts], fill=couleur, width=max(1, int(ep * k)), joint='curve')

    cx, cy, r = SOMMET
    c = P((cx, cy))
    rr = r * k
    d.ellipse([c[0] - rr, c[1] - rr, c[0] + rr, c[1] + rr], fill=ACCENT)

    return im.resize((taille, taille), Image.LANCZOS)


def main():
    if not os.path.isdir(ASSETS):
        print('assets/ absent')
        return 1
    sorties = [
        ('icon-192.png', 192, 0.0, True),
        ('icon-512.png', 512, 0.0, True),
        ('icon-180.png', 180, 0.0, True),      # iOS : pas de transparence, pas de rognage
        ('icon-maskable-512.png', 512, 5.0, True),
    ]
    for nom, taille, marge, fond in sorties:
        im = dessine(taille, marge, fond)
        if nom == 'icon-180.png':
            plat = Image.new('RGB', im.size, FOND)
            plat.paste(im, mask=im.split()[3])
            im = plat
        im.save(os.path.join(ASSETS, nom))
        print('  %-26s %4d px  %5.0f Ko' % (nom, taille,
              os.path.getsize(os.path.join(ASSETS, nom)) / 1024.0))
    print('\nicônes redessinées depuis la marque')
    return 0


if __name__ == '__main__':
    sys.exit(main())
