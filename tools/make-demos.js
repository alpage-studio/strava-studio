/* make-demos.js — les parcours de démonstration pour la revue artistique.
 *
 *   node tools/make-demos.js
 *
 * Les premiers exemples étaient des polygones : huit sommets reliés par des
 * droites, plus un peu de bruit. Suffisant pour éprouver des CALCULS — une
 * correspondance, un dénivelé, un découpage en semaines — et trompeur pour
 * juger un DESSIN. Sur un polygone, un trait de plume paraît cassé même
 * quand la géométrie est parfaite ; et à l'inverse, un défaut de raccord s'y
 * confond avec un sommet réel. On ne peut rien conclure.
 *
 * Ces tracés-ci méandrent : une ligne directrice, plus un déplacement
 * PERPENDICULAIRE composé de trois sinusoïdes de périodes différentes. C'est
 * la structure d'une route de montagne — de grandes courbes, des lacets plus
 * serrés dedans, et un léger tremblé. Tout est déterministe.
 *
 * Quatre familles, parce que chacune piège un aspect différent du rendu :
 *
 *   boucle       — se referme : le raccord des deux bouts doit être invisible
 *   aller-retour — se superpose à elle-même : les décalages se rencontrent
 *   ouvert       — deux extrémités franches : les terminaisons se voient
 *   croisements  — un huit : le remplissage `nonzero` est mis à l'épreuve
 */
'use strict';
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..');

function graine(s) {
  let x = s;
  return function () { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
}

/* Une trace qui méandre autour d'une ligne directrice.
 *
 * `axe(t)` rend un point de la directrice pour t ∈ [0,1]. On y ajoute un
 * déplacement perpendiculaire : trois sinusoïdes dont les périodes ne sont
 * pas multiples l'une de l'autre, sinon le motif se répète visiblement tous
 * les deux kilomètres et on voit la recette. */
function meandre(axe, opts) {
  const n = opts.points || 900;
  const r = graine(opts.graine || 1);
  // phases tirées une fois : le tracé reste identique d'une exécution à l'autre
  const ph = [r() * 6.283, r() * 6.283, r() * 6.283];
  const pts = [];
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const a = axe(t);
    const b = axe(Math.min(1, t + 0.004));
    const dx = b.lat - a.lat, dy = b.lon - a.lon;
    const l = Math.hypot(dx, dy) || 1e-9;
    // perpendiculaire à la directrice
    const px = -dy / l, py = dx / l;
    const amp = opts.amplitude || 0.004;
    const d =
      Math.sin(t * opts.periode1 + ph[0]) * amp +
      Math.sin(t * opts.periode2 + ph[1]) * amp * 0.42 +
      Math.sin(t * opts.periode3 + ph[2]) * amp * 0.17;
    pts.push({
      lat: a.lat + px * d,
      lon: a.lon + py * d,
      ele: a.ele + Math.sin(t * 7.1 + ph[2]) * (opts.reliefFin || 12)
    });
  }
  return pts;
}

function gpx(nom, type, depart, pts, secondesParPoint, sansEle) {
  const t0 = new Date(depart).getTime();
  const corps = pts.map(function (p, i) {
    return '      <trkpt lat="' + p.lat.toFixed(6) + '" lon="' + p.lon.toFixed(6) + '">\n' +
           (sansEle ? '' : '        <ele>' + p.ele.toFixed(1) + '</ele>\n') +
           '        <time>' + new Date(t0 + i * secondesParPoint * 1000).toISOString() + '</time>\n' +
           '      </trkpt>';
  }).join('\n');
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<gpx creator="strava-studio" version="1.1"\n' +
    '     xmlns="http://www.topografix.com/GPX/1/1">\n' +
    '  <metadata><time>' + new Date(t0).toISOString() + '</time></metadata>\n' +
    '  <trk>\n    <name>' + nom + '</name>\n    <type>' + type + '</type>\n' +
    '    <trkseg>\n' + corps + '\n    </trkseg>\n  </trk>\n</gpx>\n';
}

/* ---------- les quatre familles ---------- */

/* 1. BOUCLE SINUEUSE — un tour de vallée qui se referme proprement.
 * La directrice est un cercle légèrement aplati ; le méandre en fait une
 * route. Comme t=0 et t=1 donnent le même point ET la même phase (les
 * périodes sont des multiples de 2π), le raccord est continu : c'est ce qui
 * permet de vérifier qu'une boucle ne laisse pas d'encoche. */
function boucle() {
  const c = { lat: 46.5480, lon: 6.3820 }, R = 0.035;
  return meandre(function (t) {
    const a = t * Math.PI * 2;
    return { lat: c.lat + Math.sin(a) * R * 0.78,
             lon: c.lon + Math.cos(a) * R,
             ele: 700 + 480 * (0.5 - 0.5 * Math.cos(a)) };
  }, { points: 1100, graine: 11, amplitude: 0.0042,
       periode1: Math.PI * 2 * 5, periode2: Math.PI * 2 * 13, periode3: Math.PI * 2 * 29 });
}

/* 2. ALLER-RETOUR — on monte, on redescend par le même chemin.
 * Le retour n'est pas identique au mètre près : un GPS ne repasse jamais
 * exactement là. C'est justement ce léger écart qui met à l'épreuve les
 * décalages parallèles et les contours. */
function allerRetour() {
  const monte = meandre(function (t) {
    return { lat: 46.5210 + t * 0.052, lon: 6.4100 + t * 0.031,
             ele: 620 + t * 900 };
  }, { points: 620, graine: 23, amplitude: 0.0036,
       periode1: 17, periode2: 41, periode3: 97 });
  const redescend = meandre(function (t) {
    const s = 1 - t;
    return { lat: 46.5210 + s * 0.052, lon: 6.4100 + s * 0.031, ele: 620 + s * 900 };
  }, { points: 600, graine: 29, amplitude: 0.0034,
       periode1: 17, periode2: 41, periode3: 97 });
  return monte.concat(redescend);
}

