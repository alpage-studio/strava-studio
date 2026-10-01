/* page.js — la page du carnet : déposer, composer, caler, exporter.
 *
 * Deux entrées, un même objet `entree` (voir composer.js) :
 *   - des fichiers déposés : on lit l'EXIF ici, les images restent des blob: ;
 *   - ?manifeste=chemin.json, servi en http : un carnet préparé, le temps
 *     du prototype.
 *
 * Les calages et les légendes saisis se gardent dans le navigateur, par
 * carnet. Ils ne sont qu'une commodité : le carnet exporté les emporte.
 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var entree = null, lecteur = null, edition = false;

  /* ---------- les deux langues ----------
   * L'INTERFACE (ce qu'on lit pour travailler : boutons, messages, cet écran)
   * passe par le dictionnaire commun, src/i18n.js, dont la clé est la phrase
   * française. Les IMAGES (le carnet lui-même, le carrousel, le Reel) suivent
   * Langue.images() : elles se redessinent quand on la change. Les données de
   * la personne — titre, lieux, légendes — ne se traduisent jamais. */
  var T = window.T || function (s) { return s; };
  function langueUI() { return (window.Langue && Langue.interface()) || 'fr'; }
  function langueImages() { return (window.Langue && Langue.images()) || 'fr'; }
  // un mot DESSINÉ sur les images (un nom d'étape par défaut) : langue des images
  function motImage(k, v) {
    return window.Langue ? Langue.mot(k, v) : k.replace(/\{(\w+)\}/g, function (t, x) { return v && v[x] != null ? String(v[x]) : t; });
  }
  // une phrase traduite, ses emplacements {x} remplis ensuite : l'ordre des mots change d'une langue à l'autre
  function TT(k, v) {
    var s = T(k);
    if (!v) return s;
    return s.replace(/\{(\w+)\}/g, function (tout, x) { return v[x] != null ? String(v[x]) : tout; });
  }
  // un pluriel selon la langue de l'INTERFACE : le français met 0 et 1 au singulier, l'anglais seul 1
  function TN(n, un, plusieurs, v) {
    var seul = langueUI() === 'fr' ? Math.abs(n) < 2 : n === 1;
    var w = { n: n };
    if (v) Object.keys(v).forEach(function (k) { w[k] = v[k]; });
    return TT(seul ? un : plusieurs, w);
  }
  // un nombre de l'interface : « 12,5 » en français, « 12.5 » en anglais
  function nb(x, dec) {
    return window.Langue ? Langue.nombre(x, dec, langueUI()) : (+x).toFixed(dec || 0).replace('.', ',');
  }
  // le carnet parle la langue des images ; MOTS_EN arrive avec le lecteur, s'il est là
  function poserLangue(data) {
    var l = langueImages();
    data.langue = l;
    data.mots = (l === 'en' && window.CarnetLecteur && CarnetLecteur.MOTS_EN) || null;
    return data;
  }

  // le texte statique de la page, une fois : les sélecteurs de langue d'abord,
  // pour que leur libellé soit traduit avec le reste
  if (window.Langue) Langue.monter();
  if (window.I18N) I18N.appliquer();
  // le titre de l'onglet, « Carnet — alpage », est un nom propre : il ne se traduit pas
  // (T() le rendrait « Notebook — alpage » par la règle de la tête « X — … »)
  // une phrase coupée par un <b> : traduite entière
  $('dCarnet').innerHTML = T('Un carnet déjà enregistré (fichier <b>.carnet</b>) se rouvre de la même façon.');

  function note(txt, ms) {
    var n = $('note');
    n.textContent = txt; n.classList.add('vue');
    clearTimeout(note.t);
    note.t = setTimeout(function () { n.classList.remove('vue'); }, ms || 3200);
  }

  /* ---------- la mémoire des calages ---------- */
  /* la clé de stockage d'un carnet : une empreinte de sa TRACE et son nombre
   * de photos. Elle dépendait du titre — renommer le voyage aurait perdu tous
   * les calages et tous les réglages du panneau. */
  var empreinteDe = { gpx: null, k: '' };
  function cle() {
    if (empreinteDe.gpx !== entree.gpx) {
      var h = 5381, t = entree.gpx || '';
      for (var i = 0; i < t.length; i += 7) h = ((h * 33) ^ t.charCodeAt(i)) >>> 0;
      empreinteDe = { gpx: entree.gpx, k: h.toString(36) + '-' + t.length.toString(36) };
    }
    return 'carnet:' + empreinteDe.k + ':' + entree.medias.length;
  }
  function sauver() {
    var c = {};
    entree.medias.forEach(function (m) { if (m.km != null || m.legende) c[m.id] = { km: m.km, source: m.source || null, legende: m.legende || '' }; });
    try { localStorage.setItem(cle(), JSON.stringify(c)); } catch (e) { /* navigation privée */ }
  }
  function restaurer() {
    restaurerVoyage();
    var c = null;
    try { c = JSON.parse(localStorage.getItem(cle()) || 'null'); } catch (e) { c = null; }
    if (!c) return;
    entree.medias.forEach(function (m) {
      if (!c[m.id]) return;
      if (c[m.id].km != null) { m.km = c[m.id].km; m.source = c[m.id].source || m.source || 'main'; }
      if (c[m.id].legende) m.legende = c[m.id].legende;
    });
  }

  /* ---------- rendre ---------- */
  function rendre(garderId) {
    var data;
    try { data = poserLangue(Composer.composer(entree)); }
    catch (e) { $('etat').textContent = e.message; return; }
    var repere = garderId && document.querySelector('.cr-fig[data-id="' + garderId + '"]');
    var avant = repere ? repere.getBoundingClientRect().top : null;

    $('accueil').hidden = true;
    $('outils').hidden = false;
    lecteur = CarnetLecteur.monter($('carnet'), data);
    lecteur.data = data;
    // combien de positions restent à valider : le bouton le dit
    var aValider = data.medias.filter(function (m) { return m.statut === 'estimee'; }).length;
    $('bCaler').textContent = aValider ? TT('Caler les photos · {n} à valider', { n: aValider }) : T('Caler les photos · tout est validé');
    $('bRelief').hidden = !!entree.relief;   // la topo se prépare une fois, puis voyage avec le carnet
    if (edition) lecteur.racine.classList.add('cr-edition');
    poserCalage(data);

    if (garderId) {
      var apres = document.querySelector('.cr-fig[data-id="' + garderId + '"]');
      if (apres && avant != null) window.scrollBy(0, apres.getBoundingClientRect().top - avant);
    }
  }

  /* ---------- le calage ----------
   * Sous chaque image, un curseur qui la déplace le long du parcours. La
   * lâcher en fait une ANCRE : les photos voisines se replacent entre les
   * ancres. Une photo non calée est encadrée en pointillés. */
  function poserCalage(data) {
    var total = data.total.km;
    document.querySelectorAll('.cr-fig').forEach(function (f) {
      var m = data.medias.filter(function (x) { return x.id === f.dataset.id; })[0];
      var src = entree.medias.filter(function (x) { return x.id === f.dataset.id; })[0];
      if (!m || !src) return;
      f.classList.add(m.ancre ? 'ancre' : 'estime');
      var heure = m.t ? new Date(m.t).toLocaleString(langueUI() === 'en' ? 'en-GB' : 'fr-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : T('sans heure');
      var libelle = { gps: T('localisée · GPS'), confirmee: T('confirmée'), estimee: T('estimée par l’heure') }[m.statut];
      var b = document.createElement('div');
      b.className = 'calage';
      b.innerHTML = '<span><span class="statut ' + m.statut + '">' + libelle +
        '</span> · km <output>' + nb(m.km, 1) + '</output> · ' + heure + '</span>' +
        (m.ancre ? '<button type="button" class="lib">' + esc(T('libérer')) + '</button>' : '<button type="button" class="conf">' + esc(T('confirmer ici')) + '</button>') +
        '<input type="range" min="0" max="' + total.toFixed(1) + '" step="0.1" value="' + m.km.toFixed(1) + '">' +
        '<input type="text" placeholder="' + esc(T('Légende (sinon : le repère le plus proche)')) + '" value="' + (src.legende || '').replace(/"/g, '&quot;') + '">';
      f.appendChild(b);
      var r = b.querySelector('input[type=range]'), o = b.querySelector('output');
      r.addEventListener('input', function () { o.textContent = nb(+r.value, 1); });
      r.addEventListener('change', function () { src.km = +r.value; src.source = 'main'; sauver(); rendre(m.id); note(TT('Photo confirmée au km {km} — les voisines se replacent.', { km: nb(+r.value, 1) })); });
      var lib = b.querySelector('.lib');
      if (lib) lib.addEventListener('click', function () { delete src.km; delete src.source; sauver(); rendre(m.id); });
      // l'estimation est juste : on la confirme telle quelle, elle devient une ancre
      var conf = b.querySelector('.conf');
      if (conf) conf.addEventListener('click', function () { src.km = +m.km.toFixed(2); src.source = 'main'; sauver(); rendre(m.id); note(TT('Position confirmée au km {km}.', { km: nb(m.km, 1) })); });
      var t = b.querySelector('input[type=text]');
      t.addEventListener('change', function () { src.legende = t.value.trim(); sauver(); rendre(m.id); });
    });
  }

  $('bCaler').addEventListener('click', function () {
    edition = !edition;
    this.setAttribute('aria-pressed', String(edition));
    lecteur.racine.classList.toggle('cr-edition', edition);
    if (edition) note(T('Déplace une photo le long du parcours : elle devient une ancre, et les autres se replacent autour.'), 4800);
  });

  /* ---------- l'écran « Le voyage » ----------
   * Le titre, les étapes et les noms des repères. Un GPX déposé n'apporte que
   * son nom de fichier ou celui que Komoot lui a donné, des étapes appelées
   * « Départ » et « Arrivée », et des repères en anglais. Cet écran les règle
   * en une fois, juste après le dépôt, puis depuis le bouton « Le voyage ».
   *
   * Les étapes se décrivent par leurs LIEUX : le départ, chaque nuit et son
   * kilomètre, l'arrivée. Une étape va d'un lieu au suivant : écrire « Ollomont »
   * une fois suffit pour finir le jour 1 et commencer le jour 2. */
  var vLieux = [], vReps = [];

  function fmtKm(km) { return nb(km, 1); }
  function fmtM(m) { return m == null ? '—' : nb(m, 0) + ' m'; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'); }

  function estBoucle() {
    var T = lecteur && lecteur.data && lecteur.data.trace;
    if (!T) return false;
    var n = T.x.length - 1;
    return Math.hypot(T.x[0] - T.x[n], T.y[0] - T.y[n]) * T.kmParUnite < 1.5;
  }

  function ouvrirVoyage(premiere) {
    if (!entree || !lecteur) return;
    var P = Composer.profilBrut(entree.gpx), data = lecteur.data;
    vLieux = [{ nom: data.etapes[0].de, km: 0 }].concat(data.etapes.map(function (et) { return { nom: et.a, km: et.kmFin }; }));
    vLieux[vLieux.length - 1].km = P.total;
    $('vTitre').value = entree.titre || data.titre || '';
    $('vSous').value = entree.sousTitre || '';
    $('vNb').value = String(Math.min(5, data.etapes.length));
    $('vBoucle').checked = estBoucle() && vLieux[0].nom === vLieux[vLieux.length - 1].nom || (premiere && estBoucle());
    var noms = entree.noms || {};
    vReps = Composer.reperesBruts(entree.gpx).map(function (r) {
      var garde = noms[r.nom] !== null && r.surLeChemin;
      return { orig: r.nom, nom: noms[r.nom] || r.nom, garde: garde, km: r.km, alt: r.alt, ecart: r.ecart, surLeChemin: r.surLeChemin };
    });
    dessinerLieux(P);
    dessinerReperes();
    $('vTitreEcran').textContent = premiere ? T('Le voyage — avant de commencer') : T('Le voyage');
    $('voyage').hidden = false;
    $('vTitre').focus();
  }

  function dessinerLieux(P) {
    P = P || Composer.profilBrut(entree.gpx);
    var box = $('vLieux'), n = vLieux.length - 1, boucle = $('vBoucle').checked;
    box.innerHTML = '';
    vLieux.forEach(function (l, i) {
      var d = document.createElement('div');
      d.className = 'v-lieu';
      var quoi = i === 0 ? T('Départ') : i === n ? T('Arrivée') : TT('Nuit {n}', { n: i });
      var mirroir = i === n && boucle;
      d.innerHTML = '<span class="quoi">' + quoi + '</span>' +
        '<input type="text" value="' + esc(mirroir ? vLieux[0].nom : l.nom) + '"' + (mirroir ? ' disabled title="' + esc(T('Une boucle revient à son départ')) + '"' : '') + ' aria-label="' + esc(quoi) + '">' +
        '<span class="ou">' + (i > 0 && i < n
          ? 'km <input type="number" min="1" max="' + Math.floor(P.total - 1) + '" step="0.1" value="' + l.km.toFixed(1) + '" aria-label="' + esc(TT('Kilomètre de la nuit {n}', { n: i })) + '"> <span class="alt">' + fmtM(P.alt(l.km)) + '</span>'
          : 'km ' + fmtKm(l.km) + ' · ' + fmtM(P.alt(l.km))) + '</span>';
      var t = d.querySelector('input[type=text]');
      t.addEventListener('input', function () { l.nom = t.value; if (i === 0 && boucle) dessinerLieux(P); });
      var k = d.querySelector('input[type=number]');
      if (k) k.addEventListener('change', function () {
        var lo = vLieux[i - 1].km + 1, hi = vLieux[i + 1].km - 1;
        l.km = Math.max(lo, Math.min(hi, +k.value || l.km));
        k.value = l.km.toFixed(1);
        d.querySelector('.alt').textContent = fmtM(P.alt(l.km));
      });
      box.appendChild(d);
    });
  }

  // un autre nombre d'étapes : les nuits se replacent au point le plus bas de
  // chaque tronçon — un voyage en montagne dort en vallée —, les noms restent
  function changerNombre() {
    var P = Composer.profilBrut(entree.gpx), n = +$('vNb').value, anciens = vLieux.slice(1, -1);
    var milieu = [];
    for (var k = 1; k < n; k++) {
      var km = P.plusBas(P.total * (k - 0.5) / n, P.total * (k + 0.5) / n);
      milieu.push({ nom: anciens[k - 1] ? anciens[k - 1].nom : motImage('Étape {n}', { n: k + 1 }), km: km });
    }
    vLieux = [vLieux[0]].concat(milieu, [vLieux[vLieux.length - 1]]);
    dessinerLieux(P);
  }

  function dessinerReperes() {
    var box = $('vReperes');
    box.innerHTML = '';
    vReps.forEach(function (r) {
      var d = document.createElement('div');
      d.className = 'v-rep' + (r.garde ? '' : ' retire') + (r.surLeChemin ? '' : ' horschemin');
      d.innerHTML = '<input type="checkbox"' + (r.garde ? ' checked' : '') + (r.surLeChemin ? '' : ' disabled') + ' aria-label="' + esc(T('Garder ce repère')) + '">' +
        '<span><input type="text" value="' + esc(r.nom) + '" aria-label="' + esc(T('Nom du repère')) + '">' +
        (r.nom !== r.orig ? '<span class="orig">' + TT('Komoot : {nom}', { nom: esc(r.orig) }) + '</span>' : '') + '</span>' +
        '<span class="ou">' + (r.surLeChemin
          ? 'km ' + fmtKm(r.km) + '<br>' + esc(TT('passage à {alt}', { alt: fmtM(r.alt) }))
          : esc(TT('à {km} km du chemin', { km: nb(r.ecart / 1000, 1) })) + '<br>' + esc(T('non posé'))) + '</span>';
      var c = d.querySelector('input[type=checkbox]'), t = d.querySelector('input[type=text]');
      c.addEventListener('change', function () { r.garde = c.checked; d.classList.toggle('retire', !r.garde); majCompte(); });
      t.addEventListener('change', function () { r.nom = t.value.trim() || r.orig; dessinerReperes(); });
      box.appendChild(d);
    });
    majCompte();
  }
  function majCompte() {
    var g = vReps.filter(function (r) { return r.garde; }).length;
    $('vCompte').textContent = '· ' + TN(g, '{n} gardé sur {total}', '{n} gardés sur {total}', { total: vReps.length });
    majFrancais();
  }
  /* « Proposer en français » traduit des noms Komoot vers le français : il n'a
   * de sens que pour des images en français */
  function majFrancais() { $('vFrancais').hidden = !vReps.length || langueImages() !== 'fr'; }

  // seuls les noms encore D'ORIGINE reçoivent une proposition : un nom déjà
  // écrit à la main n'est jamais remplacé
  $('vFrancais').addEventListener('click', function () {
    var n = 0;
    vReps.forEach(function (r) { if (r.nom === r.orig) { var p = Noms.proposer(r.orig); if (p !== r.orig) { r.nom = p; n++; } } });
    dessinerReperes();
    note(n ? TN(n, '{n} nom proposé en français — relis-le avant d’appliquer.', '{n} noms proposés en français — relis-les avant d’appliquer.')
           : T('Aucun nom à traduire : tous sont déjà en français ou écrits à la main.'), 4500);
  });
  $('vNb').addEventListener('change', changerNombre);
  $('vBoucle').addEventListener('change', function () { dessinerLieux(); });
  $('vAnnuler').addEventListener('click', function () { $('voyage').hidden = true; });
  $('voyage').addEventListener('keydown', function (e) { if (e.key === 'Escape') $('voyage').hidden = true; });
  $('bVoyage').addEventListener('click', function () { ouvrirVoyage(false); });

  $('vAppliquer').addEventListener('click', function () {
    var boucle = $('vBoucle').checked, n = vLieux.length - 1;
    var noms = vLieux.map(function (l, i) { return (i === n && boucle ? vLieux[0].nom : l.nom).trim() || (i === 0 ? motImage('Départ') : i === n ? motImage('Arrivée') : motImage('Étape {n}', { n: i + 1 })); });
    entree.titre = $('vTitre').value.trim() || entree.titre;
    entree.sousTitre = $('vSous').value.trim();
    entree.etapes = vLieux.slice(1).map(function (l, i) { return { de: noms[i], a: noms[i + 1], finKm: +l.km.toFixed(2) }; });
    entree.noms = {};
    vReps.forEach(function (r) { if (!r.garde) entree.noms[r.orig] = null; else if (r.nom !== r.orig) entree.noms[r.orig] = r.nom; });
    sauverVoyage();
    $('voyage').hidden = true;
    rendre();
    if (!$('horizon').hidden) { hRendre(); hMoments(); }
    var gardes = vReps.filter(function (r) { return r.garde; }).length;
    note(TN(entree.etapes.length, 'Voyage mis à jour : {n} étape, {reperes}.', 'Voyage mis à jour : {n} étapes, {reperes}.',
      { reperes: TN(gardes, '{n} repère', '{n} repères') }), 4000);
  });

  // le voyage se garde avec les calages, et part dans le fichier .carnet avec l'entrée
  function sauverVoyage() {
    try {
      localStorage.setItem(cle() + ':voyage', JSON.stringify({ titre: entree.titre, sousTitre: entree.sousTitre, etapes: entree.etapes, noms: entree.noms }));
    } catch (e) { /* navigation privée */ }
  }
  function restaurerVoyage() {
    var v = null;
    try { v = JSON.parse(localStorage.getItem(cle() + ':voyage') || 'null'); } catch (e) { v = null; }
    if (!v) return false;
    ['titre', 'sousTitre', 'etapes', 'noms'].forEach(function (k) { if (v[k] != null) entree[k] = v[k]; });
    return true;
  }

  /* ---------- déposer des fichiers ---------- */
  function dims(url) {
    return new Promise(function (ok) {
      var i = new Image();
      i.onload = function () { ok([i.naturalWidth, i.naturalHeight]); };
      i.onerror = function () { ok([4, 3]); };
      i.src = url;
    });
  }

  function lireFichiers(files) {
    files = Array.prototype.slice.call(files);
    // un carnet enregistré se rouvre tel quel
    var carnet = files.filter(function (f) { return /\.carnet$/i.test(f.name); })[0];
    if (carnet) return rouvrirCarnet(carnet);
    var gpx = files.filter(function (f) { return /\.gpx$/i.test(f.name); });
    var imgs = files.filter(function (f) { return /\.(jpe?g)$/i.test(f.name) || f.type === 'image/jpeg'; });
    var vids = files.filter(function (f) { return /\.(mov|mp4)$/i.test(f.name); });
    if (!gpx.length) { $('etat').textContent = T('Il manque le GPX du parcours.'); return; }
    $('etat').textContent = TN(imgs.length, 'Lecture de {n} image…', 'Lecture de {n} images…');

    var base = function (n) { return n.replace(/\.[^.]+$/, ''); };
    var sansGps = 0, sansHeure = 0;
    Promise.all([gpx[0].text()].concat(imgs.map(function (f) {
      return f.arrayBuffer().then(function (buf) {
        var x = Exif.lire(buf) || {};
        var url = URL.createObjectURL(f);
        return dims(url).then(function (d) {
          if (x.lat == null) sansGps++;
          if (!x.t) sansHeure++;
          var v = vids.filter(function (w) { return base(w.name) === base(f.name); })[0];
          // l'EXIF donne l'orientation, le navigateur l'applique : on lit les
          // dimensions APRÈS, sur l'image décodée
          return { id: base(f.name), src: url, video: v ? URL.createObjectURL(v) : null,
                   t: x.t || (f.lastModified || null), w: d[0], h: d[1], gps: x.lat != null ? [x.lat, x.lon] : null };
        });
      });
    }))).then(function (res) {
      var texte = res.shift();
      entree = { gpx: texte, medias: res, masque: 0.3 };
      // une photo géolocalisée se cale d'elle-même au point le plus proche
      var pts = Activity.parseGPX(texte).track;
      res.forEach(function (m) {
        if (!m.gps) return;
        var best = null, bd = Infinity;
        for (var i = 0; i < pts.length; i += 2) {
          var dx = (pts[i].lat - m.gps[0]) * 111, dy = (pts[i].lon - m.gps[1]) * 76;
          var d2 = dx * dx + dy * dy;
          if (d2 < bd) { bd = d2; best = pts[i]; }
        }
        if (best && bd < 0.25) { m.km = best.d / 1000; m.source = 'gps'; }   // à moins de 500 m du chemin
        delete m.gps;
      });
      restaurer();
      var dejaRegle = !!(entree.etapes && entree.etapes.length);
      rendre();
      if (!dejaRegle) ouvrirVoyage(true);
      var avis = [];
      if (sansGps) avis.push(TT('{n} sur {total} sans position : placées par l’heure', { n: sansGps, total: res.length }));
      if (sansHeure) avis.push(TT('{n} sans heure', { n: sansHeure }));
      if (avis.length) note(TT('{avis}. « Caler les photos » pour corriger.', { avis: avis.join(' · ') }), 6000);
      var seules = vids.filter(function (w) { return !imgs.some(function (f) { return base(f.name) === base(w.name); }); });
      if (seules.length) setTimeout(function () { note(TT('{n} vidéo(s) sans photo jumelle ignorée(s) pour l’instant.', { n: seules.length }), 5000); }, 6200);
    }).catch(function (e) { $('etat').textContent = TT('Lecture impossible : {e}', { e: e.message }); });
  }

  $('fichiers').addEventListener('change', function () { lireFichiers(this.files); });
  var depot = $('depot');
  ['dragenter', 'dragover'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); depot.classList.add('survol'); });
  });
  ['dragleave', 'drop'].forEach(function (t) {
    document.addEventListener(t, function (e) { e.preventDefault(); depot.classList.remove('survol'); });
  });
  document.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files.length) lireFichiers(e.dataTransfer.files); });

  /* la galerie locale n'existe que sur la machine qui a préparé le carnet
   * (carnet-local/, ignoré par git) : le lien ne s'affiche que si elle répond */
  if (location.protocol.indexOf('http') === 0) {
    fetch('carnet-local/galerie.html', { method: 'HEAD' }).then(function (r) { if (r.ok) $('bGalerie').hidden = false; }).catch(function () {});
  }

  /* ---------- un carnet préparé ---------- */
  var q = new URLSearchParams(location.search).get('manifeste');
  if (q && /^[\w\-\/]+\.json$/.test(q)) {
    fetch(q).then(function (r) { return r.json(); }).then(function (man) {
      // le relief est facultatif : sans lui, le carnet se dessine comme avant
      var relief = man.relief ? fetch(man.relief).then(function (r) { return r.ok ? r.json() : null; }).catch(function () { return null; }) : null;
      return Promise.all([fetch(man.gpx).then(function (r) { return r.text(); }), relief]).then(function (res) {
        entree = man; entree.gpx = res[0]; entree.relief = res[1];
        restaurer();
        rendre();
      });
    }).catch(function (e) { $('etat').textContent = TT('Manifeste illisible : {e}', { e: e.message }); });
  }

  /* ---------- enregistrer le carnet, le rouvrir ailleurs ----------
   * Le carnet ne vit que dans ce navigateur : les photos déposées sont des
   * blob:, les calages et les réglages sont dans son stockage local. Pour
   * reprendre le travail sur un autre ordinateur, tout part dans UN fichier
   * `.carnet` — une archive ZIP « stockée » (src/zip.js) :
   *
   *   carnet.json    le carnet : titre, étapes, noms, Komoot, et chaque photo
   *                  avec son heure, son kilomètre, son statut, sa légende
   *   reglages.json  le panneau Instagram : format, thème, titres, anecdotes,
   *                  moments du Reel…
   *   parcours.gpx   la trace, telle quelle
   *   relief.json    le relief swisstopo, s'il a été préparé
   *   photos/…jpg    les photos, RÉENCODÉES à 2400 px : plus légères, et sans
   *                  EXIF — le fichier ne porte que ce que le carnet utilise
   *   videos/…       les Live Photos, telles quelles
   *
   * Le rouvrir, c'est le déposer sur l'accueil du carnet, comme un GPX. */
  var CARNET_COTE = 2400;
  /* une adresse data: se décode ici : la politique de sécurité du carnet
   * n'autorise pas fetch() vers data:, et c'est très bien ainsi */
  function enOctets(u) {
    if (/^data:/.test(u)) {
      var b = atob(u.slice(u.indexOf(',') + 1)), o = new Uint8Array(b.length);
      for (var i = 0; i < b.length; i++) o[i] = b.charCodeAt(i);
      return Promise.resolve(o);
    }
    return fetch(u).then(function (r) { return r.arrayBuffer(); }).then(function (x) { return new Uint8Array(x); });
  }
  function texteOctets(s) { return new TextEncoder().encode(s); }

  function enregistrerCarnet() {
    if (!entree) return;
    var bouton = $('bEnregistrer');
    bouton.disabled = true;
    note(T('Préparation du fichier…'), 60000);
    var reglages = null;
    try { reglages = localStorage.getItem(hCle()); } catch (e) { reglages = null; }
    var sansSource = JSON.parse(JSON.stringify(entree, function (k, v) {
      // la trace et le relief ont leur propre fichier ; les src ne valent que dans ce navigateur
      return (k === 'gpx' || k === 'relief' || k === 'src' || k === 'video') ? undefined : v;
    }));
    sansSource.medias.forEach(function (m, i) {
      m.fichier = 'photos/' + entree.medias[i].id + '.jpg';
      if (entree.medias[i].video) m.fichierVideo = 'videos/' + entree.medias[i].id + '.mov';
    });
    var fait = 0, n = entree.medias.length;
    Promise.all(entree.medias.map(function (m) {
      return reencoder(m.src, CARNET_COTE).then(enOctets).then(function (photo) {
        note(TT('Préparation du fichier… {i} / {n}', { i: ++fait, n: n }), 60000);
        var sorties = [{ name: 'photos/' + m.id + '.jpg', data: photo }];
        if (!m.video) return sorties;
        return enOctets(m.video).then(function (v) { sorties.push({ name: 'videos/' + m.id + '.mov', data: v }); return sorties; },
                                      function () { return sorties; });
      });
    })).then(function (lots) {
      var entrees = [
        { name: 'carnet.json', data: texteOctets(JSON.stringify(sansSource, null, 1)) },
        { name: 'parcours.gpx', data: texteOctets(entree.gpx) }
      ];
      if (entree.relief) entrees.push({ name: 'relief.json', data: texteOctets(JSON.stringify(entree.relief)) });
      if (reglages) entrees.push({ name: 'reglages.json', data: texteOctets(reglages) });
      lots.forEach(function (l) { entrees = entrees.concat(l); });
      var zip = Zip.build(entrees);
      Video.save(zip, nomFichier() + '.carnet');
      note(TT('Carnet enregistré : {mo} Mo. Dépose-le sur l’accueil du carnet pour le rouvrir, sur n’importe quel ordinateur.', { mo: nb(zip.size / 1048576, 1) }), 7000);
    }).catch(function (e) { note(TT('Enregistrement impossible : {e}', { e: e.message }), 6000); })
      .then(function () { bouton.disabled = false; });
  }

  /* lire une archive « stockée » — la seule que le carnet écrit. Une archive
   * compressée par un autre outil est refusée en le disant, pas lue de travers. */
  function lireZip(buffer) {
    var v = new DataView(buffer), o = 0, fichiers = {}, dec = new TextDecoder();
    while (o + 30 <= v.byteLength && v.getUint32(o, true) === 0x04034B50) {
      var methode = v.getUint16(o + 8, true), taille = v.getUint32(o + 18, true);
      var lNom = v.getUint16(o + 26, true), lExtra = v.getUint16(o + 28, true);
      var nom = dec.decode(new Uint8Array(buffer, o + 30, lNom));
      if (methode !== 0) throw new Error(T('ce fichier a été recompressé par un autre outil — enregistre-le à nouveau depuis le carnet'));
      var debut = o + 30 + lNom + lExtra;
      fichiers[nom] = new Uint8Array(buffer, debut, taille);
      o = debut + taille;
    }
    if (!fichiers['carnet.json']) throw new Error(T('ce n’est pas un fichier de carnet'));
    return fichiers;
  }

  function rouvrirCarnet(fichier) {
    $('etat').textContent = T('Ouverture du carnet…');
    fichier.arrayBuffer().then(function (buf) {
      var F = lireZip(buf), dec = new TextDecoder();
      var carnet = JSON.parse(dec.decode(F['carnet.json']));
      carnet.gpx = dec.decode(F['parcours.gpx']);
      carnet.relief = F['relief.json'] ? JSON.parse(dec.decode(F['relief.json'])) : null;
      carnet.medias.forEach(function (m) {
        var photo = F[m.fichier], video = m.fichierVideo && F[m.fichierVideo];
        if (!photo) throw new Error(TT('la photo {id} manque dans le fichier', { id: m.id }));
        m.src = URL.createObjectURL(new Blob([photo], { type: 'image/jpeg' }));
        m.video = video ? URL.createObjectURL(new Blob([video], { type: 'video/quicktime' })) : null;
        delete m.fichier; delete m.fichierVideo;
      });
      entree = carnet;
      // les réglages du panneau reprennent leur place dans ce navigateur
      if (F['reglages.json']) { try { localStorage.setItem(hCle(), dec.decode(F['reglages.json'])); } catch (e) { /* navigation privée */ } }
      hOpts = { theme: 'papier', titre: null, sousTitre: null, exclus: {} };
      rendre();
      note(TN(carnet.medias.length, 'Carnet rouvert : {n} photo, calages et réglages compris.', 'Carnet rouvert : {n} photos, calages et réglages compris.'), 5000);
    }).catch(function (e) { $('etat').textContent = TT('Ouverture impossible : {e}', { e: e.message }); });
  }
  $('bEnregistrer').addEventListener('click', enregistrerCarnet);

  /* ---------- la topo, depuis swisstopo ----------
   * Le seul moment où le carnet parle au réseau, et il le dit AVANT : quelle
   * zone part, à qui, combien de requêtes. Ni la trace ni les photos ne
   * partent — seulement les coordonnées d'un rectangle autour du parcours,
   * qui le situent pourtant. Le relief obtenu reste dans le carnet et part
   * avec lui dans le fichier .carnet : on ne le redemande jamais. */
  $('bRelief').addEventListener('click', function () {
    var bouton = this, pts;
    try { pts = Activity.parseGPX(entree.gpx).track; } catch (e) { note(TT('Trace illisible : {e}', { e: e.message }), 5000); return; }
    var est = Relief.estimer(pts);
    var ok = window.confirm(T('Ajouter la topo swisstopo ?') + '\n\n' +
      TT('Le carnet va demander à swisstopo (geo.admin.ch) le relief d’une zone d’environ {l} × {h} km autour du parcours — {r} requêtes, une vingtaine de secondes.',
        { l: Math.round(est.kmLarge), h: Math.round(est.kmHaut), r: est.requetes }) + '\n\n' +
      T('Seules les coordonnées de cette zone partent : ni la trace, ni les photos. Elles situent toutefois le parcours.') + '\n\n' +
      T('Le relief couvre la Suisse et ses abords immédiats.'));
    if (!ok) return;
    bouton.disabled = true;
    Relief.preparer(pts, { progres: function (k) { note(TT('Topo swisstopo… {p} %', { p: Math.round(k * 100) }), 60000); } })
      .then(function (r) {
        entree.relief = r;
        rendre();
        note(TT('Topo ajoutée : {n} courbes de niveau. L’altitude swisstopo s’écarte de {e} m du GPX en médiane. « Enregistrer le carnet » la garde.',
          { n: r.courbes.length, e: r.controle.ecartMedian }), 7000);
      })
      .catch(function (e) { note(TT('Topo impossible : {e}', { e: e.message }), 8000); })
      .then(function () { bouton.disabled = false; });
  });

  /* ---------- exporter ----------
   * UN fichier HTML, qui s'ouvre partout sans rien installer ni rien
   * appeler : le lecteur, le carnet et les images à l'intérieur.
   *
   * Les images sont RÉENCODÉES par un canvas : c'est ce qui en retire
   * l'EXIF — position, appareil, heure. Le carnet partagé ne dit donc que
   * ce que la page montre. */
  function versDataUrl(blob) {
    return new Promise(function (ok, ko) {
      var r = new FileReader();
      r.onload = function () { ok(r.result); };
      r.onerror = ko;
      r.readAsDataURL(blob);
    });
  }
  function reencoder(src, cote) {
    return new Promise(function (ok, ko) {
      var i = new Image();
      i.onload = function () {
        var s = Math.min(1, cote / Math.max(i.naturalWidth, i.naturalHeight));
        var c = document.createElement('canvas');
        c.width = Math.round(i.naturalWidth * s); c.height = Math.round(i.naturalHeight * s);
        c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
        ok(c.toDataURL('image/jpeg', 0.84));
      };
      i.onerror = function () { ko(new Error(T('image illisible'))); };
      i.src = src;
    });
  }
  function police(url) {
    return fetch(url).then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (b) { return b ? versDataUrl(b) : null; }).catch(function () { return null; });
  }

  $('bExport').addEventListener('click', function () {
    var bouton = this, data = poserLangue(JSON.parse(JSON.stringify(lecteur.data)));
    bouton.disabled = true;
    note(T('Préparation du carnet…'), 60000);
    var faits = 0;
    Promise.all(data.medias.map(function (m) {
      return reencoder(m.src, 1800).then(function (u) {
        m.src = u; delete m.t;
        note(TT('Préparation du carnet… {i} / {n}', { i: ++faits, n: data.medias.length }), 60000);
        if (!m.video) return;
        return fetch(m.video).then(function (r) { return r.blob(); }).then(versDataUrl)
          .then(function (v) { m.video = v; }, function () { m.video = null; });
      });
    })).then(function () {
      data.etapes.forEach(function (e) { delete e.fenetre; });   // des heures : elles datent le voyage
      // l'image d'ombrage chargée ne survit pas à la copie : un {} vide empêcherait de la recharger
      if (data.relief) delete data.relief.__img;
      delete data.__legendes;
      delete data.facteur;
      return Promise.all([
        police('assets/archivo-latin.woff2'), police('assets/archivo-latin-ext.woff2'),
        police('assets/plexmono-latin.woff2')
      ]);
    }).then(function (f) {
      var fontes = '';
      if (f[0]) fontes += '@font-face{font-family:"Archivo";src:url(' + f[0] + ') format("woff2");font-weight:100 900;font-stretch:62% 125%}';
      if (f[1]) fontes += '@font-face{font-family:"Archivo";src:url(' + f[1] + ') format("woff2");font-weight:100 900;font-stretch:62% 125%;unicode-range:U+0100-024F,U+1E00-1EFF}';
      if (f[2]) fontes += '@font-face{font-family:"IBM Plex Mono";src:url(' + f[2] + ') format("woff2")}';
      var json = JSON.stringify(data).replace(/</g, '\\u003c');
      var html = '<!doctype html>\n<html lang="' + (data.langue === 'en' ? 'en' : 'fr') + '"><head><meta charset="utf-8">' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">' +
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; media-src data: blob:; font-src data:">' +
        '<title>' + data.titre.replace(/</g, '&lt;') + '</title>' +
        '<style>html,body{margin:0;background:#F7F5EF}' + fontes + '</style></head><body>' +
        '<div id="carnet"></div>' +
        '<script type="application/json" id="donnees">' + json + '<\/script>' +
        '<script>var CarnetLecteur=(' + CarnetLecteur.source + ')();' +
        'CarnetLecteur.monter(document.getElementById("carnet"),JSON.parse(document.getElementById("donnees").textContent));<\/script>' +
        '</body></html>';
      var blob = new Blob([html], { type: 'text/html' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'carnet-' + data.titre.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '.html';
      document.body.appendChild(a); a.click(); a.remove();
      note(TT('Carnet exporté : {mo} Mo, un seul fichier, aucune coordonnée.', { mo: nb(blob.size / 1048576, 1) }), 5000);
    }).catch(function (e) { note(TT('Export impossible : {e}', { e: e.message }), 6000); })
      .then(function () { bouton.disabled = false; });
  });

  /* ---------- Horizon : le carrousel Instagram ----------
   * Le même carnet, découpé en planches de 1080 × 1350. Le titre, le
   * sous-titre, les légendes et le choix des photos se règlent ici ; les
   * légendes sont celles du carnet — les changer ici les change partout. */
  var hOpts = { theme: 'papier', titre: null, sousTitre: null, exclus: {} };
  var hImages = {}, hGrand = document.createElement('canvas'), hPlan = null;

  function hCle() { return cle() + ':horizon'; }
  function hCharger() {
    try { var o = JSON.parse(localStorage.getItem(hCle()) || 'null'); if (o) hOpts = o; } catch (e) { /* rien */ }
    hOpts.exclus = hOpts.exclus || {};
  }
  function hSauver() { try { localStorage.setItem(hCle(), JSON.stringify(hOpts)); } catch (e) { /* rien */ } }

  function hImagesPretes(data) {
    var ombre = null;
    if (data.relief && data.relief.ombre && !data.relief.__img) {
      ombre = new Promise(function (ok) {
        var i = new Image(); i.onload = i.onerror = function () { ok(); }; i.src = data.relief.ombre.src; data.relief.__img = i;
      });
    }
    return Promise.all([ombre].concat(data.medias.map(function (m) {
      if (hImages[m.id] && hImages[m.id].src === m.src && hImages[m.id].complete) return null;
      return new Promise(function (ok) {
        var i = new Image(); i.onload = i.onerror = function () { ok(); }; i.src = m.src; hImages[m.id] = i;
      });
    }))).then(function () {
      return document.fonts ? Promise.all([document.fonts.load('800 100px Archivo'), document.fonts.load('400 30px Archivo'),
        document.fonts.load('22px "IBM Plex Mono"')]) : null;
    });
  }

  /* Deux formats pour le même carnet : le RÉCIT court (un moment par image,
   * le défaut) et le PANORAMA continu. Le panorama est toujours composé :
   * c'est lui que le Reel filme. */
  var hPlanches = [];
  function hRendre() {
    var data = lecteur.data;
    hPlan = Horizon.composer(data, hOpts);
    Horizon.dessiner(hGrand, data, hPlan, hImages, hOpts);
    var planches;
    var f = format();
    if (f === 'promo' || f === 'recit') {
      var M = f === 'promo' ? Promo : Recit;
      planches = M.composer(data, hOpts).map(function (im) {
        var c = document.createElement('canvas'); c.width = M.W; c.height = M.H;
        M.dessiner(c.getContext('2d'), data, im, hImages, hOpts);
        return c;
      });
    } else planches = Horizon.planches(hGrand, hPlan.n);
    $('hKomoot').hidden = f !== 'promo';
    hPlanches = planches;
    var bande = $('hBande');
    bande.innerHTML = '';
    planches.forEach(function (c, i) {
      var f = document.createElement('figure');
      f.appendChild(c);
      var cap = document.createElement('figcaption'); cap.textContent = (i + 1) + ' / ' + planches.length;
      f.appendChild(cap);
      bande.appendChild(f);
    });
    $('hNb').textContent = planches.length + ' IMAGES · 1080 × 1350';
  }

  /* les moments du récit : un titre et une anecdote chacun. La clé est la
   * première photo du moment — elle survit aux changements de thème et de
   * couverture, pas à un regroupement différent des photos. */
  var ANECDOTE_MAX = 140;
  /* trois formats : la PROMOTION (club et Komoot, le défaut), le souvenir en
   * récit, le souvenir en panorama. Le Reel et la liste des moments suivent. */
  function format() { return hOpts.format || 'promo'; }
  function composerMoments() { return (format() === 'promo' ? Promo : Recit).composer(lecteur.data, hOpts); }

  function hMoments() {
    var box = $('hMoments');
    box.innerHTML = '';
    if (format() === 'panorama') return;
    hOpts.titres = hOpts.titres || {}; hOpts.textes = hOpts.textes || {};
    composerMoments().filter(function (im) { return im.type === 'moment'; }).forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'moment';
      d.innerHTML = '<span>' + String(s.n).padStart(2, '0') + ' · ' + (s.estime ? '≈ km ' + Math.round(s.a) : 'km ' + nb(s.a, 1)) + '</span>' +
        '<input type="text" aria-label="' + esc(T('Titre du moment')) + '">' +
        '<textarea aria-label="' + esc(T('Anecdote')) + '" placeholder="' + esc(T('Une anecdote, une phrase (facultatif)')) + '"></textarea>' +
        '<span class="compte"></span>';
      var t = d.querySelector('input'), a = d.querySelector('textarea'), c = d.querySelector('.compte');
      t.placeholder = s.titre; t.value = hOpts.titres[s.cle] || '';
      a.value = hOpts.textes[s.cle] || '';
      function compter() { var n = a.value.length; c.textContent = n + ' / ' + ANECDOTE_MAX; c.classList.toggle('trop', n > ANECDOTE_MAX); }
      compter();
      a.addEventListener('input', compter);
      t.addEventListener('change', function () { if (t.value.trim()) hOpts.titres[s.cle] = t.value.trim(); else delete hOpts.titres[s.cle]; hSauver(); hRendre(); });
      a.addEventListener('change', function () { if (a.value.trim()) hOpts.textes[s.cle] = a.value.trim(); else delete hOpts.textes[s.cle]; hSauver(); hRendre(); });
      box.appendChild(d);
    });
  }

  function hPhotos() {
    var data = lecteur.data, box = $('hPhotos');
    box.innerHTML = '';
    data.medias.forEach(function (m) {
      var src = entree.medias.filter(function (x) { return x.id === m.id; })[0];
      var l = document.createElement('label');
      if (hOpts.exclus[m.id]) l.className = 'off';
      l.innerHTML = '<img alt=""><span><input type="checkbox"> km ' + nb(m.km, 1) + '</span><input type="text" placeholder="' + esc(T('Légende')) + '">';
      l.querySelector('img').src = m.src;
      var cb = l.querySelector('input[type=checkbox]'), tx = l.querySelector('input[type=text]');
      cb.checked = !hOpts.exclus[m.id];
      tx.value = (src && src.legende) || '';
      cb.addEventListener('change', function () {
        if (cb.checked) delete hOpts.exclus[m.id]; else hOpts.exclus[m.id] = true;
        l.className = cb.checked ? '' : 'off';
        hSauver(); hRendre();
      });
      tx.addEventListener('change', function () {
        if (src) { src.legende = tx.value.trim(); sauver(); }
        rendre(); hRendre();   // le carnet et le carrousel lisent la même légende
      });
      box.appendChild(l);
    });
  }

  $('bHorizon').addEventListener('click', function () {
    hCharger();
    var data = lecteur.data;
    $('hTitre').value = hOpts.titre != null ? hOpts.titre : data.titre;
    $('hSous').value = hOpts.sousTitre != null ? hOpts.sousTitre : data.sousTitre;
    $('hTheme').value = hOpts.theme;
    // la signature vient du carnet (manifeste) tant qu'on ne l'a pas changée ici
    if (hOpts.signature == null) { hOpts.signature = entree.signature || ''; hOpts.lienSignature = entree.lienSignature || ''; }
    $('hSigne').value = hOpts.signature;
    $('hNB').checked = !!hOpts.nb;
    $('hCouv').value = hOpts.couverture || 'coupe';
    $('hFormat').value = format();
    // les liens Komoot : ceux du carnet (manifeste) tant qu'on ne les a pas changés ici
    if (!hOpts.komoot) hOpts.komoot = Object.assign({ dansCollection: false }, entree.komoot || {});
    var K = hOpts.komoot;
    $('kTour').value = K.tour || ''; $('kCollection').value = K.collection || ''; $('kNom').value = K.nom || '';
    $('kParcours').value = K.parcours || ''; $('kDans').checked = !!K.dansCollection; $('kBio').checked = hOpts.lienEnBio !== false;
    $('hFondu').value = hOpts.fondu || 'halo';
    // le récit se lit en Papier, photos en couleur, signature sobre — sauf choix contraire
    if (hOpts.signatureSobre == null) hOpts.signatureSobre = true;
    $('hMain').checked = !!hOpts.manuscrit;
    $('horizon').hidden = false;
    document.body.style.overflow = 'hidden';
    note(T('Composition du panorama…'), 2000);
    hImagesPretes(data).then(function () { hRendre(); hMoments(); hPhotos(); });
  });
  $('hFermer').addEventListener('click', function () { $('horizon').hidden = true; document.body.style.overflow = ''; });
  $('hTitre').addEventListener('change', function () { hOpts.titre = this.value; hSauver(); hRendre(); });
  $('hSous').addEventListener('change', function () { hOpts.sousTitre = this.value; hSauver(); hRendre(); });
  $('hTheme').addEventListener('change', function () { hOpts.theme = this.value; hSauver(); hRendre(); });
  $('hSigne').addEventListener('change', function () { hOpts.signature = this.value.trim(); hSauver(); hRendre(); });
  $('hNB').addEventListener('change', function () { hOpts.nb = this.checked; hSauver(); hRendre(); });
  $('hCouv').addEventListener('change', function () { hOpts.couverture = this.value; hSauver(); hRendre(); });
  $('hFormat').addEventListener('change', function () { hOpts.format = this.value; hSauver(); hRendre(); hMoments(); });
  /* Komoot : les réglages valent pour les images ET pour le carnet web, dont
   * les liens, eux, se cliquent — on les recopie donc dans le carnet */
  function majKomoot() {
    var K = hOpts.komoot = hOpts.komoot || {};
    K.tour = $('kTour').value.trim(); K.collection = $('kCollection').value.trim(); K.nom = $('kNom').value.trim();
    K.parcours = +$('kParcours').value || null; K.dansCollection = $('kDans').checked;
    hOpts.lienEnBio = $('kBio').checked;
    entree.komoot = { tour: K.tour, collection: K.collection, nom: K.nom, parcours: K.parcours, dansCollection: K.dansCollection };
    hSauver(); hRendre(); rendre();
  }
  ['kTour', 'kCollection', 'kNom', 'kParcours', 'kDans', 'kBio'].forEach(function (id) { $(id).addEventListener('change', majKomoot); });

  /* la story : l'invitation en 9:16, la zone du sticker lien laissée libre —
   * c'est le seul endroit d'Instagram où un lien se clique depuis une image */
  $('hStory').addEventListener('click', function () {
    var c = document.createElement('canvas'); c.width = 1080; c.height = 1920;
    Promo.dessinerStory(c.getContext('2d'), lecteur.data, hImages, hOpts);
    c.toBlob(function (b) {
      Video.save(b, 'story-' + nomFichier() + '.png');
      note(T('Story exportée. Sur Instagram : ajoute le sticker « Lien » dans la zone libre, avec le lien de la collection.'), 7000);
    }, 'image/png');
  });
  $('hFondu').addEventListener('change', function () { hOpts.fondu = this.value; hSauver(); hRendre(); });
  $('hMain').addEventListener('change', function () { hOpts.manuscrit = this.checked; hSauver(); hRendre(); });
  $('hContinu').addEventListener('change', function () { $('hBande').classList.toggle('continu', this.checked); });

  $('hExport').addEventListener('click', function () {
    var bouton = this, planches = hPlanches;
    bouton.disabled = true;
    Promise.all(planches.map(function (c) {
      return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', 0.93); })
        .then(function (b) { return b.arrayBuffer(); });
    })).then(function (bufs) {
      var nom = (hOpts.titre || lecteur.data.titre).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      var zip = Zip.build(bufs.map(function (b, i) {
        return { name: nom + '-' + String(i + 1).padStart(2, '0') + '.jpg', data: new Uint8Array(b) };
      }));
      var a = document.createElement('a');
      a.href = URL.createObjectURL(zip); a.download = 'horizon-' + nom + '.zip';
      document.body.appendChild(a); a.click(); a.remove();
      note(TN(planches.length, '{n} image exportée, dans l’ordre du carrousel.', '{n} images exportées, dans l’ordre du carrousel.'), 4000);
    }).catch(function (e) { note(TT('Export impossible : {e}', { e: e.message }), 5000); })
      .then(function () { bouton.disabled = false; });
  });

  /* ---------- le Reel : le même panorama, filmé ----------
   * L'aperçu tourne en boucle ; l'export l'enregistre en temps réel —
   * l'onglet doit donc rester au premier plan, et video.js le surveille. */
  var reel = null, reelAnim = 0, reelVideos = {};
  function reelVideosPretes(data) {
    data.medias.forEach(function (m) {
      if (!m.video || reelVideos[m.id]) return;
      var v = document.createElement('video');
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.addEventListener('error', function () { v.__erreur = true; });   // HEVC illisible : la photo prend le relais
      v.src = m.video;
      var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
      reelVideos[m.id] = v;
    });
  }
  function reelMonter() {
    reelVideosPretes(lecteur.data);
    /* le Reel MONTÉ (par défaut) : titre, boucle, trois moments en plein cadre,
     * bilan ; ou le travelling du panorama, gardé pour comparer */
    reel = (hOpts.reelMode || 'montage') === 'montage'
      ? Montage.monter(lecteur.data, composerMoments(), hImages, reelVideos, Object.assign({}, hOpts, { format: format(), komoot: hOpts.komoot }))
      : Reel.monter(hGrand, hPlan, lecteur.data, hImages, reelVideos, hOpts);
    $('hReelCanvas').__reel = reel;   // pour tirer une image précise (contrôles)
    $('hReelInfo').textContent = Math.round(reel.duree) + ' s · 1080 × 1920';
    reelChoix();
  }

  /* LE CHOIX DES MOMENTS, À LA MAIN. Une pastille par moment du récit ; les
   * allumées entrent dans le Reel, dans l'ordre du voyage. Le premier clic part
   * du choix automatique, pour ne pas repartir de rien. « Automatique » rend
   * la main au calcul. De un à cinq moments : au-delà, le Reel dépasse 40 s. */
  var REEL_MAX = 5;
  function reelChoix() {
    var box = $('hReelMoments');
    box.innerHTML = '';
    if (!reel.candidats) return;   // le travelling n'a pas de moments
    var aide = document.createElement('div');
    aide.className = 'aide';
    aide.textContent = reel.aLaMain ? T('Moments choisis à la main — touche pour ajouter ou retirer')
                                    : T('Moments choisis automatiquement — touche pour choisir toi-même');
    box.appendChild(aide);
    reel.candidats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = reel.choisis.indexOf(c.cle) >= 0 ? 'on' : '';
      b.innerHTML = c.titre.replace(/</g, '&lt;') + '<small>' + c.km + ' · ' + esc(TN(c.n, '{n} photo', '{n} photos')) + (c.video ? ' · ' + esc(T('vidéo')) : '') + '</small>';
      b.addEventListener('click', function () {
        var sel = reel.choisis.slice(), i = sel.indexOf(c.cle);
        if (i >= 0) {
          if (sel.length === 1) { note(T('Il faut au moins un moment dans le Reel.'), 3000); return; }
          sel.splice(i, 1);
        } else {
          if (sel.length >= REEL_MAX) { note(T('Cinq moments au plus : retire-en un d’abord.'), 3500); return; }
          sel.push(c.cle);
        }
        hOpts.reelMoments = sel; hSauver();
        reelMonter(); reelLire();
      });
      box.appendChild(b);
    });
    if (reel.aLaMain) {
      var a = document.createElement('button');
      a.type = 'button'; a.className = 'auto'; a.textContent = T('Automatique');
      a.addEventListener('click', function () { delete hOpts.reelMoments; hSauver(); reelMonter(); reelLire(); });
      box.appendChild(a);
    }
  }
  function reelLire() {
    var ctx = $('hReelCanvas').getContext('2d'), t0 = performance.now();
    cancelAnimationFrame(reelAnim);
    (function image(now) {
      reel.dessiner(ctx, ((now - t0) / 1000) % reel.duree);
      reelAnim = requestAnimationFrame(image);
    })(t0);
  }
  $('hReel').addEventListener('click', function () {
    if (!hPlan) return;
    $('hReelMode').value = hOpts.reelMode || 'montage';
    reelMonter();
    $('hReelBoite').hidden = false;
    reelLire();
  });
  $('hReelMode').addEventListener('change', function () { hOpts.reelMode = this.value; hSauver(); reelMonter(); reelLire(); });
  $('hReelFermer').addEventListener('click', function () { cancelAnimationFrame(reelAnim); $('hReelBoite').hidden = true; });
  function nomFichier() {
    return (hOpts.titre || lecteur.data.titre).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
  }
  /* L'export du Reel : IMAGE PAR IMAGE quand le navigateur sait encoder
   * (WebCodecs) — le résultat ne dépend plus de la vitesse de la machine ni de
   * la visibilité de l'onglet. Sinon, repli sur l'enregistrement en temps réel. */
  $('hReelExport').addEventListener('click', function () {
    var bouton = this, cv = $('hReelCanvas'), ctx = cv.getContext('2d');
    if (Mp4.disponible()) {
      cancelAnimationFrame(reelAnim);
      bouton.disabled = true;
      var t0 = performance.now();
      Mp4.encoder(cv, {
        fps: 30, secondes: reel.duree, debit: 10e6,
        dessiner: function (t) { return reel.preparer(t).then(function () { reel.dessiner(ctx, t); }); },
        progres: function (k) { $('hReelInfo').textContent = TT('Encodage… {p} %', { p: Math.round(k * 100) }); }
      }).then(function (blob) {
        Video.save(blob, 'reel-' + nomFichier() + '.mp4');
        note(TT('Reel exporté en MP4 : {mo} Mo, {d} s, encodé en {t} s.',
          { mo: nb(blob.size / 1048576, 1), d: Math.round(reel.duree), t: Math.round((performance.now() - t0) / 1000) }), 6000);
      }).catch(function (e) { note(TT('Export impossible : {e}', { e: e.message }), 6000); })
        .then(function () { bouton.disabled = false; reelMonter(); reelLire(); });
      return;
    }
    if (!Video.pickMime()) { note(T('Ce navigateur ne sait pas enregistrer de vidéo (Safari) : exporte depuis Chrome ou Edge.'), 6000); return; }
    cancelAnimationFrame(reelAnim);
    bouton.disabled = true;
    Video.record(cv, function (p) { reel.dessiner(ctx, p * reel.duree); }, {
      duration: reel.duree * 1000, fps: 30, bitrate: 14000000,
      at: function (k) { return { p: k, fade: 0 }; },
      onProgress: function (k) { $('hReelInfo').textContent = TT('Enregistrement… {p} % — garde l’onglet au premier plan', { p: Math.round(k * 100) }); }
    }).then(function (r) {
      var ext = /mp4/.test(r.mime) ? 'mp4' : 'webm';
      var nom = (hOpts.titre || lecteur.data.titre).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      Video.save(r.blob, 'reel-' + nom + '.' + ext);
      note(ext === 'webm' ? TT('Reel exporté en {ext} — Instagram préfère le MP4 : exporte depuis Chrome récent.', { ext: ext.toUpperCase() })
                          : TT('Reel exporté en {ext}.', { ext: ext.toUpperCase() }), 6000);
    }).catch(function (e) { note(TT('Enregistrement interrompu : {e}', { e: e.message }), 6000); })
      .then(function () { bouton.disabled = false; reelMonter(); reelLire(); });
  });

  /* ---------- la langue des IMAGES change ----------
   * Tout ce qui est dessiné se redessine dans la nouvelle langue : le carnet
   * (rendre() le remonte entier, avec data.langue), le carrousel et ses
   * moments s'il est ouvert, l'aperçu du Reel s'il tourne. Celle de
   * l'INTERFACE, elle, recharge la page (src/langue.js). */
  if (window.Langue) Langue.surChangement(function () {
    majFrancais();
    if (!entree || !lecteur) return;
    var y = window.scrollY;
    rendre();
    window.scrollTo(0, y);
    if (!$('horizon').hidden && hPlan) {
      hRendre(); hMoments();
      if (!$('hReelBoite').hidden && reel) { reelMonter(); reelLire(); }
    }
  });
})();
