/* video.js — export vidéo : le parcours se trace tout seul.
 *
 * Aucun template ne connaît l'animation. Le moteur révèle la géométrie
 * (Studio.setProgress) et cette boucle enregistre le canvas image par image.
 *
 * Format : MP4 quand le navigateur sait l'encoder — c'est le seul que les
 * Stories acceptent. Sinon WebM, et on le dit franchement plutôt que de
 * livrer un fichier qu'Instagram refusera.
 */
(function (global) {
  'use strict';

  function pickMime() {
    var candidates = [
      'video/mp4;codecs=avc1.42E01E',
      'video/mp4',
      'video/webm;codecs=vp9',
      'video/webm'
    ];
    for (var i = 0; i < candidates.length; i++) {
      if (window.MediaRecorder && MediaRecorder.isTypeSupported(candidates[i])) {
        return candidates[i];
      }
    }
    return null;
  }

  // départ vif, arrivée douce : le tracé ralentit en approchant du bout
  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  /* drawFrame(progress, textFade) doit peindre UNE image dans le canvas. */
  function record(canvas, drawFrame, opt) {
    opt = opt || {};
    var mime = opt.mime || pickMime();
    if (!mime) return Promise.reject(new Error('Ce navigateur ne sait pas enregistrer de vidéo.'));

    var fps = opt.fps || 30;
    var duration = opt.duration || 4000;   // ms
    var tail = opt.tail || 900;            // temps d'arrêt sur l'image finale
    var reveal = duration - tail;

    var stream = canvas.captureStream(fps);

    /* Un canvas n'a pas de son. Si l'image de fond vient d'une vidéo, on
     * greffe sa piste audio sur le flux, sinon l'export sort muet — ce qui
     * se remarque seulement une fois publié. */
    if (opt.audioFrom && opt.audioFrom.captureStream) {
      try {
        opt.audioFrom.captureStream().getAudioTracks().forEach(function (tr) {
          stream.addTrack(tr);
        });
      } catch (e) { /* pas d'audio : on enregistre l'image seule */ }
    }
    var rec = new MediaRecorder(stream, {
      mimeType: mime,
      videoBitsPerSecond: opt.bitrate || 12000000
    });
    var chunks = [];
    rec.ondataavailable = function (e) { if (e.data.size) chunks.push(e.data); };

    return new Promise(function (resolve, reject) {
      rec.onerror = reject;
      rec.onstop = function () {
        resolve({ blob: new Blob(chunks, { type: mime }), mime: mime });
      };

      var t0 = performance.now();
      rec.start();

      function frame(now) {
        var elapsed = now - t0;
        if (elapsed >= duration) {
          drawFrame(1, 1);
          rec.stop();
          return;
        }
        var p = Math.min(1, elapsed / reveal);
        // le texte n'apparaît qu'une fois le tracé bien engagé
        var fade = Math.max(0, Math.min(1, (p - 0.55) / 0.3));
        drawFrame(easeOut(p), fade);
        if (opt.onProgress) opt.onProgress(elapsed / duration);
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
  }

  function save(blob, filename) {
    if (global.Share) return global.Share.file(blob, filename);
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }

  global.Video = { record: record, save: save, pickMime: pickMime };
}(window));
