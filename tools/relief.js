/* relief.js — le vrai relief autour d'un parcours, depuis swisstopo.
 *
 *   node tools/relief.js <parcours.gpx> <sortie.json> [pas_en_m=150] [format=1.3]
 *
 * Un GPX ne connaît que l'altitude SUR le chemin. Les courbes de niveau
 * demandent le terrain autour : on le demande ici à swisstopo, une fois,
 * et le carnet n'a plus jamais besoin du réseau.
 *
 * LA SOURCE. Le service de profils de geo.admin.ch
 * (api3.geo.admin.ch/rest/services/profile.json) renvoie l'altitude le long
 * d'une ligne — modèle « COMB » : swissALTI3D, complété par DHM25, qui
 * déborde sur les pays voisins le long de la frontière. On balaie la zone
 * par lignes est-ouest, une requête par ligne, espacées pour rester poli.
 * Les dalles swissALTI3D elles-mêmes (1 km², 1,2 Mo) auraient demandé des
 * centaines de mégaoctets pour un seul voyage.
 *
 * CE QUI SORT. Des courbes de niveau et un ombrage, en latitude/longitude,
 * dans un fichier LOCAL : le carnet les projette avec la même fonction que
 * la trace. Attention à ce que cela implique : un vrai relief rend le lieu
 * reconnaissable. C'est un choix, que la trace seule ne faisait pas.
 *
 * LE CONTRÔLE. Avant d'écrire, on compare l'altitude swisstopo à celle du
 * GPX le long du parcours. Un écart médian de quelques mètres dit que la
 * grille est juste ; un écart de centaines dit qu'elle ne couvre pas
 * l'endroit — et on le dit au lieu de dessiner des courbes fausses.
 *
 * Aucune dépendance : Node, son zlib, et https.
 */
'use strict';
const fs = require('fs');
const https = require('https');
const zlib = require('zlib');

const [,, gpxChemin, sortie, pasArg, formatArg] = process.argv;
if (!gpxChemin || !sortie) {
  console.error('usage : node tools/relief.js <parcours.gpx> <sortie.json> [pas_en_m=150]');
  process.exit(1);
}
const PAS = Math.max(60, +pasArg || 150);
const FORMAT = +formatArg || 1.3;   // largeur / hauteur de la zone
const MARGE = 2500;            // m autour du parcours
const EQUIDISTANCE = 100;      // m entre deux courbes
const MAITRESSE = 500;         // une courbe sur cinq, plus appuyée

/* ---------- WGS84 <-> LV95 (formules approchées de swisstopo, ~1 m) ---------- */
function versLV95(lat, lon) {
  const p = (lat * 3600 - 169028.66) / 10000, l = (lon * 3600 - 26782.5) / 10000;
  return {
    e: 2600072.37 + 211455.93 * l - 10938.51 * l * p - 0.36 * l * p * p - 44.54 * l * l * l,
    n: 1200147.07 + 308807.95 * p + 3745.25 * l * l + 76.63 * p * p - 194.56 * l * l * p + 119.79 * p * p * p
  };
}
function versWGS(e, n) {
  const y = (e - 2600000) / 1e6, x = (n - 1200000) / 1e6;
  const l = 2.6779094 + 4.728982 * y + 0.791484 * y * x + 0.1306 * y * x * x - 0.0436 * y * y * y;
  const p = 16.9023892 + 3.238272 * x - 0.270978 * y * y - 0.002528 * x * x - 0.0447 * y * y * x - 0.0140 * x * x * x;
  return { lat: p * 100 / 36, lon: l * 100 / 36 };
}

/* ---------- le GPX ---------- */
function lireGPX(txt) {
  const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const pts = []; let m;
  while ((m = re.exec(txt))) {
    const ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3]);
    pts.push({ lat: +m[1], lon: +m[2], ele: ele ? +ele[1] : null });
  }
  return pts;
}

