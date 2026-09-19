/* banc-vtt/banc.js — « Sous-bois » et « Versants », sur les mêmes sorties.
 *
 *   node tools/banc-vtt/banc.js [url]
 *   MOTEUR=webkit node tools/banc-vtt/banc.js
 *
 * Le brief demande de comparer les deux propositions sur les MÊMES activités :
 * une boucle avec lacets, une sortie à plusieurs montées et un parcours
 * ouvert. Il demande aussi les quatre formats, les titres longs et les
 * données manquantes. Ce banc fait les quatre, et il MESURE — un banc qui se
 * contente d'écrire des PNG ne dit pas si le dessin tient.
 *
 * CE QU'IL NE COUVRE PAS, et c'est écrit ici plutôt que sous-entendu :
 *   - l'aperçu animé et l'export vidéo de ces deux planches (le banc rend des
 *     images fixes ; l'export vidéo a son propre cas d'acceptation) ;
 *   - le rendu à l'impression A3, trop lourd pour un banc qui tourne à chaque
 *     retouche — les quatre formats d'écran sont couverts ;
 *   - le jugement esthétique, qui n'est pas mesurable et se fait à l'œil sur
 *     les PNG que ce banc écrit.
 */
'use strict';
const MOTEUR = process.env.MOTEUR || 'chromium';
const chromium = (function () {
  try { return require('playwright')[MOTEUR]; }
  catch (e) {
    console.log('playwright est absent.');
    console.log('  npm i -g playwright && npx playwright install chromium webkit');
    console.log('  puis  NODE_PATH="$(npm root -g)" node tools/banc-vtt/banc.js');
    process.exit(1);
  }
}());
if (!chromium) { console.log('moteur inconnu : ' + MOTEUR + '  (chromium ou webkit)'); process.exit(1); }

const fs = require('fs');
const path = require('path');
const BANC = __dirname;
const RACINE = path.join(__dirname, '..', '..');
const BASE = process.argv[2] || 'http://127.0.0.1:8778/';

const SORTIES = [
  { f: 'demo-boucle.gpx',                    dit: 'boucle a lacets' },
  { f: 'tools/banc-gravure/montagne.gpx',    dit: 'deux cols' },
  { f: 'demo-ouvert.gpx',                    dit: 'parcours ouvert' },
  { f: 'tools/banc-gravure/sans-altitude.gpx', dit: 'sans altitude' }
];
const FORMATS = [['story', 1080, 1920], ['post', 1080, 1350],
                 ['carre', 1080, 1080], ['paysage', 1920, 1080]];
const TITRE_LONG = 'Traversée intégrale des Alpes vaudoises par les cols du Jorat et du Marchairuz';

let ko = 0;
function dit(ok, t) { console.log((ok ? '  ok    ' : '  ECHEC ') + t); if (!ok) ko++; }

/* Ce que le navigateur mesure sur une planche : encre, cadre occupé, et de
 * quoi dire si deux rendus diffèrent. */
/* Playwright passe l'argument d'`evaluate` comme UN seul paramètre : une
 * signature `(tpl, o, taille)` recevait le tableau entier dans `tpl` et deux
 * `undefined` derrière. On déstructure, comme le fait le reste du dépôt. */
const MESURE = function ([tpl, o, taille]) {
  window.Studio.setSupport(false);
  window.Studio.setVoile('aucun');
  const cv = document.createElement('canvas');
  window.Studio.render(cv, tpl, window.App.etat.base, o, taille);
  const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data;
  const f = [d[0], d[1], d[2], d[3]];
  let n = 0, tot = 0, haut = -1, bas = -1, gauche = cv.width, droite = -1;
  for (let y = 0; y < cv.height; y++) {
    for (let x = 0; x < cv.width; x += 2) {
      const i = (y * cv.width + x) * 4;
      const ec = Math.abs(d[i] - f[0]) + Math.abs(d[i + 1] - f[1]) +
                 Math.abs(d[i + 2] - f[2]) + Math.abs(d[i + 3] - f[3]);
      tot++;
      if (ec > 40) {
        n++;
        if (haut < 0) haut = y; bas = y;
        if (x < gauche) gauche = x; if (x > droite) droite = x;
      }
    }
  }
  return { encre: n / tot, haut, bas, gauche, droite,
           w: cv.width, h: cv.height, png: cv.toDataURL('image/png') };
};

