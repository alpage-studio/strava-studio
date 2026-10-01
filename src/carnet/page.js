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

  function note(txt, ms) {
    var n = $('note');
    n.textContent = txt; n.classList.add('vue');
    clearTimeout(note.t);
    note.t = setTimeout(function () { n.classList.remove('vue'); }, ms || 3200);
  }

  /* ---------- la mémoire des calages ---------- */
  function cle() { return 'carnet:' + (entree.titre || '') + ':' + entree.medias.length; }
  function sauver() {
    var c = {};
    entree.medias.forEach(function (m) { if (m.km != null || m.legende) c[m.id] = { km: m.km, source: m.source || null, legende: m.legende || '' }; });
    try { localStorage.setItem(cle(), JSON.stringify(c)); } catch (e) { /* navigation privée */ }
  }
  function restaurer() {
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
    try { data = Composer.composer(entree); }
    catch (e) { $('etat').textContent = e.message; return; }
    var repere = garderId && document.querySelector('.cr-fig[data-id="' + garderId + '"]');
    var avant = repere ? repere.getBoundingClientRect().top : null;

    $('accueil').hidden = true;
    $('outils').hidden = false;
    lecteur = CarnetLecteur.monter($('carnet'), data);
    lecteur.data = data;
    // combien de positions restent à valider : le bouton le dit
    var aValider = data.medias.filter(function (m) { return m.statut === 'estimee'; }).length;
    $('bCaler').textContent = 'Caler les photos' + (aValider ? ' · ' + aValider + ' à valider' : ' · tout est validé');
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
      var heure = m.t ? new Date(m.t).toLocaleString('fr-CH', { weekday: 'short', hour: '2-digit', minute: '2-digit' }) : 'sans heure';
      var libelle = { gps: 'localisée · GPS', confirmee: 'confirmée', estimee: 'estimée par l’heure' }[m.statut];
      var b = document.createElement('div');
      b.className = 'calage';
      b.innerHTML = '<span><span class="statut ' + m.statut + '">' + libelle +
        '</span> · km <output>' + m.km.toFixed(1) + '</output> · ' + heure + '</span>' +
        (m.ancre ? '<button type="button" class="lib">libérer</button>' : '<button type="button" class="conf">confirmer ici</button>') +
        '<input type="range" min="0" max="' + total.toFixed(1) + '" step="0.1" value="' + m.km.toFixed(1) + '">' +
        '<input type="text" placeholder="Légende (sinon : le repère le plus proche)" value="' + (src.legende || '').replace(/"/g, '&quot;') + '">';
      f.appendChild(b);
      var r = b.querySelector('input[type=range]'), o = b.querySelector('output');
      r.addEventListener('input', function () { o.textContent = (+r.value).toFixed(1); });
      r.addEventListener('change', function () { src.km = +r.value; src.source = 'main'; sauver(); rendre(m.id); note('Photo confirmée au km ' + (+r.value).toFixed(1) + ' — les voisines se replacent.'); });
      var lib = b.querySelector('.lib');
      if (lib) lib.addEventListener('click', function () { delete src.km; delete src.source; sauver(); rendre(m.id); });
      // l'estimation est juste : on la confirme telle quelle, elle devient une ancre
      var conf = b.querySelector('.conf');
      if (conf) conf.addEventListener('click', function () { src.km = +m.km.toFixed(2); src.source = 'main'; sauver(); rendre(m.id); note('Position confirmée au km ' + m.km.toFixed(1) + '.'); });
      var t = b.querySelector('input[type=text]');
      t.addEventListener('change', function () { src.legende = t.value.trim(); sauver(); rendre(m.id); });
    });
  }

  $('bCaler').addEventListener('click', function () {
    edition = !edition;
    this.setAttribute('aria-pressed', String(edition));
    lecteur.racine.classList.toggle('cr-edition', edition);
    if (edition) note('Déplace une photo le long du parcours : elle devient une ancre, et les autres se replacent autour.', 4800);
  });

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
    if (!gpx.length) { $('etat').textContent = 'Il manque le GPX du parcours.'; return; }
    $('etat').textContent = 'Lecture de ' + imgs.length + ' images…';

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
      rendre();
      var avis = [];
      if (sansGps) avis.push(sansGps + ' sur ' + res.length + ' sans position : placées par l’heure');
      if (sansHeure) avis.push(sansHeure + ' sans heure');
      if (avis.length) note(avis.join(' · ') + '. « Caler les photos » pour corriger.', 6000);
      var seules = vids.filter(function (w) { return !imgs.some(function (f) { return base(f.name) === base(w.name); }); });
      if (seules.length) setTimeout(function () { note(seules.length + ' vidéo(s) sans photo jumelle ignorée(s) pour l’instant.', 5000); }, 6200);
    }).catch(function (e) { $('etat').textContent = 'Lecture impossible : ' + e.message; });
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
    }).catch(function (e) { $('etat').textContent = 'Manifeste illisible : ' + e.message; });
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
    note('Préparation du fichier…', 60000);
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
        note('Préparation du fichier… ' + (++fait) + ' / ' + n, 60000);
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
      note('Carnet enregistré : ' + (zip.size / 1048576).toFixed(1) + ' Mo. Dépose-le sur l’accueil du carnet pour le rouvrir, sur n’importe quel ordinateur.', 7000);
    }).catch(function (e) { note('Enregistrement impossible : ' + e.message, 6000); })
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
      if (methode !== 0) throw new Error('ce fichier a été recompressé par un autre outil — enregistre-le à nouveau depuis le carnet');
      var debut = o + 30 + lNom + lExtra;
      fichiers[nom] = new Uint8Array(buffer, debut, taille);
      o = debut + taille;
    }
    if (!fichiers['carnet.json']) throw new Error('ce n’est pas un fichier de carnet');
    return fichiers;
  }

  function rouvrirCarnet(fichier) {
    $('etat').textContent = 'Ouverture du carnet…';
    fichier.arrayBuffer().then(function (buf) {
      var F = lireZip(buf), dec = new TextDecoder();
      var carnet = JSON.parse(dec.decode(F['carnet.json']));
      carnet.gpx = dec.decode(F['parcours.gpx']);
      carnet.relief = F['relief.json'] ? JSON.parse(dec.decode(F['relief.json'])) : null;
      carnet.medias.forEach(function (m) {
        var photo = F[m.fichier], video = m.fichierVideo && F[m.fichierVideo];
        if (!photo) throw new Error('la photo ' + m.id + ' manque dans le fichier');
        m.src = URL.createObjectURL(new Blob([photo], { type: 'image/jpeg' }));
        m.video = video ? URL.createObjectURL(new Blob([video], { type: 'video/quicktime' })) : null;
        delete m.fichier; delete m.fichierVideo;
      });
      entree = carnet;
      // les réglages du panneau reprennent leur place dans ce navigateur
      if (F['reglages.json']) { try { localStorage.setItem(hCle(), dec.decode(F['reglages.json'])); } catch (e) { /* navigation privée */ } }
      hOpts = { theme: 'papier', titre: null, sousTitre: null, exclus: {} };
      rendre();
      note('Carnet rouvert : ' + carnet.medias.length + ' photos, calages et réglages compris.', 5000);
    }).catch(function (e) { $('etat').textContent = 'Ouverture impossible : ' + e.message; });
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
    try { pts = Activity.parseGPX(entree.gpx).track; } catch (e) { note('Trace illisible : ' + e.message, 5000); return; }
    var est = Relief.estimer(pts);
    var ok = window.confirm('Ajouter la topo swisstopo ?\n\n' +
      'Le carnet va demander à swisstopo (geo.admin.ch) le relief d’une zone d’environ ' +
      Math.round(est.kmLarge) + ' × ' + Math.round(est.kmHaut) + ' km autour du parcours — ' + est.requetes + ' requêtes, une vingtaine de secondes.\n\n' +
      'Seules les coordonnées de cette zone partent : ni la trace, ni les photos. Elles situent toutefois le parcours.\n\n' +
      'Le relief couvre la Suisse et ses abords immédiats.');
    if (!ok) return;
    bouton.disabled = true;
    Relief.preparer(pts, { progres: function (k) { note('Topo swisstopo… ' + Math.round(k * 100) + ' %', 60000); } })
      .then(function (r) {
        entree.relief = r;
        rendre();
        note('Topo ajoutée : ' + r.courbes.length + ' courbes de niveau. L’altitude swisstopo s’écarte de ' + r.controle.ecartMedian +
          ' m du GPX en médiane. « Enregistrer le carnet » la garde.', 7000);
      })
      .catch(function (e) { note('Topo impossible : ' + e.message, 8000); })
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
      i.onerror = function () { ko(new Error('image illisible')); };
      i.src = src;
    });
  }
  function police(url) {
    return fetch(url).then(function (r) { return r.ok ? r.blob() : null; })
      .then(function (b) { return b ? versDataUrl(b) : null; }).catch(function () { return null; });
  }

  $('bExport').addEventListener('click', function () {
    var bouton = this, data = JSON.parse(JSON.stringify(lecteur.data));
    bouton.disabled = true;
    note('Préparation du carnet…', 60000);
    var faits = 0;
    Promise.all(data.medias.map(function (m) {
      return reencoder(m.src, 1800).then(function (u) {
        m.src = u; delete m.t;
        note('Préparation du carnet… ' + (++faits) + ' / ' + data.medias.length, 60000);
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
      var html = '<!doctype html>\n<html lang="fr"><head><meta charset="utf-8">' +
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
      note('Carnet exporté : ' + (blob.size / 1048576).toFixed(1) + ' Mo, un seul fichier, aucune coordonnée.', 5000);
    }).catch(function (e) { note('Export impossible : ' + e.message, 6000); })
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
      d.innerHTML = '<span>' + String(s.n).padStart(2, '0') + ' · ' + (s.estime ? '≈ km ' + Math.round(s.a) : 'km ' + s.a.toFixed(1).replace('.', ',')) + '</span>' +
        '<input type="text" aria-label="Titre du moment">' +
        '<textarea aria-label="Anecdote" placeholder="Une anecdote, une phrase (facultatif)"></textarea>' +
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
      l.innerHTML = '<img alt=""><span><input type="checkbox"> km ' + m.km.toFixed(1) + '</span><input type="text" placeholder="Légende">';
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
    note('Composition du panorama…', 2000);
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
      note('Story exportée. Sur Instagram : ajoute le sticker « Lien » dans la zone libre, avec le lien de la collection.', 7000);
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
      note(planches.length + ' images exportées, dans l’ordre du carrousel.', 4000);
    }).catch(function (e) { note('Export impossible : ' + e.message, 5000); })
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
    aide.textContent = reel.aLaMain ? 'Moments choisis à la main — touche pour ajouter ou retirer'
                                    : 'Moments choisis automatiquement — touche pour choisir toi-même';
    box.appendChild(aide);
    reel.candidats.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = reel.choisis.indexOf(c.cle) >= 0 ? 'on' : '';
      b.innerHTML = c.titre.replace(/</g, '&lt;') + '<small>' + c.km + ' · ' + c.n + (c.n > 1 ? ' photos' : ' photo') + (c.video ? ' · vidéo' : '') + '</small>';
      b.addEventListener('click', function () {
        var sel = reel.choisis.slice(), i = sel.indexOf(c.cle);
        if (i >= 0) {
          if (sel.length === 1) { note('Il faut au moins un moment dans le Reel.', 3000); return; }
          sel.splice(i, 1);
        } else {
          if (sel.length >= REEL_MAX) { note('Cinq moments au plus : retire-en un d’abord.', 3500); return; }
          sel.push(c.cle);
        }
        hOpts.reelMoments = sel; hSauver();
        reelMonter(); reelLire();
      });
      box.appendChild(b);
    });
    if (reel.aLaMain) {
      var a = document.createElement('button');
      a.type = 'button'; a.className = 'auto'; a.textContent = 'Automatique';
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
        progres: function (k) { $('hReelInfo').textContent = 'Encodage… ' + Math.round(k * 100) + ' %'; }
      }).then(function (blob) {
        Video.save(blob, 'reel-' + nomFichier() + '.mp4');
        note('Reel exporté en MP4 : ' + (blob.size / 1048576).toFixed(1) + ' Mo, ' + Math.round(reel.duree) + ' s, encodé en ' + Math.round((performance.now() - t0) / 1000) + ' s.', 6000);
      }).catch(function (e) { note('Export impossible : ' + e.message, 6000); })
        .then(function () { bouton.disabled = false; reelMonter(); reelLire(); });
      return;
    }
    if (!Video.pickMime()) { note('Ce navigateur ne sait pas enregistrer de vidéo (Safari) : exporte depuis Chrome ou Edge.', 6000); return; }
    cancelAnimationFrame(reelAnim);
    bouton.disabled = true;
    Video.record(cv, function (p) { reel.dessiner(ctx, p * reel.duree); }, {
      duration: reel.duree * 1000, fps: 30, bitrate: 14000000,
      at: function (k) { return { p: k, fade: 0 }; },
      onProgress: function (k) { $('hReelInfo').textContent = 'Enregistrement… ' + Math.round(k * 100) + ' % — garde l’onglet au premier plan'; }
    }).then(function (r) {
      var ext = /mp4/.test(r.mime) ? 'mp4' : 'webm';
      var nom = (hOpts.titre || lecteur.data.titre).toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
      Video.save(r.blob, 'reel-' + nom + '.' + ext);
      note('Reel exporté en ' + ext.toUpperCase() + (ext === 'webm' ? ' — Instagram préfère le MP4 : exporte depuis Chrome récent.' : '.'), 6000);
    }).catch(function (e) { note('Enregistrement interrompu : ' + e.message, 6000); })
      .then(function () { bouton.disabled = false; reelMonter(); reelLire(); });
  });
})();
