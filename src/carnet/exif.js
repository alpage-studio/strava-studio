/* exif.js — lire dans un JPEG ce qui place une photo sur un parcours.
 *
 * Trois choses, et rien d'autre : la position GPS, l'heure de prise de vue,
 * l'orientation. Pas de bibliothèque : le format TIFF tient en quarante
 * lignes quand on ne lit que les étiquettes dont on a besoin.
 *
 * L'heure a deux sources et elles ne se valent pas :
 *   - GPSDateStamp + GPSTimeStamp sont en UTC, écrits par le récepteur ;
 *   - DateTimeOriginal est l'heure LOCALE de l'appareil, sans fuseau, sauf
 *     si OffsetTimeOriginal l'accompagne.
 * On préfère la première. La seconde sans décalage est rendue telle quelle,
 * marquée `heureLocale: true` — c'est à l'appelant de décider quoi en faire.
 *
 * Même fichier pour le navigateur et pour Node (le harnais de test).
 */
(function (global) {
  'use strict';

  function lire(buffer) {
    var v = new DataView(buffer);
    if (v.byteLength < 4 || v.getUint16(0) !== 0xFFD8) return null;
    var off = 2;
    while (off + 4 <= v.byteLength) {
      if (v.getUint8(off) !== 0xFF) return null;
      var marque = v.getUint8(off + 1);
      var long = v.getUint16(off + 2);
      if (marque === 0xE1 && v.getUint32(off + 4) === 0x45786966) {   // « Exif »
        return tiff(v, off + 10);
      }
      if (marque === 0xDA) return null;   // début de l'image : plus d'en-tête après
      off += 2 + long;
    }
    return null;
  }

  function tiff(v, base) {
    var le = v.getUint16(base) === 0x4949;
    function u16(o) { return v.getUint16(base + o, le); }
    function u32(o) { return v.getUint32(base + o, le); }

    function ifd(o) {
      var tags = {}, n = u16(o);
      for (var i = 0; i < n; i++) {
        var e = o + 2 + i * 12;
        tags[u16(e)] = { type: u16(e + 2), n: u32(e + 4), e: e + 8 };
      }
      return tags;
    }
    function valeur(t) {
      if (!t) return null;
      var taille = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8 }[t.type] || 1;
      var o = t.n * taille > 4 ? u32(t.e) : t.e;
      var out = [], i;
      if (t.type === 2) {
        var s = '';
        for (i = 0; i < t.n; i++) { var c = v.getUint8(base + o + i); if (!c) break; s += String.fromCharCode(c); }
        return s;
      }
      for (i = 0; i < t.n; i++) {
        if (t.type === 3) out.push(u16(o + i * 2));
        else if (t.type === 4) out.push(u32(o + i * 4));
        else if (t.type === 5 || t.type === 10) {
          var d = u32(o + i * 8 + 4);
          out.push(d ? u32(o + i * 8) / d : 0);
        } else out.push(v.getUint8(base + o + i));
      }
      return out;
    }

    var ifd0 = ifd(u32(4));
    var res = { lat: null, lon: null, alt: null, t: null, heureLocale: false, orientation: 1 };
    var or = valeur(ifd0[0x0112]);
    if (or) res.orientation = or[0];

    var exifIfd = ifd0[0x8769] ? ifd(valeur(ifd0[0x8769])[0]) : {};
    var gpsIfd = ifd0[0x8825] ? ifd(valeur(ifd0[0x8825])[0]) : {};

    var lat = valeur(gpsIfd[2]), lon = valeur(gpsIfd[4]);
    if (lat && lon && lat.length === 3 && lon.length === 3) {
      var la = lat[0] + lat[1] / 60 + lat[2] / 3600;
      var lo = lon[0] + lon[1] / 60 + lon[2] / 3600;
      if (valeur(gpsIfd[1]) === 'S') la = -la;
      if (valeur(gpsIfd[3]) === 'W') lo = -lo;
      if (la || lo) { res.lat = la; res.lon = lo; }   // 0,0 = récepteur sans fix
    }
    var alt = valeur(gpsIfd[6]);
    if (alt) res.alt = (valeur(gpsIfd[5]) || [0])[0] === 1 ? -alt[0] : alt[0];

    var gd = valeur(gpsIfd[29]), gt = valeur(gpsIfd[7]);
    var dto = valeur(exifIfd[0x9003]) || valeur(ifd0[0x0132]);
    var decal = valeur(exifIfd[0x9011]);
    if (gd && gt && gt.length === 3) {
      var p = gd.split(':');
      res.t = Date.UTC(+p[0], +p[1] - 1, +p[2], gt[0], gt[1], Math.floor(gt[2]));
    } else if (dto) {
      var m = /(\d+):(\d+):(\d+) (\d+):(\d+):(\d+)/.exec(dto);
      if (m) {
        var local = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        var z = decal && /([+-])(\d\d):(\d\d)/.exec(decal);
        if (z) res.t = local - (z[1] === '-' ? -1 : 1) * (+z[2] * 60 + +z[3]) * 60000;
        else { res.t = local; res.heureLocale = true; }
      }
    }
    return res;
  }

  var Exif = { lire: lire };
  if (typeof module !== 'undefined' && module.exports) module.exports = Exif;
  else global.Exif = Exif;
})(this);