/* ---------- le réseau, poliment ---------- */
function get(url) {
  return new Promise((ok, ko) => {
    https.get(url, { headers: { 'User-Agent': 'alpage-studio relief (usage personnel)' } }, r => {
      let s = '';
      r.on('data', d => s += d);
      r.on('end', () => r.statusCode === 200 ? ok(s) : ko(new Error('HTTP ' + r.statusCode + ' ' + s.slice(0, 120))));
    }).on('error', ko);
  });
}
const pause = ms => new Promise(ok => setTimeout(ok, ms));

async function ligne(e0, e1, n, points) {
  const geom = JSON.stringify({ type: 'LineString', coordinates: [[e0, n], [e1, n]] });
  const url = 'https://api3.geo.admin.ch/rest/services/profile.json?sr=2056&distinct_points=true' +
    '&nb_points=' + points + '&geom=' + encodeURIComponent(geom);
  for (let essai = 0; essai < 4; essai++) {
    try {
      const d = JSON.parse(await get(url));
      return d.map(p => (p.alts && (p.alts.COMB != null ? p.alts.COMB : p.alts.DTM25)) ?? null);
    } catch (err) {
      if (essai === 3) throw err;
      await pause(1500 * (essai + 1));   // une limite de rythme ne se force pas
    }
  }
}

/* ---------- courbes de niveau : les carrés qui marchent ---------- */
function courbes(grille, larg, haut, niveau) {
  const segs = [];
  const v = (i, j) => grille[j * larg + i];
  function interp(a, b, va, vb) { const t = (niveau - va) / ((vb - va) || 1e-9); return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]; }
  for (let j = 0; j < haut - 1; j++) {
    for (let i = 0; i < larg - 1; i++) {
      const a = v(i, j), b = v(i + 1, j), c = v(i + 1, j + 1), d = v(i, j + 1);
      if (a == null || b == null || c == null || d == null) continue;
      const k = (a > niveau ? 8 : 0) | (b > niveau ? 4 : 0) | (c > niveau ? 2 : 0) | (d > niveau ? 1 : 0);
      if (k === 0 || k === 15) continue;
      const H = interp([i, j], [i + 1, j], a, b), D = interp([i + 1, j], [i + 1, j + 1], b, c);
      const B = interp([i, j + 1], [i + 1, j + 1], d, c), G = interp([i, j], [i, j + 1], a, d);
      const table = { 1: [[G, B]], 2: [[B, D]], 3: [[G, D]], 4: [[H, D]], 5: [[G, H], [B, D]], 6: [[H, B]], 7: [[G, H]],
        8: [[G, H]], 9: [[H, B]], 10: [[G, B], [H, D]], 11: [[H, D]], 12: [[G, D]], 13: [[B, D]], 14: [[G, B]] };
      table[k].forEach(s => segs.push(s));
    }
  }
  // les segments se recousent en lignes, par leurs extrémités communes
  const cle = p => p[0].toFixed(3) + ',' + p[1].toFixed(3);
  const parBout = new Map();
  segs.forEach((s, i) => [0, 1].forEach(b => { const k = cle(s[b]); (parBout.get(k) || parBout.set(k, []).get(k)).push(i); }));
  const pris = new Uint8Array(segs.length), lignes = [];
  for (let i = 0; i < segs.length; i++) {
    if (pris[i]) continue;
    pris[i] = 1;
    const l = [segs[i][0], segs[i][1]];
    for (const sens of [1, 0]) {
      for (;;) {
        const bout = sens ? l[l.length - 1] : l[0];
        const suite = (parBout.get(cle(bout)) || []).find(x => !pris[x]);
        if (suite === undefined) break;
        pris[suite] = 1;
        const s = segs[suite], autre = cle(s[0]) === cle(bout) ? s[1] : s[0];
        if (sens) l.push(autre); else l.unshift(autre);
      }
    }
    if (l.length > 4) lignes.push(l);
  }
  return lignes;
}

