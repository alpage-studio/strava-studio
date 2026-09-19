/* banc-gravure/galerie.js — produit les planches de revue des entrees
 * « Gravure d'altitude » du catalogue.
 *
 *   node tools/banc-gravure/galerie.js [url]
 *
 * Le harnais exige que CHAQUE entree du catalogue ait sa planche : ajouter
 * une entree sans l'image fait echouer la galerie, et c'est voulu — une
 * galerie qui annonce une planche absente ment au relecteur.
 *
 * Ne regenere QUE les entrees du template gravure : reconstruire les
 * quarante-cinq autres pour en ajouter quatre changerait des images que
 * personne n'a demande de changer.
 */
'use strict';
const MOTEUR = process.env.MOTEUR || 'chromium';
/* Playwright n'est PAS une dependance du projet : « aucune dependance » est
 * une regle du PRODUIT, et ce banc n'en fait pas partie. Il s'installe a
 * cote, comme pour le lanceur d'acceptation — et on le dit plutot que de
 * laisser tomber une trace d'exception sur quelqu'un qui clone le depot. */
const chromium = (function () {
  try { return require('playwright')[MOTEUR]; }
  catch (e) {
    console.log('playwright est absent.');
    console.log('  npm i -g playwright && npx playwright install chromium webkit');
    console.log('  puis  NODE_PATH="$(npm root -g)" node tools/banc-gravure/galerie.js');
    process.exit(1);
  }
}());
if (!chromium) { console.log('moteur inconnu : ' + MOTEUR + '  (chromium ou webkit)'); process.exit(1); }
const fs = require('fs');
const path = require('path');
const RACINE = path.join(__dirname, '..', '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8778/';
const A = require(path.join(RACINE, 'apercus-catalogue.js'));

/* Les planches ajoutees dans cette serie de travaux. Une liste explicite
 * plutot qu'un motif : « /^gravure/ » n'aurait jamais attrape sous-bois ni
 * versants, et leur absence de la galerie ne se serait vue nulle part. */
const NOUVELLES = ['gravure', 'gravure-puissance', 'sous-bois', 'versants'];
const ENTREES = A.CATALOGUE.filter(e => NOUVELLES.indexOf(e.t) >= 0);
if (!ENTREES.length) { console.log('aucune entree gravure au catalogue'); process.exit(1); }

(async function () {
  const nav = await chromium.launch();
  let ko = 0;
  for (const e of ENTREES) {
    const cle = A.cle(e);
    const gpx = A.JEUX[e.j][e.i || 0];
    const taille = e.taille || [1080, 1920];

    const page = await nav.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', x => { console.log('  ERREUR PAGE : ' + x.message); ko++; });
    await page.addInitScript(() => { try { localStorage['strava-studio-vu'] = '9'; } catch (x) {} });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Studio && window.Studio.get('gravure'),
                               null, { timeout: 30000, polling: 250 });
    await page.setInputFiles('#gpx', path.join(RACINE, gpx));
    await page.waitForFunction(() => {
      const a = window.App.etat.base;
      return !!(a && a.track && a.track.length > 50);
    }, null, { timeout: 30000, polling: 250 });

    /* LA PLANCHE RENDUE EST-ELLE CELLE QU'ON DEMANDE ?
     *
     * L'identifiant etait ecrit EN DUR — 'gravure' — depuis le temps ou il
     * n'y en avait qu'un. Les trois planches « puissance » de la galerie
     * etaient donc des planches d'altitude, et le controle les acceptait
     * parce qu'il ne savait dire qu'une chose : « ca a dessine ».
     *
     * On rend donc AUSSI l'autre gravure sur la meme sortie, et on exige que
     * les deux different. Un controle qui ne compare pas a un temoin ne
     * distingue pas son sujet d'un homonyme.
     */
    /* le temoin : une AUTRE planche de la serie, pour prouver qu'on a bien
     * rendu celle qu'on demande et non son homonyme */
    const autre = NOUVELLES[(NOUVELLES.indexOf(e.t) + 1) % NOUVELLES.length];
    const r = await page.evaluate(([tpl, o, taille]) => {
      /* Le support est un reglage GLOBAL du moteur : laisse a « surcouche »
       * il ecraserait le `fond` de l'entree et les quatre planches
       * sortiraient transparentes. Le catalogue decrit le fond entree par
       * entree, on rend donc la main a ses options. */
      window.Studio.setSupport(false);
      window.Studio.setVoile('aucun');
      const cv = document.createElement('canvas');
      window.Studio.render(cv, tpl, window.App.etat.base, o, taille);
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      /* COMPTER L'ENCRE, PAS LES PIXELS PEINTS. Sur papier, un fond rempli
       * et rien dessus donne 100 % de pixels opaques : la mesure evidente
       * ne sait pas distinguer une planche d'une feuille blanche. On compte
       * donc les pixels qui S'ECARTENT du fond. */
      const fondR = d[0], fondG = d[1], fondB = d[2], fondA = d[3];
      let n = 0, total = 0, haut = -1, bas = -1;
      for (let y = 0; y < cv.height; y++) {
        for (let x = 0; x < cv.width; x += 2) {
          const i = (y * cv.width + x) * 4;
          total++;
          const ecart = Math.abs(d[i] - fondR) + Math.abs(d[i + 1] - fondG) +
                        Math.abs(d[i + 2] - fondB) + Math.abs(d[i + 3] - fondA);
          if (ecart > 40) { n++; if (haut < 0) haut = y; bas = y; }
        }
      }
      /* LA HAUTEUR OCCUPEE, PAS SEULEMENT LA QUANTITE D'ENCRE.
       *
       * Un seuil sur la seule fraction d'encre ne sait pas separer une carte
       * au trait fin — Sous-bois couvre 0,6 % du cadre, et c'est sa signature
       * normale — d'un etat vide, qui en couvre 0,5 %. Deux choses tres
       * differentes, un meme chiffre : le controle accusait la planche la
       * plus legere de ne rien dessiner.
       *
       * L'ETENDUE les separe : un message tient sur une bande de deux lignes,
       * une planche occupe la feuille. */
      return { png: cv.toDataURL('image/png'), remplissage: n / total,
               etendue: bas < 0 ? 0 : (bas - haut) / cv.height };
    }, [e.t, e.o, taille]);

    const f = path.join(RACINE, 'apercus', cle + '.png');
    fs.writeFileSync(f, Buffer.from(r.png.split(',')[1], 'base64'));
    /* Une planche vide s'ecrit aussi bien qu'une planche pleine : sans
     * cette mesure, la galerie se remplirait d'images blanches et le
     * harnais les compterait comme presentes. */
    const temoin = await page.evaluate(([tpl, o, taille]) => {
      window.Studio.setSupport(false);
      window.Studio.setVoile('aucun');
      const cv = document.createElement('canvas');
      window.Studio.render(cv, tpl, window.App.etat.base, o, taille);
      return cv.toDataURL('image/png');
    }, [autre, e.o, taille]);

    const bon = r.remplissage > 0.003 && r.etendue > 0.35;
    const distincte = r.png !== temoin;
    if (!bon || !distincte) ko++;
    console.log((bon && distincte ? '  ok    ' : '  ECHEC ') + cle.padEnd(44) +
                taille.join('x').padEnd(10) + gpx.padEnd(22) +
                (100 * r.remplissage).toFixed(1) + ' % encre · ' +
                Math.round(100 * r.etendue) + ' % de hauteur' +
                (distincte ? '' : '  — IDENTIQUE A ' + autre + ' : mauvaise planche rendue'));
    await page.close();
  }
  await nav.close();
  console.log(ko ? '\n' + ko + ' echec(s)' : '\n' + ENTREES.length + ' planches ecrites');
  if (ko) process.exitCode = 1;
})();
