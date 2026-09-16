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

  const ver = fs.readFileSync(path.join(ROOT, 'src', 'version.js'), 'utf8');
  ok('version.js · numéro lisible',
     /var STUDIO_VERSION = '[\d.]+'/.test(ver));

  /* UNE seule horloge. L'aperçu animé, l'export vidéo et la séquence PNG
   * doivent parcourir la même chronologie ; la séquence recopiait autrefois
   * la courbe de la vidéo à la main, avec le commentaire « même courbe que
   * la vidéo » — la définition d'une divergence qui attend son heure. */
  const app = fs.readFileSync(path.join(ROOT, 'src', 'app.js'), 'utf8');
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

    const cles = A.CATALOGUE.map(A.cle);
    ok('galerie · les identifiants du catalogue sont uniques  (' + cles.length + ')',
       new Set(cles).size === cles.length);
    ok('galerie · chaque entrée nomme un template et un jeu de données',
       A.CATALOGUE.every(function (e) { return e.t && e.f && e.g && e.n && e.j; }));
    ok('galerie · chaque jeu de données est déclaré',
       A.CATALOGUE.every(function (e) { return e.j === 'annee' || A.JEUX[e.j]; }));

    const dossier = path.join(ROOT, 'apercus');
    if (!fs.existsSync(dossier)) { saute('galerie · vignettes', 'apercus/ non généré'); return; }
    const absents = cles.filter(function (k) {
      return !fs.existsSync(path.join(dossier, k + '.png'));
    });
    ok('galerie · chaque entrée a son image  (' + cles.length + ')',
       absents.length === 0, 'absentes : ' + absents.join(', '));

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
  testsBibliotheque(chargeLibrary());
  await testsServeur();

  console.log('\n' + reussis + ' réussis · ' + echoues + ' échoués' +
              (ignores ? ' · ' + ignores + ' passés' : ''));
  /* process.exit() coupe Node pendant la fermeture du serveur enfant et
   * Windows s en plaint. On pose le code et on laisse le processus finir. */
  process.exitCode = echoues ? 1 : 0;
}());
