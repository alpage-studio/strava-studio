/* banc-gravure/formats.js — les quatre formats, la surcouche, les trois
 * niveaux de texte. Rend des planches a REGARDER et mesure ce qui se compte.
 *
 *   node tools/banc-gravure/formats.js [url]
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
    console.log('  puis  NODE_PATH="$(npm root -g)" node tools/banc-gravure/formats.js');
    process.exit(1);
  }
}());
if (!chromium) { console.log('moteur inconnu : ' + MOTEUR + '  (chromium ou webkit)'); process.exit(1); }
const fs = require('fs');
const path = require('path');
const BANC = __dirname;
const BASE = process.argv[2] || 'http://127.0.0.1:8778/';

const FORMATS = [['story', 1080, 1920], ['post', 1080, 1350],
                 ['carre', 1080, 1080], ['paysage', 1920, 1080]];

(async function () {
  const nav = await chromium.launch();
  const page = await nav.newPage({ viewport: { width: 1400, height: 950 } });
  page.on('pageerror', e => { console.log('  ERREUR PAGE : ' + e.message); process.exitCode = 1; });
  await page.addInitScript(() => { try { localStorage['strava-studio-vu'] = '9'; } catch (e) {} });
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.Studio && window.Studio.get('gravure'),
                             null, { timeout: 30000, polling: 250 });
  await page.setInputFiles('#gpx', path.join(BANC, 'montagne.gpx'));
  await page.waitForFunction(() => {
    const a = window.App.etat.base; return !!(a && a.name === 'montagne');
  }, null, { timeout: 30000, polling: 250 });

  let ko = 0;
  function dit(ok, t) { console.log((ok ? '  ok    ' : '  ECHEC ') + t); if (!ok) ko++; }

  /* --- 1. les quatre formats : le dessin doit tenir DANS le cadre --- */
  console.log('\nLES QUATRE FORMATS');
  for (const [nom, w, h] of FORMATS) {
    for (const compo of ['frise', 'massif']) {
      const m = await page.evaluate(([w, h, compo]) => {
        const cv = document.createElement('canvas');
        window.Studio.render(cv, 'gravure', window.App.etat.base,
          { composition: compo, fond: 'papier', mentions: 'signature' }, [w, h]);
        const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
        let haut = -1, bas = -1, gauche = cv.width, droite = -1, n = 0;
        for (let y = 0; y < cv.height; y++) for (let x = 0; x < cv.width; x += 2) {
          const i = (y * cv.width + x) * 4;
          if (d[i] < 170 && d[i + 3] > 40) {
            if (haut < 0) haut = y; bas = y; n++;
            if (x < gauche) gauche = x; if (x > droite) droite = x;
          }
        }
        return { haut, bas, gauche, droite, n, w: cv.width, h: cv.height,
                 png: cv.toDataURL('image/png') };
      }, [w, h, compo]);
      fs.writeFileSync(path.join(BANC, 'format-' + nom + '-' + compo + '.png'),
                       Buffer.from(m.png.split(',')[1], 'base64'));
      /* Rien ne touche le bord : une planche qui deborde est rognee a
       * l'impression, et le debordement ne se voit pas sur une vignette. */
      const marge = Math.min(m.haut, m.h - m.bas, m.gauche, m.w - m.droite);
      dit(m.n > 3000 && marge >= 8,
          (nom + ' ' + compo).padEnd(18) + m.n + ' px encres, marge mini ' + marge + ' px');
    }
  }

  /* --- 2. la surcouche : sur photo, tout doit rester visible ---
   *
   * LE SUPPORT EST GLOBAL, PAS UNE OPTION DE PLANCHE. Passer `fond` dans les
   * options ne fait rien : le moteur l'ECRASE depuis `setSupport()`, et il
   * est deja en surcouche par defaut. Ce banc-ci mesurait donc deux fois la
   * meme planche transparente et trouvait « 0 % contre 0 % » — deux cas
   * indiscernables, un vert qui ne prouvait rien. On pilote le vrai reglage. */
  console.log('\nSURCOUCHE (reglage global du support)');
  const sur = await page.evaluate(() => {
    const out = {};
    [['papier', false], ['transparent', true]].forEach(function (p) {
      window.Studio.setSupport(p[1]);
      window.Studio.setVoile('bas');
      const cv = document.createElement('canvas');
      window.Studio.render(cv, 'gravure', window.App.etat.base,
        { composition: 'frise', mentions: 'signature' }, [1080, 1350]);
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      let opaques = 0, total = 0;
      for (let i = 3; i < d.length; i += 4 * 7) { total++; if (d[i] > 200) opaques++; }
      out[p[0]] = { part: opaques / total, png: cv.toDataURL('image/png') };
    });
    window.Studio.setSupport(true);
    return out;
  });
  fs.writeFileSync(path.join(BANC, 'surcouche.png'),
                   Buffer.from(sur.transparent.png.split(',')[1], 'base64'));
  dit(sur.papier.part > 0.95, 'sur papier, la planche est opaque  (' +
      Math.round(100 * sur.papier.part) + ' %)');
  /* LA MESURE QUI COMPTE. « transparent » doit laisser passer la photo :
   * si la part opaque approche celle du papier, le reglage ne fait rien. */
  dit(sur.transparent.part < 0.60, 'en surcouche, la photo passe au travers  (' +
      Math.round(100 * sur.transparent.part) + ' % opaque, contre ' +
      Math.round(100 * sur.papier.part) + ' % sur papier)');

  /* --- 3. les trois niveaux de texte --- */
  console.log('\nLES TROIS NIVEAUX DE TEXTE');
  const txt = await page.evaluate(() => {
    const out = {};
    ['aucun', 'signature', 'donnees'].forEach(function (m) {
      const cv = document.createElement('canvas');
      window.Studio.render(cv, 'gravure', window.App.etat.base,
        { composition: 'frise', fond: 'papier', mentions: m }, [1080, 1350]);
      const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
      /* on ne compte QUE le bandeau de texte, sous le dessin */
      let n = 0;
      for (let y = Math.floor(cv.height * 0.82); y < cv.height; y++)
        for (let x = 0; x < cv.width; x += 2) {
          const i = (y * cv.width + x) * 4;
          if (d[i] < 170 && d[i + 3] > 40) n++;
        }
      /* LE PIED DE PLANCHE NE DOIT PAS MORDRE LA MARGE. La troisieme ligne
       * des « Donnees » tombait sous la grille : lisible a l'ecran, rognee
       * a l'impression, et aucun controle ne la voyait puisque tous
       * comptaient des pixels sans regarder OU ils etaient. */
      let bas = -1;
      for (let y = cv.height - 1; y >= 0 && bas < 0; y--)
        for (let x = 0; x < cv.width; x += 2) {
          const i = (y * cv.width + x) * 4;
          if (d[i] < 170 && d[i + 3] > 40) { bas = y; break; }
        }
      out[m] = { px: n, souslebord: cv.height - 1 - bas,
                 marge: Math.round(0.08 * Math.min(cv.width, cv.height)) };
    });
    return out;
  });
  console.log('    aucun ' + txt.aucun.px + ' · signature ' + txt.signature.px +
              ' · donnees ' + txt.donnees.px + '  (pixels de texte)');
  dit(txt.aucun.px === 0, 'aucun · le bandeau de texte est vide');
  dit(txt.signature.px > 200, 'signature · titre et mesures sont la');
  dit(txt.donnees.px > txt.signature.px * 1.2,
      'donnees · en dit strictement plus que signature');
  ['signature', 'donnees'].forEach(function (m) {
    dit(txt[m].souslebord >= txt[m].marge,
        m + ' · le pied de planche reste au-dessus de la marge  (' +
        txt[m].souslebord + ' px sous la derniere ligne, marge ' + txt[m].marge + ' px)');
  });

  await nav.close();
  console.log('\n' + (ko ? ko + ' echec(s)' : 'banc vert'));
  if (ko) process.exitCode = 1;
})();
