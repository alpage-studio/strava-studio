/* relief.js — préparer le relief swisstopo d'un parcours, en ligne de commande.
 *
 *   node tools/relief.js <parcours.gpx> <sortie.json> [pas_en_m=150] [format=1.3]
 *
 * Le calcul vit dans src/carnet/relief.js, partagé avec la page du carnet (qui
 * le lance depuis un bouton). Ce fichier ne fait que lire le GPX, écrire le
 * PNG de l'ombrage avec zlib, et enregistrer le résultat. Une seule écriture
 * du calcul : sinon le relief préparé ici et celui préparé dans la page
 * finiraient par ne pas dire la même chose.
 *
 * Aucune dépendance : Node 18+ (fetch), son zlib.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const Relief = require(path.join(__dirname, '..', 'src', 'carnet', 'relief.js'));

const [,, gpxChemin, sortie, pasArg, formatArg] = process.argv;
if (!gpxChemin || !sortie) {
  console.error('usage : node tools/relief.js <parcours.gpx> <sortie.json> [pas_en_m=150] [format=1.3]');
  process.exit(1);
}

function lireGPX(txt) {
  const re = /<trkpt[^>]*lat="([-\d.]+)"[^>]*lon="([-\d.]+)"[^>]*>([\s\S]*?)<\/trkpt>/g;
  const pts = []; let m;
  while ((m = re.exec(txt))) {
    const ele = /<ele>([-\d.]+)<\/ele>/.exec(m[3]);
    pts.push({ lat: +m[1], lon: +m[2], ele: ele ? +ele[1] : null });
  }
  return pts;
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
  for (let j = 0; j < h; j++) { brut[j * (w + 1)] = 0; Buffer.from(gris.buffer, gris.byteOffset + j * w, w).copy(brut, j * (w + 1) + 1); }
  return 'data:image/png;base64,' + Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloc('IHDR', ihdr), bloc('IDAT', zlib.deflateSync(brut)), bloc('IEND', Buffer.alloc(0))]).toString('base64');
}

const pts = lireGPX(fs.readFileSync(gpxChemin, 'utf8'));
const est = Relief.estimer(pts, +pasArg || 150);
console.log('zone ≈ ' + est.kmLarge.toFixed(1) + ' × ' + est.kmHaut.toFixed(1) + ' km — ' + est.requetes + ' requêtes');
let dernier = -1;
Relief.preparer(pts, {
  pas: +pasArg || 150, format: +formatArg || 1.3, versPng: png,
  progres: k => { const p = Math.floor(k * 10); if (p !== dernier) { dernier = p; process.stdout.write('  ' + (p * 10) + ' %\n'); } }
}).then(out => {
  const c = out.controle;
  console.log('contrôle : écart médian GPX / swisstopo ' + c.ecartMedian + ' m, 90 % sous ' + c.ecartP90 + ' m, ' + c.cellulesVides + ' cellules sans altitude');
  fs.writeFileSync(sortie, JSON.stringify(out));
  console.log(out.courbes.length + ' courbes, ' + (fs.statSync(sortie).size / 1e6).toFixed(2) + ' Mo → ' + sortie);
}).catch(e => { console.error('ÉCHEC : ' + e.message + ' — rien n’est écrit'); process.exit(1); });
