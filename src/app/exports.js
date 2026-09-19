/* exports.js — video de fond, export video, apercu anime, sequence PNG
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;
  /* LE CANVAS ET LES FORMATS VIENNENT DE `A`, ILS NE SONT PAS GLOBAUX.
   *
   * Ces deux lignes manquaient depuis le découpage de app.js. Dans le fichier
   * monolithique, `SIZES` et `canvas` étaient de simples variables de fichier
   * et les vingt fonctions les voyaient ; chaque module est désormais sa
   * propre fermeture, et une référence nue y lève `SIZES is not defined`.
   *
   * Conséquence : l'export vidéo ET la séquence PNG mouraient sur leur
   * PREMIÈRE ligne utile, avant même d'afficher un message. L'export PNG,
   * lui, marchait — `sources.js` déclarait bien ses deux alias. C'est ce qui
   * rendait la panne crédible comme « problème de vidéo ».
   *
   * Aucun contrôle ne l'a vu : l'acceptation écrit noir sur blanc que
   * l'export vidéo et la séquence PNG ne sont PAS couverts, parce qu'ils
   * demandent MediaRecorder sur plusieurs secondes. Deux cent un cas verts
   * au-dessus d'un chemin que personne n'exécutait. */
  var canvas = A.canvas;
  var SIZES = A.SIZES;
  var save = A.save;
  var effective = A.effective;
  var resolvedOptions = A.resolvedOptions;
  var majPeriode = A.majPeriode;
  var syncBibliotheque = A.syncBibliotheque;
  var draw = A.draw;
  var verrouiller = A.verrouiller;
  var libelle = A.libelle;
  var ground = A.ground;
  var changement = A.changement;
  /* Le catalogue appartient à un autre module et se charge peut-être après
   * celui-ci : on l'appelle par `A.` au moment de s'en servir, plutôt que
   * d'en prendre une copie au chargement — une copie prise trop tôt vaudrait
   * `undefined` pour toujours. */
  var buildOptions = A.buildOptions;
  var parseDuration = A.parseDuration;
  var summary = A.summary;
  var nomFichier = A.nomFichier;
  var slug = A.slug;
  var majPanneauSon = A.majPanneauSon;

  /* ---------- vidéo de fond ---------- */
  $('#bgvideo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    var note = $('#bgvideo-state');
    if (!file) { E.bgVideo = null; note.textContent = ''; return; }
    nomFichier('#bgvideo', T('Ajouter une vidéo'), file.name);
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = function () {
      E.bgVideo = v;
      note.textContent = Math.round(v.duration) + ' s · ' + v.videoWidth + '×' + v.videoHeight +
        (v.duration > 20 ? ' — seules les 20 premières secondes seront gravées' : '');
      /* L'APERCU DOIT LA MONTRER TOUT DE SUITE.
       * Sans cette ligne, la video n'existait qu'au moment de l'export : on
       * reglait a l'aveugle et on decouvrait le cadrage dans le fichier. */
      if ($('#ground').value !== 'photo') $('#ground').value = 'photo';
      ground();
    };
    v.onerror = function () {
      E.bgVideo = null;
      note.textContent = 'Vidéo illisible par le navigateur.';
      ground();
    };
  });

  [['#f-name', 'name', function (v) { return v; }],
   ['#f-dist', 'distance_km', function (v) { return v === '' ? null : parseFloat(v.replace(',', '.')); }],
   ['#f-time', 'duration_s', function (v) { return parseDuration(v); }],
   ['#f-elev', 'elev_gain_m', function (v) { return v === '' ? null : parseInt(v, 10); }]
  ].forEach(function (f) {
    $(f[0]).addEventListener('input', function () {
      // saisir une valeur à la main compte comme fournir une sortie
      E.chargee = true;
      E.overrides[f[1]] = f[2]($(f[0]).value);
      summary();
      draw();
    });
  });

  $('#minimal').addEventListener('change', changement);
  $('#tpl').addEventListener('change', function () {
    buildOptions(); majPeriode(); majDuree(); changement();
  });

  /* LE RÉGLAGE DE DURÉE NE SE MONTRE QUE S'IL FAIT QUELQUE CHOSE.
   *
   * Cinq planches portent leur propre durée — le film, la partition,
   * l'almanach, la fresque, les saisons — parce qu'elles racontent une
   * chronologie. `Studio.chrono()` ne leur applique pas le réglage global ;
   * le laisser visible chez elles afficherait un menu qui ne change rien.
   *
   * On interroge le moteur plutôt que de tenir une liste ici : une liste de
   * cinq identifiants recopiée dans l'interface est une sixième planche en
   * attente d'être oubliée. */
  function majDuree() {
    var bloc = $('#opt-duree');
    if (!bloc) return;
    var tpl = Studio.get($('#tpl').value);
    bloc.hidden = !!(tpl && tpl.duree);
  }
  A.majDuree = majDuree;
  $('#duree').addEventListener('change', function () { save(); changement(); });
  /* Le catalogue se reconstruit quand la sortie change : les vignettes sont
   * des rendus de CETTE sortie, pas des images d'illustration.
   *
   * Ces trois-là ont déjà leur écouteur plus bas (majRendu, majSupport, la
   * collection) : un second écouteur ici doublait le travail — deux
   * redessins complets et N rendus hors écran pour un seul geste. On
   * appelle donc depuis leur gestionnaire existant. */
  $('#photo-nb').addEventListener('change', function () {
    A.construitChoixStyle();
    draw();
  });
  $('#size').addEventListener('change', changement);
  /* AMORTI. Sous 900 px la page défile, donc la barre d'adresse du
   * navigateur apparaît et disparaît au défilement — et chaque apparition
   * émet un `resize`. Sans amortissement, chacune relançait un rendu complet
   * au format choisi : dix-sept mégapixels si l'on est resté en A3. */
  var minuteurTaille = null;
  window.addEventListener('resize', function () {
    if (minuteurTaille) clearTimeout(minuteurTaille);
    minuteurTaille = setTimeout(function () { minuteurTaille = null; draw(); }, 140);
  });

  $('#collection').addEventListener('change', function () {
    var c = Collections.get($('#collection').value);
    $('#collection-note').textContent = c.note ? T(c.note) : '';
    buildOptions();
    A.construitChoixStyle();      // les vignettes suivent la collection
    draw();
    save();
  });

  /* ---------- export vidéo ---------- */
  /* Rendu couleur / noir & blanc. Le réglage « photo aussi » ne s'affiche
   * qu'en noir et blanc : ailleurs il ne ferait rien. */
  function majRendu() {
    var nb = $('#rendu').value === 'nb';
    $('#opt-photo-nb').hidden = !nb;
    A.construitChoixStyle();
    changement();
  }
  $('#rendu').addEventListener('change', majRendu);

  /* Changer de support change ce qu'on voit DERRIÈRE la planche autant que
   * la planche elle-même : le fond de contrôle et les options propres au
   * template suivent. */
  function majSupport() {
    /* Le voile ne veut rien dire sur un fond plein : il ne se montre qu'en
     * surcouche. Un réglage visible en permanence et sans effet la moitié du
     * temps apprend à l'utilisateur à ne plus le lire. */
    var opt = $('#opt-voile');
    if (opt) opt.hidden = $('#support').value !== 'surcouche';
    buildOptions();
    A.construitChoixStyle();
    changement();
  }

  $('#periode').addEventListener('change', function () {
    /* syncBibliotheque() appelle déjà majPeriode() et reconstruit le
     * catalogue : refaire les deux ici donnait deux rendus pleine taille
     * pour un seul geste. */
    syncBibliotheque();
    changement();
  });
  $('#support').addEventListener('change', majSupport);
  $('#voile').addEventListener('change', function () {
    A.construitChoixStyle();      // les vignettes portent le voile, elles aussi
    changement();
  });
  /* pas d'écouteur `draw` ici : majPhotoNb s'en charge, avec le catalogue */

  /* ---------- aperçu animé ----------
   * Il rejoue EXACTEMENT la chronologie de l'export : même durée, même
   * courbe, même fondu, parce qu'il appelle le même Studio.chrono(). Voir
   * le film avant de l'enregistrer n'a de valeur que si c'est le même film.
   */
  var lecture = null;
  function arreteLecture() {
    if (!lecture) return;
    cancelAnimationFrame(lecture);
    lecture = null;
    E.enLecture = false;
    $('#preview-play').textContent = libelle('Lire l’aperçu', 'Aperçu');
    Studio.setProgress(1, 1);
    draw();
  }
  $('#preview-play').addEventListener('click', function () {
    if (lecture) return arreteLecture();
    if (!E.chargee) return;
    var horloge = Studio.chrono($('#tpl').value, resolvedOptions($('#tpl').value));
    var t0 = performance.now();
    E.enLecture = true;
    $('#preview-play').textContent = libelle('Arrêter l’aperçu', 'Arrêter');
    (function image(now) {
      var k = (now - t0) / horloge.duree;
      if (k >= 1) return arreteLecture();
      var etat = horloge.at(k);
      Studio.setProgress(etat.p, etat.fade);
      draw();
      lecture = requestAnimationFrame(image);
    }(t0));
  });
  // changer de template ou de sortie pendant la lecture n'aurait aucun sens
  ['#tpl', '#size', '#collection'].forEach(function (sel) {
    $(sel).addEventListener('change', arreteLecture);
  });
  $('#tpl').addEventListener('change', function () { majPanneauSon(); });

  $('#export-video').addEventListener('click', function () {
    var note = $('#video-state');
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    var act = effective();
    var opts = resolvedOptions(tplId);

    verrouiller(true);
    note.textContent = 'Enregistrement…';

    /* Une vidéo ne peut pas porter d'alpha : ni le MP4, ni — vérifié — le
     * WebM sorti de MediaRecorder. Sur une surcouche transparente on
     * compose donc sur le fond choisi (ta photo si elle est chargée), ce qui
     * donne un MP4 publiable tel quel. Le PNG, lui, garde sa transparence. */
    var transparent = Studio.estTransparent(tplId, opts);
    var target = canvas, ground = null;
    if (transparent) {
      target = document.createElement('canvas');
      target.width = size[0]; target.height = size[1];
      ground = target.getContext('2d');
    }

    /* Vidéo de fond : on la joue et on peint chacune de ses images sous la
     * surcouche. L'enregistrement dure ce que dure la vidéo — plus besoin
     * de passer par un montage. */
    var horloge = Studio.chrono(tplId, opts);
    var duree = horloge.duree;
    var pret = Promise.resolve();
    if (transparent && E.bgVideo) {
      duree = Math.min(E.bgVideo.duration, 20) * 1000;
      E.bgVideo.muted = false;   // sinon la piste audio capturée est silencieuse
      // on n'enregistre qu'une fois la lecture réellement commencée
      note.textContent = 'Préparation de la vidéo…';
      pret = Video.attendreLecture(E.bgVideo);
    }

    pret.then(function () {
      note.textContent = 'Enregistrement…';
      return Video.record(target, function (p, fade) {
        Studio.setProgress(p, fade);
        Studio.render(canvas, tplId, act, opts, size);
        if (ground) {
          ground.clearRect(0, 0, size[0], size[1]);
          if (E.bgVideo) cover(ground, E.bgVideo, size); else paintGround(ground, size);
          ground.drawImage(canvas, 0, 0);
        }
      }, {
        duration: duree,
        at: function (k) { return horloge.at(k); },
        audioFrom: (transparent && E.bgVideo) ? E.bgVideo : null,
        onProgress: function (k) { note.textContent = 'Enregistrement… ' + Math.round(k * 100) + ' %'; }
      });
    }).then(function (res) {
      if (E.bgVideo) { E.bgVideo.pause(); E.bgVideo.muted = true; }
      Studio.setProgress(1, 1);
      draw();
      var mp4 = res.mime.indexOf('mp4') >= 0;
      Video.save(res.blob, slug() + '_' + tplId + (mp4 ? '.mp4' : '.webm'));
      verrouiller(false);
      note.textContent = mp4
        ? 'Vidéo MP4 enregistrée.'
        : 'Enregistré en WebM — Instagram n’accepte pas ce format, il faudra le convertir.';
    }, function (err) {
      if (E.bgVideo) { E.bgVideo.pause(); E.bgVideo.muted = true; }
      Studio.setProgress(1, 1);
      draw();
      verrouiller(false);
      note.textContent = err.message;
    });
  });

  /* ---------- séquence PNG ----------
   * La seule façon de porter une animation TRANSPARENTE dans un montage :
   * une image par instant, chacune avec son canal alpha. Le montage
   * (CapCut, Premiere, Resolve) l'importe comme une piste et la pose sur
   * ta vidéo. Aucun format vidéo ne sait faire ça. */
  $('#export-seq').addEventListener('click', async function () {
    var note = $('#video-state');
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    var act = effective();
    var opts = resolvedOptions(tplId);
    var horloge = Studio.chrono(tplId, opts);
    var fps = 24;
    var total = Math.round(fps * horloge.duree / 1000);

    verrouiller(true);
    var entries = [];
    try {
      for (var i = 0; i < total; i++) {
        var etat = horloge.at(i / (total - 1));
        Studio.setProgress(etat.p, etat.fade);
        Studio.render(canvas, tplId, act, opts, size);

        var blob = await new Promise(function (ok) { canvas.toBlob(ok, 'image/png'); });
        entries.push({
          name: 'image-' + String(i + 1).padStart(3, '0') + '.png',
          data: new Uint8Array(await blob.arrayBuffer())
        });
        note.textContent = 'Séquence… ' + (i + 1) + '/' + total;
      }
      var zip = Zip.build(entries);
      Video.save(zip, slug() + '_' + tplId + '_sequence-png.zip');
      note.textContent = total + ' images · ' + Math.round(zip.size / 1048576) + ' Mo · ' +
        fps + ' im/s — à importer comme séquence dans ton montage.';
    } catch (e) {
      note.textContent = e.message;
    }
    Studio.setProgress(1, 1);
    verrouiller(false);
    draw();
  });

  /* Remplit la boîte sans déformer — photo ou image de vidéo. */
  function cover(g2, src, size) {
    var W = size[0], H = size[1];
    var sw = src.videoWidth || src.width, sh = src.videoHeight || src.height;
    if (!sw || !sh) return;
    var r = Math.max(W / sw, H / sh);
    g2.drawImage(src, (W - sw * r) / 2, (H - sh * r) / 2, sw * r, sh * r);
  }

  /* Le même fond que celui du panneau de contrôle, mais peint pour de bon. */
  function paintGround(g2, size) {
    var W = size[0], H = size[1];
    var img = E.photoImg;
    if ($('#ground').value === 'photo' && img) {
      cover(g2, img, size);
      return;
    }
    var grd = g2.createLinearGradient(0, 0, W * 0.4, H);
    if ($('#ground').value === 'claire') {
      grd.addColorStop(0, '#FDFCF8'); grd.addColorStop(0.55, '#E8E4D8'); grd.addColorStop(1, '#FBF7EF');
    } else {
      grd.addColorStop(0, '#2A3038'); grd.addColorStop(0.6, '#12151A'); grd.addColorStop(1, '#0A0C10');
    }
    g2.fillStyle = grd;
    g2.fillRect(0, 0, W, H);
  }

}(window.App));
