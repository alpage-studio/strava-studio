/* test.js — harnais de régression, sans aucune dépendance.
 *
 *   node tools/test.js
 *
 * Il ne teste pas « si le code marche » : il fige les défauts qu'on a déjà
 * payés, pour qu'ils ne reviennent pas. Chaque cas porte le nom du bug qu'il
 * garde fermé.
 *
 * Trois familles :
 *   1. CALCULS   — activity.js chargé hors navigateur, fonctions pures
 *   2. COHÉRENCE — ce qui dérive en silence entre fichiers
 *   3. SERVEUR   — les routes, attaquées pour de vrai
 *
 * Sortie 0 si tout passe, 1 sinon : utilisable tel quel dans un hook.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
let reussis = 0, echoues = 0, ignores = 0;

function ok(nom, condition, detail) {
  if (condition) { reussis++; console.log('  ok    ' + nom); }
  else { echoues++; console.log('  ÉCHEC ' + nom + (detail ? '\n          → ' + detail : '')); }
}
function proche(nom, valeur, attendu, tolerance) {
  const e = Math.abs(valeur - attendu);
  ok(nom + '  (' + arrondi(valeur) + ' ≈ ' + attendu + ')', e <= tolerance,
     'écart ' + arrondi(e) + ', toléré ' + tolerance);
}
function saute(nom, pourquoi) { ignores++; console.log('  passé ' + nom + ' — ' + pourquoi); }
function arrondi(v) { return Math.round(v * 100) / 100; }
function titre(t) { console.log('\n' + t); }

/* ================= 1. CALCULS ================= */

function chargeActivity() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'activity.js'), 'utf8');
  const faux = {};
  // activity.js ne touche au DOM que dans parseGPX ; le reste est pur
  new Function('window', 'DOMParser', src)(faux, function () {});
  return faux.Activity;
}

/* Trace synthétique : n points, dt secondes d'écart, watts constants. */
function trace(opts) {
  const o = Object.assign({ dt: 1, secondes: 60, watts: null, hr: null,
                            vitesse: 8, ele: null, gps: true }, opts);
  const t0 = new Date('2026-09-14T08:00:00Z');
  const n = Math.round(o.secondes / o.dt) + 1;
  const pts = [];
  for (let i = 0; i < n; i++) {
    pts.push({
      lat: o.gps ? 46.5 + i * 2e-6 : null,
      lon: o.gps ? 6.6 : null,
      ele: typeof o.ele === 'function' ? o.ele(i) : o.ele,
      d: i * o.dt * o.vitesse,
      t: new Date(t0.getTime() + i * o.dt * 1000),
      w: typeof o.watts === 'function' ? o.watts(i) : o.watts,
      hr: typeof o.hr === 'function' ? o.hr(i) : o.hr
    });
  }
  return pts;
}