// Douglas-Peucker : on garde la forme, on jette les points qui ne la changent pas
function simplifier(l, tol) {
  if (l.length < 3) return l;
  let dmax = 0, idx = 0;
  const [ax, ay] = l[0], [bx, by] = l[l.length - 1], dx = bx - ax, dy = by - ay, n = Math.hypot(dx, dy) || 1;
  for (let i = 1; i < l.length - 1; i++) {
    const d = Math.abs(dy * l[i][0] - dx * l[i][1] + bx * ay - by * ax) / n;
    if (d > dmax) { dmax = d; idx = i; }
  }
  if (dmax <= tol) return [l[0], l[l.length - 1]];
  return simplifier(l.slice(0, idx + 1), tol).slice(0, -1).concat(simplifier(l.slice(idx), tol));
}

/* ---------- l'ombrage, en PNG gris, sans bibliothèque ---------- */
function crc32(buf) {
  let c, crc = 0xFFFFFFFF;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xFF;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
function png(gris, w, h) {
  const bloc = (type, data) => {
    const t = Buffer.from(type), len = Buffer.alloc(4), crc = Buffer.alloc(4);
    len.writeUInt32BE(data.length); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  const brut = Buffer.alloc((w + 1) * h);
  for (let j = 0; j < h; j++) { brut[j * (w + 1)] = 0; gris.copy(brut, j * (w + 1) + 1, j * w, (j + 1) * w); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]);
}

(async function () {
  const pts = lireGPX(fs.readFileSync(gpxChemin, 'utf8'));
  if (!pts.length) throw new Error('aucun point dans ce GPX');
  const lv = pts.map(p => versLV95(p.lat, p.lon));
  let eMin = Math.floor((Math.min(...lv.map(p => p.e)) - MARGE) / PAS) * PAS;
  let eMax = Math.ceil((Math.max(...lv.map(p => p.e)) + MARGE) / PAS) * PAS;
  let nMin = Math.floor((Math.min(...lv.map(p => p.n)) - MARGE) / PAS) * PAS;
  let nMax = Math.ceil((Math.max(...lv.map(p => p.n)) + MARGE) / PAS) * PAS;
  /* une feuille de carte n'a pas la forme du parcours : on élargit la zone
   * jusqu'au format demandé (largeur / hauteur), pour que le relief remplisse
   * le cadre au lieu de s'arrêter net de part et d'autre de la boucle */
  const w0 = eMax - eMin, h0 = nMax - nMin;
  if (w0 / h0 < FORMAT) { const d = Math.ceil((FORMAT * h0 - w0) / 2 / PAS) * PAS; eMin -= d; eMax += d; }
  else { const d = Math.ceil((w0 / FORMAT - h0) / 2 / PAS) * PAS; nMin -= d; nMax += d; }
  const larg = Math.round((eMax - eMin) / PAS) + 1, haut = Math.round((nMax - nMin) / PAS) + 1;
  console.log('zone : ' + ((eMax - eMin) / 1000).toFixed(1) + ' × ' + ((nMax - nMin) / 1000).toFixed(1) + ' km, grille ' + larg + ' × ' + haut + ' au pas de ' + PAS + ' m — ' + haut + ' requêtes');

  // la grille : ligne 0 au NORD, pour qu'elle se lise comme une image
  const grille = new Array(larg * haut).fill(null);
  for (let j = 0; j < haut; j++) {
    const n = nMax - j * PAS;
    const alts = await ligne(eMin, eMax, n, larg);
    if (alts.length !== larg) console.warn('  ligne ' + j + ' : ' + alts.length + ' points au lieu de ' + larg);
    for (let i = 0; i < Math.min(larg, alts.length); i++) grille[j * larg + i] = alts[i];
    if (j % 20 === 0) process.stdout.write('  ' + j + '/' + haut + '\n');
    await pause(120);
  }
  const vides = grille.filter(v => v == null).length;

  // le contrôle : la grille dit-elle la même altitude que le GPX ?
  function alt(e, n) {
    const fi = (e - eMin) / PAS, fj = (nMax - n) / PAS, i = Math.floor(fi), j = Math.floor(fj);
    if (i < 0 || j < 0 || i >= larg - 1 || j >= haut - 1) return null;
    const a = grille[j * larg + i], b = grille[j * larg + i + 1], c = grille[(j + 1) * larg + i], d = grille[(j + 1) * larg + i + 1];
    if ([a, b, c, d].some(x => x == null)) return null;
    const u = fi - i, w = fj - j;
    return a * (1 - u) * (1 - w) + b * u * (1 - w) + c * (1 - u) * w + d * u * w;
  }
  const ecarts = [];
  pts.forEach((p, k) => { if (p.ele != null && k % 5 === 0) { const a = alt(lv[k].e, lv[k].n); if (a != null) ecarts.push(Math.abs(a - p.ele)); } });
  ecarts.sort((a, b) => a - b);
  const q = f => ecarts.length ? Math.round(ecarts[Math.floor(ecarts.length * f)]) : null;
  const controle = { points: ecarts.length, ecartMedian: q(0.5), ecartP90: q(0.9), cellulesVides: vides };
  console.log('contrôle : écart médian GPX / swisstopo ' + controle.ecartMedian + ' m, 90 % sous ' + controle.ecartP90 + ' m, ' + vides + ' cellules sans altitude');
  if (controle.ecartMedian == null || controle.ecartMedian > 60) {
    throw new Error('la grille ne correspond pas au parcours (écart médian ' + controle.ecartMedian + ' m) — rien n’est écrit');
  }

  // les courbes
  let zmin = Infinity, zmax = -Infinity;
  grille.forEach(v => { if (v != null) { zmin = Math.min(zmin, v); zmax = Math.max(zmax, v); } });
  const sortieCourbes = [];
  for (let z = Math.ceil(zmin / EQUIDISTANCE) * EQUIDISTANCE; z <= zmax; z += EQUIDISTANCE) {
    courbes(grille, larg, haut, z).forEach(l => {
      const s = simplifier(l, 0.18);   // en cellules : ~27 m au pas de 150 m
      sortieCourbes.push({
        alt: z, maitresse: z % MAITRESSE === 0,
        pts: s.map(([i, j]) => { const w = versWGS(eMin + i * PAS, nMax - j * PAS); return [+w.lat.toFixed(5), +w.lon.toFixed(5)]; })
      });
    });
  }

  // l'ombrage : lumière du nord-ouest, à 45°, comme sur les cartes suisses
  const gris = Buffer.alloc(larg * haut, 255);
  const az = 315 * Math.PI / 180, el = 45 * Math.PI / 180;
  for (let j = 1; j < haut - 1; j++) {
    for (let i = 1; i < larg - 1; i++) {
      const g = (a, b) => grille[b * larg + a];
      if ([g(i - 1, j), g(i + 1, j), g(i, j - 1), g(i, j + 1)].some(x => x == null)) continue;
      const dzdx = (g(i + 1, j) - g(i - 1, j)) / (2 * PAS), dzdy = (g(i, j - 1) - g(i, j + 1)) / (2 * PAS);
      const pente = Math.atan(Math.hypot(dzdx, dzdy)), aspect = Math.atan2(dzdy, -dzdx);
      const l = Math.cos(el) * Math.cos(pente) + Math.sin(el) * Math.sin(pente) * Math.cos(az - Math.PI / 2 - aspect);
      gris[j * larg + i] = Math.max(0, Math.min(255, Math.round(255 * l)));
    }
  }
  const coin = (e, n) => versWGS(e, n);
  const no = coin(eMin, nMax), se = coin(eMax, nMin);

  const out = {
    source: 'swisstopo · geo.admin.ch profile.json (COMB : swissALTI3D + DHM25)',
    pas: PAS, equidistance: EQUIDISTANCE, maitresse: MAITRESSE,
    altMin: Math.round(zmin), altMax: Math.round(zmax),
    controle: controle,
    courbes: sortieCourbes,
    ombre: { png: 'data:image/png;base64,' + png(gris, larg, haut).toString('base64'), nord: no.lat, ouest: no.lon, sud: se.lat, est: se.lon, larg: larg, haut: haut }
  };
  fs.writeFileSync(sortie, JSON.stringify(out));
  console.log(sortieCourbes.length + ' courbes, ' + (fs.statSync(sortie).size / 1e6).toFixed(2) + ' Mo → ' + sortie);
})().catch(e => { console.error('ÉCHEC : ' + e.message); process.exit(1); });
