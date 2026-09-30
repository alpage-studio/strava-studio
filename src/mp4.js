/* mp4.js — un MP4 image par image, sans temps réel et sans bibliothèque.
 *
 * SOCLE DE LA SUITE : le studio (src/app/exports.js) et le carnet de route
 * (src/carnet/) s'en servent tous les deux. Il ne connaît ni l'un ni l'autre :
 * il reçoit un canvas et une fonction qui le dessine à l'instant t.
 *
 * L'export par MediaRecorder filme le canvas PENDANT qu'il s'anime : il
 * dépend donc de requestAnimationFrame, que le navigateur ralentit ou coupe
 * dès que l'onglet n'est plus au premier plan. Essayé dans un panneau en
 * arrière-plan, il a livré une seule image en trois secondes, puis s'est
 * interrompu. Chez quelqu'un dont l'ordinateur rame, il livrerait une vidéo
 * saccadée sans le dire.
 *
 * Ici, chaque image est dessinée, PUIS encodée, à son instant exact : le
 * résultat ne dépend ni de la vitesse de la machine ni de la visibilité de
 * l'onglet. L'encodage est celui du navigateur (WebCodecs, H.264) ; ce
 * fichier ne fait que ranger les images encodées dans une boîte MP4 — la
 * plus simple qui soit : une piste vidéo, un seul bloc de données, l'index
 * (« moov ») en tête pour qu'Instagram puisse lire le fichier dès le début.
 *
 * Pas de son : on ajoute la musique dans Instagram.
 */
