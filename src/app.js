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

  /* ---------- papier ou sombre ----------
   * Le papier est l'accueil : l'interface ressemble alors à ce qu'elle
   * fabrique. Le sombre reste à un doigt, parce qu'une planche nocturne se
   * juge mal sur du papier — c'est un choix de travail, pas une préférence
   * de confort. */
  (function theme() {
    var CLE = 'strava-studio-theme';
    var actuel = 'papier';
    try { actuel = localStorage.getItem(CLE) || 'papier'; } catch (e) { /* mode privé */ }
    function pose(t) {
      actuel = t;
      if (t === 'sombre') document.documentElement.setAttribute('data-theme', 'sombre');
      else document.documentElement.removeAttribute('data-theme');
      var meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', t === 'sombre' ? '#0A0A09' : '#F7F5EF');
      try { localStorage.setItem(CLE, t); } catch (e) { /* tant pis */ }
    }
    pose(actuel);
    $('#theme').addEventListener('click', function () {
      pose(actuel === 'sombre' ? 'papier' : 'sombre');
      draw();                      // le fond de contrôle dépend du thème
    });
  }());

  /* La page statique est traduite AVANT que quoi que ce soit de dynamique
   * ne soit construit : autrement le parcours des nœuds de texte retomberait
   * sur des libellés déjà traduits et n'en reconnaîtrait plus la clé. */
  I18N.appliquer(document.body);
  $('#langue').value = I18N.langue();
  $('#langue').addEventListener('change', function () { I18N.setLangue(this.value); });

  /* ---------- persistance légère ---------- */
  function save() {
    try {
      localStorage.setItem('strava-studio', JSON.stringify({
        tpl: $('#tpl').value, size: $('#size').value, opts: optionValues,
        collection: $('#collection').value, minimal: $('#minimal').checked,
        rendu: $('#rendu').value, photoNb: $('#photo-nb').checked,
        support: $('#support').value, periode: $('#periode').value
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
  /* `remplacantes` sert aux vignettes du catalogue : elles doivent montrer
   * une variante qui n'est pas encore choisie, tout en passant par la
   * collection comme la planche. */
  function resolvedOptions(tplId, remplacantes) {
    var vals = remplacantes || optionValues[tplId] || {};
    return Collections.apply(tplId, vals, $('#collection').value);
  }

  /* La bibliothèque est la source ; `base` n'en est que la sortie courante.
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
  }

  function syncBibliotheque() {
    Studio.setLibrary(entreesRetenues());
    if ($('#opt-periode')) majPeriode();
    /* Les vignettes du catalogue sont des rendus des sorties chargées : elles
     * doivent être refaites quand la bibliothèque change, sinon elles
     * continuent d'afficher « charge une sortie » après le chargement.
     *
     * Le garde portait sur `typeof construitChoixStyle` — il était toujours
     * vrai, une déclaration de fonction étant hoistée, et ne protégeait donc
     * de rien. Ce qui pourrait manquer, c'est la LISTE des groupes, déclarée
     * en `var` plus bas : c'est elle qu'on teste. */
    if (GROUPES_STYLE && $('#choix-style')) construitChoixStyle();
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
    if (!chargee) return;
    var size = SIZES[$('#size').value];
    var tplId = $('#tpl').value;
    /* Le rendu achromatique est posé AVANT le rendu, dans le moteur : un
     * filtre CSS sur l'aperçu ne suivrait pas dans toBlob et l'export
     * sortirait en couleur. */
    poseEtatGlobal();
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
  var enLecture = false;                 // drapeau declare AVANT sa premiere lecture
  function libelle(long, court) { return T(ETROIT.matches ? court : long); }
  function majLibelles() {
    if (enLecture) return;               // une lecture en cours a son propre libellé
    $('#preview-play').textContent = libelle('Lire l\u2019aper\u00e7u', 'Aper\u00e7u');
    $('#export-video').textContent = libelle('Vid\u00e9o \u2014 le trac\u00e9 s\u2019anime', 'Vid\u00e9o');
    $('#export-seq').textContent = libelle('S\u00e9quence PNG \u2014 pour le montage', 'S\u00e9quence');
    $('#export').textContent = libelle('Enregistrer l’image', 'Enregistrer');
  }
  ETROIT.addEventListener('change', majLibelles);
  majLibelles();

  function majBoutons() {
    var bloque = !chargee || exportEnCours;
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
    ['#size', '#tpl', '#collection', '#minimal',
     '#rendu', '#support', '#photo-nb', '#periode'].forEach(function (sel) {
      var el = $(sel); if (el) el.disabled = exportEnCours;
    });
    var cat = $('#choix-style');
    if (cat) cat.classList.toggle('fige', exportEnCours);
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
    el.textContent = T(current.name) + ' · ' + size[0] + ' × ' + size[1] +
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
  /* Sauvegarder est une réaction à un GESTE, pas à une image.
   *
   * `save()` était appelé à la fin de draw(). Or draw() est rappelé à chaque
   * image par l'aperçu animé et par le suivi audio : soixante
   * `JSON.stringify` et soixante écritures dans le stockage local PAR
   * SECONDE, pour un état qui n'a pas bougé. On sauvegarde donc aux
   * changements, là où il y a quelque chose de neuf à retenir. */
  function changement() { draw(); save(); }

  /* ---------- LA BARRE DU TÉLÉPHONE ----------
   *
   * Sous 900 px, la colonne de réglages cède la place à quatre panneaux qui
   * remontent du bas. Une seule décision occupe l'écran à la fois, et
   * l'aperçu reste visible pendant qu'on règle.
   *
   * Les contrôles ne sont pas DUPLIQUÉS : ils sont DÉPLACÉS. `appendChild`
   * sur un nœud existant le déplace avec ses écouteurs et ses références ;
   * les identifiants ne changent pas, donc tout le reste d'app.js continue
   * de les trouver. Dupliquer aurait demandé de tenir deux interfaces en
   * accord — et elles auraient divergé au premier réglage ajouté.
   *
   * Au-dessus de 900 px, tout revient dans la colonne. */
  var ZONES = {
    /* La sortie vit dans le panneau Style : sans elle, sur un téléphone où la
     * colonne est masquée, il n'y aurait AUCUN moyen d'importer un GPX ni de
     * choisir une activité — l'application serait jolie et inutilisable. */
    style:   ['#section-activite', '#choix-style', '#opt-collection', '#collection-note',
              '#opt-minimal', '#opts', '#section-garder'],
    teintes: ['#opt-teintes', '#opt-photo-nb', '#opt-support', '#section-fond', '#opts-couleur'],
    texte:   ['#opts-texte'],
    /* « Garder » rejoint le panneau Style : c'est ce qu'on fait d'une sortie
     * une fois qu'on en a une. Sans cela ces blocs restaient dans la colonne
     * masquée du téléphone — perdus deux fois. */
    /* Format porte aussi les SORTIES : aperçu animé, vidéo, séquence, son.
     * Elles vivaient dans le socle de la colonne — masqué sous 900 px — et
     * devenaient donc introuvables sur téléphone. Un contrôle resté dans un
     * conteneur qu'on cache ne disparaît pas de l'écran : il disparaît de
     * l'application. */
    format:  ['#rangee-format', '#preview-play', '#son', '#export-video',
              '#export-seq', '#video-state']
  };
  var placeOrigine = {};        // sélecteur -> { parent, suivant } avant déplacement
  var feuilleOuverte = null;

  function memorisePlace(sel) {
    if (placeOrigine[sel]) return;
    var el = document.querySelector(sel);
    if (!el) return;
    placeOrigine[sel] = { parent: el.parentNode, suivant: el.nextSibling };
  }

  function versPanneaux() {
    Object.keys(ZONES).forEach(function (z) {
      var zone = document.querySelector('#feuille .zone[data-zone="' + z + '"]');
      if (!zone) return;
      ZONES[z].forEach(function (sel) {
        var el = document.querySelector(sel);
        if (!el) return;
        memorisePlace(sel);
        zone.appendChild(el);
      });
    });
  }

  function versColonne() {
    Object.keys(ZONES).forEach(function (z) {
      ZONES[z].forEach(function (sel) {
        var el = document.querySelector(sel);
        var p = placeOrigine[sel];
        if (!el || !p || !p.parent) return;
        /* `insertBefore` lève si le voisin mémorisé n'est plus un enfant de ce
         * parent. Ça n'arrive pas aujourd'hui — ces nœuds sont fixes dans la
         * page — mais un échec ici casserait le retour à la colonne au moment
         * d'une rotation, et laisserait l'interface sans ses réglages. On
         * retombe donc sur la fin du parent : l'ordre change, rien ne
         * disparaît. */
        try {
          p.parent.insertBefore(el, p.suivant && p.suivant.parentNode === p.parent
            ? p.suivant : null);
        } catch (e) {
          p.parent.appendChild(el);
        }
      });
    });
  }

  function ouvreFeuille(z) {
    var f = $('#feuille');
    feuilleOuverte = z;
    Array.prototype.forEach.call(document.querySelectorAll('#feuille .zone'), function (el) {
      el.hidden = el.getAttribute('data-zone') !== z;
    });
    var titres = { style: 'Style', teintes: 'Teintes', texte: 'Texte', format: 'Format' };
    $('#feuille-titre').textContent = T(titres[z] || '');
    f.classList.toggle('large', z === 'style');
    f.hidden = false;
    Array.prototype.forEach.call(document.querySelectorAll('#barre button[data-feuille]'),
      function (b) { b.classList.toggle('on', b.getAttribute('data-feuille') === z); });
  }

  function fermeFeuille() {
    feuilleOuverte = null;
    $('#feuille').hidden = true;
    Array.prototype.forEach.call(document.querySelectorAll('#barre button[data-feuille]'),
      function (b) { b.classList.remove('on'); });
  }

  function majDisposition() {
    var petit = TELEPHONE.matches;
    $('#barre').hidden = !petit;
    if (petit) versPanneaux();
    else { fermeFeuille(); versColonne(); }
    document.body.classList.toggle('telephone', petit);
  }

  Array.prototype.forEach.call(document.querySelectorAll('#barre button[data-feuille]'),
    function (b) {
      b.addEventListener('click', function () {
        var z = b.getAttribute('data-feuille');
        if (feuilleOuverte === z) fermeFeuille(); else ouvreFeuille(z);
      });
    });
  $('#feuille-fermer').addEventListener('click', fermeFeuille);
  $('#feuille-voile').addEventListener('click', fermeFeuille);
  $('#barre-enregistrer').addEventListener('click', function () {
    fermeFeuille();
    $('#export').click();
  });
  TELEPHONE.addEventListener('change', majDisposition);

  /* ---------- LE CHOIX DE STYLE, EN DEUX TEMPS ----------
   *
   * Trente-trois noms dans un menu déroulant demandent de connaître le
   * catalogue par cœur. On montre donc d'abord des FAMILLES, avec une
   * vignette rendue depuis les sorties chargées — puis, une fois la famille
   * choisie, ses variantes.
   *
   * Les vignettes sont de vrais rendus, pas des images figées : elles
   * suivent la sortie, la couleur, le support et le noir & blanc en cours.
   * Une image figée aurait menti dès le premier réglage.
   *
   * Le regroupement est de la NAVIGATION, pas de la donnée : il vit ici et
   * non dans les templates, qui n'ont pas à connaître le rangement du
   * magasin. Tout template absent d'un groupe retombe dans « Autres » — en
   * ajouter un ne peut donc pas le faire disparaître de l'interface. */
  var GROUPES_STYLE = [
    { id: 'affiches', nom: 'Affiches',
      ids: ['encre', 'empreinte', 'mots', 'editorial', 'trace', 'chiffres',
            'allumettes', 'pente', 'radiale', 'sommet-ligne', 'sommet-barres'] },
    { id: 'cartes', nom: 'Cartes',
      ids: ['medaillon', 'atlas', 'metro', 'exploration'] },
    { id: 'reliefs', nom: 'Reliefs et données',
      ids: ['strates', 'ressenti', 'almanac', 'tissage'] },
    { id: 'souvenirs', nom: 'Souvenirs',
      ids: ['saisons', 'musee', 'serie', 'fresque'] },
    { id: 'films', nom: 'Films et son', ids: ['film', 'partition'] },
    { id: 'surcouches', nom: 'Surcouches',
      ids: ['ov-filet', 'ov-profil', 'ov-trace', 'ov-ardoise', 'ov-heros',
            'ov-tranche', 'ov-sommet-ligne', 'ov-sommet-barres'] }
  ];

  var groupeCourant = 'affiches';
  var familleOuverte = null;          // null = on regarde les familles

  /* La phrase sous le nom vient du template lui-même : « Encre — le geste
   * du terrain » se coupe en « Encre » et « le geste du terrain ». Aucune
   * liste de descriptions à tenir à jour en parallèle. */
  function nomEtDit(tpl) {
    var n = T(tpl.name);
    var i = n.indexOf(' — ');
    return i > 0 ? { nom: n.slice(0, i), dit: n.slice(i + 3) } : { nom: n, dit: '' };
  }

  /* La variante d'une famille : son premier menu, hors fond et voile qui
   * sont devenus des réglages globaux. */
  function optionVariante(tpl) {
    return (tpl.options || []).filter(function (d) {
      return d.type === 'select' && d.key !== 'fond' && d.key !== 'voile';
    })[0] || null;
  }

  /* Une vignette : un vrai rendu, en petit. On rend à 300 px de large et on
   * laisse le CSS réduire — en dessous, les textes des planches deviennent
   * des taches grises et toutes les familles se ressemblent. */
  function vignette(cv, tplId, valeurs) {
    var L = 300, H2 = Math.round(L * 16 / 9);
    /* Les réglages posés avant de peindre, comme pour la scène — sinon la
     * vignette ment d'un cran sur le noir & blanc et le support.
     *
     * Et surtout : les options passent par resolvedOptions(), donc par la
     * COLLECTION. Sans cela une collection choisie pilotait la planche mais
     * pas les vignettes, et la carte montrait autre chose que ce qu'elle
     * allait produire — exactement ce qu'un rendu vivant était censé éviter.
     *
     * Studio.render attrape déjà toute exception et peint une carte d'erreur :
     * pas de try/catch ici, il ne pourrait rien attraper. */
    poseEtatGlobal();
    Studio.render(cv, tplId, effective(), resolvedOptions(tplId, valeurs), [L, H2]);
  }

  function construitChoixStyle() {
    var boite = $('#choix-style');
    if (!boite) return;
    boite.innerHTML = '';
    /* Le damier derrière les vignettes quand le support est transparent :
     * sans lui, une encre sombre sur une carte sombre est invisible. */
    boite.classList.toggle('surcouche', $('#support').value === 'surcouche');
    var tousIds = Studio.all().map(function (t) { return t.id; });
    var ranges = {};
    GROUPES_STYLE.forEach(function (g) {
      g.ids.forEach(function (i) { ranges[i] = 1; });
    });
    var orphelins = tousIds.filter(function (i) { return !ranges[i]; });
    var groupes = GROUPES_STYLE.slice();
    if (orphelins.length) groupes.push({ id: 'autres', nom: 'Autres', ids: orphelins });

    if (familleOuverte) return construitVariantes(boite);

    var chips = document.createElement('div');
    chips.className = 'groupes-style';
    groupes.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = T(g.nom);
      b.className = g.id === groupeCourant ? 'on' : '';
      b.addEventListener('click', function () {
        groupeCourant = g.id; construitChoixStyle();
      });
      chips.appendChild(b);
    });
    boite.appendChild(chips);

    var grille = document.createElement('div');
    grille.className = 'familles';
    var g0 = groupes.filter(function (x) { return x.id === groupeCourant; })[0] || groupes[0];
    g0.ids.forEach(function (id) {
      var tpl = Studio.get(id);
      if (!tpl) return;
      var d = nomEtDit(tpl);
      var carte = document.createElement('button');
      carte.type = 'button';
      carte.className = 'carte-style' + (id === $('#tpl').value ? ' on' : '');
      var cv = document.createElement('canvas');
      carte.appendChild(cv);
      var nom = document.createElement('span');
      nom.className = 'nom'; nom.textContent = d.nom;
      carte.appendChild(nom);
      if (d.dit) {
        var dit = document.createElement('span');
        dit.className = 'dit'; dit.textContent = d.dit;
        carte.appendChild(dit);
      }
      carte.addEventListener('click', function () {
        if (exportEnCours) return;          // un export en cours a la priorité
        $('#tpl').value = id;
        $('#tpl').dispatchEvent(new Event('change'));
        familleOuverte = optionVariante(tpl) ? id : null;
        construitChoixStyle();
      });
      grille.appendChild(carte);
      vignette(cv, id, (optionValues[id] || {}));
    });
    boite.appendChild(grille);
  }

  function construitVariantes(boite) {
    var tpl = Studio.get(familleOuverte);
    var def = tpl && optionVariante(tpl);
    if (!tpl || !def) { familleOuverte = null; return construitChoixStyle(); }

    var retour = document.createElement('button');
    retour.type = 'button';
    retour.className = 'retour-familles';
    retour.textContent = '← ' + T('Toutes les familles');
    retour.addEventListener('click', function () {
      familleOuverte = null; construitChoixStyle();
    });
    boite.appendChild(retour);

    var vals = optionValues[tpl.id] || (optionValues[tpl.id] = {});
    var grille = document.createElement('div');
    grille.className = 'variantes';
    def.choices.forEach(function (c) {
      var carte = document.createElement('button');
      carte.type = 'button';
      carte.className = 'carte-style' + (String(vals[def.key]) === String(c[0]) ? ' on' : '');
      var cv = document.createElement('canvas');
      carte.appendChild(cv);
      var nom = document.createElement('span');
      nom.className = 'nom';
      /* Le nom seul : « Original · Sceau — disque décentré » dans une carte
       * de cent-cinquante pixels ne se lit pas. L'histoire du développement
       * (Original / Exploration) n'a rien à faire dans le parcours. */
      var lib = T(c[1]).replace(/^(Original|Exploration)\s*·\s*/, '').split(' — ')[0];
      nom.textContent = lib;
      carte.appendChild(nom);
      carte.addEventListener('click', function () {
        if (exportEnCours) return;
        vals[def.key] = c[0];
        buildOptions();
        construitChoixStyle();
        draw();
        save();
      });
      grille.appendChild(carte);
      var apercu = {};
      Object.keys(vals).forEach(function (k) { apercu[k] = vals[k]; });
      apercu[def.key] = c[0];
      vignette(cv, tpl.id, apercu);
    });
    boite.appendChild(grille);
  }

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
    optionValues[tpl.id] = optionValues[tpl.id] || {};
    var vals = optionValues[tpl.id];
    var driven = Collections.driven(tpl.id, $('#collection').value);
    /* Un réglage qui ne change rien doit le dire. Le seuil en % du FTP est
     * inopérant sans FTP déclaré ou sans capteur : le laisser actif fait
     * croire qu'on règle quelque chose. */
    var inertes = (typeof tpl.inert === 'function' && chargee) ? (tpl.inert(effective(), vals) || []) : [];

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
    def.items.forEach(function (it) { libelles[it[0]] = T(it[1]); });

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
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
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
      overrides = {};
      chargee = Library.count() > 0;
      $('#gpx-err').textContent = erreurs.join(' · ');
      apresChangement();
    }
  });

  $('#photo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    if (!file) { Studio.setPhoto(null); photoURL = null; photoFile = null; draw(); return; }
    nomFichier('#photo', T('Ajouter une photo'), file.name);
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
    nomFichier('#photo', T('Ajouter une photo'));
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
        Musee.supprimer(p.id).then(function () { return majMusee(T('Pièce retirée.')); });
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
          .then(function () { return majMusee(T('Pièce ajoutée — le cartel reste à écrire.')); })
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
      return majMusee(T('Pièce créée.'));
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
        ? emp.sorties + ' ' + T('sorties de référence') + ' · ' + Math.round(emp.km) + ' km · ' +
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
      .then(function () { return majHistorique(T('Historique effacé.')); })
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
        support: $('#support').value, periode: $('#periode').value,
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
    /* `Studio.get` ne rend JAMAIS null — il retombe sur le premier template
     * du registre. La garde était donc toujours vraie, et un projet portant
     * un identifiant inconnu posait une valeur que le menu ne connaît pas :
     * `select.value` devient '', et tout le reste retombe silencieusement
     * sur Encre. On compare l'identifiant rendu à celui demandé, comme le
     * fait déjà la restauration depuis le stockage local. */
    if (p.reglages.tpl && Studio.get(p.reglages.tpl).id === p.reglages.tpl) {
      $('#tpl').value = p.reglages.tpl;
    }
    if (p.reglages.size && SIZES[p.reglages.size]) $('#size').value = p.reglages.size;
    if (p.reglages.collection) $('#collection').value = p.reglages.collection;
    if (p.reglages.minimal != null) $('#minimal').checked = !!p.reglages.minimal;
    if (p.reglages.rendu) $('#rendu').value = p.reglages.rendu;
    if (p.reglages.support) $('#support').value = p.reglages.support;
    /* La période décide QUELLES sorties composent la planche : sans elle, un
     * projet multi-sorties se rouvrait sur une autre sélection que celle
     * qu'on avait enregistrée. C'est le réglage qui change le plus ce qu'on
     * voit, et c'était le seul à manquer à l'appel. */
    if (p.reglages.periode) $('#periode').value = p.reglages.periode;
    /* Le catalogue repart des familles : rester sur les variantes d'une
     * famille qui n'est plus la bonne n'a aucun sens. */
    familleOuverte = null;
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
    reader.onerror = function () { note.textContent = T('Lecture impossible.'); };
    reader.readAsText(file);
  });

  /* ---------- vidéo de fond ---------- */
  $('#bgvideo').addEventListener('change', function (e) {
    var file = e.target.files[0];
    var note = $('#bgvideo-state');
    if (!file) { bgVideo = null; note.textContent = ''; return; }
    nomFichier('#bgvideo', T('Ajouter une vidéo'), file.name);
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

  $('#minimal').addEventListener('change', changement);
  $('#tpl').addEventListener('change', function () {
    buildOptions(); majPeriode(); changement();
  });
  /* Le catalogue se reconstruit quand la sortie change : les vignettes sont
   * des rendus de CETTE sortie, pas des images d'illustration.
   *
   * Ces trois-là ont déjà leur écouteur plus bas (majRendu, majSupport, la
   * collection) : un second écouteur ici doublait le travail — deux
   * redessins complets et N rendus hors écran pour un seul geste. On
   * appelle donc depuis leur gestionnaire existant. */
  $('#photo-nb').addEventListener('change', function () {
    construitChoixStyle();
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
    $('#collection-note').textContent = c.note || '';
    buildOptions();
    construitChoixStyle();      // les vignettes suivent la collection
    draw();
    save();
  });

  /* ---------- export vidéo ---------- */
  /* Rendu couleur / noir & blanc. Le réglage « photo aussi » ne s'affiche
   * qu'en noir et blanc : ailleurs il ne ferait rien. */
  function majRendu() {
    var nb = $('#rendu').value === 'nb';
    $('#opt-photo-nb').hidden = !nb;
    construitChoixStyle();
    changement();
  }
  $('#rendu').addEventListener('change', majRendu);

  /* Changer de support change ce qu'on voit DERRIÈRE la planche autant que
   * la planche elle-même : le fond de contrôle et les options propres au
   * template suivent. */
  function majSupport() {
    buildOptions();
    construitChoixStyle();
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
    enLecture = false;
    $('#preview-play').textContent = libelle('Lire l’aperçu', 'Aperçu');
    Studio.setProgress(1, 1);
    draw();
  }
  $('#preview-play').addEventListener('click', function () {
    if (lecture) return arreteLecture();
    if (!chargee) return;
    var horloge = Studio.chrono($('#tpl').value, resolvedOptions($('#tpl').value));
    var t0 = performance.now();
    enLecture = true;
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
      stravaState(T('intervals.icu — connecté'));
      $('#strava-refresh').style.display = '';
      loadList();
      return;
    }

    if (st && st.configured && st.authorized) {
      source = 'strava';
      /* Le prénom vient de l'API et part dans innerHTML : il s'échappe, comme
       * tout ce qui n'a pas été écrit ici. C'est la seule chaîne de cette
       * fonction qui ne soit pas de nous. */
      stravaState(T('Strava — connecté') +
        (st.athlete && st.athlete.firstname ? ' · ' + escapeHtml(st.athlete.firstname) : ''));
      $('#strava-refresh').style.display = '';
      loadList();
      return;
    }

    if (st && st.configured && !st.authorized) {
      stravaState('Strava — <a href="/connect">connecter mon compte</a> ' +
        '(portée <code>' + escapeHtml(st.scope) + '</code>, obligatoire pour lire les activités).');
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
    stravaState(T('intervals.icu — connecté depuis ce navigateur'));
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
    /* Pas de lien : rien n'a jamais écouté ce `#re`. Le formulaire revient
     * de lui-même quand la clé est refusée. */
    if (e.message === 'CLE_REFUSEE') return T('intervals.icu — clé refusée.');
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
      sel.innerHTML = '<option value="">' + T('— choisir une sortie —') + '</option>' +
        stravaActs.map(function (x) {
          var d = new Date(x.start_date_local);
          /* L'identifiant vient de l'API, comme le nom : il s'échappe aussi.
           * Un guillemet sortirait de l'attribut. */
          return '<option value="' + escapeHtml(x.id) + '">' +
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
      stravaState(T(source === 'icu-web' ? 'intervals.icu — connecté depuis ce navigateur'
        : source === 'icu' ? 'intervals.icu — connecté' : 'Strava — connecté'));
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
    /* `var slug = …` masquait ici la fonction `slug()` du même nom, avec
     * le même corps à une écriture près. Deux assainissements de nom de
     * fichier, c'est deux comportements qui finiront par diverger. */
    Studio.exportPNG(canvas, slug() + '_' + current.id + '_' + size[0] + 'x' + size[1] + '.png');
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
    og.label = T(f.label);
    Studio.all().filter(function (t) { return t.famille === f.id; }).forEach(function (t) {
      var op = document.createElement('option');
      op.value = t.id; op.textContent = T(t.name);
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
  if (saved.support) $('#support').value = saved.support;
  if (saved.periode) $('#periode').value = saved.periode;
  /* La collection était sauvée et jamais relue : c'était le seul réglage
   * global à se perdre au rechargement. */
  if (saved.collection) {
    $('#collection').value = saved.collection;
    var cInit = Collections.get(saved.collection);
    if (cInit) $('#collection-note').textContent = cInit.note || '';
  }
  $('#opt-photo-nb').hidden = $('#rendu').value !== 'nb';

  majPeriode();
  construitChoixStyle();
  majDisposition();

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
  stravaInit();
  // l'empreinte d'exploration est chargée en tâche de fond ; sans elle, la
  // planche « Territoires blancs » dirait qu'il n'y a pas d'historique
  majHistorique();
  majMusee();
  majPanneauSon();
}());