function testsCalculs(A) {
  titre('1. CALCULS');

  /* F1 — l'activité vide contenait 10 km et 120 m de D+, exportables
   * dès qu'on saisissait un titre. */
  const vide = A.empty();
  ok('F1 · activité vide : aucun chiffre',
     vide.distance_km === null && vide.duration_s === null &&
     vide.elev_gain_m === null && vide.name === '',
     JSON.stringify({ d: vide.distance_km, t: vide.duration_s, e: vide.elev_gain_m }));

  /* F2 — le coût sommait des watts sans les multiplier par le temps :
   * le même effort coûtait cinq fois moins sur un enregistrement à 5 s. */
  [1, 5, 10].forEach(function (dt) {
    const pts = trace({ dt: dt, secondes: 60, watts: 300, hr: 150, ele: 500 });
    // marges sous le seuil, pour borner l'effort
    pts.unshift(Object.assign({}, pts[0], { w: 10, d: 0, t: new Date(pts[0].t - dt * 1000) }));
    pts.push(Object.assign({}, pts[pts.length - 1], { w: 10 }));
    const a = A.build({ name: 't', track: pts, ftp: 200, distance_m: 480, duration_s: 60 });
    const f = a.burned({ pct: 1.0, minSec: 10 });
    proche('F2 · coût d’un effort de 60 s à +100 W, points à ' + dt + ' s',
           f.list.length ? f.list[0].cout : -1, 6.0, 0.6);
  });

  /* F3 — une séance sans GPS perdait tout : les points se construisaient
   * en parcourant les latitudes. */
  const ht = A.fromIntervals(
    { name: 'Home trainer', start_date_local: '2026-09-14T08:00:00Z',
      distance: 0, moving_time: 1800 },
    [{ type: 'time', data: Array.from({ length: 600 }, (_, i) => i * 3) },
     { type: 'watts', data: Array.from({ length: 600 }, () => 220) }]
  );
  ok('F3 · séance sans GPS : points construits', ht.track.length === 600, ht.track.length + ' points');
  ok('F3 · séance sans GPS : puissance conservée', ht.has_power === true);
  ok('F3 · séance sans GPS : série de puissance non vide', ht.power.data.length === 600);

  /* Le flux de position d'intervals.icu n'est PAS une liste de paires :
   * latitude dans data, longitude dans data2. */
  const icu = A.fromIntervals(
    { name: 'Sortie', start_date_local: '2026-09-14T08:00:00Z', distance: 1000, moving_time: 300 },
    [{ type: 'latlng', data: [46.50, 46.51, 46.52], data2: [6.60, 6.61, 6.62] },
     { type: 'time', data: [0, 150, 300] },
     { type: 'distance', data: [0, 500, 1000] },
     { type: 'altitude', data: [500, 520, 540] }]
  );
  ok('intervals · latitude dans data, longitude dans data2',
     icu.track.length === 3 && icu.track[0].lat === 46.50 && icu.track[0].lon === 6.60,
     JSON.stringify(icu.track[0] && { lat: icu.track[0].lat, lon: icu.track[0].lon }));

  /* Le dénivelé se lisse : sans ça le bruit GPS invente des centaines de
   * mètres sur une sortie plate. */
  const plat = A.build({
    name: 'plat', distance_m: 8000, duration_s: 1200,
    track: trace({ secondes: 1000, ele: function () { return 500 + (Math.random() - 0.5) * 2; } })
  });
  ok('dénivelé · le bruit GPS ne crée pas de D+ sur du plat',
     plat.elev_gain_m < 25, plat.elev_gain_m + ' m sur un terrain plat bruité');

  const cote = A.build({
    name: 'côte', distance_m: 8000, duration_s: 1200,
    track: trace({ secondes: 1000, ele: function (i) { return 500 + i * 0.2; } })
  });
  proche('dénivelé · montée régulière de 200 m', cote.elev_gain_m, 200, 12);

  /* Le temps en mouvement exclut les pauses. */
  const pause = trace({ secondes: 600, vitesse: 8 });
  for (let i = 200; i < 400; i++) { pause[i].d = pause[199].d; }   // 200 s à l'arrêt
  for (let i = 400; i < pause.length; i++) { pause[i].d -= 200 * 8; }
  const avecPause = A.build({ name: 'p', track: pause, distance_m: pause[pause.length - 1].d });
  ok('temps en mouvement · les pauses sont exclues',
     avecPause.duration_s == null || avecPause.duration_s < 460,
     'duration_s = ' + avecPause.duration_s + ' pour 601 s écoulées dont 200 à l’arrêt');

  /* Le lissage 3 s doit calmer un signal qui oscille à chaque point. */
  const dents = A.build({
    name: 'dents', distance_m: 1000, duration_s: 120,
    track: trace({ secondes: 120, watts: function (i) { return i % 2 ? 300 : 100; }, ele: 500 })
  });
  const ecart = Math.max.apply(null, dents.power.data.map(function (p) { return p.w; })) -
                Math.min.apply(null, dents.power.data.map(function (p) { return p.w; }));
  ok('puissance · le lissage 3 s absorbe l’oscillation (200 W crête à crête)',
     ecart < 120, 'amplitude résiduelle ' + arrondi(ecart) + ' W');

  /* Sans capteur, les allumettes basculent sur la fréquence cardiaque
   * ET le disent : c'est une autre grandeur. */
  const sansW = A.build({
    name: 'sans capteur', distance_m: 5000, duration_s: 600,
    track: trace({ secondes: 600, hr: function (i) { return i > 200 && i < 320 ? 175 : 130; }, ele: 500 })
  });
  const fh = sansW.burned({});
  ok('allumettes · repli cardiaque annoncé', fh.source === 'cardiaque', 'source = ' + fh.source);
  ok('allumettes · au moins un effort détecté par la FC', fh.list.length >= 1, fh.list.length + ' détecté(s)');

  /* L'abscisse d'une allumette suit la distance, pas le rang du point :
   * c'est ce qui les faisait flotter au-dessus du relief. */
  const irregulier = trace({ secondes: 600, watts: function (i) { return i > 400 ? 320 : 150; }, ele: 500 });
  for (let i = 0; i < irregulier.length; i++) {
    // on ralentit fortement en fin de sortie : rang et distance divergent
    irregulier[i].d = i < 400 ? i * 10 : 4000 + (i - 400) * 1;
  }
  const ir = A.build({ name: 'i', track: irregulier, ftp: 200,
                       distance_m: irregulier[irregulier.length - 1].d, duration_s: 600 });
  const fi = ir.burned({ pct: 1.05, minSec: 20 });
  ok('allumettes · l’abscisse suit la distance parcourue',
     fi.list.length >= 1 && fi.list[0].x > 0.85,
     'x = ' + (fi.list[0] ? arrondi(fi.list[0].x) : 'aucune allumette') + ' (attendu > 0,85)');
}

/* ================= 2. COHÉRENCE ================= */

