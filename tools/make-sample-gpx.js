/* Génère exemple.gpx — une boucle synthétique pour tester sans Strava.
 * node tools/make-sample-gpx.js
 */
const fs = require('fs');
const path = require('path');

const LAT = 46.5460, LON = 6.2450;            // col du Marchairuz, Jura vaudois
const N = 1400;                                // points
const START = new Date('2026-09-06T07:12:00Z');

let pts = [];
for (let i = 0; i < N; i++) {
  const t = i / N;
  const ang = t * Math.PI * 2;
  // boucle irrégulière, pas un cercle parfait
  const r = 0.105 * (1 + 0.30 * Math.sin(ang * 3) + 0.10 * Math.sin(ang * 7));
  const lat = LAT + r * Math.sin(ang) * 0.62;
  const lon = LON + r * Math.cos(ang);
  const ele = 900 + 380 * Math.sin(ang * 1.4 - 0.6) + 70 * Math.sin(ang * 5) + (Math.random() - 0.5) * 2;
  // allure qui dérive un peu + un km rapide au milieu
  const base = 3.25 + 1.05 * Math.sin(ang * 1.4 - 0.6) - (t > 0.45 && t < 0.55 ? 0.5 : 0);
  pts.push({ lat, lon, ele, pace: base, hr: Math.round(132 + 22 * Math.sin(ang * 1.4 - 0.6) + Math.random() * 4) });
}

// horodatage dérivé de l'allure et de la distance réelle entre points
const R = 6371000, rad = d => d * Math.PI / 180;
function dist(a, b) {
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}
let time = START.getTime();
pts[0].time = new Date(time);
for (let i = 1; i < pts.length; i++) {
  const d = dist(pts[i - 1], pts[i]);            // mètres
  time += (d / 1000) * pts[i].pace * 60 * 1000;  // allure min/km
  pts[i].time = new Date(time);
}

const body = pts.map(p =>
  `      <trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}">
        <ele>${p.ele.toFixed(1)}</ele>
        <time>${p.time.toISOString()}</time>
        <extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${p.hr}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions>
      </trkpt>`).join('\n');

const gpx = `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="strava-studio" version="1.1"
     xmlns="http://www.topografix.com/GPX/1/1"
     xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
  <metadata><time>${START.toISOString()}</time></metadata>
  <trk>
    <name>Col du Marchairuz</name>
    <type>ride</type>
    <trkseg>
${body}
    </trkseg>
  </trk>
</gpx>
`;

const out = path.join(__dirname, '..', 'exemple.gpx');
fs.writeFileSync(out, gpx, 'utf8');
console.log('écrit :', out, '—', pts.length, 'points');
