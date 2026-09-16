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
    /* La courbe du temps vient d'AILLEURS (Studio.chrono) : l'aperçu animé,
     * cet enregistrement et la séquence PNG doivent parcourir exactement la
     * même chronologie, sinon ce qu'on regarde n'est pas ce qu'on exporte. */
    var at = opt.at || function (k) {
      var p = Math.min(1, k / 0.78);
      return { p: easeOut(p), fade: Math.max(0, Math.min(1, (p - 0.55) / 0.3)) };
    };

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
      var fini = false;
      rec.onerror = reject;
      rec.onstop = function () {
        fini = true;
        clearInterval(chien);
        document.removeEventListener('visibilitychange', surMasquage);
        resolve({ blob: new Blob(chunks, { type: mime }), mime: mime });
      };

      function abandon(msg) {
        if (fini) return;
        fini = true;
        clearInterval(chien);
        document.removeEventListener('visibilitychange', surMasquage);
        try { rec.stop(); } catch (e) { /* déjà arrêté */ }
        reject(new Error(msg));
      }

      /* Le navigateur suspend requestAnimationFrame dès que la page passe en
       * arrière-plan : l'enregistrement se figerait sans rien dire. On le
       * détecte et on l'annonce, plutôt que de laisser tourner dans le vide. */
      function surMasquage() {
        if (document.visibilityState === 'hidden') {
          abandon('L’onglet doit rester au premier plan pendant l’enregistrement.');
        }
      }
      document.addEventListener('visibilitychange', surMasquage);

      // filet de sécurité : si aucune image n'est peinte pendant 3 s, on sort
      var derniere = performance.now();
      var chien = setInterval(function () {
        if (!fini && performance.now() - derniere > 3000) {
          abandon('L’enregistrement s’est interrompu — garde la page au premier plan.');
        }
      }, 500);

      var t0;

      /* Peindre l'image de départ AVANT de lancer l'enregistrement.
       * captureStream() diffuse le canvas tel qu'il est : sans ça, la
       * première image capturée est l'aperçu resté à l'écran — l'image
       * finale — et la vidéo commence par un éclair de la fin avant de
       * repartir de zéro. Le second requestAnimationFrame laisse au canvas
       * le temps d'être réellement composé. */
      drawFrame(0, 0);
      requestAnimationFrame(function () {
        t0 = performance.now();
        rec.start();
        requestAnimationFrame(frame);
      });

      function frame(now) {
        if (fini) return;
        derniere = now;
        var elapsed = now - t0;
        if (elapsed >= duration) {
          drawFrame(1, 1);
          rec.stop();
          return;
        }
        var etat = at(elapsed / duration);
        drawFrame(etat.p, etat.fade);
        if (opt.onProgress) opt.onProgress(elapsed / duration);
        requestAnimationFrame(frame);
      }
    });
  }

  /* Attendre qu'une vidéo joue VRAIMENT avant d'enregistrer.
   * play() rend la main immédiatement, bien avant que la première image
   * soit décodée et présentée. Enregistrer tout de suite capture des
   * images figées, puis un saut quand la lecture démarre pour de bon. */
  function attendreLecture(v) {
    return new Promise(function (ok) {
      var fait = false;
      function fini() { if (!fait) { fait = true; ok(); } }
      try { v.currentTime = 0; } catch (e) { /* flux non cherchable */ }
      // requestVideoFrameCallback se déclenche à la PRÉSENTATION d'une image
      if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(fini);
      else v.addEventListener('timeupdate', fini, { once: true });
      setTimeout(fini, 1500);   // filet : on n'attend jamais indéfiniment
      var p = v.play();
      if (p && p.catch) p.catch(fini);
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

  global.Video = { record: record, save: save, pickMime: pickMime, attendreLecture: attendreLecture };
}(window));