(function (global) {
  'use strict';

  function disponible() { return typeof global.VideoEncoder === 'function' && typeof global.VideoFrame === 'function'; }

  /* ---------- l'écriture des boîtes ---------- */
  function octets(n) { return new Uint8Array(n); }
  function u32(v) { return [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255]; }
  function u16(v) { return [(v >>> 8) & 255, v & 255]; }
  function txt(s) { return Array.prototype.map.call(s, function (c) { return c.charCodeAt(0); }); }
  function concat(parts) {
    var n = 0, i;
    for (i = 0; i < parts.length; i++) n += parts[i].length;
    var out = octets(n), o = 0;
    for (i = 0; i < parts.length; i++) { out.set(parts[i], o); o += parts[i].length; }
    return out;
  }
  function boite(type, contenu) {
    var corps = concat(contenu.map(function (c) { return c instanceof Uint8Array ? c : new Uint8Array(c); }));
    return concat([new Uint8Array(u32(8 + corps.length).concat(txt(type))), corps]);
  }
  function pleine(type, version, flags, contenu) {
    return boite(type, [[version].concat(u32(flags).slice(1))].concat(contenu));
  }
  var MATRICE = [].concat(u32(0x00010000), u32(0), u32(0), u32(0), u32(0x00010000), u32(0), u32(0), u32(0), u32(0x40000000));

  function moov(o) {
    var dureeMvt = o.n * o.pas;   // dans l'échelle de temps
    var mvhd = pleine('mvhd', 0, 0, [[].concat(u32(0), u32(0), u32(o.echelle), u32(dureeMvt), u32(0x00010000), u16(0x0100),
      [0, 0], u32(0), u32(0), MATRICE, u32(0), u32(0), u32(0), u32(0), u32(0), u32(0), u32(2))]);
    var tkhd = pleine('tkhd', 0, 3, [[].concat(u32(0), u32(0), u32(1), u32(0), u32(dureeMvt), u32(0), u32(0),
      u16(0), u16(0), u16(0), u16(0), MATRICE, u32(o.w << 16), u32(o.h << 16))]);
    var mdhd = pleine('mdhd', 0, 0, [[].concat(u32(0), u32(0), u32(o.echelle), u32(dureeMvt), u16(0x55C4), u16(0))]);
    var hdlr = pleine('hdlr', 0, 0, [[].concat(u32(0), txt('vide'), u32(0), u32(0), u32(0), txt('VideoHandler'), [0])]);
    var vmhd = pleine('vmhd', 0, 1, [[].concat(u16(0), u16(0), u16(0), u16(0))]);
    var dinf = boite('dinf', [pleine('dref', 0, 0, [u32(1), pleine('url ', 0, 1, [])])]);
    var nomComp = octets(32);
    var avc1 = boite('avc1', [[0, 0, 0, 0, 0, 0].concat(u16(1), u16(0), u16(0), u32(0), u32(0), u32(0),
      u16(o.w), u16(o.h), u32(0x00480000), u32(0x00480000), u32(0), u16(1)), nomComp, [].concat(u16(0x0018), u16(0xFFFF)),
      boite('avcC', [o.avcC])]);
    var stsd = pleine('stsd', 0, 0, [u32(1), avc1]);
    var stts = pleine('stts', 0, 0, [[].concat(u32(1), u32(o.n), u32(o.pas))]);
    var stss = pleine('stss', 0, 0, [u32(o.cles.length)].concat(o.cles.map(function (k) { return u32(k + 1); })));
    var stsc = pleine('stsc', 0, 0, [[].concat(u32(1), u32(1), u32(o.n), u32(1))]);
    var tailles = [];
    o.tailles.forEach(function (t) { tailles = tailles.concat(u32(t)); });
    var stsz = pleine('stsz', 0, 0, [[].concat(u32(0), u32(o.n)), tailles]);
    var stco = pleine('stco', 0, 0, [[].concat(u32(1), u32(o.decalage))]);
    var stbl = boite('stbl', [stsd, stts, stss, stsc, stsz, stco]);
    var minf = boite('minf', [vmhd, dinf, stbl]);
    var mdia = boite('mdia', [mdhd, hdlr, minf]);
    var trak = boite('trak', [tkhd, mdia]);
    return boite('moov', [mvhd, trak]);
  }

  /* encoder(canvas, { fps, secondes, debit, dessiner(t) → peut rendre une Promise, progres(k) })
   * → Promise<Blob>. dessiner reçoit l'instant en secondes. */
  function encoder(canvas, opt) {
    if (!disponible()) return Promise.reject(new Error('Ce navigateur ne sait pas encoder image par image (WebCodecs absent).'));
    var fps = opt.fps || 30, n = Math.round(opt.secondes * fps);
    var w = canvas.width, h = canvas.height;
    var morceaux = [], cles = [], avcC = null, erreur = null;
    var enc = new VideoEncoder({
      output: function (chunk, meta) {
        if (meta && meta.decoderConfig && meta.decoderConfig.description && !avcC) avcC = new Uint8Array(meta.decoderConfig.description);
        var b = octets(chunk.byteLength); chunk.copyTo(b);
        if (chunk.type === 'key') cles.push(morceaux.length);
        morceaux.push(b);
      },
      error: function (e) { erreur = e; }
    });
    /* du plus exigeant au plus sûr : High, Main, Baseline — niveau 4.0 pour le
     * 1080 × 1920, 5.1 pour les grands formats du studio. Au-delà, aucun ne
     * convient et l'appelant se replie sur son autre méthode. */
    var codecs = ['avc1.640028', 'avc1.4d0028', 'avc1.420028', 'avc1.640033', 'avc1.4d0033'];
    function essayer(i) {
      if (i >= codecs.length) return Promise.reject(new Error('Aucun encodage H.264 disponible pour ' + w + ' × ' + h + '.'));
      var conf = { codec: codecs[i], width: w, height: h, bitrate: opt.debit || 10e6, framerate: fps, avc: { format: 'avc' } };
      return VideoEncoder.isConfigSupported(conf).then(function (r) { return r.supported ? conf : essayer(i + 1); });
    }
    function attendreFile() {
      if (enc.encodeQueueSize <= 4) return Promise.resolve();
      return new Promise(function (ok) { setTimeout(ok, 5); }).then(attendreFile);
    }
    return essayer(0).then(function (conf) {
      enc.configure(conf);
      var i = 0;
      function suivante() {
        if (erreur) return Promise.reject(erreur);
        if (i >= n) return enc.flush();
        var t = i / fps;
        return Promise.resolve(opt.dessiner(t)).then(function () {
          var vf = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
          enc.encode(vf, { keyFrame: i % (fps * 2) === 0 });   // une image-clé toutes les deux secondes
          vf.close();
          if (opt.progres) opt.progres(i / n);
          i++;
          return attendreFile().then(suivante);
        });
      }
      return suivante();
    }).then(function () {
      enc.close();
      if (!avcC) throw new Error('L’encodeur n’a pas livré sa configuration (avcC).');
      var echelle = fps * 1000, pas = 1000;
      var tailles = morceaux.map(function (m) { return m.length; });
      var ftyp = boite('ftyp', [txt('isom'), u32(0x200), txt('isom'), txt('iso2'), txt('avc1'), txt('mp41')]);
      // l'index en tête : on le construit deux fois, la seconde avec le vrai décalage des données
      var o = { n: morceaux.length, pas: pas, echelle: echelle, w: w, h: h, avcC: avcC, cles: cles, tailles: tailles, decalage: 0 };
      var m1 = moov(o);
      o.decalage = ftyp.length + m1.length + 8;
      var m2 = moov(o);
      var donnees = concat(morceaux);
      var mdat = concat([new Uint8Array(u32(8 + donnees.length).concat(txt('mdat'))), donnees]);
      return new Blob([ftyp, m2, mdat], { type: 'video/mp4' });
    });
  }

  global.Mp4 = { disponible: disponible, encoder: encoder };
})(this);