(async function () {
  const nav = await chromium.launch();

  for (const so of SORTIES) {
    const page = await nav.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', e => { console.log('  ERREUR PAGE : ' + e.message); ko++; });
    await page.addInitScript(() => { try { localStorage['strava-studio-vu'] = '9'; } catch (e) {} });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.Studio && window.Studio.get('sous-bois') &&
                                     window.Studio.get('versants'), null,
                               { timeout: 30000, polling: 250 });
    await page.setInputFiles('#gpx', path.join(RACINE, so.f));
    await page.waitForFunction(() => {
      const a = window.App.etat.base; return !!(a && a.track && a.track.length > 50);
    }, null, { timeout: 30000, polling: 250 });

    console.log('\n' + so.dit.toUpperCase());
    for (const tpl of ['sous-bois', 'versants']) {
      /* --- 1. la planche dessine, dans les quatre formats, sans toucher le bord --- */
      for (const [nom, w, h] of FORMATS) {
        const m = await page.evaluate(MESURE, [tpl, { mentions: 'donnees' }, [w, h]]);
        if (nom === 'post') {
          fs.writeFileSync(path.join(BANC, tpl + '-' + so.dit.replace(/ /g, '-') + '.png'),
                           Buffer.from(m.png.split(',')[1], 'base64'));
        }
        const marge = Math.min(m.haut, m.h - m.bas, m.gauche, m.w - m.droite);
        const sansData = so.dit === 'sans altitude';
        /* Sans altitude, Versants n'affiche qu'un message : peu d'encre est
         * le comportement ATTENDU, pas un echec. Un seuil unique pour les
         * deux cas aurait fait passer l'un ou echouer l'autre. */
        const plancher = (sansData && tpl === 'versants') ? 0.002 : 0.004;
        dit(m.encre > plancher && marge >= 4,
            (tpl + ' · ' + nom).padEnd(26) + (100 * m.encre).toFixed(1) +
            ' % encre · marge ' + marge + ' px');
      }

      /* --- 2. un titre long ne deborde pas --- */
      const long = await page.evaluate(MESURE, [tpl, { mentions: 'signature', titre: TITRE_LONG },
                                                [1080, 1350]]);
      dit(long.droite <= long.w - 4 && long.bas <= long.h - 4,
          (tpl + ' · titre long').padEnd(26) + 'tient dans la feuille  (droite ' +
          long.droite + '/' + long.w + ')');
    }

    /* --- 3. les deux planches racontent des choses DIFFERENTES --- */
    if (so.dit !== 'sans altitude') {
      const [sb, ve] = await Promise.all([
        page.evaluate(MESURE, ['sous-bois', { mentions: 'signature' }, [1080, 1350]]),
        page.evaluate(MESURE, ['versants', { mentions: 'signature' }, [1080, 1350]])
      ]);
      /* Versants remplit une silhouette, Sous-bois pose un trait : si les
       * deux couvraient la meme surface, l'une des deux ne ferait pas son
       * travail. C'est le controle qui distingue « deux templates » de
       * « deux recoloriages », ce que le brief interdit explicitement. */
      dit(ve.encre > sb.encre * 3,
          'les deux planches different vraiment  (versants ' + (100 * ve.encre).toFixed(1) +
          ' % contre sous-bois ' + (100 * sb.encre).toFixed(1) + ' %)');
    }
    await page.close();
  }

  /* --- 4. le tremble de Sous-bois est DETERMINISTE --- */
  const page2 = await nav.newPage({ viewport: { width: 1400, height: 950 } });
  await page2.addInitScript(() => { try { localStorage['strava-studio-vu'] = '9'; } catch (e) {} });
  await page2.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page2.waitForFunction(() => window.Studio && window.Studio.get('sous-bois'), null,
                              { timeout: 30000, polling: 250 });
  await page2.setInputFiles('#gpx', path.join(RACINE, 'demo-boucle.gpx'));
  await page2.waitForFunction(() => {
    const a = window.App.etat.base; return !!(a && a.track && a.track.length > 50);
  }, null, { timeout: 30000, polling: 250 });
  /* Deux appels séparés, pas un `new Function` dans la page : la politique de
   * sécurité du studio est en `script-src 'self'` et refuse d'évaluer une
   * chaîne. Le banc ne doit pas demander une exception que le produit
   * n'accorde à personne. */
  const r1 = await page2.evaluate(MESURE, ['sous-bois', { mentions: 'signature' }, [540, 675]]);
  const r2 = await page2.evaluate(MESURE, ['sous-bois', { mentions: 'signature' }, [540, 675]]);
  const deux = r1.png === r2.png;
  /* LE BRIEF L'EXIGE : aucune irregularite tiree au sort. Sans ce controle,
   * un `Math.random()` glisse dans une texture et l'export video se met a
   * grésiller trente fois par seconde — un defaut qu'on ne voit jamais sur
   * une image fixe. */
  dit(deux, 'sous-bois · deux rendus identiques au pixel  (tremble deterministe)');
  await page2.close();

  await nav.close();
  console.log('\n' + (ko ? ko + ' echec(s)' : 'banc vert'));
  if (ko) process.exitCode = 1;
}());