function testsCoherence() {
  titre('2. COHÉRENCE DU PROJET');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

  const scripts = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const shell = [...sw.matchAll(/'\.\/([^']+)'/g)].map(m => m[1]);
  const absents = scripts.filter(s => !shell.includes(s));

  /* Un template ajouté à index.html mais oublié dans SHELL ne fonctionne
   * pas hors ligne — et personne ne s'en aperçoit avant l'avion. */
  ok('sw.js · tous les scripts d’index.html sont dans SHELL',
     absents.length === 0, 'manquants : ' + absents.join(', '));

  ok('sw.js · le fichier de version est mis en cache',
     shell.includes('src/version.js'));

  const ver = fs.readFileSync(path.join(ROOT, 'src', 'version.js'), 'utf8');
  ok('version.js · numéro lisible',
     /var STUDIO_VERSION = '[\d.]+'/.test(ver));

  /* La clé d'API ne doit jamais entrer dans un fichier versionné. */
  const suspects = [];
  (function scan(dir) {
    fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
      if (/^(\.git|node_modules|design)$/.test(e.name)) return;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return scan(p);
      if (!/\.(js|html|json|md|webmanifest)$/.test(e.name)) return;
      const t = fs.readFileSync(p, 'utf8');
      // une suite de 24+ caractères alphanumériques affectée à une clé
      if (/(api_key|client_secret|access_token)\s*[:=]\s*['"][A-Za-z0-9]{20,}['"]/.test(t)) {
        suspects.push(path.relative(ROOT, p));
      }
    });
  }(ROOT));
  ok('aucun identifiant en dur dans les fichiers du projet',
     suspects.length === 0, suspects.join(', '));
}

/* ================= 3. SERVEUR ================= */

function attend(ms) { return new Promise(r => setTimeout(r, ms)); }

async function testsServeur() {
  titre('3. SERVEUR (routes attaquées)');

  const port = 8791 + Math.floor(Math.random() * 40);
  const srv = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(port)],
                    { stdio: 'ignore' });
  const B = 'http://127.0.0.1:' + port;

  try {
    // attendre l'écoute
    for (let i = 0; i < 40; i++) {
      try { await fetch(B + '/index.html'); break; } catch (e) { await attend(100); }
    }

    /* C1 — decodeURIComponent hors try/catch pouvait arrêter le processus. */
    const malForme = await fetch(B + '/%ZZ');
    ok('C1 · URL mal formée → 400', malForme.status === 400, 'statut ' + malForme.status);
    const vivant = await fetch(B + '/index.html');
    ok('C1 · le serveur survit à l’URL mal formée', vivant.status === 200);

    /* S2 — écriture de fichier arbitraire, sans authentification. */
    const save = await fetch(B + '/__save?name=assets/intrus.png', { method: 'POST', body: 'AAAA' });
    ok('S2 · /__save absente sans --debug', save.status === 404, 'statut ' + save.status);
    ok('S2 · aucun fichier écrit',
       !fs.existsSync(path.join(ROOT, 'assets', 'intrus.png')));

    /* S3 — confinement des chemins et fichiers internes. */
    for (const [chemin, attendu] of [
      ['/../strava-studio-private/private.json', [403, 404]],
      ['/..%2fstrava-studio-private/private.json', [403, 404]],
      ['/tools/strava.js', [403]],
      ['/.git/config', [403]]
    ]) {
      const r = await fetch(B + chemin);
      ok('S3 · ' + chemin + ' refusé', attendu.includes(r.status), 'statut ' + r.status);
    }

    /* S1 — injection dans la page de retour OAuth. */
    const dep = await fetch(B + '/connect', { redirect: 'manual' });
    const loc = dep.headers.get('location') || '';
    const etat = (loc.match(/state=([a-f0-9]+)/) || [])[1];
    if (!etat) {
      saute('S1 · échappement du retour OAuth', 'Strava non configuré sur cette machine');
    } else {
      const charge = encodeURIComponent('<img src=x onerror=alert(1)>');
      const page = await (await fetch(B + '/exchange_token?error=' + charge + '&state=' + etat)).text();
      ok('S1 · la balise injectée ne ressort pas exécutable',
         page.indexOf('<img src=x onerror') === -1 && page.indexOf('&lt;img') >= 0);
      const sansEtat = await fetch(B + '/exchange_token?error=x&state=faux');
      ok('S1 · un retour sans état valide est refusé',
         (await sansEtat.text()).indexOf('Retour non reconnu') >= 0);
    }
  } finally {
    // sans attendre la fermeture, Node peut se plaindre d'un handle en cours
    await new Promise(function (r) { srv.once('exit', r); srv.kill(); setTimeout(r, 2000); });
  }
}

/* ================= exécution ================= */

(async function () {
  console.log('Harnais de régression — ' + new Date().toISOString().slice(0, 16).replace('T', ' '));
  testsCalculs(chargeActivity());
  testsCoherence();
  await testsServeur();

  console.log('\n' + reussis + ' réussis · ' + echoues + ' échoués' +
              (ignores ? ' · ' + ignores + ' passés' : ''));
  /* process.exit() coupe Node pendant la fermeture du serveur enfant et
   * Windows s en plaint. On pose le code et on laisse le processus finir. */
  process.exitCode = echoues ? 1 : 0;
}());