/* 3. OUVERT — d'un village à un autre, sans retour.
 * Deux extrémités franches : c'est là qu'on voit si les terminaisons d'un
 * ruban sont propres, et si une trace ouverte se fait refermer par erreur. */
function ouvert() {
  return meandre(function (t) {
    return { lat: 46.4900 + t * 0.086 + Math.sin(t * 3.1) * 0.012,
             lon: 6.3300 + t * 0.098,
             ele: 480 + 620 * Math.sin(t * Math.PI * 0.85) };
  }, { points: 950, graine: 37, amplitude: 0.0048,
       periode1: 11, periode2: 27, periode3: 63 });
}

/* 4. CROISEMENTS — un huit, parcouru d'un trait.
 * La trace se recoupe deux fois. C'est le cas qui départage un remplissage
 * `nonzero` correct d'un remplissage qui perce des trous, et qui montre si
 * les contours d'Empreinte contournent proprement un nœud. */
function croisements() {
  const c = { lat: 46.5600, lon: 6.5600 }, R = 0.030;
  return meandre(function (t) {
    const a = t * Math.PI * 2;
    // lemniscate de Gerono : un huit franc
    return { lat: c.lat + Math.sin(a) * Math.cos(a) * R * 1.5,
             lon: c.lon + Math.sin(a) * R,
             ele: 640 + 340 * Math.abs(Math.sin(a * 2)) };
  }, { points: 1000, graine: 43, amplitude: 0.0022,
       periode1: Math.PI * 2 * 7, periode2: Math.PI * 2 * 17, periode3: Math.PI * 2 * 37 });
}

const FAMILLES = [
  ['demo-boucle.gpx',      'Boucle du Marchairuz',  'ride',            '2026-09-06T07:10:00Z', boucle(),      4],
  ['demo-aller.gpx',       'Montée de la Dôle',     'ride',            '2026-09-09T16:20:00Z', allerRetour(), 5],
  ['demo-ouvert.gpx',      'Traversée du Jorat',    'mountain biking', '2026-09-11T09:00:00Z', ouvert(),      5],
  ['demo-croisements.gpx', 'Huit des Pléiades',     'ride',            '2026-09-13T08:30:00Z', croisements(), 4]
];

/* ---------- une semaine pour l'Atlas ----------
 * Cinq sorties, deux sports, et DEUX PORTIONS RÉELLEMENT PARTAGÉES : sans
 * elles, on ne voit pas ce qu'une semaine a de commun, et l'Atlas ressemble
 * à cinq cartes posées côte à côte. */
const DEPART = { lat: 46.5210, lon: 6.4100 };
function depuisLeVillage(capLat, capLon, longueur, gr, relief) {
  return meandre(function (t) {
    return { lat: DEPART.lat + capLat * longueur * t,
             lon: DEPART.lon + capLon * longueur * t,
             ele: 620 + relief * Math.sin(t * Math.PI * 0.9) };
  }, { points: 620, graine: gr, amplitude: 0.0034, periode1: 13, periode2: 31, periode3: 71 });
}

const SEMAINE = [
  // lundi et jeudi partagent la montée vers le nord-est
  ['sem-lun.gpx', 'Montée du matin',   'ride',            '2026-09-07T06:40:00Z', depuisLeVillage(1, 0.6, 0.048, 51, 720), 5],
  ['sem-mar.gpx', 'Tour du bois',      'mountain biking', '2026-09-08T17:10:00Z', depuisLeVillage(-0.4, 1, 0.032, 57, 380), 5],
  ['sem-jeu.gpx', 'Col, version longue','ride',           '2026-09-10T07:20:00Z', depuisLeVillage(1, 0.6, 0.071, 61, 1180), 4],
  ['sem-ven.gpx', 'Sortie courte',     'ride',            '2026-09-11T18:05:00Z', depuisLeVillage(0.2, -1, 0.021, 67, 190), 5],
  ['sem-dim.gpx', 'La grande boucle',  'ride',            '2026-09-13T08:00:00Z', boucle(),                                 4]
];

/* Deux régions éloignées, pour l'archipel de l'Atlas. */
const LOIN = [
  ['loin-a.gpx', 'Plaine de Fribourg', 'ride', '2026-09-08T09:00:00Z',
   meandre(function (t) {
     return { lat: 46.8120 + t * 0.042, lon: 7.1480 + t * 0.055, ele: 550 + 180 * Math.sin(t * 3.4) };
   }, { points: 560, graine: 71, amplitude: 0.0030, periode1: 15, periode2: 33, periode3: 79 }), 5],
  ['loin-b.gpx', 'Bord du lac', 'ride', '2026-09-12T10:30:00Z',
   meandre(function (t) {
     return { lat: 46.8300 + Math.sin(t * 2.2) * 0.020, lon: 7.1900 + t * 0.048, ele: 540 + 90 * Math.sin(t * 5) };
   }, { points: 520, graine: 73, amplitude: 0.0026, periode1: 9, periode2: 23, periode3: 51 }), 5]
];

[].concat(FAMILLES, SEMAINE, LOIN).forEach(function (j) {
  fs.writeFileSync(path.join(OUT, j[0]), gpx(j[1], j[2], j[3], j[4], j[5]), 'utf8');
  console.log(j[0] + ' · ' + j[4].length + ' points · ' + j[1]);
});
