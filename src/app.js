/* app.js — le câblage de l'interface. Aucun pixel du visuel n'est décidé ici. */
(function () {
  'use strict';

  /* Le contexte partagé vit dans src/app/noyau.js — voir ce fichier pour
   * POURQUOI il existe et comment l'ordre de chargement est tenu. Ici on ne
   * fait que s'y brancher : `E` est l'état, et il est nommé court parce qu'on
   * le lit partout. */
  var A = window.App;
  var $ = A.$;
  var canvas = A.canvas;
  var SIZES = A.SIZES;
  var E = A.etat;


  /* ---------- persistance légère ---------- */
  function save() {
    try {
      localStorage.setItem('strava-studio', JSON.stringify({
        tpl: $('#tpl').value, size: $('#size').value, opts: E.optionValues,
        collection: $('#collection').value, minimal: $('#minimal').checked,
        rendu: $('#rendu').value, photoNb: $('#photo-nb').checked,
        support: $('#support').value, voile: $('#voile').value,
        periode: $('#periode').value
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
    Object.keys(E.base).forEach(function (k) { a[k] = E.base[k]; });
    Object.keys(E.overrides).forEach(function (k) {
      if (E.overrides[k] !== null && E.overrides[k] !== undefined && E.overrides[k] !== '') a[k] = E.overrides[k];
    });
    if (E.overrides.distance_km != null && E.overrides.distance_km !== '') {
      a.distance_m = E.overrides.distance_km * 1000;
    }
    return Activity.build(a);
  }

  /* ---------- rendu ---------- */
  /* Les valeurs d'options réellement envoyées au template : celles du
   * panneau, puis la collection par-dessus si une est choisie. */
  /* `remplacantes` sert aux vignettes du catalogue : elles doivent montrer
   * une variante qui n'est pas encore choisie, tout en passant par la
   * collection comme la planche. */
  function resolvedOptions(tplId, remplacantes) {
    var vals = remplacantes || E.optionValues[tplId] || {};
    return Collections.apply(tplId, vals, $('#collection').value);
  }

  /* La bibliothèque est la source ; `E.base` n'en est que la sortie courante.
   * Les seize templates simples continuent de lire une activité, ceux qui
   * déclarent multi: true lisent la liste entière. */
  /* ---------- la période ----------
   *
   * Une planche de série lit `s.library`. Jusqu'ici elle lisait TOUT ce qui
   * était chargé, et composer « la semaine dernière » demandait de retirer à
   * la main les sorties des autres semaines — puis de les recharger.
   *
   * Le filtre s'applique donc en amont, une seule fois, à l'endroit exact où
   * le moteur reçoit la bibliothèque. Les templates n'en savent rien : ils
   * reçoivent une liste, comme avant.
   *
   * « Tout ce qui est chargé » reste le défaut : un réglage qui change ce
   * qu'on voit ne doit pas s'appliquer sans qu'on l'ait demandé. */
  function fenetreCourante() {
    var v = $('#periode') ? $('#periode').value : 'tout';
    if (!v || v === 'tout') return null;
    var p = v.split(':');
    return Alpage.fenetre(p[0], parseInt(p[1], 10) || 0);
  }

  function entreesRetenues() {
    var f = fenetreCourante();
    if (!f) return Library.list();
    return Library.list().filter(function (e) {
      return Alpage.dansLaFenetre(e.activity && e.activity.date, f);
    });
  }

  /* Ce que le filtre retient, écrit noir sur blanc. Une planche vide est un
   * résultat possible — « aucune sortie cette semaine » est une information,
   * pas une erreur — mais elle doit être ANNONCÉE, sinon elle ressemble à
   * une panne. */
  function majPeriode() {
    var tpl = Studio.get($('#tpl').value);
    var multi = !!(tpl && tpl.multi);
    var bloc = $('#opt-periode'), note = $('#periode-state');
    if (!bloc) return;
    bloc.hidden = !multi;
    var f = fenetreCourante();
    if (!multi || !f) { note.hidden = true; return; }
    var n = entreesRetenues().length, total = Library.count();
    note.hidden = false;
    note.textContent = n + ' / ' + total + ' ' + T('sorties') + ' · ' +
      f.debut.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) +
      ' → ' + new Date(f.fin.getTime() - 86400000)
        .toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) +
      (n === 0 ? ' · ' + T('aucune sortie dans cette période') : '');
  }

  /* LES RÉGLAGES GLOBAUX, POSÉS AVANT TOUT RENDU.
   *
   * Le rendu achromatique et le support vivent dans le moteur, pas dans les
   * templates. Ils étaient posés dans draw() — donc APRÈS les vignettes du
   * catalogue, qui rendent elles aussi par Studio.render(). Le catalogue
   * avait ainsi toujours un réglage de retard : on passait en noir & blanc,
   * la planche suivait, les vignettes restaient en couleur. Et au premier
   * chargement, quelqu'un qui avait laissé le noir & blanc voyait un
   * catalogue en couleur.
   *
   * Un seul endroit les pose, et tout ce qui dessine l'appelle d'abord. */
  function poseEtatGlobal() {
    Studio.setMinimal($('#minimal').checked);
    Studio.setAchromatique($('#rendu').value === 'nb', $('#photo-nb').checked);
    Studio.setSupport($('#support').value === 'surcouche');
    Studio.setVoile($('#voile') ? $('#voile').value : 'aucun');
  }

  function syncBibliotheque() {
    Studio.setLibrary(entreesRetenues());
    if ($('#opt-periode')) majPeriode();
    /* Les vignettes du catalogue sont des rendus des sorties chargées : elles
     * doivent être refaites quand la bibliothèque change, sinon elles
     * continuent d'afficher « charge une sortie » après le chargement.
     *
     * Le garde a change deux fois, et les deux fois pour la meme raison : il
     * faut tester ce qui peut REELLEMENT manquer. Il a porte sur `typeof
     * construitChoixStyle` — toujours vrai, une declaration de fonction etant
     * hoistee — puis sur la liste des groupes, declaree en `var` plus bas.
     * Depuis le decoupage, le catalogue est un module charge APRES ce
     * fichier : ce qui peut manquer, c'est lui. */
    if (A.construitChoixStyle && $('#choix-style')) A.construitChoixStyle();
    var cur = Library.current();
    if (cur) E.base = cur;
    E.chargee = Library.count() > 0 || E.chargee;
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
    if (!Library.count()) { E.chargee = false; E.base = Activity.empty(); }
    syncBibliotheque();
    // les suggestions du musée portent sur ce qui est chargé : elles suivent
    if (window.Musee) A.rendSuggestions();
    summary(); syncManualFields(); buildOptions(); draw();
  }

  function draw() {
    document.body.classList.toggle('vide', !E.chargee);
    majBoutons();
    if (!E.chargee) return;
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    /* Le rendu achromatique est posé AVANT le rendu, dans le moteur : un
     * filtre CSS sur l'aperçu ne suivrait pas dans toBlob et l'export
     * sortirait en couleur. */
    poseEtatGlobal();
    E.current = Studio.render(canvas, tplId, effective(), resolvedOptions(tplId), size);
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
  }

  /* Les trois exports partagent le MÊME canvas et le même état d'animation.
   * Chacun ne désactivait que son propre bouton, et le moindre réglage
   * rendait les autres cliquables : on pouvait lancer une séquence PNG
   * pendant un enregistrement vidéo, ou changer de format en plein milieu.
   * Le verrou est donc central, et il fige aussi ce qui décide du rendu. */
  function verrouiller(actif) {
    E.exportEnCours = actif;
    majBoutons();
  }

  /* Sur un téléphone, les trois actions secondaires tiennent sur une seule
   * rangée : « Vidéo — le tracé s'anime » n'y entre pas. On garde le mot
   * qui désigne l'action et on laisse tomber ce qui l'explique — l'écran
   * n'a pas la place d'expliquer, et le bouton reste le même. */
  /* LE SEUIL DU TÉLÉPHONE, une fois.
   *
   * Il y en avait deux — `ETROIT` pour les libellés courts, `TELEPHONE` pour
   * la barre d'outils — avec la même requête et chacun son écouteur. Ils
   * répondaient forcément la même chose, mais rien ne disait dans quel ordre
   * ils réagiraient à une rotation. Il est déclaré ici, avant son premier
   * usage : `var` ne se hisse pas avec sa valeur.
   *
   * 900 px : la largeur en dessous de laquelle la colonne de 330 ne laisse
   * plus rien à l'aperçu. La même valeur vit dans les média-requêtes
   * d'index.html, où le CSS ne peut pas lire une constante JavaScript. */
  var TELEPHONE = window.matchMedia('(max-width: 900px)');
  var ETROIT = TELEPHONE;
  function libelle(long, court) { return T(ETROIT.matches ? court : long); }
  function majLibelles() {
    if (E.enLecture) return;               // une lecture en cours a son propre libellé
    $('#preview-play').textContent = libelle('Lire l\u2019aper\u00e7u', 'Aper\u00e7u');
    $('#export-video').textContent = libelle('Vid\u00e9o \u2014 le trac\u00e9 s\u2019anime', 'Vid\u00e9o');
    $('#export-seq').textContent = libelle('S\u00e9quence PNG \u2014 pour le montage', 'S\u00e9quence');
    $('#export').textContent = libelle('Enregistrer l’image', 'Enregistrer');
  }
  ETROIT.addEventListener('change', majLibelles);
  majLibelles();

  function majBoutons() {
    var bloque = !E.chargee || E.exportEnCours;
    ['#export', '#export-video', '#export-seq', '#preview-play'].forEach(function (sel) {
      $(sel).disabled = bloque;
    });
    /* Pendant un export, ce qui définit l'image ne doit plus bouger.
     *
     * La liste avait vieilli : les réglages GLOBAUX ajoutés depuis — teintes,
     * support, période — n'y figuraient pas, et changer « Teintes » pendant
     * un enregistrement vidéo basculait le film en cours en noir et blanc.
     *
     * Le catalogue, lui, ne se fige pas avec `disabled` : ses cartes posent
     * `#tpl.value` puis émettent l'événement elles-mêmes, et `disabled` ne
     * bloque que les gestes de l'utilisateur, pas un dispatchEvent. On le
     * neutralise donc par un drapeau, lu au moment du clic. */
    ['#size', '#tpl', '#collection', '#voile', '#minimal',
     '#rendu', '#support', '#photo-nb', '#periode'].forEach(function (sel) {
      var el = $(sel); if (el) el.disabled = E.exportEnCours;
    });
    var cat = $('#choix-style');
    if (cat) cat.classList.toggle('fige', E.exportEnCours);
  }

  /* La transparence du rendu courant. Elle ne dépend plus seulement du
   * template : les planches Alpage s'exportent au choix sur papier ou en
   * surcouche, et c'est une option. */
  function transparentCourant() {
    if (!E.current) return false;
    return Studio.estTransparent(E.current.id, resolvedOptions(E.current.id));
  }

  /* Sous l'aperçu : ce qu'on regarde exactement. */
  function caption(size) {
    var el = $('#stage-caption');
    if (!el) return;
    el.textContent = T(E.current.name) + ' · ' + size[0] + ' × ' + size[1] +
      (transparentCourant() ? ' · PNG transparent' : '');
  }

  /* Dessiner PUIS sauver. Les deux allaient ensemble dans `draw()`, ce qui
   * enregistrait un etat a chaque image de l'apercu anime. */
  function changement() { draw(); save(); }

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
    if (mode === 'photo' && E.photoURL) {
      sheet.style.backgroundImage = 'url("' + E.photoURL + '")';
    } else {
      sheet.className = (mode === 'photo' ? 'damier' : mode);
    }
  }

  /* ---------- panneau d'options du template ---------- */
  /* Sauvegarder est une réaction à un GESTE, pas à une image.
   *
   * `save()` était appelé à la fin de draw(). Or draw() est rappelé à chaque
   * image par l'aperçu animé et par le suivi audio : soixante
   * `JSON.stringify` et soixante écritures dans le stockage local PAR
   * SECONDE, pour un état qui n'a pas bougé. On sauvegarde donc aux
   * changements, là où il y a quelque chose de neuf à retenir. */

  /* ---------- essentiels et réglages fins ----------
   *
   * « Beaucoup trop d'options pour que ce soit tout de suite évident » :
   * c'est vrai, et la réponse n'est pas d'en retirer. Un template déclare
   * ses réglages dans l'ordre où il les juge importants — le premier est
   * presque toujours la composition. On montre donc les TROIS premiers,
   * et on replie le reste.
   *
   * Les couleurs descendent toujours dans le repli, quelle que soit leur
   * place : changer une teinte est un geste de finition, pas le geste par
   * lequel on découvre une planche.
   *
   * L'état du repli est retenu : sans cela, tout réglage marqué `reflow`
   * reconstruit le panneau et le referme sous les doigts. */
  var TETE = 3;
  var finsOuverts = false;

  function buildOptions() {
    var tpl = Studio.get($('#tpl').value);
    var box = $('#opts');
    box.innerHTML = '';

    var boiteCouleur = $('#opts-couleur');
    var boiteTexte = $('#opts-texte');
    if (boiteCouleur) boiteCouleur.innerHTML = '';
    if (boiteTexte) boiteTexte.innerHTML = '';

    var fins = document.createElement('details');
    fins.className = 'fins';
    fins.open = finsOuverts;
    fins.addEventListener('toggle', function () { finsOuverts = fins.open; });
    var resume = document.createElement('summary');
    fins.appendChild(resume);
    E.optionValues[tpl.id] = E.optionValues[tpl.id] || {};
    var vals = E.optionValues[tpl.id];
    var driven = Collections.driven(tpl.id, $('#collection').value);
    /* Un réglage qui ne change rien doit le dire. Le seuil en % du FTP est
     * inopérant sans FTP déclaré ou sans capteur : le laisser actif fait
     * croire qu'on règle quelque chose. */
    var inertes = (typeof tpl.inert === 'function' && E.chargee) ? (tpl.inert(effective(), vals) || []) : [];

    /* Le fond n'appartient plus au template quand le support global demande
     * une surcouche : son menu dirait le contraire de ce qui se passe. */
    var supportImpose = $('#support').value === 'surcouche';

    tpl.options.forEach(function (def, rang) {
      if (vals[def.key] === undefined) vals[def.key] = def.default;
      if (supportImpose && def.key === 'fond' && def.choices) return;

      var row = document.createElement('label');
      row.className = 'opt opt--' + def.type;
      var name = document.createElement('span');
      name.textContent = T(def.label || def.key);
      row.appendChild(name);

      var input;
      if (def.type === 'select') {
        input = document.createElement('select');
        def.choices.forEach(function (c) {
          var op = document.createElement('option');
          op.value = c[0]; op.textContent = T(c[1]);
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
        input = A.ordonnanceur(def, vals);
      } else {
        input = document.createElement('input');
        input.type = 'text';
        input.value = vals[def.key] || '';
      }

      input.addEventListener('input', function () {
        vals[def.key] = (def.type === 'toggle') ? input.checked
          : (def.type === 'range') ? parseFloat(input.value)
          : input.value;
        changement();
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
      /* Chaque réglage rejoint le réceptacle de sa NATURE, pas de son rang :
       * une couleur est une couleur, qu'elle soit déclarée en premier ou en
       * dernier. Sur téléphone ces réceptacles partent dans trois panneaux
       * différents ; sur un écran large ils se suivent. */
      var dest = def.type === 'color' ? (boiteCouleur || fins)
               : def.type === 'text' ? (boiteTexte || fins)
               : (rang < TETE ? box : fins);
      dest.appendChild(row);
    });

    var replies = fins.childElementCount - 1;      // le résumé ne compte pas
    if (replies > 0) {
      resume.textContent = T('Réglages fins') + ' (' + replies + ')';
      box.appendChild(fins);
    }
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
    if (!E.chargee) {
      $('#summary').innerHTML = '<span class="muted">' +
        T('Ta prochaine création commence par une sortie.') + '</span>';
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

  /* L'apostrophe en fait partie. Aujourd'hui toutes les interpolations sont
   * en position texte ou dans un attribut à guillemets doubles, donc elle ne
   * change rien ; le premier attribut écrit en '…' casserait la garantie
   * sans le moindre bruit. Une fonction d'échappement qui ne couvre pas tous
   * les délimiteurs est un piège qui attend son heure. */
  /* Le nom de la sortie, en morceau d'URL ou de nom de fichier.
   * Il vit dans le cœur et non dans un module : trois modules s'en servent —
   * le musée, les exports et les sources — et une quatrième copie serait la
   * vingt et unième `melange()` de ce dépôt. */
  function slug() {
    return String(effective().name).toLowerCase()
      .normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'sortie';
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function syncManualFields() {
    if (!E.chargee) {
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
    nomFichier('#gpx', T('Importer une sortie'),
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
      E.overrides = {};
      E.chargee = Library.count() > 0;
      $('#gpx-err').textContent = erreurs.join(' · ');
      apresChangement();
    }
  });

  $('#photo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) { Studio.setPhoto(null); E.photoURL = null; E.photoFile = null; draw(); return; }
    nomFichier('#photo', T('Ajouter une photo'), file.name);
    E.photoFile = file;
    E.photoURL = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      Studio.setPhoto(img);
      E.photoImg = img;
      $('#ground').value = 'photo';
      draw();
    };
    img.src = E.photoURL;
  });

  $('#photo-clear').addEventListener('click', function () {
    $('#photo').value = '';
    nomFichier('#photo', T('Ajouter une photo'));
    Studio.setPhoto(null);
    E.photoURL = null; E.photoImg = null; E.photoFile = null;
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
      E.overrides = {};
      E.chargee = true;
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
        $('#son-state').textContent = T('Lecture…');
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

  /* ---------- CE QUE LE CŒUR PRÊTE AUX MODULES ----------
   *
   * La liste n'est pas un choix d'esthétique : c'est exactement ce que la
   * mesure du couplage a montré — les noms que plusieurs sections empruntaient
   * au reste du fichier. Tout ce qui n'est pas ici est local à son morceau, et
   * doit le rester.
   *
   * Les modules les reprennent par `var draw = A.draw;` en tête de fichier.
   * Cela ne vaut QUE pour des fonctions et des constantes : une valeur qui
   * change se partage par `A.etat`, jamais par copie — voir les deux drapeaux
   * qui y sont, et pourquoi. */
  A.draw = draw;
  A.save = save;
  A.effective = effective;
  A.resolvedOptions = resolvedOptions;
  A.poseEtatGlobal = poseEtatGlobal;
  A.buildOptions = buildOptions;
  A.changement = changement;
  A.apresChangement = apresChangement;
  A.syncBibliotheque = syncBibliotheque;
  A.majPeriode = majPeriode;
  A.verrouiller = verrouiller;
  A.libelle = libelle;
  A.ground = ground;
  A.bouton = bouton;
  A.nomFichier = nomFichier;
  A.escapeHtml = escapeHtml;
  A.slug = slug;
  A.summary = summary;
  A.parseDuration = parseDuration;
  A.syncManualFields = syncManualFields;
  A.majPanneauSon = majPanneauSon;
  A.TELEPHONE = TELEPHONE;

  /* ---------- démarrage ----------
   *
   * IL NE S'EXÉCUTE PLUS ICI. Le studio est découpé en plusieurs fichiers, et
   * chacun d'eux se charge APRÈS celui-ci : un démarrage lancé au bas de
   * app.js appellerait des morceaux qui n'existent pas encore, et l'ordre des
   * balises <script> deviendrait une dépendance invisible que rien ne
   * rattraperait. On le dépose donc dans la file du noyau ; src/app/demarrage.js,
   * chargé en dernier, la vide. */
  A.auDemarrage(function () {
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
      { id: 'surcouche', label: 'Sur photo — voile compris' },
      { id: 'serie',     label: 'Séries — plusieurs sorties' }
    ];
    FAMILLES.forEach(function (f) {
      var og = document.createElement('optgroup');
      og.label = T(f.label);
      Studio.all().filter(function (t) { return t.famille === f.id; }).forEach(function (t) {
        var op = document.createElement('option');
        op.value = t.id; op.textContent = T(t.name);
        og.appendChild(op);
      });
      if (og.children.length) $('#tpl').appendChild(og);
    });

    /* LES COLLECTIONS, QUI N'ÉTAIENT NULLE PART.
     *
     * `<select id="collection">` était vide dans index.html et rien ne le
     * remplissait : huit palettes nommées existaient dans collections.js,
     * s'appliquaient correctement — `Collections.apply()` est appelé à chaque
     * rendu — et aucune n'était atteignable. Toute la couche « signature » du
     * studio était morte à l'écran.
     *
     * Le détail qui l'a rendue invisible : `$('#collection').value = …` sur un
     * menu vide ne lève rien et ne change rien. Le réglage sauvegardé était
     * donc relu, posé, et perdu en silence — le correctif d'à côté ne pouvait
     * pas fonctionner, et rien ne le disait. */
    Collections.list.forEach(function (c) {
      var op = document.createElement('option');
      op.value = c.id;
      /* LES NOMS DE COLLECTIONS SONT DES NOMS PROPRES — Alpage, Braise, Brume.
       * Ils ne passent pas par T(). Une première version les traduisait, et
       * « Papier », qui existe au dictionnaire comme nom de SUPPORT, ressortait
       * « Paper » au milieu de sept noms restés français : une clé partagée
       * traduisant un nom propre par accident. Seule la première entrée est une
       * phrase et non un nom — elle, se traduit. */
      op.textContent = c.id === 'libre' ? T(c.name) : c.name;
      $('#collection').appendChild(op);
    });

    if (saved.opts) E.optionValues = saved.opts;
    if (saved.tpl && Studio.get(saved.tpl).id === saved.tpl) $('#tpl').value = saved.tpl;
    if (saved.size && SIZES[saved.size]) $('#size').value = saved.size;
    if (saved.minimal) $('#minimal').checked = true;
    if (saved.rendu) $('#rendu').value = saved.rendu;
    if (saved.photoNb) $('#photo-nb').checked = true;
    if (saved.support) $('#support').value = saved.support;
    if (saved.voile) $('#voile').value = saved.voile;
    /* le menu part caché dans le HTML : au chargement, c'est le support
     * relu qui décide s'il doit apparaître */
    $('#opt-voile').hidden = $('#support').value !== 'surcouche';
    if (saved.periode) $('#periode').value = saved.periode;
    /* La collection était sauvée et jamais relue : c'était le seul réglage
     * global à se perdre au rechargement. */
    if (saved.collection) {
      $('#collection').value = saved.collection;
      var cInit = Collections.get(saved.collection);
      if (cInit) $('#collection-note').textContent = cInit.note ? T(cInit.note) : '';
    }
    $('#opt-photo-nb').hidden = $('#rendu').value !== 'nb';

    majPeriode();
    A.construitChoixStyle();
    A.majDisposition();

    /* La planche d'accueil : un vrai rendu, depuis l'exemple embarqué. Elle
     * n'entre PAS dans la bibliothèque — l'application reste vide tant que
     * l'utilisateur n'a rien chargé, et le studio ne prétend pas qu'il a
     * pédalé quelque part. */
    (function plancheAccueil() {
      var cv = $('#accueil-planche');
      if (!cv) return;
      fetch('exemple.gpx')
        .then(function (r) { return r.ok ? r.text() : null; })
        .then(function (txt) {
          if (!txt) return;
          var act = Activity.parseGPX(txt);
          Studio.setLibrary([]);
          Studio.render(cv, 'encre', act, { interpretation: 'trait' }, [300, 533]);
          syncBibliotheque();        // la scène retrouve son état réel
        })
        .catch(function () { cv.hidden = true; });
    }());
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
    /* ---------- ce qui a changé depuis la dernière visite ----------
     *
     * On retient le dernier numéro VU, pas la date : une date se compare mal
     * entre fuseaux, et surtout elle ne dit pas ce qu'on a lu. Le journal est
     * ordonné du plus récent au plus ancien ; on s'arrête au numéro retenu.
     *
     * Premier passage (rien de retenu) : on n'affiche RIEN. Accueillir un
     * nouveau venu par la liste de ce qu'il a manqué avant d'arriver n'a
     * aucun sens. */
    (function nouveautes() {
      var boite = $('#nouveautes');
      if (!boite || typeof STUDIO_JOURNAL === 'undefined') return;
      var CLE = 'strava-studio-vu';
      var vu = null;
      try { vu = localStorage.getItem(CLE); } catch (e) { /* mode privé */ }
      try { localStorage.setItem(CLE, STUDIO_VERSION); } catch (e) { /* tant pis */ }

      if (!vu || vu === STUDIO_VERSION) return;

      var neuf = [];
      for (var i = 0; i < STUDIO_JOURNAL.length; i++) {
        if (STUDIO_JOURNAL[i].v === vu) break;
        neuf.push(STUDIO_JOURNAL[i]);
      }
      if (!neuf.length) return;

      var liste = $('#nouveautes-liste');
      neuf.forEach(function (e) {
        var t = document.createElement('div');
        t.className = 'v';
        t.textContent = 'Version ' + e.v + ' · ' + e.d;
        liste.appendChild(t);
        var ul = document.createElement('ul');
        e.points.forEach(function (p) {
          var li = document.createElement('li');
          li.textContent = p;
          ul.appendChild(li);
        });
        liste.appendChild(ul);
      });
      boite.hidden = false;
      boite.querySelector('.titre').textContent =
        T('Depuis ta dernière visite') + ' · ' + neuf.length +
        (neuf.length > 1 ? ' ' + T('versions') : ' ' + T('version'));

      var voir = $('#nouveautes-voir');
      voir.addEventListener('click', function () {
        var ouvert = liste.hidden;
        liste.hidden = !ouvert;
        voir.textContent = ouvert ? T('Masquer') : T('Voir');
      });
      /* Fermer, c'est fermer POUR DE BON : le numéro courant est déjà retenu
       * plus haut, le bandeau ne reviendra pas pour cette version. */
      $('#nouveautes-fermer').addEventListener('click', function () { boite.hidden = true; });
    }());

    draw();
    A.stravaInit();
    // l'empreinte d'exploration est chargée en tâche de fond ; sans elle, la
    // planche « Territoires blancs » dirait qu'il n'y a pas d'historique
    A.majHistorique();
    A.majMusee();
    majPanneauSon();
  });

}());
