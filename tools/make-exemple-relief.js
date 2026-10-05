/* make-exemple-relief.js — le terrain de la sortie d'exemple, inventé et dit.
 *
 *   node tools/make-exemple-relief.js
 *
 * POURQUOI UN TERRAIN INVENTÉ.
 *
 * La vignette de « Topographie » montrait un parcours sans relief tant que
 * rien n'était chargé — c'est-à-dire au premier écran, pour tout le monde.
 * On ne peut pas choisir une planche sur une image qui ne montre pas ce
 * qu'elle fait.
 *
 * Le vrai relief vient de swisstopo, et il REFUSE cette sortie : `exemple.gpx`
 * est synthétique, ses altitudes ne correspondent à aucun terrain réel —
 * l'écart médian mesuré est de 343 m. C'est le contrôle qui fonctionne, pas
 * un défaut. Demander quand même les courbes du vrai Jura pour les poser sous
 * un parcours qui n'y passe pas aurait été exactement la carte fausse que ce
 * studio refuse ailleurs.
 *
 * On fabrique donc un terrain POUR cette sortie, et on le dit : la planche
 * écrit « terrain d'exemple » et non « swisstopo ». Rien n'est présenté comme
 * mesuré.
 *
 * COMMENT, ET POURQUOI PAS AUTREMENT.
 *
 * Le champ d'altitude interpole les altitudes DE LA TRACE près d'elle, et
 * s'en éloigne en ondulations douces au-delà. L'interpolation n'est pas un
 * ornement : le calcul compare la grille au GPX et refuse au-delà de 60 m
 * d'écart médian. Un terrain qui ignorerait la trace serait rejeté par son
 * propre contrôle — ce qui est la bonne réaction, et la preuve que le
 * contrôle vaut aussi ici.
 *
 * Le calcul lui-même est CELUI DU VRAI RELIEF, par l'option `altitude` :
 * mêmes courbes, même simplification, même contrôle. Un second générateur
 * aurait produit des données de forme voisine, et la planche aurait fini par
 * ne bien dessiner que l'un des deux.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const SORTIE = path.join(ROOT, 'src', 'exemple-relief.js');

/* ---------- charger le calcul du relief, sans navigateur ---------- */
const bac = { console: console, Math: Math, Promise: Promise, Array: Array,
              Float64Array: Float64Array, Uint8Array: Uint8Array, JSON: JSON,
              setTimeout: setTimeout, fetch: function () {
                throw new Error('ce generateur ne doit RIEN demander au reseau');
              } };
bac.window = bac; bac.self = bac;
vm.createContext(bac);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'src', 'carnet', 'relief.js'), 'utf8'),
                bac, { filename: 'relief.js' });
const Relief = bac.Relief;

/* ---------- la trace d'exemple ---------- */
const gpx = fs.readFileSync(path.join(ROOT, 'exemple.gpx'), 'utf8');
const pts = [];
const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
let m;
while ((m = re.exec(gpx))) {
  const ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3]);
  pts.push({ lat: +m[1], lon: +m[2], ele: ele ? +ele[1] : null });
}
if (pts.length < 10) { console.error('exemple.gpx : trace illisible'); process.exit(1); }
const avecEle = pts.filter(function (p) { return p.ele != null; });
console.log('trace      : ' + pts.length + ' points, ' + avecEle.length + ' avec altitude');

/* ---------- le champ d'altitude ---------- */
const ancres = [];
const PAS_ANCRE = Math.max(1, Math.floor(avecEle.length / 160));
avecEle.forEach(function (p, i) {
  if (i % PAS_ANCRE) return;
  const l = Relief.versLV95(p.lat, p.lon);
  ancres.push({ e: l.e, n: l.n, z: p.ele });
});
const zMoy = ancres.reduce(function (s, a) { return s + a.z; }, 0) / ancres.length;
console.log('ancres     : ' + ancres.length + ', altitude moyenne ' + Math.round(zMoy) + ' m');

