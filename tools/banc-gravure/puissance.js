/* banc-gravure/puissance.js — l'echelle de « Gravure de puissance ».
 *
 *   node tools/banc-gravure/puissance.js [url]
 *   MOTEUR=webkit node tools/banc-gravure/puissance.js
 *
 * LA MESURE QUI COMPTE, et c'est la meme que pour l'altitude.
 *
 * `a.power.data[].y` est normalise par le maximum de la sortie : dessine tel
 * quel, un tempo regulier a 153 W et une seance de sprints a 534 W donnent
 * deux affiches IDENTIQUES. On dessine donc les WATTS contre une reference
 * fixe, et ce banc verifie que la seance dure occupe nettement plus de
 * hauteur que la sortie facile.
 *
 * Sans ce controle, la planche serait jolie et mensongere — exactement le
 * defaut que le profil normalise du studio rend facile a commettre, et qu'on
 * a deja paye une fois sur l'altitude.
 */
'use strict';
const MOTEUR = process.env.MOTEUR || 'chromium';
const chromium = (function () {
  try { return require('playwright')[MOTEUR]; }
  catch (e) {
    console.log('playwright est absent.');
    console.log('  npm i -g playwright && npx playwright install chromium webkit');
    console.log('  puis  NODE_PATH="$(npm root -g)" node tools/banc-gravure/puissance.js');
    process.exit(1);
  }
}());
if (!chromium) { console.log('moteur inconnu : ' + MOTEUR + '  (chromium ou webkit)'); process.exit(1); }
const fs = require('fs'), path = require('path');
const BANC = __dirname;
const BASE = process.argv[2] || 'http://127.0.0.1:8778/';
const CAS = [
  { gpx: 'watts-facile.gpx',   dit: 'tempo 153 W' },
  { gpx: 'watts-durs.gpx',     dit: 'sprints 534 W' },
  { gpx: 'montagne.gpx',       dit: 'sans watts' }
];
(async () => {
  const nav = await chromium.launch();
  const out = [];
  for (const c of CAS) {
    const page = await nav.newPage({ viewport: { width: 1400, height: 950 } });
    page.on('pageerror', e => console.log('PAGEERROR : ' + e.message));
    await page.addInitScript(() => { try { localStorage['strava-studio-vu']='9'; } catch(e){} });
    await page.goto(BASE, {waitUntil:'domcontentloaded'});
    await page.waitForFunction(() => window.Studio && window.Studio.get('gravure-puissance'), null, {timeout:30000,polling:250});
    await page.setInputFiles('#gpx', path.join(BANC, c.gpx));
    const n = c.gpx.replace('.gpx','');
    await page.waitForFunction((x) => { const a=window.App.etat.base; return !!(a && a.name===x); }, n, {timeout:30000,polling:250});
    for (const compo of ['frise','massif']) {
      const m = await page.evaluate(([compo]) => {
        window.Studio.setSupport(false); window.Studio.setVoile('aucun');
        const cv = document.createElement('canvas');
        window.Studio.render(cv, 'gravure-puissance', window.App.etat.base,
          { composition: compo, mentions: 'donnees' }, [1080, 1350]);
        const d = cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
        let haut=-1, bas=-1, encres=0;
        for (let y=0; y<cv.height*0.80; y++) {
          let k=0;
          for (let x=0; x<cv.width; x+=2) { const i=(y*cv.width+x)*4; if (d[i]<170 && d[i+3]>40) k++; }
          if (k>2) { if (haut<0) haut=y; bas=y; encres+=k; }
        }
        return { hauteur: bas-haut, encres, h: cv.height, png: cv.toDataURL('image/png'),
                 watts: window.App.etat.base.power && window.App.etat.base.power.max };
      }, [compo]);
      fs.writeFileSync(path.join(BANC, 'w-' + n + '-' + compo + '.png'),
                       Buffer.from(m.png.split(',')[1],'base64'));
      delete m.png;
      out.push(Object.assign({ cas: c.dit, compo }, m));
      console.log(c.dit.padEnd(16) + compo.padEnd(8) + String(m.hauteur).padStart(4) +
                  ' px (' + Math.round(100*m.hauteur/m.h) + ' %)  ' + m.encres + ' px encres');
    }
    await page.close();
  }
  await nav.close();
  let ko=0; const dit=(o,t)=>{ console.log((o?'  ok    ':'  ECHEC ')+t); if(!o) ko++; };
  console.log('');
  const f = out.filter(o=>o.cas.indexOf('153')>=0), h = out.filter(o=>o.cas.indexOf('534')>=0);
  f.forEach((x,i) => {
    const r = h[i].hauteur / x.hauteur;
    dit(r > 1.5, x.compo + ' · la seance dure occupe nettement plus de hauteur  (rapport ' +
        r.toFixed(2) + ' ; il faut > 1,50)');
  });
  out.filter(o=>o.cas.indexOf('sans')>=0).forEach(o =>
    dit(o.encres > 200 && o.hauteur < o.h*0.35,
        o.compo + ' · sans watts : un message, pas un effort invente  (' + o.encres + ' px)'));
  console.log('\n' + (ko ? ko+' echec(s)' : 'banc vert'));
  if (ko) process.exitCode = 1;
})();
