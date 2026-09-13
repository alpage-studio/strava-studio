/* zip.js — archive ZIP « stockée », sans compression et sans dépendance.
 *
 * Pourquoi sans compression : le contenu est du PNG, déjà compressé. Déflater
 * ne gagnerait rien et coûterait une bibliothèque externe — que le studio ne
 * peut pas charger, puisqu'il doit tourner hors ligne.
 */
(function (global) {
  'use strict';

  var CRC = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  }());

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
  function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

  /* entries : [{ name: 'image-001.png', data: Uint8Array }] */
  function build(entries) {
    var parts = [], central = [], offset = 0;
    var enc = new TextEncoder();

    entries.forEach(function (e) {
      var name = enc.encode(e.name);
      var crc = crc32(e.data);
      var size = e.data.length;

      var local = [].concat(
        u32(0x04034B50), u16(20), u16(0), u16(0),
        u16(0), u16(0),                       // heure et date : sans objet ici
        u32(crc), u32(size), u32(size),
        u16(name.length), u16(0)
      );
      parts.push(new Uint8Array(local), name, e.data);

      central.push([].concat(
        u32(0x02014B50), u16(20), u16(20), u16(0), u16(0),
        u16(0), u16(0),
        u32(crc), u32(size), u32(size),
        u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0),
        u32(offset)
      ), name);

      offset += local.length + name.length + size;
    });

    var dirStart = offset, dirSize = 0;
    var dirParts = [];
    for (var i = 0; i < central.length; i += 2) {
      var head = new Uint8Array(central[i]);
      dirParts.push(head, central[i + 1]);
      dirSize += head.length + central[i + 1].length;
    }
    dirParts.push(new Uint8Array([].concat(
      u32(0x06054B50), u16(0), u16(0),
      u16(entries.length), u16(entries.length),
      u32(dirSize), u32(dirStart), u16(0)
    )));

    return new Blob(parts.concat(dirParts), { type: 'application/zip' });
  }

  global.Zip = { build: build };
}(window));