/* Les ondulations : déterministes, sans aléa — le même fichier doit sortir
 * deux fois de suite, sinon le dépôt bouge sans que rien ait changé. */
function houle(e, n) {
  const a = Math.sin(e / 2300) * Math.cos(n / 1900);
  const b = Math.sin((e + n) / 1100) * 0.55;
  const c = Math.cos((e - n * 1.7) / 640) * 0.3;
  const d = Math.sin(e / 310) * Math.cos(n / 280) * 0.12;
  return (a + b + c + d) / 1.97;          // ≈ -1 … 1
}

const R_PROCHE = 900;      // m : en deçà, la trace commande
const R_LOIN = 4200;       // m : au-delà, le terrain est libre
const AMPLITUDE = 520;     // m de relief inventé, loin de la trace

function altitude(e, n) {
  let num = 0, den = 0, dmin = Infinity;
  for (let i = 0; i < ancres.length; i++) {
    const dx = e - ancres[i].e, dy = n - ancres[i].n;
    const d2 = dx * dx + dy * dy;
    if (d2 < dmin) dmin = d2;
    const w = 1 / (d2 + 40000);           // 200 m de plancher : pas de pic sur une ancre
    num += ancres[i].z * w;
    den += w;
  }
  const d = Math.sqrt(dmin);
  const proche = num / den;               // l'altitude que dit la trace
  /* `k` vaut 0 sur la trace et 1 au loin : le terrain inventé n'apparaît
   * qu'où il ne peut contredire aucune mesure. */
  const k = Math.max(0, Math.min(1, (d - R_PROCHE) / (R_LOIN - R_PROCHE)));
  const fond = zMoy + houle(e, n) * AMPLITUDE;
  return proche * (1 - k) + fond * k;
}

/* ---------- le même calcul que le vrai relief ---------- */
Relief.preparer(pts, {
  pas: 75, equidistance: 50,
  altitude: altitude,
  source: 'terrain d’exemple — inventé pour la vignette, pas mesuré',
  versPng: function () { return null; }    // l'ombrage ne sert pas à la planche
}).then(function (r) {
  const courbes = r.courbes.map(function (c) {
    return { alt: c.alt, maitresse: c.maitresse,
             pts: c.pts.map(function (p) { return [+p[0].toFixed(4), +p[1].toFixed(4)]; }) };
  });
  const paquet = {
    source: r.source, equidistance: r.equidistance, maitresse: r.maitresse,
    altMin: r.altMin, altMax: r.altMax,
    controle: r.controle,
    courbes: courbes
  };
  const js =
    '/* exemple-relief.js — ÉCRIT PAR tools/make-exemple-relief.js, ne pas retoucher.\n' +
    ' *\n' +
    ' * Le terrain de la sortie d\'exemple. Il est INVENTÉ : il interpole les\n' +
    ' * altitudes de `exemple.gpx` près de la trace et ondule doucement au-delà.\n' +
    ' * Il n\'a jamais été mesuré, et la planche l\'écrit — « terrain d\'exemple »,\n' +
    ' * jamais « swisstopo ».\n' +
    ' *\n' +
    ' * Il existe pour que la vignette de Topographie montre ce que la planche\n' +
    ' * fait, au premier écran, avant que quoi que ce soit soit chargé.\n' +
    ' *\n' +
    ' * Le vrai relief refuse cette sortie — ses altitudes ne correspondent à\n' +
    ' * aucun terrain réel (écart médian 343 m). C\'est le contrôle qui marche. */\n' +
    'window.EXEMPLE_RELIEF = ' + JSON.stringify(paquet) + ';\n';
  fs.writeFileSync(SORTIE, js);
  console.log('courbes    : ' + courbes.length + ', equidistance ' + r.equidistance + ' m');
  console.log('controle   : ecart median ' + r.controle.ecartMedian + ' m avec la trace');
  console.log('ecrit      : src/exemple-relief.js  (' + Math.round(js.length / 1024) + ' Ko)');
}).catch(function (e) {
  console.error('ECHEC : ' + e.message);
  process.exit(1);
});
