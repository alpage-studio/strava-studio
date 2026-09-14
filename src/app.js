/* app.js — le câblage de l'interface. Aucun pixel du visuel n'est décidé ici. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var canvas = $('#canvas');
  var SIZES = {
    story: [1080, 1920],
    post: [1080, 1350],
    carre: [1080, 1080],
    paysage: [1920, 1080]
  };

  var base = Activity.empty();      // activité telle que lue dans le GPX
  var overrides = {};               // corrections manuelles
  var optionValues = {};            // { templateId: { key: valeur } }
  var current = null;
  var photoURL = null;              // pour le fond de contrôle, hors canvas
  var photoImg = null;              // la même, pour composer la vidéo
  var bgVideo = null;               // vidéo de fond, pour graver la surcouche dessus
  var chargee = false;              // une vraie sortie a-t-elle été fournie ?
  var exportEnCours = false;        // un export occupe le canvas

  /* ---------- persistance légère ---------- */
  function save() {
    try {
      localStorage.setItem('strava-studio', JSON.stringify({
        tpl: $('#tpl').value, size: $('#size').value, opts: optionValues,
        collection: $('#collection').value, minimal: $('#minimal').checked
      }));
    } catch (e) { /* mode privé : tant pis */ }
  }
  function load() {
    try { return JSON.parse(localStorage.getItem('strava-studio')) || {}; }
    catch (e) { return {}; }
  }

  /* ---------- activité effective ---------- */
  function effective() {
    var a = {};
    Object.keys(base).forEach(function (k) { a[k] = base[k]; });
    Object.keys(overrides).forEach(function (k) {
      if (overrides[k] !== null && overrides[k] !== undefined && overrides[k] !== '') a[k] = overrides[k];
    });
    if (overrides.distance_km != null && overrides.distance_km !== '') {
      a.distance_m = overrides.distance_km * 1000;
    }
    return Activity.build(a);
  }

  /* ---------- rendu ---------- */
  /* Les valeurs d'options réellement envoyées au template : celles du
   * panneau, puis la collection par-dessus si une est choisie. */
  function resolvedOptions(tplId) {
    var vals = optionValues[tplId] || {};
    return Collections.apply(tplId, vals, $('#collection').value);
  }

  function draw() {
    document.body.classList.toggle('vide', !chargee);
    majBoutons();
    if (!chargee) { save(); return; }
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    Studio.setMinimal($('#minimal').checked);
    current = Studio.render(canvas, tplId, effective(), resolvedOptions(tplId), size);
    /* L'échelle prenait la largeur TOTALE du panneau et retirait 24 px à sa
     * hauteur : en paysage l'image touchait les bords, en story la légende
     * passait sous l'écran. On mesure l'espace réellement disponible, marges
     * et légende déduites. */
    var stage = $('#stage');
    var st = getComputedStyle(stage);
    var padX = parseFloat(st.paddingLeft) + parseFloat(st.paddingRight);
    var padY = parseFloat(st.paddingTop) + parseFloat(st.paddingBottom);
    var cap = $('#stage-caption');
    var capH = cap ? cap.offsetHeight + parseFloat(st.gap || 0) : 0;
    var dispoW = Math.max(80, stage.clientWidth - padX);
    var dispoH = Math.max(80, stage.clientHeight - padY - capH);
    var scale = Math.min(dispoW / size[0], dispoH / size[1]);
    canvas.style.width = Math.floor(size[0] * scale) + 'px';
    canvas.style.height = Math.floor(size[1] * scale) + 'px';
    ground();
    caption(size);
    save();
  }

  /* Les trois exports partagent le MÊME canvas et le même état d'animation.
   * Chacun ne désactivait que son propre bouton, et le moindre réglage
   * rendait les autres cliquables : on pouvait lancer une séquence PNG
   * pendant un enregistrement vidéo, ou changer de format en plein milieu.
   * Le verrou est donc central, et il fige aussi ce qui décide du rendu. */
  function verrouiller(actif) {
    exportEnCours = actif;
    majBoutons();
  }

  function majBoutons() {
    var bloque = !chargee || exportEnCours;
    ['#export', '#export-video', '#export-seq'].forEach(function (sel) {
      $(sel).disabled = bloque;
    });
    // pendant un export, ce qui définit l'image ne doit plus bouger
    ['#size', '#tpl', '#collection', '#minimal'].forEach(function (sel) {
      var el = $(sel); if (el) el.disabled = exportEnCours;
    });
  }

  /* Sous l'aperçu : ce qu'on regarde exactement. */
  function caption(size) {
    var el = $('#stage-caption');
    if (!el) return;
    el.textContent = current.name + ' · ' + size[0] + ' × ' + size[1] +
      (current.transparent ? ' · PNG transparent' : '');
  }

  /* ---------- fond de contrôle ----------
   * Il vit derrière le canvas, jamais dedans. Sur une surcouche transparente
   * c'est la seule façon de juger la lisibilité sans aplatir la photo dans
   * le PNG exporté. */
  function ground() {
    var sheet = $('#sheet');
    var mode = $('#ground').value;
    var transparent = current && current.transparent;
    sheet.className = '';
    sheet.style.backgroundImage = '';

    if (!transparent) { sheet.style.background = 'none'; return; }
    sheet.style.background = '';
    if (mode === 'photo' && photoURL) {
      sheet.style.backgroundImage = 'url("' + photoURL + '")';
    } else {
      sheet.className = (mode === 'photo' ? 'damier' : mode);
    }
  }

  /* ---------- panneau d'options du template ---------- */
  function buildOptions() {
    var tpl = Studio.get($('#tpl').value);
    var box = $('#opts');
    box.innerHTML = '';
    optionValues[tpl.id] = optionValues[tpl.id] || {};
    var vals = optionValues[tpl.id];
    var driven = Collections.driven(tpl.id, $('#collection').value);
    /* Un réglage qui ne change rien doit le dire. Le seuil en % du FTP est
     * inopérant sans FTP déclaré ou sans capteur : le laisser actif fait
     * croire qu'on règle quelque chose. */
    var inertes = (typeof tpl.inert === 'function' && chargee) ? (tpl.inert(effective()) || []) : [];

    tpl.options.forEach(function (def) {
      if (vals[def.key] === undefined) vals[def.key] = def.default;

      var row = document.createElement('label');
      row.className = 'opt opt--' + def.type;
      var name = document.createElement('span');
      name.textContent = def.label || def.key;
      row.appendChild(name);

      var input;
      if (def.type === 'select') {
        input = document.createElement('select');
        def.choices.forEach(function (c) {
          var op = document.createElement('option');
          op.value = c[0]; op.textContent = c[1];
          input.appendChild(op);
        });
        input.value = vals[def.key];
      } else if (def.type === 'toggle') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!vals[def.key];
      } else if (def.type === 'range') {
        input = document.createElement('input');
        input.type = 'range';
        input.min = def.min == null ? 0 : def.min;
        input.max = def.max == null ? 100 : def.max;
        input.value = vals[def.key];
      } else if (def.type === 'color') {
        input = document.createElement('input');
        input.type = 'color';
        input.value = vals[def.key];
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = vals[def.key] || '';
      }

      input.addEventListener('input', function () {
        vals[def.key] = (def.type === 'toggle') ? input.checked
          : (def.type === 'range') ? parseFloat(input.value)
          : input.value;
        draw();
      });

      /* Une option pilotée par la collection est grisée : la laisser active
       * ferait croire qu'elle est encore réglable alors qu'elle sera écrasée. */
      if (driven[def.key]) {
        input.disabled = true;
        row.style.opacity = '.45';
        row.title = 'Piloté par la collection';
      } else if (inertes.indexOf(def.key) >= 0) {
        input.disabled = true;
        row.style.opacity = '.45';
        row.title = 'Sans effet sur cette sortie';
      }

      row.appendChild(input);
      box.appendChild(row);
    });
  }

  /* ---------- durée saisie à la main : "48:12" ou "1:05:30" ---------- */
  function parseDuration(str) {
    if (!str) return null;
    var p = String(str).trim().split(':').map(Number);
    if (p.some(isNaN)) return null;
    if (p.length === 3) return p[0] * 3600 + p[1] * 60 + p[2];
    if (p.length === 2) return p[0] * 60 + p[1];
    return p[0] * 60;
  }

  function summary() {
    if (!chargee) {
      $('#summary').innerHTML = '<span class="muted">Aucune sortie chargée.</span>';
      return;
    }
    var a = effective();
    $('#summary').innerHTML =
      '<strong>' + escapeHtml(a.name) + '</strong><br>' +
      '<span class="figs">' +
        Studio.fmt.km(a.distance_km) + ' km · ' + Studio.fmt.duration(a.duration_s) +
        ' · ' + (a.elev_gain_m != null ? a.elev_gain_m + ' m D+' : 'D+ inconnu') +
        (a.speed_kmh ? ' · ' + Studio.fmt.speed(a.speed_kmh) + ' km/h' : '') +
      '</span>' +
      (a.track.length ? '<br><span class="ok">Trace : ' + a.track.length + ' points</span>'
                      : '<br><span class="warn">Pas de trace GPS</span>');
  }

  /* Le bouton de fichier porte le nom du fichier choisi : sans ça, rien ne
   * distingue « aucun fichier » de « fichier chargé ». */
  function nomFichier(inputSel, defaut, nom) {
    var span = $(inputSel).parentNode.querySelector('span');
    if (span) span.textContent = nom || defaut;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function syncManualFields() {
    if (!chargee) {
      ['#f-name', '#f-dist', '#f-time', '#f-elev'].forEach(function (sel) { $(sel).value = ''; });
      return;
    }
    var a = effective();
    $('#f-name').value = a.name || '';
    $('#f-dist').value = a.distance_km != null ? a.distance_km.toFixed(2) : '';
    $('#f-time').value = Studio.fmt.duration(a.duration_s);
    $('#f-elev').value = a.elev_gain_m != null ? a.elev_gain_m : '';
  }

  /* ---------- événements ---------- */

  $('#gpx').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    nomFichier('#gpx', 'Charger un fichier GPX', file.name);
    var reader = new FileReader();
    reader.onload = function () {
      try {
        base = Activity.parseGPX(reader.result);
        overrides = {};
        chargee = true;
        $('#gpx-err').textContent = '';
        syncManualFields();
        summary();
        buildOptions();
        draw();
      } catch (err) {
        $('#gpx-err').textContent = err.message;
      }
    };
    reader.readAsText(file);
  });

  $('#photo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) { Studio.setPhoto(null); photoURL = null; draw(); return; }
    nomFichier('#photo', 'Charger une photo', file.name);
    photoURL = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      Studio.setPhoto(img);
      photoImg = img;
      $('#ground').value = 'photo';
      draw();
    };
    img.src = photoURL;
  });

  $('#photo-clear').addEventListener('click', function () {
    $('#photo').value = '';
    nomFichier('#photo', 'Charger une photo');
    Studio.setPhoto(null);
    photoURL = null; photoImg = null;
    if ($('#ground').value === 'photo') $('#ground').value = 'damier';
    draw();
  });

  $('#ground').addEventListener('change', ground);

  /* Démarrer à vide est honnête — on n'affiche pas une sortie que personne
   * n'a parcourue. Mais sans rien à voir, les quinze templates sont
   * invisibles. Ce bouton donne de quoi les parcourir en un clic, et il dit
   * clairement que c'est un exemple. */
  $('#load-example').addEventListener('click', function () {
    var b = $('#load-example');
    b.disabled = true; b.textContent = 'Chargement…';
    fetch('exemple.gpx')
      .then(function (r) { return r.text(); })
      .then(function (txt) {
        base = Activity.parseGPX(txt);
        overrides = {};
        chargee = true;
        syncManualFields();
        summary();
        draw();
      })
      .catch(function () {
        b.textContent = 'Exemple indisponible';
      })
      .then(function () { b.disabled = false; });
  });

  /* ---------- vidéo de fond ---------- */
  $('#bgvideo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    var note = $('#bgvideo-state');
    if (!file) { bgVideo = null; note.textContent = ''; return; }
    nomFichier('#bgvideo', 'Charger une vidéo', file.name);
    var v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.preload = 'auto';
    v.src = URL.createObjectURL(file);
    v.onloadedmetadata = function () {
      bgVideo = v;
      note.textContent = Math.round(v.duration) + ' s · ' + v.videoWidth + '×' + v.videoHeight +
        (v.duration > 20 ? ' — seules les 20 premières secondes seront gravées' : '');
    };
    v.onerror = function () {
      bgVideo = null;
      note.textContent = 'Vidéo illisible par le navigateur.';
    };
  });

  [['#f-name', 'name', function (v) { return v; }],
   ['#f-dist', 'distance_km', function (v) { return v === '' ? null : parseFloat(v.replace(',', '.')); }],
   ['#f-time', 'duration_s', function (v) { return parseDuration(v); }],
   ['#f-elev', 'elev_gain_m', function (v) { return v === '' ? null : parseInt(v, 10); }]
  ].forEach(function (f) {
    $(f[0]).addEventListener('input', function () {
      // saisir une valeur à la main compte comme fournir une sortie
      chargee = true;
      overrides[f[1]] = f[2]($(f[0]).value);
      summary();
      draw();
    });
  });

  $('#minimal').addEventListener('change', draw);
  $('#tpl').addEventListener('change', function () { buildOptions(); draw(); });
  $('#size').addEventListener('change', draw);
  window.addEventListener('resize', draw);

  $('#collection').addEventListener('change', function () {
    var c = Collections.get($('#collection').value);
    $('#collection-note').textContent = c.note || '';
    buildOptions();
    draw();
  });

  /* ---------- export vidéo ---------- */
  $('#export-video').addEventListener('click', function () {
    var btn = $('#export-video'), note = $('#video-state');
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
    var transparent = Studio.get(tplId).transparent;
    var target = canvas, ground = null;
    if (transparent) {
      target = document.createElement('canvas');
      target.width = size[0]; target.height = size[1];
      ground = target.getContext('2d');
    }

    /* Vidéo de fond : on la joue et on peint chacune de ses images sous la
     * surcouche. L'enregistrement dure ce que dure la vidéo — plus besoin
     * de passer par un montage. */
    var duree = 4200;
    var pret = Promise.resolve();
    if (transparent && bgVideo) {
      duree = Math.min(bgVideo.duration, 20) * 1000;
      bgVideo.muted = false;   // sinon la piste audio capturée est silencieuse
      // on n'enregistre qu'une fois la lecture réellement commencée
      note.textContent = 'Préparation de la vidéo…';
      pret = Video.attendreLecture(bgVideo);
    }

    pret.then(function () {
      note.textContent = 'Enregistrement…';
      return Video.record(target, function (p, fade) {
        Studio.setProgress(p, fade);
        Studio.render(canvas, tplId, act, opts, size);
        if (ground) {
          ground.clearRect(0, 0, size[0], size[1]);
          if (bgVideo) cover(ground, bgVideo, size); else paintGround(ground, size);
          ground.drawImage(canvas, 0, 0);
        }
      }, {
        duration: duree,
        audioFrom: (transparent && bgVideo) ? bgVideo : null,
        onProgress: function (k) { note.textContent = 'Enregistrement… ' + Math.round(k * 100) + ' %'; }
      });
    }).then(function (res) {
      if (bgVideo) { bgVideo.pause(); bgVideo.muted = true; }
      Studio.setProgress(1, 1);
      draw();
      var mp4 = res.mime.indexOf('mp4') >= 0;
      Video.save(res.blob, slug() + '_' + tplId + (mp4 ? '.mp4' : '.webm'));
      verrouiller(false);
      note.textContent = mp4
        ? 'Vidéo MP4 enregistrée.'
        : 'Enregistré en WebM — Instagram n’accepte pas ce format, il faudra le convertir.';
    }, function (err) {
      if (bgVideo) { bgVideo.pause(); bgVideo.muted = true; }
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
    var btn = $('#export-seq'), note = $('#video-state');
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    var act = effective();
    var opts = resolvedOptions(tplId);
    var fps = 24, secondes = 3;
    var total = fps * secondes;

    verrouiller(true);
    var entries = [];
    try {
      for (var i = 0; i < total; i++) {
        var lineaire = i / (total - 1);
        var p = 1 - Math.pow(1 - Math.min(1, lineaire / 0.78), 3);   // même courbe que la vidéo
        var fade = Math.max(0, Math.min(1, (p - 0.55) / 0.3));
        Studio.setProgress(p, fade);
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
    var img = photoImg;
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

  function slug() {
    return String(effective().name).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sortie';
  }

  /* ---------- source d'activités ----------
   * Deux fournisseurs possibles, même interface : intervals.icu d'abord —
   * sa clé est en libre-service et il se synchronise directement depuis
   * Garmin, donc il ne dépend pas de l'abonnement Strava — puis Strava en
   * repli si quelqu'un d'autre reprend ce code avec un compte abonné. */
  var stravaActs = [];
  var source = null;          // 'icu' | 'strava'

  function stravaState(html) { $('#strava-state').innerHTML = html; }

  async function stravaInit() {
    var icu = null, st = null;
    try {
      icu = await (await fetch('api/icu/status')).json();
      st = await (await fetch('api/status')).json();
    } catch (e) {
      /* Pas de serveur local : le studio tourne depuis un hébergement
       * statique. On ne tombe plus dans le vide — intervals.icu accepte les
       * appels d'origine croisée, donc chacun peut coller SA clé, gardée
       * dans son seul navigateur. */
      source = 'icu-web';
      if (IcuWeb.key()) { connecteIcuWeb(); }
      else { stravaState('intervals.icu — colle ta clé pour charger tes sorties.'); formulaireCle(true); }
      return;
    }

    if (icu && icu.configured) {
      source = 'icu';
      stravaState('intervals.icu — connecté');
      $('#strava-refresh').style.display = '';
      loadList();
      return;
    }

    if (st && st.configured && st.authorized) {
      source = 'strava';
      stravaState('Strava — connecté' + (st.athlete && st.athlete.firstname ? ' · ' + st.athlete.firstname : ''));
      $('#strava-refresh').style.display = '';
      loadList();
      return;
    }

    if (st && st.configured && !st.authorized) {
      stravaState('Strava — <a href="/connect">connecter mon compte</a> ' +
        '(portée <code>' + st.scope + '</code>, obligatoire pour lire les activités).');
      return;
    }
    stravaState('Aucune source configurée — charge un fichier GPX.');
  }

  function formulaireCle(visible) {
    $('#icu-form').style.display = visible ? '' : 'none';
    $('#icu-forget').style.display = visible ? 'none' : '';
  }

  function connecteIcuWeb() {
    source = 'icu-web';
    stravaState('intervals.icu — connecté depuis ce navigateur');
    formulaireCle(false);
    $('#strava-refresh').style.display = '';
    loadList();
  }

  $('#icu-connect').addEventListener('click', function () {
    var k = $('#icu-key').value.trim();
    if (!k) return;
    IcuWeb.setKey(k);
    $('#icu-key').value = '';        // on ne la laisse pas dans le champ
    connecteIcuWeb();
  });
  $('#icu-key').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#icu-connect').click();
  });

  $('#icu-forget').addEventListener('click', function () {
    IcuWeb.forget();
    $('#strava-list').style.display = 'none';
    $('#strava-refresh').style.display = 'none';
    stravaState('intervals.icu — clé oubliée.');
    formulaireCle(true);
  });

  async function loadList() {
    var sel = $('#strava-list');
    sel.style.display = '';
    sel.innerHTML = '<option>chargement…</option>';
    try {
      /* Cinq sorties suffisent : on fait une affiche de la sortie du jour,
       * pas de l'historique. Et chaque appel compte dans le quota. */
      if (source === 'icu-web') {
        var web = await IcuWeb.activities(5);
        remplitListe(web);
        return;
      }
      var url = source === 'icu' ? 'api/icu/activities?limit=5' : 'api/activities?per_page=30';
      var r = await fetch(url);
      if (r.status === 401) { stravaState('Autorisation refusée — clé ou jeton à refaire.'); return; }
      if (r.status === 429) { stravaState('Quota atteint. Réessaie plus tard.'); return; }
      var data = await r.json();
      /* Une réponse d'erreur est un objet, pas un tableau : sans ce garde-fou
       * on tombe sur « .map n'est pas une fonction » au lieu de lire la cause. */
      if (!Array.isArray(data)) {
        sel.style.display = 'none';
        var msg = String(data && data.error || 'réponse inattendue');
        if (msg.indexOf('Inactive') >= 0) {
          msg = 'application désactivée par Strava — l’API est réservée aux abonnés.';
        }
        stravaState('Strava — ' + escapeHtml(msg));
        return;
      }
      remplitListe(data);
    } catch (e) {
      stravaState(messageIcu(e));
    }
  }

  function messageIcu(e) {
    if (e.message === 'CLE_REFUSEE') return 'intervals.icu — clé refusée. <a href="#" id="re">Recommencer</a>';
    if (e.message === 'QUOTA') return 'intervals.icu — quota atteint (2 500 / 15 min).';
    if (e.message === 'RESEAU') return 'intervals.icu — injoignable depuis ce navigateur.';
    return 'intervals.icu — ' + escapeHtml(e.message);
  }

  function remplitListe(data) {
    var sel = $('#strava-list');
    if (!Array.isArray(data)) {
      sel.style.display = 'none';
      stravaState('Réponse inattendue.');
      return;
    }
      stravaActs = data;
      sel.style.display = '';
      sel.innerHTML = '<option value="">— choisir une sortie —</option>' +
        stravaActs.map(function (x) {
          var d = new Date(x.start_date_local);
          return '<option value="' + x.id + '">' +
            d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) + ' · ' +
            escapeHtml(x.name) + ' · ' + (x.distance / 1000).toFixed(1) + ' km' +
            (x.total_elevation_gain ? ' · ' + Math.round(x.total_elevation_gain) + ' m' : '') +
            (x.has_power ? ' · W' : '') + '</option>';
        }).join('');
  }

  $('#strava-refresh').addEventListener('click', loadList);

  $('#strava-list').addEventListener('change', async function () {
    var id = $('#strava-list').value;
    if (!id) return;
    stravaState('Chargement de la sortie…');
    try {
      var j;
      if (source === 'icu-web') {
        j = await IcuWeb.activity(id);
      } else {
        var r = await fetch((source === 'icu' ? 'api/icu/activity/' : 'api/activity/') + id);
        j = await r.json();
        if (!r.ok) throw new Error(j.error || 'erreur');
      }
      base = (source === 'icu' || source === 'icu-web')
        ? Activity.fromIntervals(j.detail, j.streams)
        : Activity.fromStrava(j.detail, j.streams);
      overrides = {};
      chargee = true;
      $('#gpx-err').textContent = '';
      stravaState(source === 'icu-web' ? 'intervals.icu — connecté depuis ce navigateur'
        : source === 'icu' ? 'intervals.icu — connecté' : 'Strava — connecté');
      syncManualFields();
      summary();
      buildOptions();
      draw();
    } catch (e) {
      stravaState(messageIcu(e));
    }
  });

  $('#export').addEventListener('click', function () {
    var size = SIZES[$('#size').value];
    var slug = String(effective().name).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sortie';
    Studio.exportPNG(canvas, slug + '_' + current.id + '_' + size[0] + 'x' + size[1] + '.png');
  });

  /* ---------- démarrage ---------- */
  /* La version s'affiche dans l'en-tête : c'est ce qui permet de savoir,
   * d'un coup d'œil, si la page ouverte est bien la dernière déployée. */
  if (typeof STUDIO_VERSION !== 'undefined') {
    var note = $('#header-note');
    if (note) note.textContent = 'v' + STUDIO_VERSION + ' · ' + STUDIO_DATE;
  }

  var saved = load();
  /* Deux familles qui ne se mélangent pas : les images composées et les
   * surcouches à canal alpha. Le regroupement évite de choisir par erreur
   * un template transparent quand on veut une image finie. */
  var groupes = [
    { label: 'Images composées', filtre: function (t) { return !t.transparent; } },
    { label: 'Surcouches transparentes', filtre: function (t) { return t.transparent; } }
  ];
  groupes.forEach(function (gr) {
    var og = document.createElement('optgroup');
    og.label = gr.label;
    Studio.all().filter(gr.filtre).forEach(function (t) {
      var op = document.createElement('option');
      op.value = t.id; op.textContent = t.name;
      og.appendChild(op);
    });
    if (og.children.length) $('#tpl').appendChild(og);
  });
  Collections.list.forEach(function (c) {
    var op = document.createElement('option');
    op.value = c.id; op.textContent = c.name;
    $('#collection').appendChild(op);
  });
  if (saved.collection) $('#collection').value = saved.collection;
  $('#collection-note').textContent = Collections.get($('#collection').value).note || '';
  if (saved.opts) optionValues = saved.opts;
  if (saved.tpl && Studio.get(saved.tpl).id === saved.tpl) $('#tpl').value = saved.tpl;
  if (saved.size && SIZES[saved.size]) $('#size').value = saved.size;
  if (saved.minimal) $('#minimal').checked = true;

  buildOptions();
  syncManualFields();
  summary();

  /* Le canvas ne réagit pas au chargement d'une police : s'il dessine avant
   * qu'Archivo soit prête, il fige la pile de repli. On attend, puis on
   * redessine par sécurité. */
  if (document.fonts && document.fonts.ready) {
    Promise.all([
      document.fonts.load('700 100px Archivo'),
      document.fonts.load('400 40px "IBM Plex Mono"')
    ])
      .then(function () { return document.fonts.ready; })
      .then(draw, draw);
  }
  draw();
  stravaInit();
}());
