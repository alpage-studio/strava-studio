/* make-exemples.js — fabrique les trois sorties de démonstration.
 *
 *   node tools/make-exemples.js
 *
 * Les planches multi-sorties — métro, saisons, tissage, fresque — ne se
 * jugent pas sur une sortie. Il leur faut un jeu qui contienne les cas durs :
 *
 *   - deux sorties qui PARTAGENT une portion (sinon aucune correspondance
 *     n'apparaît jamais et on croit le détecteur cassé) ;
 *   - une BOUCLE, et un aller-retour (le même chemin en sens inverse) ;
 *   - une sortie ÉLOIGNÉE, pour vérifier que la planche ne la réduit pas à
 *     un point dans un cadrage commun sans le dire ;
 *   - des dates ÉTALÉES sur plusieurs semaines, pour le tissage.
 *
 * Tout est déterministe : mêmes fichiers à chaque exécution. Un jeu de
 * démonstration qui change d'une fois à l'autre ne prouve rien.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..');

/* Un bruit reproductible — surtout pas Math.random(). */
function graine(s) {
  let x = s;
  return function () { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
}

/* Construit une trace à partir de sommets (lat, lon, altitude), en
 * interpolant et en ajoutant une ondulation légère : une droite parfaite
 * entre deux points ne ressemble à aucune sortie réelle. */
function trace(sommets, opts) {
  const r = graine(opts.graine);
  const pts = [];
  for (let i = 0; i < sommets.length - 1; i++) {
    const a = sommets[i], b = sommets[i + 1];
    const n = opts.parSegment || 40;
    for (let k = 0; k < n; k++) {
      const t = k / n;
      const ond = (r() - 0.5) * (opts.bruit || 0.00035);
      pts.push({
        lat: a[0] + (b[0] - a[0]) * t + ond,
        lon: a[1] + (b[1] - a[1]) * t + ond * 1.4,
        ele: a[2] + (b[2] - a[2]) * t + (r() - 0.5) * 2.5
      });
    }
  }
  pts.push({ lat: sommets[sommets.length - 1][0], lon: sommets[sommets.length - 1][1],
             ele: sommets[sommets.length - 1][2] });
  return pts;
}

function gpx(nom, type, depart, pts, secondesParPoint) {
  const t0 = new Date(depart).getTime();
  const corps = pts.map(function (p, i) {
    return '      <trkpt lat="' + p.lat.toFixed(6) + '" lon="' + p.lon.toFixed(6) + '">\n' +
           '        <ele>' + p.ele.toFixed(1) + '</ele>\n' +
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

/* --- le tronçon commun : la montée depuis le village --- */
const COMMUN = [
  [46.5460, 6.3500, 685],
  [46.5498, 6.3562, 712],
  [46.5541, 6.3629, 758],
  [46.5588, 6.3703, 824]
];

/* 1. La boucle du col : le tronçon commun, puis une vraie boucle. */
const boucle = COMMUN.concat([
  [46.5664, 6.3812, 931],
  [46.5731, 6.3908, 1042],
  [46.5788, 6.4021, 1178],
  [46.5742, 6.4126, 1104],
  [46.5651, 6.4088, 968],
  [46.5572, 6.3951, 861],
  [46.5512, 6.3792, 776],
  [46.5460, 6.3500, 685]                      // retour au départ : boucle fermée
]);

/* 2. L'aller-retour : le MÊME tronçon commun, prolongé, puis demi-tour.
 *    C'est le cas qui piège les comparateurs de géométrie. */
const aller = COMMUN.concat([[46.5641, 6.3771, 889], [46.5702, 6.3845, 967]]);
const allerRetour = aller.concat(aller.slice(0, -1).reverse());

/* 3. La sortie éloignée : à ~40 km, pour que le cadrage commun ait un vrai
 *    problème à résoudre plutôt qu'un cas théorique. */
const ailleurs = [
  [46.8120, 7.1480, 552],
  [46.8168, 7.1571, 578],
  [46.8231, 7.1649, 611],
  [46.8294, 7.1772, 664],
  [46.8351, 7.1888, 702],
  [46.8299, 7.1971, 648],
  [46.8214, 7.1902, 596],
  [46.8148, 7.1766, 561]
];

/* 4. La VARIANTE : même départ, même montée, puis une branche décalée de
 *    ~250 m — assez pour qu'un comparateur honnête la dise nouvelle, pas
 *    assez pour que ce soit une autre région. C'est le cas qui distingue
 *    « bruit GPS » de « je suis passé ailleurs ». */
const brancheVariante = COMMUN.concat([
  [46.5601, 6.3760, 851],
  [46.5639, 6.3841, 902],
  [46.5688, 6.3925, 958],
  [46.5639, 6.3841, 902],
  [46.5601, 6.3760, 851]
]).concat(COMMUN.slice(0, -1).reverse());

const jeux = [
  ['exemple-boucle.gpx',  'Boucle du col',       'ride', '2026-08-18T07:10:00Z', boucle,       4],
  ['exemple-aller.gpx',   'Aller-retour du bois', 'ride', '2026-08-26T16:40:00Z', allerRetour, 5],
  ['exemple-ailleurs.gpx', 'Plaine de Fribourg',  'ride', '2026-09-08T09:05:00Z', ailleurs,    4],
  ['exemple-variante.gpx', 'Variante du bois',   'ride', '2026-09-02T17:15:00Z', brancheVariante, 5]
];

/* --- le jeu « huit semaines », pour le tissage ---
 * Il doit contenir ses propres cas durs : une semaine entièrement vide, une
 * sortie SANS altitude (le GPX n'a pas de <ele>), deux sorties le même jour,
 * et un dénivelé extrême qui éprouve le plafond de l'échelle commune. */
function variante(base, dLat, dLon, kEle) {
  return base.map(function (p) { return [p[0] + dLat, p[1] + dLon, p[2] * kEle]; });
}

const SEMAINES = [
  // 2026-07-13 → semaine 1
  ['sem-01.gpx', 'Tour du lac',        '2026-07-14T08:00:00Z', variante(boucle, 0, 0, 0.9),   0],
  ['sem-02.gpx', 'Montée du matin',    '2026-07-22T06:30:00Z', variante(aller, 0.004, 0.002, 1.0), 0],
  // semaine du 27.07 : rien du tout — la chaîne doit rester nue
  ['sem-03.gpx', 'Home-trainer',       '2026-08-05T18:10:00Z', variante(aller, 0.05, 0.05, 1), 1],
  ['sem-04.gpx', 'Le grand col',       '2026-08-12T07:00:00Z', variante(boucle, 0, 0, 2.4),   0],
  ['sem-05.gpx', 'Sortie courte',      '2026-08-13T17:20:00Z', variante(aller, 0.001, 0, 0.6), 0],
  ['sem-06.gpx', 'Plaine',             '2026-08-20T09:00:00Z', variante(ailleurs, 0, 0, 0.4), 0],
  ['sem-07.gpx', 'Retour au col',      '2026-08-31T08:40:00Z', variante(boucle, 0.002, 0.001, 1.1), 0],
  ['sem-08.gpx', 'Dernière de la série', '2026-09-03T16:00:00Z', variante(aller, 0, 0.003, 0.95), 0]
];

SEMAINES.forEach(function (j, i) {
  const pts = trace(j[3], { graine: 101 + i * 7, parSegment: 14, bruit: 0.00028 });
  let x = gpx(j[1], 'ride', j[2], pts, 6);
  // sans altitude : le tissage doit le dessiner autrement, pas à plat
  if (j[4]) x = x.replace(/\n\s*<ele>[^<]*<\/ele>/g, '');
  fs.writeFileSync(path.join(OUT, j[0]), x, 'utf8');
  console.log(j[0] + ' · ' + pts.length + ' points' + (j[4] ? ' · sans altitude' : ''));
});

jeux.forEach(function (j, i) {
  const pts = trace(j[4], { graine: 7 + i * 13, parSegment: 38, bruit: 0.00032 });
  fs.writeFileSync(path.join(OUT, j[0]), gpx(j[1], j[2], j[3], pts, j[5]), 'utf8');
  console.log(j[0] + ' · ' + pts.length + ' points');
});

/* --- une ANNÉE de démonstration, au format projet ---
 * Almanac ne se juge pas sur huit sorties : il lui faut une saison entière,
 * avec ses creux, ses semaines chargées et ses deux ou trois journées hors
 * norme. Soixante GPX seraient absurdes ; on écrit donc directement un
 * fichier de projet, que le studio sait rouvrir.
 *
 * La saisonnalité est INSCRITE dans les données, pas simulée à l'affichage :
 * peu de sorties en janvier, des sorties longues en juin-août, un trou de
 * trois semaines en septembre (le vide doit se voir), du vtt à l'automne. */
function annee() {
  const r = graine(4242);
  const sorties = [];
  const SPORTS = [
    { type: 'ride',            poids: 0.42, kmBase: 62, denivBase: 620 },
    { type: 'mountain biking', poids: 0.28, kmBase: 26, denivBase: 780 },
    { type: 'run',             poids: 0.18, kmBase: 11, denivBase: 180 },
    { type: 'hiking',          poids: 0.08, kmBase: 14, denivBase: 900 },
    { type: 'ski',             poids: 0.04, kmBase: 18, denivBase: 1100 }
  ];
  const LIEUX = ['Marchairuz', 'La Sonnaz', 'Lac de Joux', 'Gruyère', 'Jorat',
                 'Mont Tendre', 'Vully', 'Moléson', 'Broye', 'Jaun'];

  for (let jour = 0; jour < 365; jour++) {
    const d = new Date(Date.UTC(2026, 0, 1 + jour, 8, 0, 0));
    const mois = d.getUTCMonth();
    // le creux de septembre : trois semaines sans rien
    if (jour >= 247 && jour <= 268) continue;
    // saisonnalité : dense d'avril à septembre, creux en hiver
    const densite = 0.16 + 0.42 * Math.max(0, Math.sin((mois - 1) / 12 * Math.PI * 2 + 0.6));
    if (r() > densite) continue;

    // choix du sport, biaisé par la saison
    let acc = 0, tirage = r(), sport = SPORTS[0];
    const poids = SPORTS.map(function (sp) {
      let p = sp.poids;
      if (sp.type === 'ski') p *= (mois <= 1 || mois === 11) ? 9 : 0.02;
      if (sp.type === 'mountain biking') p *= (mois >= 8 && mois <= 10) ? 1.8 : 1;
      if (sp.type === 'ride') p *= (mois >= 3 && mois <= 8) ? 1.5 : 0.6;
      return p;
    });
    const total = poids.reduce(function (a, b) { return a + b; }, 0);
    tirage *= total;
    for (let i = 0; i < SPORTS.length; i++) { acc += poids[i]; if (tirage <= acc) { sport = SPORTS[i]; break; } }

    // une poignée de journées hors norme : elles doivent exister
    const enorme = r() > 0.965;
    const fac = enorme ? 1.9 + r() * 0.9 : 0.55 + r() * 0.95;
    const km = Math.round(sport.kmBase * fac * 10) / 10;
    const deniv = Math.round(sport.denivBase * fac * (0.7 + r() * 0.6));
    const heures = km / (sport.type === 'run' ? 10.5 : sport.type === 'hiking' ? 4 : 22);
    // une sortie sur douze n'a pas d'altimètre : la planche doit le montrer
    const sansDeniv = r() > 0.92;

    // une trace courte mais réelle, pour que les autres planches tiennent aussi
    const lat0 = 46.52 + (r() - 0.5) * 0.22, lon0 = 6.40 + (r() - 0.5) * 0.30;
    const n = 14, lat = [], lon = [], ele = [], tps = [];
    const t0 = Math.round(d.getTime() / 1000);
    for (let i = 0; i < n; i++) {
      const u2 = i / (n - 1);
      lat.push(Math.round((lat0 + Math.sin(u2 * 6.1 + r() * 0.1) * km * 0.00045) * 1e6) / 1e6);
      lon.push(Math.round((lon0 + Math.cos(u2 * 4.7) * km * 0.00062) * 1e6) / 1e6);
      ele.push(sansDeniv ? null : Math.round((520 + Math.sin(u2 * Math.PI) * deniv * 0.8) * 10) / 10);
      tps.push(t0 + Math.round(u2 * heures * 3600));
    }

    sorties.push({
      nom: LIEUX[Math.floor(r() * LIEUX.length)] + (enorme ? ' — la grande' : ''),
      type: sport.type, couleur: '#242820',
      date: d.toISOString(),
      distance_m: Math.round(km * 1000),
      duration_s: Math.round(heures * 3600),
      elev_gain_m: sansDeniv ? null : deniv,
      lat: lat, lon: lon, ele: ele, t: tps,
      w: lat.map(function () { return null; }),
      hr: lat.map(function () { return null; })
    });
  }
  return { format: 1, studio: 'exemple', cree: new Date('2027-01-01').toISOString(),
           reglages: { tpl: 'almanac' }, sorties: sorties };
}

const an = annee();
fs.writeFileSync(path.join(OUT, 'exemple-annee.json'), JSON.stringify(an), 'utf8');
console.log('exemple-annee.json · ' + an.sorties.length + ' sorties');
