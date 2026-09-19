/* banc-gravure/rendu.js — regarder la planche, pas seulement la compter.
 *
 *   node tools/banc-gravure/rendu.js [url]
 *
 * Le harnais dit que « Gravure d'altitude » est bien declaree. Il ne dit
 * rien de ce qu'elle DESSINE. Ce banc charge trois sorties choisies pour
 * leurs pieges — un massif, une plaine, une trace sans altitude — rend les
 * deux compositions dans les quatre formats, et MESURE le dessin obtenu.
 *
 * La mesure qui compte : la hauteur occupee par la cr ete. Une sortie de
 * 17 m d'amplitude doit couvrir nettement moins de pixels qu'une de 1083 m.
 * C'est le seul controle qui distingue une gravure honnete d'une gravure
 * qui normalise en silence — et c'est precisement le defaut que le profil
 * normalise du studio rend facile a commettre.
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
    console.log('  puis  NODE_PATH="$(npm root -g)" node tools/banc-gravure/rendu.js');
    process.exit(1);
  }
}());
if (!chromium) { console.log('moteur inconnu : ' + MOTEUR + '  (chromium ou webkit)'); process.exit(1); }
const fs = require('fs');
const path = require('path');
const BANC = __dirname;
const BASE = process.argv[2] || 'http://127.0.0.1:8778/';

const CAS = [
  { gpx: 'montagne.gpx',      etiquette: 'massif 1083 m' },
  { gpx: 'plate.gpx',         etiquette: 'plaine 17 m' },
  { gpx: 'sans-altitude.gpx', etiquette: 'sans altitude' }
];

(async function () {
  const nav = await chromium.launch();
  const mesures = [];

  /* UNE PAGE NEUVE PAR SORTIE. Le studio garde la premiere sortie chargee
   * comme sortie courante : en reutilisant la page, les trois cas rendaient
   * la MEME planche, et le banc affichait trois fois le meme chiffre au
   * pixel pres. C'est ce qui l'a trahi — un banc incapable de distinguer
   * ses propres cas ne mesure rien, quelle que soit sa couleur. */
  for (const cas of CAS) {
    const page = await nav.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', e => { console.log('  ERREUR PAGE : ' + e.message); process.exitCode = 1; });
    await page.addInitScript(() => { try { localStorage['strava-studio-vu'] = '9'; } catch (e) {} });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Studio && window.Studio.get && window.Studio.get('gravure'),
                               null, { timeout: 30000, polling: 250 });
    await page.setInputFiles('#gpx', path.join(BANC, cas.gpx));
    /* attendre la CONDITION, et qu'elle porte sur CETTE sortie : le nom du
     * fichier, pas « une sortie quelconque est chargee ». */
    const attendu = cas.gpx.replace('.gpx', '');
    await page.waitForFunction((n) => {
      const a = window.App && window.App.etat && window.App.etat.base;
      return !!(a && a.name === n && a.track && a.track.length > 100);
    }, attendu, { timeout: 30000, polling: 250 });

    for (const compo of ['frise', 'massif']) {
      const m = await page.evaluate(([compo]) => {
        const cv = document.createElement('canvas');
        const a = window.App.etat.base;
        const o = Object.assign({}, window.App.etat.optionValues || {},
                                { composition: compo, fond: 'papier' });
        window.Studio.render(cv, 'gravure', a, o, [1080, 1350]);
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        /* lignes de pixels ou l'encre apparait, hors zone de texte du bas */
        let haut = -1, bas = -1, encres = 0;
        for (let y = 0; y < cv.height * 0.80; y++) {
          let n = 0;
          for (let x = 0; x < cv.width; x += 2) {
            const i = (y * cv.width + x) * 4;
            if (d[i] < 170 && d[i + 3] > 40) n++;
          }
          if (n > 2) { if (haut < 0) haut = y; bas = y; encres += n; }
        }
        return { haut, bas, hauteur: bas - haut, encres, w: cv.width, h: cv.height,
                 png: cv.toDataURL('image/png') };
      }, [compo]);
      const f = path.join(BANC, 'rendu-' + cas.gpx.replace('.gpx', '') + '-' + compo + '.png');
      fs.writeFileSync(f, Buffer.from(m.png.split(',')[1], 'base64'));
      delete m.png;
      mesures.push(Object.assign({ cas: cas.etiquette, compo }, m));
      console.log(cas.etiquette.padEnd(16) + compo.padEnd(8) +
                  'dessin sur ' + String(m.hauteur).padStart(4) + ' px  (' +
                  Math.round(100 * m.hauteur / m.h) + ' % de la hauteur)  ' +
                  m.encres + ' pixels encres');
    }
    await page.close();
  }
  await nav.close();
  fs.writeFileSync(path.join(BANC, 'mesures.json'), JSON.stringify(mesures, null, 2));

  /* ---- le verdict, pas la couleur ---- */
  console.log('');
  const m1083 = mesures.filter(m => m.cas.indexOf('1083') >= 0);
  const m17 = mesures.filter(m => m.cas.indexOf('17 m') >= 0);
  const sans = mesures.filter(m => m.cas.indexOf('sans') >= 0);
  let ko = 0;
  function dit(ok, texte) { console.log((ok ? '  ok    ' : '  ECHEC ') + texte); if (!ok) ko++; }

  m1083.forEach((a, i) => {
    const b = m17[i];
    const rapport = b.hauteur ? a.hauteur / b.hauteur : 0;
    dit(rapport > 1.6,
        a.compo + ' · la plaine est visiblement plus plate que le massif  (rapport ' +
        rapport.toFixed(2) + ' ; il faut > 1,60)');
  });
  mesures.filter(m => m.cas.indexOf('sans') < 0).forEach(m => {
    dit(m.encres > 3000, m.cas + ' · ' + m.compo + ' · la planche a bien dessine  (' + m.encres + ' px)');
  });
  sans.forEach(m => {
    dit(m.encres > 200 && m.hauteur < m.h * 0.35,
        m.compo + ' · sans altitude : un message, pas un relief invente  (' +
        m.encres + ' px sur ' + m.hauteur + ' px de haut)');
  });
  console.log('\n' + (ko ? ko + ' echec(s)' : 'banc vert'));
  if (ko) process.exitCode = 1;
})();
