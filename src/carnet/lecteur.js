/* lecteur.js — le carnet de route qu'on fait défiler.
 *
 * Il ne lit ni GPX ni EXIF : il reçoit un carnet déjà composé (voir
 * composer.js) et le déroule. La carte et le profil restent à l'écran ;
 * le récit défile à côté, et le kilomètre lu à hauteur d'œil pilote le
 * tracé. C'est la seule règle du lecteur : LE DÉFILEMENT EST UNE DISTANCE.
 *
 * Tout le lecteur vit dans `fabrique`, sans rien emprunter au reste du
 * studio. Ce n'est pas du zèle : l'export d'un carnet autonome recopie
 * `fabrique.toString()` dans le fichier partagé. Une dépendance ajoutée ici
 * casserait le fichier partagé sans rien casser dans le studio.
 *
 * Le carnet ne contient AUCUNE coordonnée : la trace arrive déjà projetée
 * dans un carré unité (x, y), avec ses kilomètres et ses altitudes. Ce
 * qu'on partage dessine le parcours sans pouvoir le replacer sur une carte.
 */
(function (global) {
  'use strict';

  function fabrique() {

    var CSS = [
      '.cr{--bg:#F7F5EF;--panel:#EEEAE1;--line:#D8D5CC;--ink:#252820;--mut:#62665C;--acc:#A54F37;',
      '--sans:"Archivo","Helvetica Neue",Helvetica,Arial,sans-serif;--mono:"IBM Plex Mono",ui-monospace,Consolas,monospace;',
      'background:var(--bg);color:var(--ink);font:16px/1.55 var(--sans);display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr);min-height:100vh}',
      '.cr *{box-sizing:border-box}',
      '.cr-carte{position:sticky;top:0;height:100vh;display:flex;flex-direction:column;padding:28px 28px 22px;border-right:1px solid var(--line);background:var(--bg)}',
      '.cr-carte canvas{display:block;width:100%}',
      '.cr-plan{flex:1 1 auto;min-height:0}',
      '.cr-profil{height:88px;flex:0 0 auto;margin-top:14px}',
      '.cr-lecture{display:flex;align-items:baseline;gap:18px;flex-wrap:wrap;font:13px/1.3 var(--mono);color:var(--mut);letter-spacing:.02em}',
      '.cr-lecture b{font:600 30px/1 var(--sans);font-stretch:112%;color:var(--ink);letter-spacing:-.01em}',
      '.cr-lecture .cr-etq{margin-left:auto;text-transform:uppercase;letter-spacing:.12em;font-size:11px}',
      '.cr-recit{min-width:0}',
      '.cr-couv{position:relative;height:100vh;display:flex;align-items:flex-end;overflow:hidden;background:#1d1f19;color:#FBF9F4}',
      '.cr-couv img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;transform:scale(1.04);transition:transform 8s ease-out}',
      '.cr-couv.vu img{transform:scale(1)}',
      '.cr-couv:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,20,15,0) 35%,rgba(20,20,15,.78))}',
      '.cr-couv div{position:relative;z-index:1;padding:0 48px 56px}',
      '.cr-couv h1{font:800 clamp(44px,7vw,96px)/.92 var(--sans);font-stretch:118%;letter-spacing:-.03em;margin:0 0 14px}',
      '.cr-couv p{margin:0;font:15px/1.5 var(--mono);opacity:.88;letter-spacing:.02em}',
      '.cr-couv .cr-sous{font:400 22px/1.3 var(--sans);opacity:1;margin-bottom:18px;max-width:30ch}',
      '.cr-fil{padding:0 48px 18vh}',
      '.cr-chap{padding:22vh 0 8vh;border-bottom:1px solid var(--line)}',
      '.cr-chap .cr-num{font:12px var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--acc)}',
      '.cr-chap h2{font:800 clamp(34px,4.4vw,58px)/1 var(--sans);font-stretch:115%;letter-spacing:-.025em;margin:14px 0 18px}',
      '.cr-chap h2 span{color:var(--mut);font-weight:300}',
      '.cr-chap p{font:14px var(--mono);color:var(--mut);margin:0}',
      '.cr-rep{display:flex;gap:14px;align-items:baseline;font:13px/1.4 var(--mono);color:var(--mut);padding:10px 0;border-top:1px dashed var(--line)}',
      '.cr-rep b{font:600 17px/1.3 var(--sans);color:var(--ink)}',
      '.cr-rep i{font-style:normal;min-width:64px;color:var(--acc)}',
      '.cr-fig{margin:0;padding:0}',
      '.cr-fig .cr-cadre{position:relative;overflow:hidden;background:var(--panel);cursor:zoom-in}',
      '.cr-fig img,.cr-fig video{display:block;width:100%;height:auto;transition:transform .9s cubic-bezier(.2,.7,.2,1),opacity .9s}',
      '.cr-fig video{position:absolute;inset:0;height:100%;object-fit:cover;opacity:0}',
      '.cr-fig.vivant video{opacity:1}',
      '.cr-fig .cr-cadre{opacity:0;transform:translateY(28px);transition:opacity .8s,transform .8s cubic-bezier(.2,.7,.2,1)}',
      '.cr-fig.vu .cr-cadre{opacity:1;transform:none}',
      '.cr-fig figcaption{display:flex;flex-wrap:wrap;gap:2px 12px;align-items:baseline;padding:10px 0 0;font:12px/1.4 var(--mono);color:var(--mut)}',
      '.cr-serie figcaption b{flex-basis:100%}',
      '.cr-fig figcaption b{font:500 15px/1.35 var(--sans);color:var(--ink)}',
      '.cr-fig figcaption i{font-style:normal;color:var(--acc);white-space:nowrap}',
      '.cr-seul.cr-portrait{width:64%}',
      '.cr-seul.cr-portrait.cr-droite{margin-left:auto}',
      '.cr-serie{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:start}',
      '.cr-serie.cr-trois{grid-template-columns:1.3fr 1fr}',
      '.cr-serie.cr-trois .cr-fig:first-child{grid-row:span 2}',
      '.cr-fin{padding:22vh 0 10vh;text-align:left}',
      '.cr-fin h2{font:800 clamp(40px,5vw,72px)/.95 var(--sans);font-stretch:118%;letter-spacing:-.03em;margin:0 0 20px}',
      '.cr-fin p{font:14px/1.7 var(--mono);color:var(--mut);margin:0}',
      '.cr-boite{position:fixed;inset:0;z-index:50;background:rgba(18,18,14,.94);display:none;align-items:center;justify-content:center;cursor:zoom-out;padding:3vh 3vw}',
      '.cr-boite.ouvert{display:flex}',
      '.cr-boite img,.cr-boite video{max-width:100%;max-height:100%;object-fit:contain}',
      '.cr-komoot{display:flex;flex-wrap:wrap;gap:10px;padding:26px 48px 0}',
      '.cr-komoot a{font:600 15px/1.2 var(--sans);text-decoration:none;border-radius:99px;padding:12px 18px;border:1.5px solid var(--ink);color:var(--ink)}',
      '.cr-komoot a.cr-principal{background:var(--ink);color:var(--bg)}',
      '.cr-fin .cr-komoot{padding:26px 0 0}',
      '.cr-sommaire{display:flex;flex-wrap:wrap;gap:8px;padding:28px 48px 0}',
      '.cr-sommaire button{font:13px/1.2 var(--mono);border:1px solid var(--line);background:var(--panel);color:var(--ink);border-radius:99px;padding:8px 12px;cursor:pointer}',
      '.cr-sommaire button.cr-et{background:var(--ink);color:var(--bg);border-color:var(--ink)}',
      '.cr-prog,.cr-bascule{display:none}',
      '@media (max-width:900px){',
      '.cr{grid-template-columns:1fr}',
      /* sur téléphone la carte devient un BANDEAU : le lieu, le kilomètre et la
       * progression, sur une ligne. La carte se déplie d'un geste. */
      '.cr-carte{height:auto;z-index:5;padding:10px 16px 0;border-right:0;border-bottom:1px solid var(--line);box-shadow:0 2px 10px rgba(37,40,32,.08)}',
      '.cr-carte .cr-plan,.cr-carte .cr-profil{display:none}',
      '.cr-carte.cr-ouverte .cr-plan{display:block;height:46vh}',
      '.cr-carte.cr-ouverte .cr-profil{display:block;height:44px;margin-top:4px}',
      '.cr-lecture{gap:10px;font-size:11px;flex-wrap:nowrap;align-items:center}',
      '.cr-lecture b,.cr-lecture .cr-alt{font-size:20px;white-space:nowrap;flex:0 0 auto}.cr-lecture .cr-alt{font-size:11px}',
      '.cr-lecture .cr-etq{margin-left:0;flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10.5px}',
      '.cr-bascule{display:block;flex:0 0 auto;font:12px var(--mono);border:1px solid var(--line);background:var(--bg);color:var(--ink);border-radius:99px;padding:6px 10px;cursor:pointer}',
      '.cr-prog{display:block;height:3px;background:var(--line);margin:10px -16px 0}',
      '.cr-prog i{display:block;height:100%;width:0;background:var(--acc)}',
      '.cr-couv{height:62vh}.cr-couv div{padding:0 16px 28px}.cr-couv .cr-sous{font-size:18px}',
      '.cr-komoot{padding:18px 16px 0}',
      '.cr-sommaire{padding:20px 16px 0;flex-wrap:nowrap;overflow-x:auto;-webkit-overflow-scrolling:touch}',
      '.cr-sommaire button{flex:0 0 auto}',
      '.cr-fil{padding:0 16px 12vh}',
      '.cr-chap{padding:9vh 0 4vh}',
      '.cr-chap h2{font-size:34px}',
      // une colonne de grandes photos : rien ne rapetisse côte à côte
      '.cr-seul.cr-portrait{width:100%}',
      '.cr-serie,.cr-serie.cr-trois{grid-template-columns:1fr;gap:22px}',
      '.cr-serie.cr-trois .cr-fig:first-child{grid-row:auto}',
      '.cr-fig figcaption{font-size:13px}.cr-fig figcaption b{font-size:16px}',
      '.cr-rep{font-size:12px}.cr-rep b{font-size:15px}',
      '}',
      '@media (prefers-reduced-motion:reduce){.cr-fig .cr-cadre,.cr-couv img{transition:none;transform:none;opacity:1}}'
    ].join('\n');

    function el(tag, cls, html) {
      var e = document.createElement(tag);
      if (cls) e.className = cls;
      if (html != null) e.innerHTML = html;
      return e;
    }
    function esc(s) {
      return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
        .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    // un nom de lieu ne se coupe pas : « Le » seul en fin de ligne
    function insecable(s) { return esc(s).replace(/ /g, '\u00A0'); }
    function fKm(km) { return km.toFixed(1).replace('.', ',') + ' km'; }
    function fM(m) { return Math.round(m).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' m'; }

    /* l'indice du point de trace au kilomètre donné — recherche dichotomique */
    function indiceAuKm(T, km) {
      var a = 0, b = T.km.length - 1;
      if (km <= T.km[0]) return 0;
      if (km >= T.km[b]) return b;
      while (b - a > 1) { var m = (a + b) >> 1; if (T.km[m] <= km) a = m; else b = m; }
      return a;
    }
    function auKm(T, km) {
      var i = indiceAuKm(T, km), j = Math.min(i + 1, T.km.length - 1);
      var span = T.km[j] - T.km[i], f = span > 0 ? (km - T.km[i]) / span : 0;
      f = Math.max(0, Math.min(1, f));
      return {
        i: i, x: T.x[i] + (T.x[j] - T.x[i]) * f, y: T.y[i] + (T.y[j] - T.y[i]) * f,
        ele: T.ele[i] + (T.ele[j] - T.ele[i]) * f
      };
    }

    /* ---------- le récit ----------
     * Une suite d'éléments, chacun porteur de son kilomètre. L'espace
     * vertical entre deux éléments suit l'écart de distance : une longue
     * montée sans photo se lit longue, trois photos au même col s'enchaînent.
     */
    function construireFil(data) {
      var items = [];
      data.etapes.forEach(function (et, n) {
        items.push({ type: 'chap', km: et.kmDebut, etape: et, n: n });
        var dedans = [];
        data.medias.forEach(function (m) { if (m.km >= et.kmDebut && m.km < et.kmFin + (n === data.etapes.length - 1 ? 1e-6 : 0)) dedans.push({ type: 'media', km: m.km, m: m }); });
        (data.reperes || []).forEach(function (r) {
          if (r.km > et.kmDebut + 0.3 && r.km < et.kmFin - 0.3) dedans.push({ type: 'rep', km: r.km, r: r });
        });
        dedans.sort(function (a, b) { return a.km - b.km; });
        // les photos prises à moins de 1,2 km l'une de l'autre forment une série
        var k = 0;
        while (k < dedans.length) {
          var it = dedans[k];
          if (it.type !== 'media') { items.push(it); k++; continue; }
          var serie = [it];
          while (k + serie.length < dedans.length && dedans[k + serie.length].type === 'media' &&
                 dedans[k + serie.length].km - serie[serie.length - 1].km < 1.2 && serie.length < 3) {
            serie.push(dedans[k + serie.length]);
          }
          items.push(serie.length === 1 ? it : { type: 'serie', km: serie[0].km, liste: serie });
          k += serie.length;
        }
      });
      items.push({ type: 'fin', km: data.total.km });
      return items;
    }

    function legendeAuto(data, km) {
      var best = null;
      (data.reperes || []).forEach(function (r) {
        var d = Math.abs(r.km - km);
        if (d < 1.6 && (!best || d < best.d)) best = { d: d, r: r };
      });
      return best ? best.r.nom : '';
    }

    function figure(data, m, cls) {
      var f = el('figure', 'cr-fig ' + (cls || ''));
      f.dataset.km = m.km;
      f.dataset.id = m.id;
      var cadre = el('div', 'cr-cadre');
      var img = el('img');
      img.src = m.src; img.alt = m.legende || ''; img.loading = 'lazy'; img.decoding = 'async';
      if (m.w && m.h) { img.width = m.w; img.height = m.h; }
      cadre.appendChild(img);
      if (m.video) {
        var v = el('video');
        v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'none';
        v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
        v.src = m.video;
        v.addEventListener('playing', function () { f.classList.add('vivant'); });
        v.addEventListener('error', function () { v.remove(); });   // HEVC illisible : la photo reste
        cadre.appendChild(v);
      }
      f.appendChild(cadre);
      var leg = m.legende || legendeAuto(data, m.km);
      var p = auKm(data.trace, m.km);
      // une position estimée ne s'affiche pas au dixième : elle ne le vaut pas
      var kmLu = m.statut === 'estimee' ? '≈ km ' + Math.round(m.km) : fKm(m.km);
      f.appendChild(el('figcaption', '', '<i>' + kmLu + '</i><span>' + fM(p.ele) + '</span>' +
        (leg ? '<b>' + esc(leg) + '</b>' : '')));
      return f;
    }

    function monter(root, data) {
      if (!document.getElementById('cr-style')) {
        var st = el('style'); st.id = 'cr-style'; st.textContent = CSS; document.head.appendChild(st);
      }
      root.innerHTML = '';
      var cr = el('div', 'cr');
      var aside = el('aside', 'cr-carte');
      var lecture = el('div', 'cr-lecture', '<b>0,0 km</b><span class="cr-alt"></span><span class="cr-etq"></span>');
      var plan = el('canvas', 'cr-plan');
      var profil = el('canvas', 'cr-profil');
      var bascule = el('button', 'cr-bascule', 'Carte');
      bascule.type = 'button';
      lecture.appendChild(bascule);
      var prog = el('div', 'cr-prog', '<i></i>');
      aside.appendChild(lecture); aside.appendChild(plan); aside.appendChild(profil); aside.appendChild(prog);
      bascule.addEventListener('click', function () {
        var ouverte = aside.classList.toggle('cr-ouverte');
        bascule.textContent = ouverte ? 'Fermer' : 'Carte';
        requestAnimationFrame(function () { dessiner(); });
      });
      var recit = el('main', 'cr-recit');
      cr.appendChild(aside); cr.appendChild(recit);
      root.appendChild(cr);

      /* la couverture */
      var couv = el('section', 'cr-couv');
      var mc = data.medias.filter(function (m) { return m.id === data.couverture; })[0] || data.medias[0];
      couv.innerHTML = (mc ? '<img src="' + esc(mc.src) + '" alt="">' : '') +
        '<div><h1>' + esc(data.titre) + '</h1>' +
        (data.sousTitre ? '<p class="cr-sous">' + esc(data.sousTitre) + '</p>' : '') +
        '<p>' + fKm(data.total.km) + ' · ' + fM(data.total.dplus) + ' de dénivelé · ' +
        data.etapes.length + (data.etapes.length > 1 ? ' étapes' : ' étape') + '</p></div>';
      recit.appendChild(couv);
      requestAnimationFrame(function () { couv.classList.add('vu'); });
      /* les liens Komoot : ici ils se CLIQUENT, contrairement aux images
       * Instagram. En tête pour qui veut y aller tout de suite, à la fin pour
       * qui a tout lu. */
      function liensKomoot() {
        var K = data.komoot;
        if (!K || (!K.tour && !K.collection)) return null;
        var box = el('div', 'cr-komoot');
        function lien(url, txt, cls) {
          if (!/^https:\/\/(www\.)?komoot\.[a-z]+\//.test(url || '')) return;   // uniquement des liens Komoot
          var a = el('a', cls || '', esc(txt)); a.href = url; a.target = '_blank'; a.rel = 'noopener';
          box.appendChild(a);
        }
        lien(K.tour, 'Voir le parcours sur Komoot', 'cr-principal');
        lien(K.collection, K.nom ? 'La collection ' + K.nom : 'La collection sur Komoot');
        return box.childNodes.length ? box : null;
      }
      var kHaut = liensKomoot();
      if (kHaut) recit.appendChild(kHaut);
      var sommaire = el('nav', 'cr-sommaire');
      sommaire.setAttribute('aria-label', 'Aller à');
      recit.appendChild(sommaire);

      var fil = el('div', 'cr-fil');
      recit.appendChild(fil);
      var items = construireFil(data), noeuds = [], cote = 0, precedent = 0;
      items.forEach(function (it) {
        var n;
        if (it.type === 'chap') {
          var et = it.etape;
          n = el('section', 'cr-chap',
            '<div class="cr-num">Étape ' + (it.n + 1) + ' / ' + data.etapes.length + '</div>' +
            '<h2>' + insecable(et.de) + ' <span>→</span> ' + insecable(et.a) + '</h2>' +
            '<p>' + fKm(et.kmFin - et.kmDebut) + ' · ' + fM(et.dplus) + ' de montée · ' +
            'alt. max. ' + fM(et.altMax) + '</p>');
        } else if (it.type === 'rep') {
          n = el('div', 'cr-rep', '<i>' + fKm(it.r.km) + '</i><b>' + esc(it.r.nom) + '</b><span>' +
            (it.r.alt != null ? 'passage à ' + fM(it.r.alt) : fM(auKm(data.trace, it.r.km).ele)) + '</span>');
        } else if (it.type === 'media') {
          var portrait = it.m.h > it.m.w;
          n = figure(data, it.m, 'cr-seul' + (portrait ? ' cr-portrait' + (cote++ % 2 ? ' cr-droite' : '') : ''));
        } else if (it.type === 'serie') {
          n = el('div', 'cr-serie' + (it.liste.length === 3 ? ' cr-trois' : ''));
          it.liste.forEach(function (s) { n.appendChild(figure(data, s.m)); });
        } else {
          n = el('section', 'cr-fin', '<h2>' + esc(data.etapes[data.etapes.length - 1].a) + '</h2>' +
            '<p>' + fKm(data.total.km) + ' · ' + fM(data.total.dplus) + ' D+</p>');
          var kBas = liensKomoot();
          if (kBas) n.appendChild(kBas);
        }
        if (it.type === 'media' || it.type === 'serie' || it.type === 'rep') {
          var ecart = it.km - precedent;
          n.style.marginTop = Math.round(Math.max(it.type === 'rep' ? 12 : 40, Math.min(260, ecart * 9))) + 'px';
        }
        precedent = it.km;
        n.dataset.km = it.km;
        fil.appendChild(n);
        noeuds.push({ n: n, km: it.km });
      });

      /* le sommaire se remplit une fois le fil posé : une pastille par étape,
       * une par lieu nommé qui porte une photo */
      var vus = {};
      noeuds.forEach(function (x) {
        var n = x.n, nom = null, cls = '';
        if (n.classList.contains('cr-chap')) { nom = 'Étape ' + (n.querySelector('.cr-num').textContent.match(/\d+/) || [''])[0]; cls = 'cr-et'; }
        else {
          var b = n.querySelector && n.querySelector('figcaption b');
          if (b) nom = b.textContent;
        }
        if (!nom || vus[nom]) return;
        vus[nom] = true;
        var bt = el('button', cls, esc(nom));
        bt.type = 'button';
        bt.addEventListener('click', function () { n.scrollIntoView({ behavior: 'smooth', block: 'start' }); });
        sommaire.appendChild(bt);
      });

      /* ---------- la visionneuse ---------- */
      var boite = el('div', 'cr-boite');
      cr.appendChild(boite);
      boite.addEventListener('click', function () { boite.classList.remove('ouvert'); boite.innerHTML = ''; });
      fil.addEventListener('click', function (e) {
        var f = e.target.closest && e.target.closest('.cr-fig');
        if (!f || cr.classList.contains('cr-edition')) return;
        var m = data.medias.filter(function (x) { return x.id === f.dataset.id; })[0];
        if (!m) return;
        var vid = f.classList.contains('vivant') && m.video;
        boite.innerHTML = vid ? '<video src="' + esc(m.video) + '" autoplay loop muted playsinline></video>'
                              : '<img src="' + esc(m.src) + '" alt="">';
        boite.classList.add('ouvert');
      });
      document.addEventListener('keydown', function (e) { if (e.key === 'Escape') boite.click(); });

      /* ---------- apparition et vidéos ---------- */
      if ('IntersectionObserver' in window) {
        var io = new IntersectionObserver(function (es) {
          es.forEach(function (e) {
            var v = e.target.querySelector('video');
            if (e.isIntersecting) {
              e.target.classList.add('vu');
              if (v) { var pr = v.play(); if (pr && pr.catch) pr.catch(function () {}); }
            } else if (v) v.pause();
          });
        }, { threshold: 0.25 });
        fil.querySelectorAll('.cr-fig').forEach(function (f) { io.observe(f); });
      } else fil.querySelectorAll('.cr-fig').forEach(function (f) { f.classList.add('vu'); });

      /* ---------- le dessin ---------- */
      var T = data.trace, kmCourant = 0, voulu = 0, anime = false;
      var vignettes = {};
      data.medias.forEach(function (m) {
        var i = new Image(); i.decoding = 'async'; i.src = m.src;
        i.onload = function () { if (Math.abs(m.km - kmCourant) < 1.2) dessiner(); };
        vignettes[m.id] = i;
      });
      var styleCr = getComputedStyle(cr);
      function c(nom) { return styleCr.getPropertyValue(nom).trim(); }

      function taille(cv) {
        var r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
        var w = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
        if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
        return { w: w, h: h, dpr: dpr };
      }

      function dessinerPlan(km) {
        var z = taille(plan), ctx = plan.getContext('2d'), d = z.dpr;
        ctx.clearRect(0, 0, z.w, z.h);
        var pad = 26 * d, aw = z.w - 2 * pad, ah = z.h - 2 * pad;
        var s = Math.min(aw / T.largeur, ah / T.hauteur);
        var ox = pad + (aw - T.largeur * s) / 2, oy = pad + (ah - T.hauteur * s) / 2;
        function X(i) { return ox + T.x[i] * s; }
        function Y(i) { return oy + T.y[i] * s; }
        var p = auKm(T, km), n = T.x.length;
        ctx.lineJoin = 'round'; ctx.lineCap = 'round';

        /* le relief réel, s'il a été préparé : l'ombrage puis les courbes,
         * très bas en contraste — il porte le lieu, il ne doit pas voler la trace */
        if (data.relief) {
          var Rl = data.relief;
          if (Rl.ombre && !Rl.__img) { Rl.__img = new Image(); Rl.__img.onload = function () { dessiner(); }; Rl.__img.src = Rl.ombre.src; }
          if (Rl.__img && Rl.__img.complete && Rl.__img.naturalWidth) {
            ctx.globalCompositeOperation = 'multiply'; ctx.globalAlpha = 0.28;
            ctx.drawImage(Rl.__img, ox + Rl.ombre.x0 * s, oy + Rl.ombre.y0 * s, (Rl.ombre.x1 - Rl.ombre.x0) * s, (Rl.ombre.y1 - Rl.ombre.y0) * s);
            ctx.globalCompositeOperation = 'source-over';
          }
          ctx.strokeStyle = '#8A6446';
          [0, 1].forEach(function (m) {
            ctx.globalAlpha = m ? 0.42 : 0.2; ctx.lineWidth = (m ? 1.3 : 0.7) * d;
            ctx.beginPath();
            Rl.courbes.forEach(function (cb) {
              if (cb.m !== m) return;
              for (var k = 0; k < cb.x.length; k++) ctx[k ? 'lineTo' : 'moveTo'](ox + cb.x[k] * s, oy + cb.y[k] * s);
            });
            ctx.stroke();
          });
          ctx.globalAlpha = 1;
          ctx.fillStyle = c('--mut'); ctx.font = (9.5 * d) + 'px ' + c('--mono'); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
          ctx.fillText('relief © swisstopo', z.w - 4 * d, z.h - 4 * d);
        }

        // le parcours entier, en attente — plus appuyé quand le relief est dessous, sinon il s'y perd
        ctx.strokeStyle = data.relief ? c('--mut') : c('--line'); ctx.lineWidth = (data.relief ? 2 : 1.6) * d;
        ctx.globalAlpha = data.relief ? 0.7 : 1;
        ctx.beginPath(); ctx.moveTo(X(0), Y(0));
        for (var i = 1; i < n; i++) ctx.lineTo(X(i), Y(i));
        ctx.stroke();
        ctx.globalAlpha = 1;

        // ce qui est parcouru : l'étape en cours à l'encre, les précédentes adoucies
        var etc = etapeAuKm(km);
        data.etapes.forEach(function (et, k) {
          if (et.kmDebut > km) return;
          var a = indiceAuKm(T, et.kmDebut), b = et.kmFin < km ? indiceAuKm(T, et.kmFin) + 1 : p.i;
          ctx.strokeStyle = c('--ink'); ctx.globalAlpha = k === etc ? 1 : 0.45;
          ctx.lineWidth = (k === etc ? 2.6 : 2) * d;
          ctx.beginPath(); ctx.moveTo(X(a), Y(a));
          for (var j = a + 1; j <= Math.min(b, n - 1); j++) ctx.lineTo(X(j), Y(j));
          if (k === etc || et.kmFin >= km) ctx.lineTo(ox + p.x * s, oy + p.y * s);
          ctx.stroke();
        });
        ctx.globalAlpha = 1;

        // les photos : un carré, plein une fois dépassé
        data.medias.forEach(function (m) {
          var q = auKm(T, m.km), x = ox + q.x * s, y = oy + q.y * s, r = 3.2 * d;
          ctx.fillStyle = m.km <= km ? c('--acc') : c('--bg');
          ctx.strokeStyle = m.km <= km ? c('--acc') : c('--mut');
          ctx.lineWidth = 1 * d;
          ctx.fillRect(x - r, y - r, 2 * r, 2 * r); ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
        });

        // les repères : un point et un nom, lisible seulement quand on s'en approche
        ctx.font = (10.5 * d) + 'px ' + c('--mono');
        ctx.textBaseline = 'middle';
        (data.reperes || []).forEach(function (r) {
          var q = auKm(T, r.km), x = ox + q.x * s, y = oy + q.y * s;
          var proche = Math.abs(r.km - km) < 6;
          ctx.fillStyle = r.km <= km ? c('--ink') : c('--mut');
          ctx.beginPath(); ctx.arc(x, y, 2 * d, 0, 7); ctx.fill();
          if (proche || r.fort) {
            ctx.globalAlpha = proche ? 1 : 0.55;
            var droite = q.x * s < T.largeur * s * 0.62;
            ctx.textAlign = droite ? 'left' : 'right';
            ctx.fillText(r.nom, x + (droite ? 8 : -8) * d, y);
            ctx.globalAlpha = 1;
          }
        });

        // départ
        ctx.strokeStyle = c('--ink'); ctx.lineWidth = 1.5 * d;
        ctx.beginPath(); ctx.arc(X(0), Y(0), 5 * d, 0, 7); ctx.stroke();

        /* la photo qu'on regarde, épinglée là où elle a été prise.
         * Elle s'efface à mesure qu'on s'en éloigne : à 1,2 km, plus rien. */
        var proche = null;
        data.medias.forEach(function (m) {
          var e = Math.abs(m.km - km);
          if (e < 1.2 && (!proche || e < proche.e)) proche = { e: e, m: m };
        });
        var im = proche && vignettes[proche.m.id];
        if (im && im.complete && im.naturalWidth) {
          var q = auKm(T, proche.m.km), qx = ox + q.x * s, qy = oy + q.y * s;
          var cote = Math.min(z.w, z.h) * 0.24, ar = im.naturalWidth / im.naturalHeight;
          var vw = ar >= 1 ? cote : cote * ar, vh = ar >= 1 ? cote / ar : cote;
          // vers l'intérieur de la carte, pour ne jamais sortir du cadre
          var cxm = ox + T.largeur * s / 2, cym = oy + T.hauteur * s / 2;
          var dx = cxm - qx, dy = cym - qy, nn = Math.hypot(dx, dy) || 1;
          var vx = qx + dx / nn * cote * 0.75 - vw / 2, vy = qy + dy / nn * cote * 0.75 - vh / 2;
          vx = Math.max(4 * d, Math.min(z.w - vw - 4 * d, vx));
          vy = Math.max(4 * d, Math.min(z.h - vh - 4 * d, vy));
          ctx.globalAlpha = Math.max(0, 1 - proche.e / 1.2);
          ctx.strokeStyle = c('--ink'); ctx.lineWidth = 1 * d;
          ctx.beginPath(); ctx.moveTo(qx, qy);
          ctx.lineTo(Math.max(vx, Math.min(vx + vw, qx)), Math.max(vy, Math.min(vy + vh, qy))); ctx.stroke();
          ctx.shadowColor = 'rgba(37,40,32,.25)'; ctx.shadowBlur = 14 * d; ctx.shadowOffsetY = 3 * d;
          ctx.fillStyle = '#FBF9F4';
          var bord = 4 * d;
          ctx.fillRect(vx - bord, vy - bord, vw + 2 * bord, vh + 2 * bord);
          ctx.shadowColor = 'transparent';
          ctx.drawImage(im, vx, vy, vw, vh);
          ctx.globalAlpha = 1;
        }

        // la position
        var px = ox + p.x * s, py = oy + p.y * s;
        ctx.fillStyle = c('--acc'); ctx.globalAlpha = 0.18;
        ctx.beginPath(); ctx.arc(px, py, 13 * d, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath(); ctx.arc(px, py, 5 * d, 0, 7); ctx.fill();
        ctx.strokeStyle = c('--bg'); ctx.lineWidth = 2 * d; ctx.stroke();

        // l'échelle : dix kilomètres, sans rien dire de l'endroit
        if (T.kmParUnite) {
          var l = 10 / T.kmParUnite * s, bx = pad, by = z.h - 8 * d;
          ctx.strokeStyle = c('--mut'); ctx.lineWidth = 1 * d;
          ctx.beginPath(); ctx.moveTo(bx, by - 4 * d); ctx.lineTo(bx, by); ctx.lineTo(bx + l, by); ctx.lineTo(bx + l, by - 4 * d); ctx.stroke();
          ctx.fillStyle = c('--mut'); ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
          ctx.fillText('10 km', bx + l + 6 * d, by + 1 * d);
        }
      }

      function dessinerProfil(km) {
        var z = taille(profil), ctx = profil.getContext('2d'), d = z.dpr;
        ctx.clearRect(0, 0, z.w, z.h);
        var n = T.km.length, top = 6 * d, bas = z.h - 2 * d;
        var emin = T.eleMin, emax = T.eleMax, total = T.km[n - 1];
        function X(k) { return k / total * z.w; }
        function Y(e) { return bas - (e - emin) / Math.max(1, emax - emin) * (bas - top); }
        ctx.beginPath(); ctx.moveTo(0, bas);
        for (var i = 0; i < n; i++) ctx.lineTo(X(T.km[i]), Y(T.ele[i]));
        ctx.lineTo(z.w, bas); ctx.closePath();
        ctx.fillStyle = c('--panel'); ctx.fill();
        // la part parcourue
        ctx.save(); ctx.beginPath(); ctx.rect(0, 0, X(km), z.h); ctx.clip();
        ctx.beginPath(); ctx.moveTo(0, bas);
        for (i = 0; i < n; i++) ctx.lineTo(X(T.km[i]), Y(T.ele[i]));
        ctx.lineTo(z.w, bas); ctx.closePath();
        ctx.fillStyle = c('--line'); ctx.fill();
        ctx.beginPath();
        for (i = 0; i < n; i++) ctx[i ? 'lineTo' : 'moveTo'](X(T.km[i]), Y(T.ele[i]));
        ctx.strokeStyle = c('--ink'); ctx.lineWidth = 1.4 * d; ctx.stroke();
        ctx.restore();
        // les nuits
        ctx.strokeStyle = c('--mut'); ctx.setLineDash([2 * d, 3 * d]); ctx.lineWidth = 1 * d;
        data.etapes.slice(1).forEach(function (et) {
          ctx.beginPath(); ctx.moveTo(X(et.kmDebut), top); ctx.lineTo(X(et.kmDebut), bas); ctx.stroke();
        });
        ctx.setLineDash([]);
        // les photos
        data.medias.forEach(function (m) {
          ctx.fillStyle = m.km <= km ? c('--acc') : c('--mut');
          ctx.fillRect(X(m.km) - 1 * d, bas - 5 * d, 2 * d, 5 * d);
        });
        var p = auKm(T, km);
        ctx.strokeStyle = c('--acc'); ctx.lineWidth = 1.5 * d;
        ctx.beginPath(); ctx.moveTo(X(km), top); ctx.lineTo(X(km), bas); ctx.stroke();
        ctx.fillStyle = c('--acc');
        ctx.beginPath(); ctx.arc(X(km), Y(p.ele), 3.5 * d, 0, 7); ctx.fill();
      }

      function etapeAuKm(km) {
        for (var k = data.etapes.length - 1; k >= 0; k--) if (km >= data.etapes[k].kmDebut) return k;
        return 0;
      }

      var bKm = lecture.querySelector('b'), sAlt = lecture.querySelector('.cr-alt'), sEt = lecture.querySelector('.cr-etq');
      var barre = prog.querySelector('i');
      function dessiner() {
        barre.style.width = (kmCourant / data.total.km * 100).toFixed(1) + '%';
        if (plan.offsetParent !== null) dessinerPlan(kmCourant);
        if (profil.offsetParent !== null) dessinerProfil(kmCourant);
        var et = data.etapes[etapeAuKm(kmCourant)];
        bKm.textContent = fKm(kmCourant);
        sAlt.textContent = fM(auKm(T, kmCourant).ele);
        sEt.textContent = et ? et.de + ' → ' + et.a : '';
      }

      /* ---------- le défilement devient une distance ----------
       * La ligne de lecture est à 55 % de la hauteur : ce qui la franchit est
       * « ce qu'on regarde ». Entre deux éléments, le kilomètre s'interpole
       * sur leur position, de sorte que le point avance continûment. */
      function kmLu() {
        var ligne = window.innerHeight * 0.55, prev = null;
        for (var i = 0; i < noeuds.length; i++) {
          var r = noeuds[i].n.getBoundingClientRect();
          var y = r.top + Math.min(r.height, window.innerHeight) * 0.5;
          if (y > ligne) {
            if (!prev) return noeuds[i].km * Math.max(0, 1 - (y - ligne) / window.innerHeight);
            var f = (ligne - prev.y) / Math.max(1, y - prev.y);
            return prev.km + (noeuds[i].km - prev.km) * f;
          }
          prev = { y: y, km: noeuds[i].km };
        }
        return data.total.km;
      }
      /* l'amorti se compte en millisecondes, pas en images : sur un
       * téléphone qui tombe à 20 images par seconde, le point doit arriver
       * aussi vite qu'à 120. */
      var dernier = 0;
      function boucle(t) {
        var dt = dernier ? Math.min(250, t - dernier) : 16;
        dernier = t;
        var d = voulu - kmCourant;
        kmCourant = Math.abs(d) < 0.02 ? voulu : kmCourant + d * (1 - Math.exp(-dt / 110));
        dessiner();
        if (kmCourant !== voulu) requestAnimationFrame(boucle); else { anime = false; dernier = 0; }
      }
      function surDefilement() {
        voulu = Math.max(0, Math.min(data.total.km, kmLu()));
        if (!anime) { anime = true; requestAnimationFrame(boucle); }
      }
      window.addEventListener('scroll', surDefilement, { passive: true });
      window.addEventListener('resize', function () { styleCr = getComputedStyle(cr); dessiner(); surDefilement(); });
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(dessiner);
      dessiner();
      surDefilement();

      return { racine: cr, redessiner: dessiner, allerAuKm: function (km) {
        var cible = null;
        noeuds.forEach(function (x) { if (!cible && x.km >= km) cible = x; });
        if (cible) cible.n.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } };
    }

    return { CSS: CSS, monter: monter, auKm: auKm };
  }

  var L = fabrique();
  L.source = fabrique.toString();
  global.CarnetLecteur = L;
})(this);
