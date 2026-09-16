/* app.js — le câblage de l'interface. Aucun pixel du visuel n'est décidé ici. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var canvas = $('#canvas');
  var SIZES = {
    story: [1080, 1920],
    post: [1080, 1350],
    carre: [1080, 1080],
    paysage: [1920, 1080],
    /* Formats d'impression, en 300 points par pouce. Le tissage et la fresque
     * sont faits pour être tirés sur papier, et une story de 1080 pixels de
     * large donne une bouillie en A3. L'A3 fait 17 mégapixels : c'est lourd
     * mais tenable pour un PNG. L'export vidéo, lui, reste absurde à cette
     * taille — le verrou d'export s'en charge en pratique, l'utilisateur
     * repasse en story pour animer. */
    a4: [2480, 3508],
    a3: [3508, 4961]
  };

  var base = Activity.empty();      // activité telle que lue dans le GPX
  var overrides = {};               // corrections manuelles
  var optionValues = {};            // { templateId: { key: valeur } }
  var current = null;
  var photoURL = null;              // pour le fond de contrôle, hors canvas
  var photoFile = null;             // le fichier lui-même, pour le musée
  var empreinteCourante = null;     // l'historique d'exploration aplati
  var photoImg = null;              // la même, pour composer la vidéo
  var bgVideo = null;               // vidéo de fond, pour graver la surcouche dessus
  var chargee = false;              // une vraie sortie a-t-elle été fournie ?
  var exportEnCours = false;        // un export occupe le canvas

  /* ---------- persistance légère ---------- */
  function save() {
    try {
      localStorage.setItem('strava-studio', JSON.stringify({
        tpl: $('#tpl').value, size: $('#size').value, opts: optionValues,
        collection: $('#collection').value, minimal: $('#minimal').checked,
        rendu: $('#rendu').value, photoNb: $('#photo-nb').checked
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

  /* La bibliothèque est la source ; `base` n'en est que la sortie courante.
   * Les seize templates simples continuent de lire une activité, ceux qui
   * déclarent multi: true lisent la liste entière. */
  function syncBibliotheque() {
    Studio.setLibrary(Library.list());
    var cur = Library.current();
    if (cur) base = cur;
    chargee = Library.count() > 0 || chargee;
    rendLibrary();
  }

  function rendLibrary() {
    var box = $('#library');
    var entrees = Library.list();
    box.className = entrees.length > 1 ? 'on' : '';
    if (entrees.length < 2) { box.innerHTML = ''; return; }
    box.innerHTML = '';
    entrees.forEach(function (e, i) {
      var row = document.createElement('div');
      row.className = 'lib' + (e.id === Library.currentId() ? ' sel' : '');
      row.innerHTML =
        '<span class="nom">' + escapeHtml(Library.nomCourt(e.activity, 24)) + '</span>' +
        '<span class="chiffre">' + Studio.fmt.km(e.activity.distance_km, 1) + '</span>';

      /* La pastille EST le sélecteur de couleur. Les planches multi-sorties
       * — série, métro, tissage, fresque — identifient chaque sortie par sa
       * couleur ; sans moyen de la changer, la palette d'arrivée s'impose. */
      var teinte = document.createElement('input');
      teinte.type = 'color';
      teinte.className = 'pastille';
      teinte.value = e.couleur;
      teinte.title = 'Couleur de cette sortie';
      teinte.addEventListener('click', function (ev) { ev.stopPropagation(); });
      teinte.addEventListener('input', function () {
        Library.setColor(e.id, teinte.value);
        Studio.setLibrary(Library.list());
        draw();
      });
      row.insertBefore(teinte, row.firstChild);
      var monter = bouton('↑', 'Monter', function (ev) { ev.stopPropagation(); Library.move(e.id, -1); syncBibliotheque(); draw(); });
      var descendre = bouton('↓', 'Descendre', function (ev) { ev.stopPropagation(); Library.move(e.id, 1); syncBibliotheque(); draw(); });
      var retirer = bouton('×', 'Retirer', function (ev) { ev.stopPropagation(); Library.remove(e.id); apresChangement(); });
      if (i === 0) monter.disabled = true;
      if (i === entrees.length - 1) descendre.disabled = true;
      row.appendChild(monter); row.appendChild(descendre); row.appendChild(retirer);
      row.addEventListener('click', function () {
        Library.select(e.id); syncBibliotheque(); summary(); syncManualFields(); buildOptions(); draw();
      });
      box.appendChild(row);
    });
  }

  function bouton(txt, titre, fn) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = txt; b.title = titre;
    b.addEventListener('click', fn);
    return b;
  }

  function apresChangement() {
    if (!Library.count()) { chargee = false; base = Activity.empty(); }
    syncBibliotheque();
    // les suggestions du musée portent sur ce qui est chargé : elles suivent
    if (window.Musee) rendSuggestions();
    summary(); syncManualFields(); buildOptions(); draw();
  }

  function draw() {
    document.body.classList.toggle('vide', !chargee);
    majBoutons();
    if (!chargee) { save(); return; }
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    Studio.setMinimal($('#minimal').checked);
    /* Le rendu achromatique est posé AVANT le rendu, dans le moteur : un
     * filtre CSS sur l'aperçu ne suivrait pas dans toBlob et l'export
     * sortirait en couleur. */
    Studio.setAchromatique($('#rendu').value === 'nb', $('#photo-nb').checked);
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
    ['#export', '#export-video', '#export-seq', '#preview-play'].forEach(function (sel) {
      $(sel).disabled = bloque;
    });
    // pendant un export, ce qui définit l'image ne doit plus bouger
    ['#size', '#tpl', '#collection', '#minimal'].forEach(function (sel) {
      var el = $(sel); if (el) el.disabled = exportEnCours;
    });
  }

  /* La transparence du rendu courant. Elle ne dépend plus seulement du
   * template : les planches Alpage s'exportent au choix sur papier ou en
   * surcouche, et c'est une option. */
  function transparentCourant() {
    if (!current) return false;
    return Studio.estTransparent(current.id, resolvedOptions(current.id));
  }

  /* Sous l'aperçu : ce qu'on regarde exactement. */
  function caption(size) {
    var el = $('#stage-caption');
    if (!el) return;
    el.textContent = current.name + ' · ' + size[0] + ' × ' + size[1] +
      (transparentCourant() ? ' · PNG transparent' : '');
  }

  /* ---------- fond de contrôle ----------
   * Il vit derrière le canvas, jamais dedans. Sur une surcouche transparente
   * c'est la seule façon de juger la lisibilité sans aplatir la photo dans
   * le PNG exporté. */
  function ground() {
    var sheet = $('#sheet');
    var mode = $('#ground').value;
    var transparent = transparentCourant();
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
    var inertes = (typeof tpl.inert === 'function' && chargee) ? (tpl.inert(effective(), vals) || []) : [];

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
        if (def.step != null) input.step = def.step;
        input.value = vals[def.key];
      } else if (def.type === 'color') {
        input = document.createElement('input');
        input.type = 'color';
        input.value = vals[def.key];
      } else if (def.type === 'order') {
        /* Un storyboard : des scènes qu'on active, désactive et réordonne.
         * La valeur reste une simple chaîne « clé,clé,clé » — le même type
         * que les autres options, donc elle se sauvegarde, se restaure et
         * s'exporte sans un cas particulier de plus. */
        input = ordonnanceur(def, vals);
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

      /* Certains réglages décident si d'AUTRES réglages servent encore —
       * le nombre de portions, un mode qui reprend la main sur des curseurs.
       * Sans reconstruction, le grisé resterait figé sur l'état précédent et
       * mentirait. On écoute `change` et non `input` : reconstruire à chaque
       * pixel d'un curseur qu'on fait glisser lui ferait perdre le focus. */
      if (def.reflow) input.addEventListener('change', function () { buildOptions(); });

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

  /* ---------- le storyboard ----------
   * Rendu comme une liste : chaque scène a une case et deux flèches. La
   * valeur produite est la suite ordonnée des clés actives, séparées par des
   * virgules — volontairement la même forme qu'un champ texte, pour que rien
   * dans la chaîne sauvegarde → collection → export n'ait à la connaître.
   *
   * `def.items` = [[clé, libellé], …] · `def.min` / `def.max` bornent le
   * nombre de scènes actives : sous la borne basse, on refuse de décocher.
   */
  function ordonnanceur(def, vals) {
    var boite = document.createElement('div');
    boite.className = 'ordre';
    var libelles = {};
    def.items.forEach(function (it) { libelles[it[0]] = it[1]; });

    function lire() {
      return String(vals[def.key] || def.default || '')
        .split(',').map(function (x) { return x.trim(); })
        .filter(function (k) { return libelles[k]; });
    }
    function ecrire(liste) {
      boite.value = liste.join(',');
      boite.dispatchEvent(new Event('input'));
      rendre();
    }

    function rendre() {
      var actives = lire();
      var mini = def.min == null ? 1 : def.min;
      var maxi = def.max == null ? def.items.length : def.max;
      boite.innerHTML = '';
      // les actives dans leur ordre, puis les inactives
      var rangees = actives.concat(def.items.map(function (it) { return it[0]; })
        .filter(function (k) { return actives.indexOf(k) < 0; }));

      rangees.forEach(function (cle) {
        var i = actives.indexOf(cle);
        var on = i >= 0;
        var ligne = document.createElement('div');
        ligne.className = 'ordre-l' + (on ? ' on' : '');

        var coche = document.createElement('input');
        coche.type = 'checkbox';
        coche.checked = on;
        coche.disabled = (on && actives.length <= mini) || (!on && actives.length >= maxi);
        coche.addEventListener('change', function () {
          var l = lire();
          if (on) l.splice(l.indexOf(cle), 1); else l.push(cle);
          ecrire(l);
        });

        var nom = document.createElement('span');
        nom.textContent = libelles[cle];

        ligne.appendChild(coche);
        ligne.appendChild(nom);
        [['↑', -1], ['↓', 1]].forEach(function (b) {
          var bt = document.createElement('button');
          bt.type = 'button'; bt.textContent = b[0];
          bt.disabled = !on || (i + b[1] < 0) || (i + b[1] >= actives.length);
          bt.addEventListener('click', function () {
            var l = lire(), de = l.indexOf(cle), vers = de + b[1];
            if (vers < 0 || vers >= l.length) return;
            var t = l[vers]; l[vers] = l[de]; l[de] = t;
            ecrire(l);
          });
          ligne.appendChild(bt);
        });
        boite.appendChild(ligne);
      });
    }

    boite.value = lire().join(',');
    rendre();
    return boite;
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
    var fichiers = Array.prototype.slice.call(e.target.files || []);
    if (!fichiers.length) return;
    nomFichier('#gpx', 'Charger un ou plusieurs GPX',
      fichiers.length === 1 ? fichiers[0].name : fichiers.length + ' fichiers');

    /* Les lectures se terminent dans un ordre non garanti. On trie par nom
     * AVANT de lire et on range chaque résultat à sa place : sans ça, la
     * bibliothèque sort dans un ordre différent à chaque chargement, et
     * l'ordre est précisément ce que l'utilisateur contrôle. */
    fichiers.sort(function (x, y) { return x.name.localeCompare(y.name); });
    var lus = new Array(fichiers.length);
    var erreurs = [];
    var restants = fichiers.length;

    fichiers.forEach(function (file, i) {
      var reader = new FileReader();
      reader.onload = function () {
        try { lus[i] = Activity.parseGPX(reader.result); }
        catch (err) { erreurs.push(file.name + ' : ' + err.message); }
        if (--restants === 0) termine();
      };
      reader.onerror = function () {
        erreurs.push(file.name + ' : lecture impossible');
        if (--restants === 0) termine();
      };
      reader.readAsText(file);
    });

    function termine() {
      lus.forEach(function (act) { if (act) Library.add(act); });
      overrides = {};
      chargee = Library.count() > 0;
      $('#gpx-err').textContent = erreurs.join(' · ');
      apresChangement();
    }
  });

  $('#photo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) { Studio.setPhoto(null); photoURL = null; photoFile = null; draw(); return; }
    nomFichier('#photo', 'Charger une photo', file.name);
    photoFile = file;
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
    photoURL = null; photoImg = null; photoFile = null;
    if ($('#ground').value === 'photo') $('#ground').value = 'damier';
    draw();
  });

  $('#ground').addEventListener('change', ground);

  /* Démarrer à vide est honnête — on n'affiche pas une sortie que personne
   * n'a parcourue. Mais sans rien à voir, les quinze templates sont
   * invisibles. Ce bouton donne de quoi les parcourir en un clic, et il dit
   * clairement que c'est un exemple. */
  /* Deux exemples : une sortie, ou le jeu multi-sorties. Le second existe
   * parce que les planches « série », « métro », « saisons », « tissage » et
   * « fresque » ne se jugent pas sur une sortie unique — et parce qu'un
   * visiteur hors ligne doit pouvoir les voir quand même. Les trois fichiers
   * sont dans le cache du service worker. */
  function chargeExemples(bouton, fichiers, libelle) {
    bouton.disabled = true;
    var avant = bouton.textContent;
    bouton.textContent = 'Chargement…';
    Promise.all(fichiers.map(function (f) {
      return fetch(f).then(function (r) {
        if (!r.ok) throw new Error(f);
        return r.text();
      });
    })).then(function (textes) {
      // l'ordre de la bibliothèque suit l'ordre demandé, pas l'ordre du réseau
      textes.forEach(function (txt) { Library.add(Activity.parseGPX(txt)); });
      overrides = {};
      chargee = true;
      apresChangement();
      bouton.textContent = avant;
    }).catch(function () {
      bouton.textContent = libelle + ' indisponible';
    }).then(function () { bouton.disabled = false; });
  }

  $('#load-example').addEventListener('click', function () {
    chargeExemples($('#load-example'), ['exemple.gpx'], 'Exemple');
  });
  $('#load-examples').addEventListener('click', function () {
    chargeExemples($('#load-examples'),
      ['exemple-boucle.gpx', 'exemple-aller.gpx',
       'exemple-variante.gpx', 'exemple-ailleurs.gpx'], 'Exemples');
  });
  /* Huit sorties sur huit semaines — dont une semaine entièrement vide et une
   * sortie sans altitude. C'est le jeu qui montre ce que le tissage promet :
   * trois absences différentes, trois dessins différents. */
  /* Trois jeux de revue artistique. Ils existent parce qu'on ne peut pas
   * juger un DESSIN sur les données qui servent à éprouver des CALCULS :
   * les premiers exemples étaient des polygones à huit sommets, sur
   * lesquels un trait de plume paraît cassé même quand la géométrie est
   * parfaite — et où un vrai défaut de raccord se confond avec un sommet. */
  $('#load-formes').addEventListener('click', function () {
    chargeExemples($('#load-formes'),
      ['demo-boucle.gpx', 'demo-aller.gpx', 'demo-ouvert.gpx', 'demo-croisements.gpx'],
      'Formes');
  });
  /* Cinq sorties, deux sports, et deux portions réellement partagées : sans
   * elles, l'Atlas ressemble à cinq cartes posées côte à côte. */
  $('#load-semaine').addEventListener('click', function () {
    chargeExemples($('#load-semaine'),
      ['sem-lun.gpx', 'sem-mar.gpx', 'sem-jeu.gpx', 'sem-ven.gpx', 'sem-dim.gpx'],
      'Semaine');
  });
  $('#load-regions').addEventListener('click', function () {
    chargeExemples($('#load-regions'),
      ['sem-lun.gpx', 'sem-jeu.gpx', 'loin-a.gpx', 'loin-b.gpx'],
      'Régions');
  });

  $('#load-weeks').addEventListener('click', function () {
    chargeExemples($('#load-weeks'), [
      'sem-01.gpx', 'sem-02.gpx', 'sem-03.gpx', 'sem-04.gpx',
      'sem-05.gpx', 'sem-06.gpx', 'sem-07.gpx', 'sem-08.gpx'
    ], 'Semaines');
  });

  /* ---------- le son ----------
   * Rien ne sonne avant un clic sur « Écouter ». Le panneau n'apparaît même
   * que sur la planche « Partition » : des commandes de lecture posées sous
   * une affiche muette feraient croire que tout le studio fait du bruit.
   *
   * Pendant la lecture, l'aperçu suit la TÊTE DE LECTURE AUDIO plutôt qu'une
   * horloge parallèle. Deux horloges qui partent ensemble dérivent : au bout
   * de quinze secondes la partition dessinée ne serait plus celle qu'on
   * entend, et c'est exactement ce que la synchronisation doit éviter. */
  var lecteur = window.Partition ? new Partition.Lecteur() : null;
  var boucleSon = null;

  function partitionCourante() {
    var vals = resolvedOptions('partition');
    return Partition.construire(effective(), {
      duree: Number(vals.tempo) || 14,
      ambiance: vals.ambiance || 'nappe'
    });
  }

  function volumeCourant() {
    var vals = resolvedOptions('partition');
    return (vals.volume == null ? 70 : Number(vals.volume)) / 100;
  }

  function majPanneauSon() {
    var el = $('#son');
    if (!el) return;
    var actif = $('#tpl').value === 'partition';
    el.hidden = !actif;
    if (!actif && lecteur) arreteSon();
  }

  function suitLeSon() {
    if (!lecteur || lecteur.etat !== 'joue') return;
    var p = lecteur.partition;
    var pos = lecteur.position();
    Studio.setProgress(Math.min(1, pos / p.duree), 1);
    draw();
    if (pos >= p.duree) { arreteSon(); return; }
    boucleSon = requestAnimationFrame(suitLeSon);
  }

  function arreteSon() {
    if (boucleSon) { cancelAnimationFrame(boucleSon); boucleSon = null; }
    if (lecteur) lecteur.arreter();
    Studio.setProgress(1, 1);
    $('#son-state').textContent = '';
    draw();
  }

  if (lecteur) {
    $('#son-play').addEventListener('click', function () {
      try {
        lecteur.jouer(partitionCourante(), { volume: volumeCourant() });
        $('#son-state').textContent = 'Lecture…';
        boucleSon = requestAnimationFrame(suitLeSon);
      } catch (e) { $('#son-state').textContent = e.message; }
    });
    $('#son-pause').addEventListener('click', function () {
      if (lecteur.etat !== 'joue') return;
      lecteur.pause();
      if (boucleSon) { cancelAnimationFrame(boucleSon); boucleSon = null; }
      $('#son-state').textContent = 'En pause à ' + lecteur.position().toFixed(1) + ' s.';
    });
    $('#son-stop').addEventListener('click', arreteSon);
    $('#son-wav').addEventListener('click', function () {
      var note = $('#son-state');
      note.textContent = 'Rendu du son…';
      Partition.exporterWav(partitionCourante(), { volume: volumeCourant() })
        .then(function (blob) {
          Video.save(blob, slug() + '_partition.wav');
          note.textContent = 'WAV enregistré (' + Math.round(blob.size / 1024) + ' ko) — ' +
            'l’export vidéo reste muet : à marier au montage.';
        })
        .catch(function (e) { note.textContent = e.message; });
    });
  }

  /* ---------- musée personnel ----------
   * Rien n'entre dans la collection sans un clic, et une suggestion affiche
   * SA RAISON avant qu'on l'accepte. Le studio ne décide d'aucune première
   * fois à ta place : il dit ce qu'il a vérifié, et sur quoi. */
  var piecesMusee = [];

  function majMusee(message) {
    if (!window.Musee) return Promise.resolve();
    return Musee.lister().then(function (list) {
      piecesMusee = list;
      Studio.setMusee(list);
      rendMusee();
      if (message) $('#musee-state').textContent = message;
      draw();
    }).catch(function (e) { $('#musee-state').textContent = e.message; });
  }

  function rendMusee() {
    var box = $('#musee-liste');
    box.innerHTML = '';
    piecesMusee.forEach(function (p, i) {
      var row = document.createElement('div');
      row.className = 'piece';
      row.innerHTML = '<span class="nom">' + escapeHtml(p.titre) + '</span>';
      /* Classer, c'est ORDONNER, pas noter : deux flèches, pas d'étoiles. */
      var monter = bouton('↑', 'Monter', function () { echange(i, i - 1); });
      var descendre = bouton('↓', 'Descendre', function () { echange(i, i + 1); });
      var effacer = bouton('×', 'Retirer de la collection', function () {
        if (!window.confirm('Retirer « ' + p.titre + ' » de la collection ?')) return;
        Musee.supprimer(p.id).then(function () { return majMusee('Pièce retirée.'); });
      });
      if (i === 0) monter.disabled = true;
      if (i === piecesMusee.length - 1) descendre.disabled = true;
      row.appendChild(monter); row.appendChild(descendre); row.appendChild(effacer);
      box.appendChild(row);
    });
    rendSuggestions();
  }

  function echange(i, j) {
    if (j < 0 || j >= piecesMusee.length) return;
    var a = piecesMusee[i], b = piecesMusee[j];
    Promise.all([Musee.modifier(a.id, { rang: b.rang }), Musee.modifier(b.id, { rang: a.rang })])
      .then(function () { return majMusee(); });
  }

  function rendSuggestions() {
    var box = $('#musee-suggestions');
    box.innerHTML = '';
    if (!Library.count()) return;
    var sugg = Musee.suggestions(Library.list(), empreinteCourante,
                                 piecesMusee.map(function (p) { return p.id; }));
    sugg.slice(0, 4).forEach(function (sg) {
      var el = document.createElement('div');
      el.className = 'sugg';
      el.innerHTML = '<strong>' + escapeHtml(sg.titre) + '</strong>' +
                     '<div class="pourquoi">' + escapeHtml(sg.pourquoi) + '</div>';
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'ghost'; b.textContent = 'Ajouter à la collection';
      b.addEventListener('click', function () {
        Musee.creer(sg.activity, { titre: sg.titre, recit: '', couleur: couleurDe(sg.activity) })
          .then(function () { return majMusee('Pièce ajoutée — le cartel reste à écrire.'); })
          .catch(function (e) { $('#musee-state').textContent = e.message; });
      });
      el.appendChild(b);
      box.appendChild(el);
    });
  }

  function couleurDe(act) {
    var e = Library.list().filter(function (x) { return x.activity === act; })[0];
    return e ? e.couleur : '#E5502D';
  }

  $('#musee-creer').addEventListener('click', function () {
    if (!chargee) { $('#musee-state').textContent = 'Charge une sortie d’abord.'; return; }
    var cur = Library.current() || effective();
    Musee.creer(cur, {
      titre: $('#musee-titre').value,
      recit: $('#musee-recit').value,
      couleur: couleurDe(cur)
    }, photoFile).then(function () {
      $('#musee-titre').value = ''; $('#musee-recit').value = '';
      return majMusee('Pièce créée.');
    }).catch(function (e) { $('#musee-state').textContent = e.message; });
  });

  $('#musee-save').addEventListener('click', function () {
    if (!piecesMusee.length) { $('#musee-state').textContent = 'Collection vide.'; return; }
    var blob = new Blob([JSON.stringify(Musee.sauvegarde(piecesMusee))], { type: 'application/json' });
    if (window.Share) Share.file(blob, 'musee.json');
    else {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url; a.download = 'musee.json';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
    }
    $('#musee-state').textContent = piecesMusee.length + ' pièces sauvegardées — sans les photos.';
  });

  $('#musee-open').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) return;
    nomFichier('#musee-open', 'Restaurer', file.name);
    var r = new FileReader();
    r.onload = function () {
      Musee.restaurer(r.result)
        .then(function (n) { return majMusee(n + ' pièces restaurées.'); })
        .catch(function (err) { $('#musee-state').textContent = err.message; });
      e.target.value = '';
    };
    r.readAsText(file);
  });

  /* ---------- historique d'exploration ----------
   * Stockage LOCAL et explicite : rien n'y entre sans un clic, et « effacer »
   * efface pour de bon. L'empreinte est recalculée puis poussée au moteur —
   * IndexedDB est asynchrone et un draw() ne peut pas l'attendre. */
  function majHistorique(message) {
    if (!window.Historique) return Promise.resolve();
    return Historique.lister().then(function (list) {
      var emp = Historique.empreinte(list);
      empreinteCourante = emp.sorties ? emp : null;
      Studio.setHistorique(empreinteCourante);
      // les suggestions du musée dépendent de l'historique : elles se
      // recalculent ici plutôt que de rester sur l'état d'avant
      if (window.Musee) rendSuggestions();
      $('#hist-state').textContent = message || (emp.sorties
        ? emp.sorties + ' sorties de référence · ' + Math.round(emp.km) + ' km · ' +
          emp.cases.toLocaleString('fr-CH') + ' cases'
        : 'Aucun historique — la première importation fera la référence.');
      draw();
    }).catch(function (e) {
      $('#hist-state').textContent = e.message;
    });
  }

  $('#hist-add').addEventListener('click', function () {
    if (!Library.count()) { $('#hist-state').textContent = 'Rien à ajouter.'; return; }
    $('#hist-state').textContent = 'Enregistrement…';
    Historique.ajouter(Library.list().map(function (e) { return e.activity; }))
      .then(function (n) { return majHistorique(n + ' sorties enregistrées dans l’historique.'); })
      .then(function () { setTimeout(function () { majHistorique(); }, 1800); })
      .catch(function (e) { $('#hist-state').textContent = e.message; });
  });

  $('#hist-clear').addEventListener('click', function () {
    /* Une confirmation, parce que c'est irréversible et que le bouton est
     * juste à côté de celui qui ajoute. */
    if (!window.confirm('Effacer tout l’historique d’exploration de ce navigateur ?')) return;
    Historique.vider()
      .then(function () { return majHistorique('Historique effacé.'); })
      .then(function () { setTimeout(function () { majHistorique(); }, 1800); })
      .catch(function (e) { $('#hist-state').textContent = e.message; });
  });

  /* ---------- projet : enregistrer, rouvrir ----------
   * Un fichier local, rien d'autre. Rouvrir REMPLACE la bibliothèque : la
   * fusionner donnerait des doublons invisibles au bout de deux essais, et
   * « pourquoi ma fresque a douze contributions » est une question qu'on ne
   * veut jamais avoir à se poser. */
  $('#projet-save').addEventListener('click', function () {
    var note = $('#projet-state');
    if (!Library.count()) { note.textContent = 'Rien à enregistrer.'; return; }
    try {
      Projet.exporter(Library.list(), {
        tpl: $('#tpl').value, size: $('#size').value,
        collection: $('#collection').value, minimal: $('#minimal').checked,
        rendu: $('#rendu').value, photoNb: $('#photo-nb').checked,
        opts: optionValues
      }, 'projet-' + slug() + '.json');
      note.textContent = Library.count() + ' sorties enregistrées.';
    } catch (e) {
      note.textContent = e.message;
    }
  });

  /* Rouvrir REMPLACE la bibliothèque. Partagé entre le fichier choisi par
   * l'utilisateur et l'année de démonstration : deux chemins qui divergent
   * finissent par restaurer deux états différents du même fichier. */
  function appliqueProjet(p) {
    Library.clear();
    p.sorties.forEach(function (so) {
      var entree = Library.add(so.activity);
      if (entree && so.couleur) Library.setColor(entree.id, so.couleur);
    });
    if (p.reglages.opts) optionValues = p.reglages.opts;
    if (p.reglages.tpl && Studio.get(p.reglages.tpl)) $('#tpl').value = p.reglages.tpl;
    if (p.reglages.size && SIZES[p.reglages.size]) $('#size').value = p.reglages.size;
    if (p.reglages.collection) $('#collection').value = p.reglages.collection;
    if (p.reglages.minimal != null) $('#minimal').checked = !!p.reglages.minimal;
    if (p.reglages.rendu) $('#rendu').value = p.reglages.rendu;
    if (p.reglages.photoNb != null) $('#photo-nb').checked = !!p.reglages.photoNb;
    $('#opt-photo-nb').hidden = $('#rendu').value !== 'nb';
    overrides = {};
    chargee = Library.count() > 0;
    apresChangement();
  }

  /* Une année entière, pour Almanac : 106 sorties avec leurs creux, leurs
   * semaines chargées et deux journées hors norme. En GPX il aurait fallu
   * cent fichiers ; le format projet en fait un seul de 90 ko. */
  $('#load-year').addEventListener('click', function () {
    var b = $('#load-year'), avant = b.textContent;
    b.disabled = true; b.textContent = 'Chargement…';
    fetch('exemple-annee.json')
      .then(function (r) { if (!r.ok) throw new Error('indisponible'); return r.text(); })
      .then(function (txt) {
        appliqueProjet(Projet.lire(txt));
        b.textContent = avant;
      })
      .catch(function () { b.textContent = 'Année indisponible'; })
      .then(function () { b.disabled = false; });
  });

  $('#projet-open').addEventListener('change', function (e) {
    var file = e.target.files[0];
    var note = $('#projet-state');
    if (!file) return;
    nomFichier('#projet-open', 'Rouvrir un projet', file.name);
    var reader = new FileReader();
    reader.onload = function () {
      try {
        appliqueProjet(Projet.lire(reader.result));
        note.textContent = Library.count() + ' sorties rouvertes.';
      } catch (err) {
        note.textContent = err.message;
      }
      // sans ça, rouvrir DEUX FOIS le même fichier ne déclenche rien
      e.target.value = '';
    };
    reader.onerror = function () { note.textContent = 'Lecture impossible.'; };
    reader.readAsText(file);
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
  /* Rendu couleur / noir & blanc. Le réglage « photo aussi » ne s'affiche
   * qu'en noir et blanc : ailleurs il ne ferait rien. */
  function majRendu() {
    var nb = $('#rendu').value === 'nb';
    $('#opt-photo-nb').hidden = !nb;
    draw();
  }
  $('#rendu').addEventListener('change', majRendu);
  $('#photo-nb').addEventListener('change', draw);

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
    $('#preview-play').textContent = 'Lire l’aperçu';
    Studio.setProgress(1, 1);
    draw();
  }
  $('#preview-play').addEventListener('click', function () {
    if (lecture) return arreteLecture();
    if (!chargee) return;
    var horloge = Studio.chrono($('#tpl').value, resolvedOptions($('#tpl').value));
    var t0 = performance.now();
    $('#preview-play').textContent = 'Arrêter l’aperçu';
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
        at: function (k) { return horloge.at(k); },
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
      Library.add((source === 'icu' || source === 'icu-web')
        ? Activity.fromIntervals(j.detail, j.streams)
        : Activity.fromStrava(j.detail, j.streams));
      overrides = {};
      chargee = true;
      syncBibliotheque();
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
  /* Le sélecteur est rangé par FAMILLE. Avec seize templates il devenait
   * une liste où l'on ne retrouvait rien ; à vingt-six ce serait un
   * catalogue inutilisable. L'ordre des familles est fixe et volontaire :
   * on cherche d'abord une affiche, la surcouche est un cas particulier,
   * et les séries demandent plusieurs sorties chargées. */
  var FAMILLES = [
    { id: 'affiche',   label: 'Affiches' },
    { id: 'surcouche', label: 'Surcouches transparentes' },
    { id: 'serie',     label: 'Séries — plusieurs sorties' }
  ];
  FAMILLES.forEach(function (f) {
    var og = document.createElement('optgroup');
    og.label = f.label;
    Studio.all().filter(function (t) { return t.famille === f.id; }).forEach(function (t) {
      var op = document.createElement('option');
      op.value = t.id; op.textContent = t.name;
      og.appendChild(op);
    });
    if (og.children.length) $('#tpl').appendChild(og);
  });

  if (saved.opts) optionValues = saved.opts;
  if (saved.tpl && Studio.get(saved.tpl).id === saved.tpl) $('#tpl').value = saved.tpl;
  if (saved.size && SIZES[saved.size]) $('#size').value = saved.size;
  if (saved.minimal) $('#minimal').checked = true;
  if (saved.rendu) $('#rendu').value = saved.rendu;
  if (saved.photoNb) $('#photo-nb').checked = true;
  $('#opt-photo-nb').hidden = $('#rendu').value !== 'nb';

  syncBibliotheque();
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
  // l'empreinte d'exploration est chargée en tâche de fond ; sans elle, la
  // planche « Territoires blancs » dirait qu'il n'y a pas d'historique
  majHistorique();
  majMusee();
  majPanneauSon();
}());
