/* Extrait d'exemple.gpx ce qu'il faut pour dessiner les maquettes :
 * un chemin SVG normalisé, les altitudes rééchantillonnées, les splits.
 * node tools/extract-geometry.js
 */
const fs = require('fs');
const path = require('path');

const gpx = fs.readFileSync(path.join(__dirname, '..', 'exemple.gpx'), 'utf8');
const pts = [...gpx.matchAll(/<trkpt lat="([-\d.]+)" lon="([-\d.]+)">\s*<ele>([-\d.]+)<\/ele>/g)]
  .map(m => ({ lat: +m[1], lon: +m[2], ele: +m[3] }));

// projection mercator locale, normalisée dans une boîte 0..100 (aspect conservé)
const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
const k = Math.cos(lat0 * Math.PI / 180);
const xs = pts.map(p => p.lon * k), ys = pts.map(p => -p.lat);
const minX = Math.min(...xs), maxX = Math.max(...xs);
const minY = Math.min(...ys), maxY = Math.max(...ys);
const w = maxX - minX, h = maxY - minY, s = Math.max(w, h);
const nx = xs.map(x => ((x - minX) / s + (s - w) / (2 * s)) * 100);
const ny = ys.map(y => ((y - minY) / s + (s - h) / (2 * s)) * 100);

// on allège : 1 point sur 5 suffit à l'échelle d'une maquette
let d = '';
for (let i = 0; i < pts.length; i += 5) {
  d += (i === 0 ? 'M' : 'L') + nx[i].toFixed(2) + ' ' + ny[i].toFixed(2);
}
d += 'Z';

function resample(values, n) {
  const out = [], step = values.length / n;
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * step), b = Math.max(a + 1, Math.floor((i + 1) * step));
    const sl = values.slice(a, b);
    out.push(sl.reduce((x, y) => x + y, 0) / sl.length);
  }
  return out;
}

const eles = pts.map(p => p.ele);
const lo = Math.min(...eles), hi = Math.max(...eles);
const bars56 = resample(eles, 56).map(e => +((e - lo) / (hi - lo)).toFixed(3));
const bars32 = resample(eles, 32).map(e => +((e - lo) / (hi - lo)).toFixed(3));

const out = {
  path: d,
  aspect: +(w / h).toFixed(3),
  eleMin: Math.round(lo), eleMax: Math.round(hi),
  bars56, bars32
};
fs.writeFileSync(path.join(__dirname, 'geometry.json'), JSON.stringify(out, null, 1));
console.log('path:', d.length, 'car. | aspect', out.aspect, '| alt', out.eleMin, '-', out.eleMax);
