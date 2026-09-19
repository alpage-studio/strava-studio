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

/* L'INTERFACE EST DÉSORMAIS EN PLUSIEURS FICHIERS.
 *
 * src/app.js portait huit sujets ; il en garde trois et le reste vit dans
 * src/app/. Les contrôles qui lisaient « src/app.js » lisaient donc, du jour
 * au lendemain, un tiers du sujet — et repassaient au vert pour la pire des
 * raisons : ils ne regardaient plus l'endroit où la chose se trouve. Ceux-là
 * prennent maintenant TOUTE l'interface. */
function sourceInterface() {
  const dir = path.join(ROOT, 'src', 'app');
  let out = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  if (fs.existsSync(dir)) {
    fs.readdirSync(dir).filter(function (f) { return /[.]js$/.test(f); })
      .forEach(function (f) { out += '\n' + fs.readFileSync(path.join(dir, f), 'utf8'); });
  }
  return out;
}

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

  /* Un exemple listé dans app.js mais absent du disque donne un 404 une fois
   * en ligne — et la règle *.gpx du .gitignore l'avait déjà fait une fois. */
  const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  const exemples = [...appSrc.matchAll(/'((?:exemple|sem)[a-z0-9-]*\.gpx)'/g)].map(m => m[1]);
  const perdus = [...new Set(exemples)].filter(f => !fs.existsSync(path.join(ROOT, f)));
  ok('les exemples cités existent sur le disque  (' + new Set(exemples).size + ')',
     perdus.length === 0, 'absents : ' + perdus.join(', '));
  const horsCache = [...new Set(exemples)].filter(f => !shell.includes(f));
  ok('les exemples sont dans le cache hors ligne',
     horsCache.length === 0, 'manquants : ' + horsCache.join(', '));

  /* ---------- LE SHELL SE SERT D'UNE SEULE GENERATION ----------
   *
   * Le studio etait UN fichier de code ; il en fait dix depuis le decoupage.
   * Avec une strategie reseau-d'abord appliquee requete par requete, une
   * connexion qui flanche sert quelques fichiers neufs et les autres depuis le
   * cache : un melange qui ne ressemble a aucune version. Reproduit sur un
   * profil iPhone — la classe `telephone` n'est jamais posee, la barre du bas
   * disparait, la colonne du bureau s'ecrase sur l'ecran.
   *
   * Deux choses a tenir, et la seconde est celle qu'on oublie :
   *   · le shell se lit dans le cache de SA version, pas sur le reseau ;
   *   · on n'interroge jamais `caches.match` tout court — il cherche dans TOUS
   *     les caches, y compris ceux des versions precedentes. */
  /* LE NUMERO DE VERSION DOIT RESTER LISIBLE SUR TELEPHONE.
   *
   * Il vivait dans un `<span class="sub">`, et la regle telephone cachait
   * toute la classe — baseline et numero ensemble. Sur un telephone il n'y
   * avait donc AUCUN moyen de savoir quelle version on regardait, ce qui est
   * exactement la question qu'on se pose quand l'ecran ne ressemble pas a ce
   * qu'on attend. La seule reponse etait les outils de developpement, c'est-a-
   * dire aucune. */
  (function () {
    const h = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const cache = /header \.sub \{ display: none; \}/.test(h);
    const rendu = /header #header-note \{[^}]*display: block/.test(h);
    ok('version · le numero reste lisible sur telephone',
       !cache || rendu,
       'la regle telephone cache .sub sans rendre #header-note');
  }());

  const swSrc = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  ok('sw · le shell est servi depuis le cache de sa version',
     /CHEMINS_SHELL\.has\(url\.pathname\)/.test(swSrc) &&
     /caches\.open\(VERSION\)[\s\S]{0,200}?c\.match\(req\)/.test(swSrc));
  ok('sw · aucune lecture dans tous les caches a la fois',
     !/(^|[^.\w])caches\.match\(/.test(swSrc),
     '`caches.match` sans cache nomme peut servir un fichier d’une version precedente');

  const ver = fs.readFileSync(path.join(ROOT, 'src', 'version.js'), 'utf8');
  ok('version.js · numéro lisible',
     /var STUDIO_VERSION = '[\d.]+'/.test(ver));

  /* Le journal des nouveautés vit dans le MÊME fichier que le numéro, et
   * c'est ce contrôle qui rend ce voisinage utile : bumper la version sans
   * écrire ce qui a changé échoue ici, pas chez un visiteur à qui la page
   * annoncerait « rien de neuf » après une refonte. */
  (function () {
    const bac = { };
    new Function('window', ver + '; window.V = STUDIO_VERSION;' +
                 ' window.J = typeof STUDIO_JOURNAL === "undefined" ? null : STUDIO_JOURNAL;')(bac);
    if (!bac.J) { saute('version.js · journal', 'STUDIO_JOURNAL absent'); return; }
    ok('version.js · le journal s’ouvre sur la version servie  (' + bac.V + ')',
       bac.J[0] && bac.J[0].v === bac.V,
       'le journal commence à ' + (bac.J[0] || {}).v);
    ok('version.js · chaque entrée dit ce qui a changé',
       bac.J.every(function (e) { return e.v && e.d && (e.points || []).length; }));
    const nums = bac.J.map(function (e) { return e.v; });
    ok('version.js · aucune version en double', new Set(nums).size === nums.length);
  }());

  /* UNE seule horloge. L'aperçu animé, l'export vidéo et la séquence PNG
   * doivent parcourir la même chronologie ; la séquence recopiait autrefois
   * la courbe de la vidéo à la main, avec le commentaire « même courbe que
   * la vidéo » — la définition d'une divergence qui attend son heure. */
  const app = sourceInterface();
  const consommateurs = (app.match(/Studio\.chrono\(/g) || []).length;
  ok('une seule horloge · les trois consommateurs passent par Studio.chrono  (' +
     consommateurs + ')', consommateurs >= 3);
  ok('app.js ne recopie plus la courbe d’animation',
     !/1 - Math\.pow\(1 - /.test(app));
  /* Une planche dont la durée dépend d'un réglage doit passer ce réglage à
   * l'horloge. Sans ça, régler la partition sur vingt secondes donnait une
   * vidéo de quatorze : l'aperçu et l'export se seraient arrêtés au milieu
   * du morceau, ce que la chronologie unique est censée rendre impossible. */
  const appels = app.split('\n').filter(l => /Studio\.chrono\(.+,/.test(l)).length;
  ok('l’horloge reçoit les options du template  (' + appels + ' appels)', appels >= 3);

  /* ---- le piège du `var` appelé trop tôt ----
   *
   * Il a mordu quatre fois en une séance : `alea`, `mesureUtilisee`,
   * `FAMILLES`, puis `lundiDe`. Le mécanisme est toujours le même — une
   * DÉCLARATION est remontée en haut de la fonction, son AFFECTATION non.
   * Le template se charge sans erreur, se rend sans erreur au chargement du
   * fichier, et explose seulement quand quelqu'un l'affiche.
   *
   * Ce contrôle relit chaque corps de `draw:` et signale toute valeur
   * déclarée par `var` et déjà utilisée plus haut. Il ne remplace pas un
   * rendu réel — il rend juste ce bogue-là impossible à réintroduire. */
  (function () {
    const dossier = path.join(ROOT, 'src', 'templates');
    const soucis = [];
    fs.readdirSync(dossier).filter(f => f.endsWith('.js')).forEach(function (f) {
      const src = fs.readFileSync(path.join(dossier, f), 'utf8');
      const iDraw = src.indexOf('draw: function');
      if (iDraw < 0) return;
      /* Les commentaires et les chaînes sont retirés d'abord, en gardant la
       * longueur du texte pour que les positions restent valables. Sans ça,
       * le mot « carte » d'un commentaire passait pour un appel de la
       * variable `carte` — un contrôle qui crie au loup finit par être
       * ignoré, ce qui est pire que pas de contrôle. */
      const corps = src.slice(iDraw)
        .replace(/\/\*[\s\S]*?\*\//g, c => c.replace(/[^\n]/g, ' '))
        .replace(/\/\/[^\n]*/g, c => c.replace(/[^\n]/g, ' '))
        .replace(/'(?:[^'\\\n]|\\.)*'/g, c => c.replace(/[^\n]/g, ' '))
        .replace(/"(?:[^"\\\n]|\\.)*"/g, c => c.replace(/[^\n]/g, ' '));
      // les déclarations `var X = …` posées à l'indentation du corps de draw
      const decls = [...corps.matchAll(/\n    var ([A-Za-z_$][\w$]*) = /g)];
      decls.forEach(function (m) {
        const nom = m[1], pos = m.index;
        // un usage AVANT l'affectation : appel, ou lecture de propriété
        const avant = corps.slice(0, pos);
        const usage = new RegExp('[^\\w$.\'"]' + nom.replace(/\$/g, '\\$') + '\\s*[([.]');
        if (usage.test(avant)) soucis.push(f + ' · ' + nom);
      });
    });
    ok('aucun `var` de template n’est utilisé avant son affectation',
       soucis.length === 0, soucis.join(', '));
  }());

  /* LES FENÊTRES DE TEMPS.
   *
   * « Cette semaine », « le mois dernier » : trois lignes de code et quatre
   * pièges — le lundi d'une semaine à cheval sur deux années, un mois de
   * 28 jours, le recul qui traverse janvier, et la borne de fin qu'on croit
   * inclusive. On éprouve donc sur des dates connues, pas sur « aujourd'hui »
   * qui rendrait le contrôle vert un jour et rouge un autre. */
  (function () {
    const faux = { };
    new Function('window', fs.readFileSync(path.join(ROOT, 'src', 'alpage.js'), 'utf8'))(faux);
    const A = faux.Alpage;
    if (!A || !A.fenetre) { saute('période · fenêtres', 'Alpage.fenetre absent'); return; }

    const jeudi = new Date(2026, 8, 17);            // jeudi 17.09.2026
    const sem = A.fenetre('semaine', 0, jeudi);
    ok('période · la semaine commence le lundi  (' +
       sem.debut.toLocaleDateString('fr-CH') + ')',
       sem.debut.getDay() === 1 && sem.debut.getDate() === 14);
    ok('période · la fin est EXCLUE, une semaine dure sept jours',
       Math.round((sem.fin - sem.debut) / 86400000) === 7);

    const semAvant = A.fenetre('semaine', 2, jeudi);
    ok('période · reculer de deux semaines recule de quatorze jours',
       Math.round((sem.debut - semAvant.debut) / 86400000) === 14);

    /* Le 1er janvier 2027 est un vendredi : sa semaine ISO commence en 2026. */
    const nouvelAn = A.fenetre('semaine', 0, new Date(2027, 0, 1));
    ok('période · une semaine à cheval sur deux années commence en décembre  (' +
       nouvelAn.debut.toLocaleDateString('fr-CH') + ')',
       nouvelAn.debut.getFullYear() === 2026 && nouvelAn.debut.getMonth() === 11);

    const fevrier = A.fenetre('mois', 0, new Date(2026, 1, 15));
    ok('période · février 2026 fait 28 jours',
       Math.round((fevrier.fin - fevrier.debut) / 86400000) === 28);

    const janvier = A.fenetre('mois', 1, new Date(2026, 0, 20));
    ok('période · le mois précédent janvier est décembre de l’année d’avant',
       janvier.debut.getFullYear() === 2025 && janvier.debut.getMonth() === 11);

    ok('période · sans mode, aucune fenêtre — tout est retenu',
       A.fenetre('tout', 0, jeudi) === null);

    const f = A.fenetre('mois', 0, new Date(2026, 8, 15));
    ok('période · le dernier instant du mois précédent est dehors',
       !A.dansLaFenetre(new Date(2026, 7, 31, 23, 59), f));
    ok('période · le premier instant du mois est dedans',
       A.dansLaFenetre(new Date(2026, 8, 1, 0, 0), f));
    ok('période · une sortie sans date n’est jamais retenue par une fenêtre',
       !A.dansLaFenetre(null, f));
  }());

  /* LA MARQUE NE SE DÉDOUBLE PAS.
   *
   * Elle est dessinée en SVG dans l'entête, et redessinée en Python pour les
   * icônes — iOS et Android veulent des PNG. Le fichier icones.py le dit :
   * « sans ce fichier, la marque et l'icône divergent à la première
   * retouche ». C'est exactement ce qui est arrivé en l'affinant : l'entête a
   * changé, l'icône est restée sur l'ancien tracé, et rien ne l'a dit.
   *
   * On compare donc les COORDONNÉES, pas les fichiers : les six points de
   * chaque segment cubique doivent être les mêmes des deux côtés. */
  (function () {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const py = path.join(ROOT, 'tools', 'icones.py');
    if (!fs.existsSync(py)) { saute('marque · icônes', 'icones.py absent'); return; }

    const m = html.match(/<svg class="mark"[\s\S]*?<path d="([^"]+)"/);
    if (!m) { saute('marque · tracé', 'chemin introuvable dans l’entête'); return; }
    const nombresSvg = (m[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

    const src = fs.readFileSync(py, 'utf8');
    const mg = src.match(/GESTE = \[([\s\S]*?)\]/);
    if (!mg) { saute('marque · GESTE', 'littéral introuvable'); return; }
    const nombresPy = (mg[1].match(/-?\d+(?:\.\d+)?/g) || []).map(Number);

    /* Le SVG écrit le point de départ une fois (M) puis trois points par
     * segment ; le Python répète le point de départ de chaque segment. On
     * compare donc la suite dépliée. */
    const dep = [];
    for (var i = 0; i + 1 < nombresPy.length; i += 2) {
      if (i % 8 === 0 && i > 0) continue;          // le départ répété
      dep.push(nombresPy[i], nombresPy[i + 1]);
    }
    const memes = nombresSvg.length === dep.length &&
      nombresSvg.every(function (v, k) { return Math.abs(v - dep[k]) < 0.001; });
    ok('marque · l’icône suit le même tracé que l’entête  (' +
       nombresSvg.length / 2 + ' points)',
       memes, 'entête : ' + nombresSvg.join(' ') + '  —  icône : ' + dep.join(' '));
  }());

  /* LE RANGEMENT NE SE DÉFAIT PAS.
   *
   * `melange()` — une couleur hexa rendue en rgba — était recopiée à
   * l'identique dans dix-sept templates. Elle vit maintenant dans Alpage, et
   * chaque template en garde une délégation d'une ligne. Rien n'empêche de
   * recoller un corps complet au prochain template : ce contrôle le refuse.
   *
   * Il regarde le CORPS, pas le nom : un template a le droit d'avoir sa
   * propre fonction de mélange si elle fait autre chose (strates en a deux,
   * tissage délègue à sa propre teinte). Ce qui est refusé, c'est la
   * dix-huitième copie de la MÊME analyse d'hexadécimal. */
  (function () {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    const fichiers = (html.match(/src="src\/templates\/[^"]+"/g) || [])
      .map(function (m) { return m.slice(5, -1); });
    const copieurs = fichiers.filter(function (f) {
      const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
      return /parseInt\(String\(hex\)\.replace\('#', ''\), 16\)/.test(src);
    });
    ok('rangement · aucun template ne recopie l’analyse d’hexadécimal  (' +
       fichiers.length + ' templates)',
       copieurs.length === 0, 'copies : ' + copieurs.join(', '));

    /* Et l'ordre de chargement : un template qui délègue à Alpage sans
     * qu'Alpage soit chargé avant lui échoue à la première couleur. */
    const iAlpage = html.indexOf('src/alpage.js');
    const iPremier = html.indexOf('src/templates/');
    ok('rangement · Alpage est chargé avant les templates',
       iAlpage > 0 && iAlpage < iPremier);
  }());

  /* LA NAVIGATION.
   *
   * La barre du téléphone ne DUPLIQUE pas les contrôles : elle les DÉPLACE,
   * par sélecteur. Un identifiant renommé dans index.html ne casse donc
   * rien de visible — le panneau se contente d'être vide, et on ne s'en
   * aperçoit qu'en cherchant un réglage qui a disparu. C'est exactement le
   * genre de défaut qu'un contrôle statique attrape et qu'une relecture
   * manque.
   *
   * On lit les littéraux directement dans app.js : ils vivent dans une IIFE
   * qu'on ne peut pas charger sans un DOM complet, et fabriquer ce DOM
   * coûterait plus cher que la règle qu'on vérifie. */
  (function () {
    const app = sourceInterface();
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

    const mz = app.match(/var ZONES = \{[\s\S]*?\n  \};/);
    if (!mz) { saute('navigation · ZONES', 'littéral introuvable'); return; }
    const selecteurs = (mz[0].match(/'#[A-Za-z0-9_-]+'/g) || [])
      .map(function (x) { return x.slice(2, -1); });
    const absents = selecteurs.filter(function (id) {
      return html.indexOf('id="' + id + '"') < 0;
    });
    ok('navigation · chaque contrôle déplacé existe dans la page  (' +
       selecteurs.length + ')',
       absents.length === 0, 'identifiants absents : ' + absents.join(', '));

    /* Un contrôle ne peut pas être réclamé par deux panneaux : le second
     * gagnerait silencieusement, et le premier serait vide. */
    const doubles = selecteurs.filter(function (x, i) { return selecteurs.indexOf(x) !== i; });
    ok('navigation · aucun contrôle réclamé par deux panneaux',
       doubles.length === 0, 'en double : ' + doubles.join(', '));

    /* Les groupes du catalogue : tout template doit être atteignable. Un id
     * mal orthographié ici, et une famille entière disparaît de l'interface
     * — le repli « Autres » la rattrape, mais un id qui ne désigne RIEN
     * laisse une case vide dans la grille. */
    const mg = app.match(/var GROUPES_STYLE = \[[\s\S]*?\n  \];/);
    if (mg) {
      const cites = (mg[0].match(/'[a-z0-9-]+'/g) || [])
        .map(function (x) { return x.slice(1, -1); });
      const fichiers = (html.match(/src="src\/templates\/[^"]+"/g) || []);
      const sources = fichiers.map(function (f) {
        return fs.readFileSync(path.join(ROOT, f.slice(5, -1)), 'utf8');
      }).join('\n');
      const inconnus = cites.filter(function (id) {
        if (['affiches', 'cartes', 'reliefs', 'souvenirs', 'films', 'surcouches'].indexOf(id) >= 0) return false;
        return sources.indexOf("id: '" + id + "'") < 0;
      });
      ok('navigation · tout identifiant cité par le catalogue existe',
         inconnus.length === 0, 'inconnus : ' + inconnus.join(', '));
    } else {
      saute('navigation · GROUPES_STYLE', 'littéral introuvable');
    }

    /* La règle qui a coûté un bandeau impossible à fermer : `display: flex`
     * sur un élément portant `hidden` écrase l'attribut, et le JavaScript a
     * beau faire exactement ce qu'on lui demande, rien ne se passe. */
    ok('navigation · l’attribut hidden est respecté partout',
       /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/.test(html));

    /* Un panneau qui s'ouvre doit pouvoir se fermer. */
    ok('navigation · le panneau a une fermeture et un voile',
       html.indexOf('id="feuille-fermer"') > 0 && html.indexOf('id="feuille-voile"') > 0 &&
       app.indexOf("$('#feuille-fermer').addEventListener") > 0 &&
       app.indexOf("$('#feuille-voile').addEventListener") > 0);

    /* Sur téléphone la colonne est masquée : si la section de l'activité
     * n'est pas déplacée, il devient impossible d'importer quoi que ce soit
     * — l'application est alors jolie et inutilisable. */
    ok('navigation · la sortie reste accessible quand la colonne disparaît',
       mz[0].indexOf('#section-activite') > 0);
  }());

  /* LA LANGUE.
   *
   * Un template ajouté sans traduction ne casse rien : son libellé reste en
   * français au milieu d'une interface anglaise. C'est précisément pour ça
   * qu'il faut un contrôle — le défaut est invisible à l'exécution, et
   * personne ne le verra tant qu'un anglophone ne l'aura pas signalé.
   *
   * On charge les templates dans un vrai contexte (ils lisent le global
   * `Studio`, pas un paramètre) et on confronte chaque chaîne AFFICHÉE au
   * dictionnaire. */
  (function () {
    const vm = require('vm');
    const bac = {
      devicePixelRatio: 1, console: console,
      matchMedia: function () { return { matches: false, addEventListener: function () {} }; },
      requestAnimationFrame: function () { return 0; },
      cancelAnimationFrame: function () {},
      CanvasRenderingContext2D: function () {}, Image: function () {},
      DOMParser: function () {}, performance: { now: function () { return 0; } },
      localStorage: { getItem: function () { return null; }, setItem: function () {} },
      location: { reload: function () {} },
      document: {
        createElement: function () { return { getContext: function () { return {}; }, style: {} }; },
        addEventListener: function () {}, querySelector: function () { return null; },
        querySelectorAll: function () { return []; },
        createTreeWalker: function () { return { nextNode: function () { return null; } }; },
        documentElement: {}, body: null
      }
    };
    bac.window = bac; bac.self = bac;
    vm.createContext(bac);

    function charge(rel) {
      vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), bac, { filename: rel });
    }

    try {
      ['src/studio.js', 'src/alpage.js', 'src/library.js', 'src/overlay.js',
       'src/design.js', 'src/i18n.js'].forEach(charge);
      const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const fichiers = (html.match(/src="(src\/templates\/[^"]+)"/g) || [])
        .map(function (m) { return m.slice(5, -1); });
      fichiers.forEach(function (f) { try { charge(f); } catch (e) { /* template à part */ } });
    } catch (e) {
      saute('langue · chargement', e.message);
      return;
    }

    const reg = bac.Studio.all();
    const manquantes = [];
    const DICO = bac.I18N.DICOS.en;
    function verifie(x) {
      if (typeof x !== 'string' || !x.trim()) return;
      if (!Object.prototype.hasOwnProperty.call(DICO, x)) manquantes.push(x);
    }
    reg.forEach(function (t) {
      verifie(t.name);
      /* Les variantes déclarées sont AFFICHÉES sur les cartes du catalogue :
       * elles se traduisent comme le reste. */
      (t.variantes || []).forEach(function (v) { verifie(v.nom); verifie(v.dit); });
      (t.options || []).forEach(function (o) {
        verifie(o.label);
        (o.choices || []).forEach(function (c) { verifie(c[1]); });
        (o.items || []).forEach(function (c) { verifie(c[1]); });
      });
    });

    /* Une chaîne identique dans les deux langues — « Composition », « Photo »,
     * « Pause » — est présente au dictionnaire avec la même valeur : elle
     * compte comme traduite. Ce qui est signalé ici n'a jamais été écrit. */
    const vraiesManquantes = manquantes;

    /* Le nombre COMPTE : un contrôle qui ne charge que vingt-cinq templates
     * sur trente-trois est vert pour huit templates qu'il n'a pas regardés. */
    const attendus = (fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
      .match(/src="src\/templates\//g) || []).length;
    ok('langue · tous les templates sont chargés pour le contrôle  (' +
       reg.length + ')', reg.length >= attendus,
       'index.html en liste ' + attendus + ', le contrôle en voit ' + reg.length);

    ok('langue · tout libellé de template a sa traduction anglaise  (' +
       reg.length + ' templates)',
       vraiesManquantes.length === 0,
       'sans traduction : ' + vraiesManquantes.slice(0, 8).join(' | ') +
       (vraiesManquantes.length > 8 ? ' … et ' + (vraiesManquantes.length - 8) + ' autres' : ''));

    ok('langue · l\u2019anglais est la langue par d\u00e9faut', bac.I18N.langue() === 'en');

    /* ---------- LES ENTREES QUE PLUS RIEN N'AFFICHE ----------
     *
     * Retirer une fonctionnalite laisse ses libelles au dictionnaire. Ils ne
     * cassent rien : ils encombrent, et surtout ils font croire que la chose
     * existe encore a qui lit le dictionnaire pour savoir ce que fait l'app.
     *
     * DEUX PIEGES, ET LES DEUX ONT FAIT MENTIR UNE PREMIERE VERSION.
     *   · Le corpus ne doit PAS contenir i18n.js : chaque cle s'y trouve
     *     forcement, en tant que cle. Le controle trouvait tout et ne
     *     signalait jamais rien.
     *   · Il faut normaliser. « Photo aussi en N&B » s'ecrit « N&amp;B » dans
     *     le HTML, et une phrase longue y est coupee sur deux lignes : sans
     *     decodage des entites ni ecrasement des espaces, deux libelles bien
     *     vivants passaient pour orphelins — et une suppression aveugle les
     *     aurait emportes. */
    (function () {
      function nettoie(t) {
        return t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
                .replace(/&#39;/g, String.fromCharCode(39)).replace(/&nbsp;/g, ' ')
                .replace(/\s+/g, ' ');
      }
      let corpus = '';
      (function lis(d) {
        fs.readdirSync(d, { withFileTypes: true }).forEach(function (e) {
          const q = path.join(d, e.name);
          if (e.isDirectory()) return lis(q);
          if (!/[.](js|html)$/.test(e.name)) return;
          if (q === path.join(ROOT, 'src', 'i18n.js')) return;
          corpus += fs.readFileSync(q, 'utf8');
        });
      }(path.join(ROOT, 'src')));
      corpus += fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      const cat = path.join(ROOT, 'apercus-catalogue.js');
      if (fs.existsSync(cat)) corpus += fs.readFileSync(cat, 'utf8');
      /* LA GALERIE COMPTE AUSSI. Elle est devenue une page publique traduite
       * par le meme dictionnaire ; sans elle dans le corpus, ses quatre-vingts
       * libelles passaient pour orphelins et une suppression aveugle aurait
       * remis la page en francais. Troisieme fois qu'un controle se trompe de
       * PERIMETRE plutot que de regle. */
      const gal = path.join(ROOT, 'apercus', 'index.html');
      if (fs.existsSync(gal)) corpus += fs.readFileSync(gal, 'utf8');
      corpus = nettoie(corpus);
      const orphelines = Object.keys(DICO).filter(function (k) {
        return corpus.indexOf(nettoie(k)) < 0;
      });
      ok('langue · aucune entree de dictionnaire orpheline  (' +
         Object.keys(DICO).length + ' entrees)',
         orphelines.length === 0,
         'plus affichees nulle part : ' + orphelines.slice(0, 6).join(' | '));
    }());

    /* ---------- LES VARIANTES SONT-ELLES ATTEIGNABLES ? ----------
     *
     * Le défaut signalé : « je retrouve pas tous les templates, empreinte etc,
     * tous les plus artistiques ». Il était réel. Le catalogue n'ouvrait qu'un
     * SEUL axe — la première liste déroulante — et tout ce qui demandait une
     * combinaison restait invisible : « Fragment » de Médaillon est un cadrage
     * et un décalage, « Gravity » d'Almanac combine trois clés, « Massif ·
     * accent » ajoute un réglage à la composition. Ces planches existaient dans
     * la galerie de revue et nulle part dans l'outil.
     *
     * LA RÈGLE CONTRÔLÉE ICI : ce que la galerie montre doit être atteignable.
     *
     * La sélection des variantes est REDÉRIVÉE ici, et non empruntée à
     * src/app.js. Un contrôle qui appellerait la fonction du produit ne
     * prouverait que sa cohérence avec elle-même — y compris quand elle a
     * tort. */
    function variantesDe(t) {
      if (t.variantes && t.variantes.length) return t.variantes;
      const def = (t.options || []).filter(function (d) {
        return d.type === 'select' && d.key !== 'fond' && d.key !== 'voile';
      })[0];
      if (!def) return null;
      return def.choices.map(function (c) {
        const o = {};
        o[def.key] = c[0];
        return { nom: c[1], o: o };
      });
    }
    /* COMPARER À DÉFAUTS ÉGAUX.
     *
     * Une entrée de galerie note `{}` pour la composition de base — « pars des
     * réglages du template » — là où la variante engendrée depuis le premier
     * menu note `{ interpretation: 'trait' }`. Les deux décrivent la MÊME
     * planche. Une première version du contrôle les déclarait différentes et
     * signalait trois défauts qui n'existaient pas.
     *
     * On projette donc les deux côtés sur les clés que la famille fait varier,
     * en remplaçant l'absence par le défaut du template — exactement ce que
     * fait le produit quand on clique sur une carte. */
    function projette(t, cles, o) {
      return cles.map(function (k) {
        const v = (o && o[k] !== undefined) ? o[k]
                : (t.options || []).filter(function (d) { return d.key === k; })
                    .map(function (d) { return d.default; })[0];
        return String(v);
      }).join('\u0000');
    }

    /* 1. Déclarer `variantes` ne doit RIEN retirer : la liste explicite doit
     *    couvrir au moins les valeurs du premier menu, sinon le correctif
     *    provoque la perte qu'il répare. */
    const retirees = [];
    reg.forEach(function (t) {
      if (!t.variantes || !t.variantes.length) return;
      const def = (t.options || []).filter(function (d) {
        return d.type === 'select' && d.key !== 'fond' && d.key !== 'voile';
      })[0];
      if (!def) return;
      def.choices.forEach(function (c) {
        const atteint = t.variantes.some(function (v) {
          return String(v.o[def.key]) === String(c[0]) ||
                 (c[0] === def.default && !Object.keys(v.o).length);
        });
        if (!atteint) retirees.push(t.id + ' · ' + def.key + '=' + c[0]);
      });
    });
    ok('variantes · déclarer une liste ne retire aucune composition',
       retirees.length === 0, retirees.join(' | '));

    /* 2. Chaque planche de la galerie — hors « Support », qui décrit des
     *    réglages globaux et non des compositions — doit avoir sa carte. */
    const catV = path.join(ROOT, 'apercus-catalogue.js');
    if (!fs.existsSync(catV)) {
      saute('variantes · galerie', 'catalogue absent');
    } else {
      const fauxV = {};
      new Function('window', fs.readFileSync(catV, 'utf8'))(fauxV);
      const entrees = fauxV.Apercus.CATALOGUE.filter(function (e) {
        return e.g === 'Original' || e.g === 'Exploration';
      });
      const introuvables = [];
      entrees.forEach(function (e) {
        const t = bac.Studio.get(e.t);
        const liste = t && variantesDe(t);
        if (!liste) { introuvables.push(e.f + ' · ' + e.n + ' (aucune variante)'); return; }
        /* Les clés comparées sont celles des variantes ET CELLES DE L'ENTRÉE.
         *
         * Une première version ne prenait que celles des variantes : pour
         * Médaillon sans liste déclarée, elle ne comparait donc que `palette`,
         * et « Fragment » — cadrage 58, décalage −15 — se projetait sur la
         * palette par défaut, c'est-à-dire sur « Minéral ». Le contrôle
         * déclarait atteignable la planche même qui ne l'était pas. Il est
         * resté VERT sur son propre témoin avant cette correction. */
        const vues = {};
        liste.forEach(function (v) {
          Object.keys(v.o).forEach(function (k) { vues[k] = 1; });
        });
        Object.keys(e.o || {}).forEach(function (k) { vues[k] = 1; });
        const cles = Object.keys(vues);
        const cible = projette(t, cles, e.o || {});
        if (!liste.some(function (v) { return projette(t, cles, v.o) === cible; })) {
          introuvables.push(e.f + ' · ' + e.n + ' ' + JSON.stringify(e.o));
        }
      });
      ok('variantes · les ' + entrees.length +
         ' planches de la galerie sont atteignables dans l’outil',
         introuvables.length === 0,
         'sans carte : ' + introuvables.join(' | '));
    }
  }());

  /* La galerie de revue. Le catalogue décrit ce qui existe ; la génération
   * et la page le lisent tous les deux, donc ils ne peuvent pas diverger sur
   * les LIBELLÉS. Reste à vérifier que chaque entrée a bien son image.
   *
   * Ce contrôle existe parce que le précédent ne contrôlait rien : il
   * testait `img.complete && naturalWidth === 0`, et une image en chargement
   * paresseux n'est pas `complete` — elle passait donc le test sans avoir
   * été chargée. Les quarante-cinq vignettes étaient en 404 et le contrôle
   * disait « aucune cassée ». */
  (function () {
    const cat = path.join(ROOT, 'apercus-catalogue.js');
    if (!fs.existsSync(cat)) { saute('galerie · catalogue', 'absent'); return; }
    const faux = { };
    new Function('window', fs.readFileSync(cat, 'utf8'))(faux);
    const A = faux.Apercus;

    /* LA GALERIE EST UNE PAGE PUBLIQUE, EN ANGLAIS, AVEC LE MEME DICTIONNAIRE.
     *
     * Elle a longtemps ete la page de revue d'une seule personne : sombre, en
     * francais, avec ses propres couleurs. Devenue publique, elle doit parler
     * comme l'outil — et surtout avec la MEME table, pas une copie. Une copie
     * finirait par appeler « Sceau » autrement que le menu qui le regle, ce
     * que la ligne « chemin » sous chaque vignette est censee empecher. */
    const gal = path.join(ROOT, 'apercus', 'index.html');
    if (!fs.existsSync(gal)) {
      saute('galerie · page', 'absente');
    } else {
      const html = fs.readFileSync(gal, 'utf8');
      ok('galerie · elle charge le dictionnaire du studio',
         /src="\.\.\/src\/i18n\.js"/.test(html));
      ok('galerie · elle applique la traduction au chargement',
         /I18N\.appliquer\(/.test(html));
      ok('galerie · elle se declare en anglais', /<html lang="en">/.test(html));
      /* Une seconde table de traduction dans la page serait la copie qu'on
       * refuse : on la reconnait a un objet de correspondances francais →
       * anglais declare sur place. */
      const propre = /var\s+(DICO|TRAD|EN)\s*=\s*\{/.test(html);
      ok('galerie · elle ne tient pas sa propre table de traduction', !propre);
    }

    const cles = A.CATALOGUE.map(A.cle);
    ok('galerie · les identifiants du catalogue sont uniques  (' + cles.length + ')',
       new Set(cles).size === cles.length);
    ok('galerie · chaque entrée nomme un template et un jeu de données',
       A.CATALOGUE.every(function (e) { return e.t && e.f && e.g && e.n && e.j; }));
    ok('galerie · chaque jeu de données est déclaré',
       A.CATALOGUE.every(function (e) { return e.j === 'annee' || A.JEUX[e.j]; }));

    const dossier = path.join(ROOT, 'apercus');
    if (!fs.existsSync(dossier)) { saute('galerie · vignettes', 'apercus/ non généré'); return; }

    /* Les PNG sources ne sont PAS versionnés : sur un dépôt fraîchement
     * cloné ils n'existent pas, et exiger leur présence ferait échouer un
     * contrôle qui n'a rien constaté. On ne les vérifie que si la
     * génération a tourné ici. */
    const avecPng = cles.filter(function (k) {
      return fs.existsSync(path.join(dossier, k + '.png'));
    });
    if (avecPng.length === 0) {
      saute('galerie · planches sources', 'aucun PNG local (dépôt cloné)');
    } else {
      ok('galerie · chaque entrée a sa planche source  (' + cles.length + ')',
         avecPng.length === cles.length,
         'absentes : ' + (cles.length - avecPng.length));
    }

    /* CE QUI PART EN LIGNE : deux dossiers de WebP. v/ pour la grille,
     * p/ pour le clic. C'est le seul contrôle qui porte sur des fichiers
     * VERSIONNÉS — s'il passe, la galerie s'affiche depuis le dépôt, PNG
     * locaux ou pas. */
    [['v', 'vignettes', 2], ['p', 'planches', 5]].forEach(function (d) {
      const dir = path.join(dossier, d[0]);
      if (!fs.existsSync(dir)) {
        saute('galerie · ' + d[1] + ' WebP', 'apercus/' + d[0] + '/ non généré');
        return;
      }
      const manquantes = cles.filter(function (k) {
        return !fs.existsSync(path.join(dir, k + '.webp'));
      });
      ok('galerie · chaque entrée a sa ' + d[1].slice(0, -1) + ' WebP  (' +
         cles.length + ')',
         manquantes.length === 0, 'absentes : ' + manquantes.join(', '));

      /* Le poids, pas seulement la présence : une vignette de 400 Ko ne
       * vaut pas mieux que la planche qu'elle remplace. */
      let poids = 0;
      cles.forEach(function (k) {
        const f = path.join(dir, k + '.webp');
        if (fs.existsSync(f)) poids += fs.statSync(f).size;
      });
      ok('galerie · les ' + d[1] + ' pèsent moins de ' + d[2] + ' Mo  (' +
         (poids / 1048576).toFixed(2) + ' Mo)', poids < d[2] * 1048576);
    });

    /* La page ne doit pointer que sur des fichiers PUBLIÉS. photo-demo.png
     * reste hors du dépôt : la page doit donc viser sa vignette, sinon le
     * fond des surcouches est un 404 une fois en ligne. */
    const pageGalerie = path.join(dossier, 'index.html');
    if (fs.existsSync(pageGalerie)) {
      const html = fs.readFileSync(pageGalerie, 'utf8');
      ok('galerie · la page ne vise que des fichiers publiés',
         html.indexOf('v/photo-demo.webp') > 0 &&
         html.indexOf('.png') < 0);
      ok('galerie · la grille ne déborde pas sous la largeur de colonne',
         html.indexOf('minmax(min(var(--col), 100%), 1fr)') > 0);
    }

    /* Les fichiers cités par le catalogue doivent exister, sinon la
     * génération échoue à mi-parcours sans le dire clairement. */
    const fichiers = [];
    Object.keys(A.JEUX).forEach(function (j) {
      (A.JEUX[j] || []).forEach(function (f) { if (fichiers.indexOf(f) < 0) fichiers.push(f); });
    });
    const perdus = fichiers.filter(function (f) { return !fs.existsSync(path.join(ROOT, f)); });
    ok('galerie · les parcours de démonstration existent  (' + fichiers.length + ')',
       perdus.length === 0, 'absents : ' + perdus.join(', '));
  }());

  /* Le rendu achromatique. Il ne peut pas être un filtre CSS — celui-ci ne
   * suit pas dans toBlob — donc chaque couleur est convertie à la source.
   * Ce qui doit tenir : toutes les syntaxes du studio, l'alpha préservé, et
   * deux teintes distinctes qui ne se confondent pas. */
  (function () {
    const faux = {};
    new Function('window', 'CanvasRenderingContext2D',
      fs.readFileSync(path.join(ROOT, 'src', 'studio.js'), 'utf8'))
      (faux, function () {});
    const gris = faux.Studio.versGris;

    ok('gris · #RRGGBB  (rouille → ' + gris('#A54F37') + ')',
       gris('#A54F37') === 'rgb(96,96,96)', gris('#A54F37'));
    ok('gris · #RGB court', gris('#fff') === 'rgb(255,255,255)', gris('#fff'));
    ok('gris · rgb()', gris('rgb(36,40,32)') === 'rgb(39,39,39)', gris('rgb(36,40,32)'));
    /* L'alpha DOIT survivre : la moitié des planches pose ses gris et ses
     * voiles en rgba, et les aplatir à 1 remplirait toutes les surcouches. */
    ok('gris · rgba() garde son alpha', gris('rgba(36,40,32,0.45)') === 'rgba(39,39,39,0.45)',
       gris('rgba(36,40,32,0.45)'));
    ok('gris · un dégradé n’est pas touché', gris({ objet: 1 }).objet === 1);
    ok('gris · une syntaxe inconnue reste intacte', gris('currentColor') === 'currentColor');

    /* Le papier crème DOIT devenir un gris neutre : du crème n'est pas du
     * noir et blanc, et le laisser aurait vidé le réglage de son sens. */
    const papier = gris('#F2EFE6');
    const m = /rgb\((\d+),(\d+),(\d+)\)/.exec(papier);
    ok('gris · le papier crème devient neutre  (' + papier + ')',
       m && m[1] === m[2] && m[2] === m[3]);

    /* Rouille et bleu ne doivent pas tomber sur le même gris, sinon deux
     * sorties distinctes deviennent indiscernables en noir et blanc. */
    const rouille = gris('#A54F37'), bleu = gris('#355E70');
    ok('gris · rouille et bleu restent distincts  (' + rouille + ' / ' + bleu + ')',
       rouille !== bleu);

    /* Mais neuf niveaux d'écart ne SUFFISENT pas à distinguer deux sorties
     * sur une planche multi-activités : la luminance rapproche le rouille et
     * le bleu. D'où la rampe de gris régulière, qui les répartit. */
    const rampe = faux.Studio.rampeDeGris(5);
    ok('gris · la rampe multi-sorties est régulièrement espacée  (' +
       rampe.join(' ') + ')',
       rampe.length === 5 && new Set(rampe).size === 5);
    const niveaux = rampe.map(function (c) { return parseInt(/\d+/.exec(c)[0], 10); });
    let ecartMini = Infinity;
    for (let i = 1; i < niveaux.length; i++) {
      ecartMini = Math.min(ecartMini, Math.abs(niveaux[i] - niveaux[i - 1]));
    }
    ok('gris · deux sorties voisines gardent 25 niveaux d’écart  (' + ecartMini + ')',
       ecartMini >= 25);
  }());

  /* Le socle « Alpage ». Six planches en dépendent, et chacune de ces
   * fonctions a une manière silencieuse de se tromper : un rééchantillonnage
   * inégal raconte la vitesse au lieu de la forme, un champ de distance faux
   * donne des anneaux plausibles mais décalés, une donnée absente comptée
   * pour zéro creuse un trou qui n'existe pas. */
  (function () {
    const faux = {};
    new Function('window', fs.readFileSync(path.join(ROOT, 'src', 'alpage.js'), 'utf8'))(faux);
    const A = faux.Alpage;

    /* --- projection : des MÈTRES, avec la correction en cosinus --- */
    const vue = A.projette([
      { lat: 46.5, lon: 6.5 }, { lat: 46.5, lon: 6.5 + 1 / 111.320 },   // +1 km est… presque
      { lat: 46.5 + 1 / 110.540, lon: 6.5 }                              // +1 km nord
    ]);
    proche('alpage · un degré de latitude fait bien 110 540 m',
           Math.abs(vue.pts[2].y - vue.pts[0].y), 1000, 2);
    /* À 46,5°, un degré de longitude vaut cos(46,5) ≈ 0,688 degré de
     * latitude. Sans cette correction, toute forme sortirait étirée. */
    proche('alpage · la longitude est corrigée par le cosinus',
           vue.pts[1].x - vue.pts[0].x, 1000 * Math.cos(46.5 * Math.PI / 180), 2);

    /* --- rééchantillonnage : des pas ÉGAUX --- */
    const inegal = [];
    for (let i = 0; i < 40; i++) {
      // des points très serrés puis très espacés : le cas d'une montée
      const x = i < 20 ? i * 2 : 40 + (i - 20) * 60;
      inegal.push({ x: x, y: 0 });
    }
    const egal = A.reechantillonne(inegal, 25);
    const ecarts = [];
    for (let i = 1; i < egal.length - 1; i++) {
      ecarts.push(Math.hypot(egal[i].x - egal[i - 1].x, egal[i].y - egal[i - 1].y));
    }
    const pire = Math.max.apply(null, ecarts.map(function (e) { return Math.abs(e - 25); }));
    ok('alpage · le rééchantillonnage donne des pas égaux  (écart max ' +
       arrondi(pire) + ' m)', pire < 0.01);

    /* --- champ de distance : la valeur est la bonne --- */
    const boite = { x: -100, y: -100, w: 200, h: 200 };
    const champ = A.champDistance([{ x: 0, y: 0 }, { x: 0, y: 0 }], boite, 160);
    function distanceEn(px, py) {
      const gx = Math.round((px - boite.x) / champ.pasX);
      const gy = Math.round((py - boite.y) / champ.pasY);
      return champ.d[gy * champ.R + gx] * champ.unite;
    }
    proche('alpage · champ de distance à 40 m d’un point', distanceEn(40, 0), 40, 3);
    proche('alpage · champ de distance en diagonale', distanceEn(30, 40), 50, 4);

    /* --- ligne de niveau : elle est bien à la bonne distance --- */
    const segs = A.ligneDeNiveau(champ, 50);
    ok('alpage · une ligne de niveau existe  (' + segs.length + ' segments)', segs.length > 20);
    const rayons = segs.map(function (sg) { return Math.hypot(sg[0].x, sg[0].y); });
    const ecart = Math.max.apply(null, rayons.map(function (r) { return Math.abs(r - 50); }));
    ok('alpage · la ligne de niveau 50 m est un cercle de 50 m  (écart ' +
       arrondi(ecart) + ' m)', ecart < 4);

    /* --- série : les absences ne valent pas zéro --- */
    const pts = [{ w: 100 }, { w: null }, { w: 200 }, { w: 5000 }, { w: 150 }];
    for (let i = 0; i < 40; i++) pts.push({ w: 120 + (i % 5) });
    const se = A.serie(pts, 'w');
    ok('alpage · une mesure absente reprend la dernière connue, pas zéro',
       se.valeurs[1] === se.valeurs[0]);
    ok('alpage · une valeur aberrante ne s’écrase pas sur l’échelle  (hi=' +
       Math.round(se.hi) + ' pour un pic à 5000)', se.hi < 1000);
    ok('alpage · les valeurs restent dans 0..1',
       se.valeurs.every(function (v) { return v >= 0 && v <= 1; }));

    /* --- déterminisme --- */
    const alea1 = A.graine({ largeur: 1234, hauteur: 567, pts: { length: 890 } });
    const alea2 = A.graine({ largeur: 1234, hauteur: 567, pts: { length: 890 } });
    let identique = true;
    for (let i = 0; i < 200; i++) if (alea1(i, 3) !== alea2(i, 3)) identique = false;
    ok('alpage · le bruit est reproductible à l’identique', identique);
    const autre = A.graine({ largeur: 999, hauteur: 567, pts: { length: 890 } });
    ok('alpage · deux sorties différentes ont deux matières différentes',
       autre(7, 1) !== alea1(7, 1));

    /* --- temps --- */
    /* Les pièges de l'ISO 8601, ceux qui ne se voient qu'une fois par an. */
    ok('alpage · 4 janvier 2026 est en semaine 1', A.semaineISO(new Date(2026, 0, 4)) === 1);
    ok('alpage · 1er janvier 2027 est en semaine 53 de 2026',
       A.semaineISO(new Date(2027, 0, 1)) === 53, String(A.semaineISO(new Date(2027, 0, 1))));
    ok('alpage · 29 décembre 2025 est déjà en semaine 1',
       A.semaineISO(new Date(2025, 11, 29)) === 1, String(A.semaineISO(new Date(2025, 11, 29))));
    ok('alpage · le lundi d’un dimanche est six jours avant',
       A.lundiDe(new Date(2026, 8, 13)).getDate() === 7);

    const deb = new Date(2026, 0, 1), fin = new Date(2027, 0, 1);
    proche('alpage · le 1er janvier est à 0 % de l’année',
           A.positionDansPeriode(new Date(2026, 0, 1), deb, fin), 0, 0.002);
    proche('alpage · le 1er juillet est à la moitié de l’année',
           A.positionDansPeriode(new Date(2026, 6, 1), deb, fin), 0.4959, 0.01);
    /* Deux sorties le même jour à 8 h et 18 h doivent être proches : c'est
     * toute la différence entre « angle = position » et « angle = heure ». */
    const m = A.positionDansPeriode(new Date(2026, 5, 10, 8), deb, fin);
    const s2 = A.positionDansPeriode(new Date(2026, 5, 10, 18), deb, fin);
    ok('alpage · l’heure ne pèse qu’une fraction de jour  (' +
       arrondi((s2 - m) * 360) + '° d’écart)', (s2 - m) * 360 < 0.5);
  }());

  /* La partition promet d'être DÉTERMINISTE et de dire d'où vient sa
   * pulsation. Les deux se vérifient sans ouvrir de contexte audio. */
  (function () {
    const faux = {};
    new Function('window', 'DOMParser', fs.readFileSync(path.join(ROOT, 'src', 'activity.js'), 'utf8'))
      (faux, function () {});
    new Function('window', fs.readFileSync(path.join(ROOT, 'src', 'partition.js'), 'utf8'))(faux);

    function sortie(avecCadence) {
      const pts = [];
      for (let i = 0; i < 300; i++) {
        pts.push({
          lat: 46.54 + i * 0.0002, lon: 6.35 + i * 0.0003,
          ele: 680 + 300 * Math.sin(i / 40),
          cad: avecCadence ? 70 + 20 * Math.sin(i / 30) : null,
          t: new Date(Date.UTC(2026, 8, 6, 7, 0, i * 4)), d: 0
        });
      }
      return faux.Activity.fromPoints({ name: 'Essai', type: 'ride' }, pts);
    }

    const empreinteP = function (p) {
      return p.notes.map(function (n) {
        return n.t.toFixed(5) + ':' + n.degre + ':' + n.force.toFixed(4);
      }).join('|');
    };

    const a = sortie(true);
    const p1 = faux.Partition.construire(a, { duree: 14, ambiance: 'nappe' });
    const p2 = faux.Partition.construire(a, { duree: 14, ambiance: 'nappe' });
    ok('partition · deux constructions donnent la même pièce  (' + p1.notes.length + ' notes)',
       empreinteP(p1) === empreinteP(p2));
    proche('partition · la durée demandée est tenue',
           p1.notes[p1.notes.length - 1].t + p1.notes[p1.notes.length - 1].duree, 14, 0.01);
    ok('partition · avec capteur, la pulsation est dite mesurée',
       p1.source.pulsation === 'cadence');
    ok('partition · sans capteur, la pulsation est annoncée conventionnelle',
       faux.Partition.construire(sortie(false), { duree: 14 }).source.pulsation === 'convention');
    /* Aucune note hors de la gamme : c'est ce qui garantit qu'aucune sortie,
     * même en dents de scie, ne sorte une dissonance. */
    const degres = p1.notes.map(function (n) { return n.degre; });
    ok('partition · tous les degrés restent dans la gamme  (' +
       Math.min.apply(null, degres) + '–' + Math.max.apply(null, degres) + ')',
       Math.min.apply(null, degres) >= 0 && Math.max.apply(null, degres) < p1.echelle);
    ok('partition · une durée aberrante est ramenée dans les bornes',
       faux.Partition.construire(a, { duree: 900 }).duree === 20 &&
       faux.Partition.construire(a, { duree: 1 }).duree === 10);
    ok('partition · une sortie vide ne fabrique pas de notes',
       faux.Partition.construire({ track: [] }, {}).vide === true);
  }());

  /* L'historique d'exploration promet trois choses vérifiables sans base de
   * données : le sens ne compte pas, le bruit GPS est absorbé, une vraie
   * variante est vue comme neuve. */
  (function () {
    const faux = {};
    new Function('window', fs.readFileSync(path.join(ROOT, 'src', 'historique.js'), 'utf8'))(faux);
    const Hi = faux.Historique;

    const track = [];
    for (let i = 0; i < 200; i++) {
      track.push({ lat: 46.5460 + i * 0.00012, lon: 6.3500 + i * 0.00018, d: i * 20 });
    }
    const cases = Hi.cases(track);
    const inverse = Hi.cases(track.slice().reverse().map(function (p, i) {
      return { lat: p.lat, lon: p.lon, d: i * 20 };
    }));
    ok('exploration · le sens inverse donne les mêmes cases  (' + cases.length + ')',
       cases.slice().sort().join() === inverse.slice().sort().join());

    const set = Object.create(null);
    cases.forEach(function (c) { set[c] = 1; });
    function connuA(decalM) {
      const d = decalM / 110540;
      let n = 0;
      track.forEach(function (p) { if (Hi.connue(set, p.lat + d, p.lon)) n++; });
      return Math.round(100 * n / track.length);
    }
    ok('exploration · le bruit GPS (30 m) reste connu  (' + connuA(30) + ' %)', connuA(30) >= 80);
    ok('exploration · une variante à 300 m est neuve  (' + connuA(300) + ' %)', connuA(300) <= 5);

    /* Une trace échantillonnée grossièrement ne doit pas trouer la grille :
     * sans interpolation entre deux points, une sortie à 30 km/h saute une
     * case sur deux et « oublie » la moitié de ce qu'elle a parcouru. */
    const grossier = [];
    for (let i = 0; i < 20; i++) {
      grossier.push({ lat: 46.5460 + i * 0.0012, lon: 6.3500 + i * 0.0018, d: i * 200 });
    }
    ok('exploration · les trous entre deux points sont comblés  (' +
       Hi.cases(grossier).length + ' cases pour 20 points)',
       Hi.cases(grossier).length > 60);
  }());

  /* Un projet doit se rouvrir À L'IDENTIQUE. Une composition à plusieurs se
   * reprend des semaines plus tard : si l'aller-retour perd une sortie, une
   * couleur ou une altitude, on le découvre le jour où c'est trop tard. */
  (function () {
    const faux = { STUDIO_VERSION: 'test' };
    new Function('window', 'DOMParser', fs.readFileSync(path.join(ROOT, 'src', 'activity.js'), 'utf8'))
      (faux, function () {});
    new Function('window', fs.readFileSync(path.join(ROOT, 'src', 'projet.js'), 'utf8'))(faux);

    const pts = [];
    for (let i = 0; i < 60; i++) {
      pts.push({ lat: 46.54 + i * 0.0004, lon: 6.35 + i * 0.0006,
                 ele: 680 + i * 3.5, w: 180 + (i % 7) * 12, hr: 130 + (i % 5),
                 t: new Date(Date.UTC(2026, 8, 6, 7, 0, i * 5)), d: 0 });
    }
    const act = faux.Activity.fromPoints({ name: 'Essai', type: 'ride' }, pts);
    const json = JSON.stringify(faux.Projet.construire(
      [{ couleur: '#ABCDEF', activity: act }], { tpl: 'fresque' }));
    const relu = faux.Projet.lire(json);
    const b = relu.sorties[0];

    ok('projet · une sortie revient', relu.sorties.length === 1);
    ok('projet · la couleur est conservée', b.couleur === '#ABCDEF');
    ok('projet · le nom est conservé', b.activity.name === 'Essai');
    ok('projet · la trace est complète  (' + b.activity.track.length + ')',
       b.activity.track.length === 60);
    proche('projet · la distance survit au tour', b.activity.distance_km, act.distance_km, 0.01);
    proche('projet · le dénivelé survit au tour', b.activity.elev_gain_m, act.elev_gain_m, 1);
    ok('projet · la puissance survit au tour',
       b.activity.has_power && b.activity.power.max === act.power.max,
       String(b.activity.power && b.activity.power.max));
    ok('projet · un fichier étranger est refusé, pas à moitié lu', (function () {
      try { faux.Projet.lire('{"format":99,"sorties":[]}'); return false; }
      catch (e) { return /Format de projet inconnu/.test(e.message); }
    }()));
  }());

  /* « Sans chiffres » promet qu'aucune statistique ne revient par la bande.
   * Une promesse tenue par la discipline se casse au premier ajout distrait :
   * on la vérifie sur le texte source. */
  const mots = fs.readFileSync(path.join(ROOT, 'src', 'templates', 'mots.js'), 'utf8');
  const corps = mots.slice(mots.indexOf('draw:'));
  const chiffres = ['distance_km', 'duration_s', 'elev_gain_m', 'moving_s',
                    'splits', 'profile', 'H.stat', 'H.field', 'H.bars', 'fmt.km']
    .filter(n => corps.indexOf(n) >= 0);
  ok('mots.js · aucune statistique ne peut revenir à l’export',
     chiffres.length === 0, 'trouvé : ' + chiffres.join(', '));

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

/* ================= 2 sexies. LES DEUX THEMES SE MESURENT =================
 *
 * « Les couleurs du sombre doivent etre meilleures » est un avis tant qu'on ne
 * mesure pas. Une fois mesure, c'etaient deux faits :
 *
 *   · les SURFACES ne se separaient plus. Fond, panneau et bloc en relief
 *     etaient a 1,06 et 1,08 de rapport, contre 1,10 et 1,09 en clair. Sur un
 *     ecran sombre l'oeil a besoin de PLUS d'ecart, pas de moins.
 *   · l'ACCENT changeait d'identite : rouille en clair, OR en sombre. Pas une
 *     variante nocturne — une autre marque.
 *
 * Ces cas figent les deux. Ils lisent les jetons dans index.html, la ou ils
 * sont ecrits : un controle qui recopierait les valeurs mesurerait sa copie.
 */

/* ================= 2 septies. LA FEUILLE DE STYLE TIENT =================
 *
 * LE DEFAUT QUE CES CAS FERMENT, ET IL A VECU TROIS VERSIONS.
 *
 * En retirant le selecteur de langue, une expression reguliere a mange
 * l'accolade fermante du bloc `@media (max-width: 400px)`. Tout le CSS qui
 * suivait — cent quarante-six regles — s'est retrouve AVALE dans ce bloc.
 *
 * Sous 400 px la regle s'applique : la page semblait parfaite, et c'est la
 * largeur ou tournaient les essais. Au-dessus, plus rien : ni police, ni
 * couleurs, ni barre du bas. Un iPhone Plus fait 430 pt, un ordinateur bien
 * davantage. Le studio a donc ete sans style pour une bonne part de ceux qui
 * l'ouvraient, pendant que cent soixante-dix controles passaient au vert.
 *
 * Ils passaient parce qu'ils lisaient le DOM — des identifiants, des classes,
 * des attributs — et que le DOM etait intact. Un controle qui ne regarde que
 * la structure ne voit pas une page sans apparence.
 */

function testsStyle() {
  titre('2 septies. LA FEUILLE DE STYLE');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const i = html.indexOf('<style>'), j = html.indexOf('</style>', i);
  if (i < 0 || j < 0) { saute('style · bloc', 'introuvable'); return; }
  const css = html.slice(i + 7, j);

  let prof = 0, regles = 0, negatif = false;
  for (let k = 0; k < css.length; k++) {
    if (css[k] === '{') prof++;
    else if (css[k] === '}') {
      prof--;
      if (prof < 0) negatif = true;
      if (prof === 0) regles++;
    }
  }
  ok('style · les accolades sont equilibrees  (profondeur ' + prof + ')',
     prof === 0 && !negatif,
     prof > 0 ? prof + ' bloc(s) jamais referme(s) : tout ce qui suit est avale dedans'
              : 'une accolade fermante de trop');

  /* Le NOMBRE compte autant que l'equilibre : une accolade manquante ne rend
   * pas la feuille invalide, elle la reduit. Seize regles de premier niveau au
   * lieu de cent soixante-deux, et le navigateur ne signale rien. */
  ok('style · la feuille porte toutes ses regles  (' + regles + ')', regles >= 100,
     'seulement ' + regles + ' regles de premier niveau — un bloc en avale sans doute d’autres');

  /* Les memes controles sur la galerie, qui a sa propre feuille. */
  const gal = path.join(ROOT, 'apercus', 'index.html');
  if (fs.existsSync(gal)) {
    const g = fs.readFileSync(gal, 'utf8');
    const a2 = g.indexOf('<style>'), b2 = g.indexOf('</style>', a2);
    if (a2 >= 0 && b2 >= 0) {
      const cg = g.slice(a2 + 7, b2);
      let pg = 0;
      for (let k = 0; k < cg.length; k++) {
        if (cg[k] === '{') pg++; else if (cg[k] === '}') pg--;
      }
      ok('style · la galerie aussi est equilibree  (profondeur ' + pg + ')', pg === 0);
    }
  }

  /* UNE PAGE EN `viewport-fit=cover` S'ETEND SOUS L'ENCOCHE.
   *
   * C'est ce qu'on veut — une planche qui touche les bords — mais il faut
   * alors ecarter le contenu des quatre cotes soi-meme. La galerie traitait la
   * gauche, la droite et le bas ; le haut manquait, et son entete passait sous
   * la barre d'etat avec le bouton de retour vers le studio. On ne pouvait
   * plus revenir. Trois cotes sur quatre ne se voit pas en relisant. */
  [['index.html', html], ['apercus/index.html', fs.existsSync(gal) ? fs.readFileSync(gal, 'utf8') : '']]
    .forEach(function (pr) {
      if (!pr[1]) return;
      if (!/viewport-fit=cover/.test(pr[1])) return;
      ok('style · ' + pr[0] + ' ecarte le contenu de l’encoche',
         /safe-area-inset-top/.test(pr[1]),
         'la page s’etend sous l’encoche sans jamais compenser en haut');
    });
}

/* ================= 2 octies. UN SEUL VOILE =================
 *
 * Le voile est peint a DEUX endroits : alpage.js pour les quinze planches qui
 * declarent la cle, src/studio.js pour les dix-sept autres. Les deux courbes
 * avaient diverge — 0,62 d'un cote, 0,58 de l'autre, avec des etalements
 * differents — de sorte qu'un reglage portant un seul nom, « vers le bas »,
 * assombrissait plus ou moins selon la planche choisie. Personne n'aurait su
 * dire laquelle etait la bonne.
 */

function testsVoile() {
  titre('2 octies. UN SEUL VOILE');

  /* Les deux fichiers n'ecrivent pas la couleur de la meme facon : le moteur
   * pose un litteral `rgba(18,20,16,.40)`, alpage.js concatene `'rgba(' +
   * teinte + ',.40)'`. Une premiere version du controle ne lisait que le
   * litteral, ne trouvait qu'un arret sur trois, et declarait une divergence
   * qui n'existait pas — il mesurait sa propre incapacite a lire. On ne
   * retient donc que la POSITION et l'OPACITE, quelle que soit l'ecriture. */
  function stops(src, apres) {
    const i = src.indexOf(apres);
    if (i < 0) return null;
    const bout = src.slice(i, i + 700);
    const m = [...bout.matchAll(/addColorStop\(\s*([\d.]+)\s*,[^;]*?,\s*\.?([\d.]+)\)'/g)];
    return m.slice(0, 3).map(function (x) {
      const op = x[2].charAt(0) === '.' ? x[2] : '.' + x[2];
      return x[1] + ':' + (x[2] === '0' ? '0' : op);
    }).join(' ');
  }
  const alp = fs.readFileSync(path.join(ROOT, 'src', 'alpage.js'), 'utf8');
  const stu = fs.readFileSync(path.join(ROOT, 'src', 'studio.js'), 'utf8');

  const a = stops(alp, 'var lg = ctx.createLinearGradient');
  const b = stops(stu, "mode === 'bas' ? ctx.createLinearGradient");
  if (!a || !b) { saute('voile · courbes', 'gradients introuvables'); return; }
  ok('voile · les deux peintres suivent la meme courbe',
     a === b, 'alpage : ' + a + '   ·   moteur : ' + b);

  /* Discret veut dire mesurable : au-dela de 0,45 au pied, le voile devient le
   * sujet de l'image au lieu de rendre un titre lisible. */
  const pied = parseFloat(a.split(' ')[0].split(':')[1]);
  ok('voile · il reste discret  (' + pied + ' au pied)', pied <= 0.45);
}

function testsThemes() {
  titre('2 sexies. LES DEUX THEMES');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  function jetons(bloc) {
    const o = {};
    (bloc.match(/--[\w-]+:\s*#[0-9A-Fa-f]{6}/g) || []).forEach(function (d) {
      const m = /--([\w-]+):\s*(#[0-9A-Fa-f]{6})/.exec(d);
      o[m[1]] = m[2];
    });
    return o;
  }
  const mClair = /\n  :root \{([\s\S]*?)\n  \}/.exec(html);
  const mSombre = /\[data-theme="sombre"\] \{([\s\S]*?)\n  \}/.exec(html);
  if (!mClair || !mSombre) { saute('themes', 'jetons introuvables'); return; }
  const clair = jetons(mClair[1]), sombre = jetons(mSombre[1]);

  function lum(h) {
    const v = parseInt(h.slice(1), 16);
    const c = [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255]
      .map(function (x) { return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function rapport(a, b) {
    const A = lum(a), B = lum(b);
    return (Math.max(A, B) + 0.05) / (Math.min(A, B) + 0.05);
  }

  [['clair', clair], ['sombre', sombre]].forEach(function (pr) {
    const nom = pr[0], t = pr[1];
    if (!t.bg || !t.ink || !t.mut || !t.acc || !t.panel || !t.raised) {
      saute('theme ' + nom, 'jetons incomplets');
      return;
    }
    /* Du TEXTE sur son fond : le seuil lisible usuel est 4,5. */
    [['ink', t.ink], ['mut', t.mut], ['acc', t.acc]].forEach(function (x) {
      const r = rapport(x[1], t.bg);
      ok('theme ' + nom + ' · ' + x[0] + ' lisible sur le fond  (' + r.toFixed(2) + ')',
         r >= 4.5);
    });
    /* Les SURFACES : un palier trop faible efface la structure de la page.
     * 1,08 est le plancher observe sur le theme clair, qui tient. */
    const sep = rapport(t.panel, t.bg);
    ok('theme ' + nom + ' · les panneaux se detachent du fond  (' + sep.toFixed(2) + ')',
       sep >= 1.08);
    const rel = rapport(t.raised, t.panel);
    ok('theme ' + nom + ' · le relief se detache du panneau  (' + rel.toFixed(2) + ')',
       rel >= 1.08);
  });

  /* L'ACCENT GARDE SA TEINTE. On compare l'angle de teinte des deux rouilles :
   * une variante nocturne s'eclaircit, elle ne change pas de couleur. */
  function teinte(h) {
    const v = parseInt(h.slice(1), 16);
    const r = (v >> 16 & 255) / 255, g = (v >> 8 & 255) / 255, b = (v & 255) / 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    if (!d) return 0;
    let t;
    if (mx === r) t = ((g - b) / d) % 6;
    else if (mx === g) t = (b - r) / d + 2;
    else t = (r - g) / d + 4;
    t *= 60;
    return t < 0 ? t + 360 : t;
  }
  const ecart = Math.abs(teinte(clair.acc) - teinte(sombre.acc));
  ok('themes · l’accent garde sa teinte  (' + Math.round(teinte(clair.acc)) +
     '° vs ' + Math.round(teinte(sombre.acc)) + '°)',
     Math.min(ecart, 360 - ecart) <= 20,
     'le clair et le sombre ne portent pas la meme couleur d’accent');
}

/* ================= 2 quinquies. L'ORDRE DES MORCEAUX =================
 *
 * src/app.js portait huit sujets dans deux mille lignes ; il en garde trois et
 * le reste vit dans src/app/. Le decoupage tient a un ordre de chargement, et
 * un ordre de chargement est exactement le genre de chose qu'on casse sans
 * s'en rendre compte — en rangeant les balises par ordre alphabetique, par
 * exemple. Ces cas-la le figent.
 */

function testsMorceaux() {
  titre("2 quinquies. L'ORDRE DES MORCEAUX");

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ordre = (html.match(/src="(src\/app(?:\.js|\/[\w-]+\.js))"/g) || [])
    .map(function (m) { return m.slice(5, -1); });

  ok('morceaux · le noyau est charge en premier  (' + ordre.length + ' fichiers)',
     ordre[0] === 'src/app/noyau.js', ordre.slice(0, 3).join(' '));
  ok('morceaux · le coeur vient juste apres le noyau',
     ordre[1] === 'src/app.js', ordre[1]);
  ok('morceaux · demarrage.js est le DERNIER',
     ordre[ordre.length - 1] === 'src/app/demarrage.js',
     'dernier charge : ' + ordre[ordre.length - 1]);

  /* Un module oublie dans index.html ne leve rien au chargement : il est
   * simplement absent, et la moitie d'une interface manque en silence. */
  const surDisque = fs.readdirSync(path.join(ROOT, 'src', 'app'))
    .filter(function (f) { return /[.]js$/.test(f); })
    .map(function (f) { return 'src/app/' + f; });
  const oublies = surDisque.filter(function (f) { return ordre.indexOf(f) < 0; });
  ok('morceaux · tous les fichiers de src/app/ sont charges  (' +
     surDisque.length + ')', oublies.length === 0, oublies.join(', '));

  /* Le demarrage ne doit exister qu'a UN endroit. Deux appels a A.demarre()
   * rejoueraient toute la mise en route — ecouteurs poses deux fois compris. */
  const appels = surDisque.concat(['src/app.js']).reduce(function (n, f) {
    const t = fs.readFileSync(path.join(ROOT, f), 'utf8');
    return n + (t.match(/A\.demarre\(\)/g) || []).length;
  }, 0);
  ok('morceaux · un seul appel a demarre()  (' + appels + ')', appels === 1);
}

/* ================= 2 quater. MENUS REMPLIS =================
 *
 * Le défaut réel : `<select id="collection">` était vide dans index.html et
 * aucun code ne le remplissait. Huit palettes existaient, s'appliquaient
 * correctement, et aucune n'était atteignable. Rien n'a levé d'erreur — poser
 * une valeur sur un menu vide ne lève rien — et le studio a vécu des semaines
 * avec un réglage global inaccessible.
 *
 * Le contrôle est donc GÉNÉRAL, pas particulier : tout menu déclaré sans
 * option dans le HTML doit être rempli quelque part dans src/. */

function testsMenus() {
  titre('2 quater. MENUS REMPLIS');

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  /* TOUT src/, SOUS-DOSSIERS COMPRIS.
   *
   * Ce controle ne lisait que le premier niveau. Le jour ou app.js a ete
   * decoupe et ou le remplissage d'un menu est parti dans src/app/, il a
   * declare vide un menu parfaitement rempli — un controle devenu rouge non
   * parce que le produit avait change, mais parce que son PERIMETRE ne
   * suivait plus le code. C'est la forme la plus courante du controle qui ne
   * controle plus : il regarde encore la ou la chose n'est plus. */
  const js = (function collecte(dir) {
    return fs.readdirSync(dir, { withFileTypes: true }).reduce(function (acc, e) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return acc.concat(collecte(p));
      return /[.]js$/.test(e.name) ? acc.concat(fs.readFileSync(p, 'utf8')) : acc;
    }, []);
  }(path.join(ROOT, 'src'))).join('\n');

  const re = /<select([^>]*)>([\s\S]*?)<\/select>/g;
  let m;
  const vides = [];
  while ((m = re.exec(html))) {
    const id = (/id="([^"]+)"/.exec(m[1]) || [])[1];
    if (!id) continue;
    if (/<option/.test(m[2])) continue;                 // rempli dans le HTML
    /* Rempli en JS : on cherche une ÉCRITURE vers ce menu — `appendChild(`,
     * `innerHTML =` ou `add(` — dans ce qui suit immédiatement l'endroit où le
     * menu est désigné.
     *
     * DEUX VERSIONS FAUSSES AVANT CELLE-CI, et chacune dans un sens différent.
     * La première acceptait `add` sans parenthèse : `addEventListener` lui
     * suffisait, et elle restait VERTE sur le défaut exact qu'elle devait
     * attraper. La deuxième exigeait l'écriture directement sur `$('#id')` et
     * déclarait donc vide un menu rempli par `var sel = $('#id'); sel.innerHTML
     * = …` — ROUGE sur du code correct. Un contrôle se trompe dans les deux
     * sens, et les deux coûtent : l'un laisse passer, l'autre fait chercher un
     * défaut qui n'existe pas. */
    const sel = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const points = [...js.matchAll(new RegExp("#" + sel + "'\\)", 'g'))];
    const ecrit = points.some(function (p) {
      const suite = js.slice(p.index, p.index + 400);
      return /\.\s*(?:appendChild\s*\(|innerHTML\s*=|add\s*\(|options\s*=)/.test(suite) ||
             /\bnew Option\b/.test(suite);
    });
    if (!ecrit) vides.push(id);
  }
  ok('aucun menu ne reste vide  (' +
     (html.match(/<select/g) || []).length + ' menus)',
     vides.length === 0,
     'déclaré sans option et jamais rempli : ' + vides.join(', '));

  /* LES NOTES DES COLLECTIONS SONT DES PHRASES, LEURS NOMS SONT DES NOMS.
   *
   * Les noms — Alpage, Braise, Brume — ne doivent PAS être traduits. Une
   * première version les passait par T(), et « Papier », qui existe déjà au
   * dictionnaire comme nom de support, ressortait « Paper » au milieu de sept
   * noms français. Les notes, elles, doivent toutes l'être : sept phrases
   * françaises dans une interface anglaise, c'est la moitié d'une traduction. */
  const bacI = {};
  new Function('window', fs.readFileSync(path.join(ROOT, 'src', 'i18n.js'), 'utf8'))(bacI);
  const EN = bacI.I18N && bacI.I18N.DICOS && bacI.I18N.DICOS.en;
  const srcColl = fs.readFileSync(path.join(ROOT, 'src', 'collections.js'), 'utf8');
  const notes = [...srcColl.matchAll(/note: '([^']+)'/g)].map(function (m) { return m[1]; });
  if (!EN) {
    saute('collections · notes traduites', 'dictionnaire illisible');
  } else {
    const sansTrad = notes.filter(function (n) { return !EN[n]; });
    ok('collections · les ' + notes.length + ' notes sont traduites',
       notes.length > 0 && sansTrad.length === 0, sansTrad.join(' | '));
  }

  const appSrc = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
  ok('collections · les noms ne passent pas par le dictionnaire',
     !/op\.textContent = T\(c\.name\)/.test(appSrc));

  /* LE VOILE GLOBAL PARLE-T-IL LA MÊME LANGUE QUE LES TEMPLATES ?
   *
   * Le menu global ne peint rien lui-même : il transmet son choix au voile de
   * chaque planche, déclaré dans `optionsFond()` (alpage.js). Si les deux
   * vocabulaires divergent — « centre » d'un côté, « radial » de l'autre — la
   * transmission échoue EN SILENCE : `transmetVoile` ne trouve pas la valeur
   * dans les choix du template et n'écrit rien. Aucune erreur, aucun voile. */
  const voileHtml = (/<select id="voile">([\s\S]*?)<\/select>/.exec(html) || [])[1] || '';
  const valeursHtml = [...voileHtml.matchAll(/value="([^"]+)"/g)].map(function (m) { return m[1]; });
  const alpageSrc = fs.readFileSync(path.join(ROOT, 'src', 'alpage.js'), 'utf8');
  const blocVoile = (/key: 'voile'[\s\S]*?choices: \[([\s\S]*?)\]\s*\}/.exec(alpageSrc) || [])[1] || '';
  const valeursTpl = [...blocVoile.matchAll(/\['([^']+)'/g)].map(function (m) { return m[1]; });
  const orphelines = valeursHtml.filter(function (v) { return valeursTpl.indexOf(v) < 0; });
  ok('voile · le menu global parle le vocabulaire des templates  (' +
     valeursHtml.join(', ') + ')',
     valeursHtml.length >= 3 && orphelines.length === 0,
     'valeurs sans équivalent dans optionsFond() : ' + orphelines.join(', '));

  ok('voile · le moteur reçoit le réglage avant chaque rendu',
     /Studio\.setVoile\(/.test(appSrc) &&
     /setVoile: setVoile/.test(fs.readFileSync(path.join(ROOT, 'src', 'studio.js'), 'utf8')));
}

/* ================= 2 ter. CHAÎNE DE PUBLICATION =================
 *
 * La chaîne se contrôle elle-même. Un fichier de workflow n'échoue pas quand il
 * a tort : il s'exécute, il est vert, et il ne fait pas ce qu'on croit. Les cas
 * ci-dessous portent sur ce que personne ne relit — l'épinglage des actions, le
 * nom d'un script appelé, les permissions par défaut. */

function testsChaine() {
  titre('2 ter. CHAÎNE DE PUBLICATION');

  const fWorkflow = path.join(ROOT, '.github', 'workflows', 'publication.yml');
  if (!fs.existsSync(fWorkflow)) {
    saute('chaîne · workflow', '.github/workflows/publication.yml absent');
    return;
  }
  const wf = fs.readFileSync(fWorkflow, 'utf8');

  /* UNE ACTION S'ÉPINGLE À UN COMMIT. `@v4` exécute ce que son auteur y met
   * aujourd'hui : l'étiquette se déplace, le code change, et rien ne le dit
   * dans notre dépôt. */
  const usages = wf.match(/uses:\s*\S+/g) || [];
  const flottantes = usages.filter(function (u) {
    return !/@[0-9a-f]{40}\b/.test(u);
  });
  ok('chaîne · toutes les actions sont épinglées à un commit',
     usages.length > 0 && flottantes.length === 0,
     flottantes.join(' · '));

  /* Le jeton ne doit pouvoir QUE lire par défaut ; seule la tâche qui publie
   * demande davantage. */
  ok('chaîne · les permissions par défaut sont en lecture',
     /^permissions:\s*\n\s+contents:\s*read\s*$/m.test(wf));

  /* Un `run: node tools/xxx.js` qui désigne un fichier absent ne se voit qu'au
   * moment où la tâche tourne — c'est-à-dire trop tard. */
  const appels = (wf.match(/node\s+tools\/[\w.-]+\.js/g) || [])
    .map(function (s) { return s.replace(/^node\s+/, ''); });
  const manquants = appels.filter(function (rel) {
    return !fs.existsSync(path.join(ROOT, rel));
  });
  ok('chaîne · les scripts appelés existent  (' +
     Array.from(new Set(appels)).join(', ') + ')',
     appels.length >= 3 && manquants.length === 0, manquants.join(', '));

  /* La publication DÉPEND des contrôles : c'est tout l'objet du fichier. Si la
   * dépendance saute, le workflow reste vert et la barrière n'existe plus. */
  ok('chaîne · la publication dépend du harnais et de l’acceptation',
     /needs:\s*\[harnais,\s*acceptation\]/.test(wf));
  ok('chaîne · seule la branche main publie',
     /github\.ref == 'refs\/heads\/main'/.test(wf));

  /* UNE TACHE SANS PLAFOND TOURNE SIX HEURES — le defaut de GitHub — et garde
   * le verrou de publication tout ce temps. */
  /* UNE TACHE SE COMPTE EN LISANT LES LIGNES, pas avec une expression a
   * cheval sur deux d'entre elles.
   *
   * Deux versions fausses avant celle-ci, et la seconde est la pire : elle
   * comptait ZERO tache et passait au vert, puisque « zero plafond suffit
   * pour zero tache ». Un controle qui compte doit donc verifier que son
   * compte est PLAUSIBLE — sans quoi une erreur de comptage se lit comme un
   * succes, ce qui est la pire facon d'echouer. */
  /* On coupe les retours chariot avant de comparer : les outils d'edition
   * laissent parfois des CRLF dans le repertoire de travail, et `jobs:\r` ne
   * s'egale pas a `jobs:`. Le compte tombait alors a zero — et sans la
   * verification de plausibilite juste en dessous, ce zero serait passe pour
   * un succes, puisque zero plafond suffit pour zero tache. */
  const lignes = wf.split('\n').map(function (l) { return l.replace(/\r$/, ''); });
  const iJobs = lignes.indexOf('jobs:');
  let taches = 0;
  for (let k = iJobs + 1; k < lignes.length && iJobs >= 0; k++) {
    if (/^  [a-z-]+:\s*$/.test(lignes[k])) taches++;
  }
  const plafonds = (wf.match(/timeout-minutes:/g) || []).length;
  ok('chaîne · le compte des taches est plausible  (' + taches + ')', taches >= 3);
  ok('chaîne · chaque tache a un plafond de duree  (' + plafonds + '/' + taches + ')',
     taches >= 3 && plafonds >= taches, (taches - plafonds) + ' tache(s) sans plafond');

  /* On n'annule JAMAIS une chaine qui publie : l'interrompre laisserait le
   * site dans un etat qu'on n'a pas choisi. */
  ok('chaîne · on n’annule que les propositions',
     /cancel-in-progress: \$\{\{ github\.event_name == 'pull_request' \}\}/.test(wf));

  /* Le cache des navigateurs porte le numero de Playwright : sans lui, une
   * montee de version servirait les anciens binaires depuis le cache. */
  const versionPw = (/playwright@([\d.]+)/.exec(wf) || [])[1];
  ok('chaîne · le cache des navigateurs suit la version  (' + versionPw + ')',
     !!versionPw && wf.indexOf('playwright-' + versionPw + '-') > 0,
     'la cle de cache ne mentionne pas la version installee');

  /* La mémoire du dépôt et les agents : leur absence ne casse rien, leur
   * dérive si. Un agent sans outils déclarés reçoit tout, ce qu'on ne veut pas
   * pour une revue qui ne doit rien modifier. */
  ok('chaîne · CLAUDE.md porte la mémoire du dépôt',
     fs.existsSync(path.join(ROOT, 'CLAUDE.md')));

  const dAgents = path.join(ROOT, '.claude', 'agents');
  if (!fs.existsSync(dAgents)) {
    saute('chaîne · agents', '.claude/agents absent');
  } else {
    const agents = fs.readdirSync(dAgents).filter(function (f) { return /\.md$/.test(f); });
    const mal = agents.filter(function (f) {
      const t = fs.readFileSync(path.join(dAgents, f), 'utf8');
      /* l'en-tête est le bloc entre les deux lignes de tirets ; on l'isole
       * d'abord, puis on cherche les clés dedans, sans rien supposer de leur
       * ORDRE — une expression qui les exigeait dans l'ordre a échoué sur ces
       * deux fichiers, qui étaient parfaitement corrects */
      const entete = (/^---\r?\n([\s\S]*?)\r?\n---/.exec(t) || [])[1];
      if (!entete) return true;
      return ['name', 'description', 'tools'].some(function (cle) {
        return !new RegExp('^' + cle + ':\\s*\\S', 'm').test(entete);
      });
    });
    ok('chaîne · chaque agent déclare nom, description et outils  (' +
       agents.length + ')', agents.length > 0 && mal.length === 0, mal.join(', '));

    /* Une revue qui peut écrire n'est plus une revue : elle corrige, et le
     * constat disparaît avec la correction. */
    const revue = path.join(dAgents, 'revue.md');
    if (fs.existsSync(revue)) {
      const t = fs.readFileSync(revue, 'utf8');
      const ligne = (/\ntools:\s*(.+)/.exec(t) || [])[1] || '';
      ok('chaîne · l’agent de revue ne peut pas écrire',
         !/\b(Write|Edit|NotebookEdit)\b/.test(ligne), ligne.trim());
    }
  }
}

/* ================= 2 bis. BIBLIOTHÈQUE ================= */

function chargeLibrary() {
  const src = fs.readFileSync(path.join(ROOT, 'src', 'library.js'), 'utf8');
  const faux = {};
  new Function('window', src)(faux);
  return faux.Library;
}

function testsBibliotheque(L) {
  titre('2 bis. BIBLIOTHÈQUE (plusieurs sorties)');

  L.clear();
  const a = L.add({ name: 'A', distance_km: 6 });
  const b = L.add({ name: 'B', distance_km: 16 });
  const c = L.add({ name: 'C', distance_km: 9 });

  ok('les ajouts s’accumulent', L.count() === 3, 'compté ' + L.count());
  ok('la première chargée devient la courante', L.currentId() === a.id);

  /* Le bug qui rend deux images d’une même série illisibles ensemble :
   * une couleur attribuée par POSITION se réattribue au réordonnancement. */
  const couleurB = b.couleur;
  L.move(b.id, -1);
  ok('après déplacement, l’ordre a changé',
     L.list().map(e => e.id).join(',') === [b.id, a.id, c.id].join(','),
     L.list().map(e => e.id).join(','));
  ok('la couleur suit la sortie, pas sa place',
     L.get(b.id).couleur === couleurB);
  ok('deux sorties n’ont pas la même couleur',
     new Set(L.list().map(e => e.couleur)).size === 3);

  L.remove(b.id);
  ok('le retrait n’altère pas les couleurs restantes',
     L.get(a.id).couleur === a.couleur && L.get(c.id).couleur === c.couleur);

  L.clear();
  ok('vider remet à zéro', L.count() === 0 && L.current() === null);

  /* « Le Mont-sur-Lausanne Mountain Biking » tronqué à 18 puis rogné
   * jusqu’au dernier espace donnait « Le… » : le nom disparaissait. */
  const court = L.nomCourt({ name: 'Le Mont-sur-Lausanne Mountain Biking' }, 18);
  ok('nomCourt · un nom long garde sa substance  (' + court + ')',
     court.length >= 12 && /Mont/.test(court));
  ok('nomCourt · le type d’activité est retiré  (' +
     L.nomCourt({ name: 'Fribourg Road Cycling' }, 24) + ')',
     L.nomCourt({ name: 'Fribourg Road Cycling' }, 24) === 'Fribourg');
  ok('nomCourt · un nom qui n’est QUE le type ne disparaît pas',
     L.nomCourt({ name: 'Ride' }, 24) === 'Sortie');
  ok('nomCourt · sans nom, un libellé quand même',
     L.nomCourt({}, 24) === 'Sortie');
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
  testsVoile();
  testsStyle();
  testsThemes();
  testsMorceaux();
  testsMenus();
  testsChaine();
  testsBibliotheque(chargeLibrary());
  await testsServeur();

  console.log('\n' + reussis + ' réussis · ' + echoues + ' échoués' +
              (ignores ? ' · ' + ignores + ' passés' : ''));
  /* process.exit() coupe Node pendant la fermeture du serveur enfant et
   * Windows s en plaint. On pose le code et on laisse le processus finir. */
  process.exitCode = echoues ? 1 : 0;
}());
