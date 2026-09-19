/* acceptation-tete-nue.js — le parcours réel, sans personne devant l'écran.
 *
 *   node tools/acceptation-tete-nue.js                 # le dépôt, en local
 *   node tools/acceptation-tete-nue.js --moteur webkit # le moteur de Safari
 *   node tools/acceptation-tete-nue.js --moteur tous   # les deux
 *   node tools/acceptation-tete-nue.js --url https://alpage-studio.github.io/strava-studio/
 *
 * CE QUE ÇA AJOUTE À tools/acceptation.js
 *   Rien, et c'est voulu : les cas sont les MÊMES, dans le même fichier. Ce
 *   script ne fait que les lancer tout seuls, dans un Chromium sans fenêtre, et
 *   à DEUX largeurs — 1280 px puis 390 px. Les cas « téléphone » de
 *   l'acceptation sont derrière une condition `max-width: 900px` : à la main on
 *   ne les voyait qu'en redimensionnant, c'est-à-dire rarement.
 *
 * DEUX MOTEURS, ET CE N'EST PAS UNE PRÉCAUTION DE PRINCIPE
 *   Cinquante-trois cas ont tourné pendant des semaines dans Chromium et
 *   nulle part ailleurs. La première exécution dans WebKit — le moteur de
 *   Safari, donc de tout navigateur sur iPhone — a trouvé en trois minutes ce
 *   qu'aucune n'avait vu : le voile dit « global » n'atteignait que quinze
 *   planches sur trente-deux. Il ne l'a pas trouvé en étant plus strict, mais
 *   en étant plus LENT : un délai fixe qui tenait dans Chromium ne tenait plus,
 *   le cas a échoué, et en le rendant honnête il a nommé une planche nue.
 *
 *   CE QUE WEBKIT NE PROUVE PAS : que l'export vidéo marche sur un iPhone. La
 *   compilation de Playwright n'embarque ni `canvas.captureStream` ni
 *   `MediaRecorder` — ce sont ses modules media qui manquent, pas ceux de
 *   Safari. Un échec ici n'est pas un verdict sur iOS, et le présenter
 *   autrement serait exactement le contrôle qui ne contrôle pas ce qu'il dit.
 *
 * POURQUOI PLAYWRIGHT ALORS QUE LE PROJET N'A AUCUNE DÉPENDANCE
 *   « Zéro dépendance » est une règle du PRODUIT : ce que télécharge un
 *   visiteur. Un navigateur installé dans un runner de CI ne met rien dans le
 *   dépôt, ne part avec aucun fichier servi, et disparaît avec la machine.
 *   Confondre les deux reviendrait à refuser un bon contrôle au nom d'une règle
 *   qui ne parle pas de lui.
 *
 *   Il n'est pas installé ici par défaut. En local :
 *       npm i -g playwright && npx playwright install chromium
 *
 * LE DÉTAIL QUI COINCE, ET SA RAISON
 *   Le serveur de développement REFUSE de servir tools/ — c'est un
 *   durcissement, pas un oubli. La page, elle, porte une CSP en `script-src
 *   'self'` : elle refuse un script injecté en ligne. Les deux ensemble
 *   interdisent la voie évidente. On intercepte donc la requête vers
 *   `tools/acceptation.js` et on la sert depuis le disque : l'URL reste de la
 *   même origine, la CSP est satisfaite, et le durcissement du serveur n'est
 *   pas touché. En `--url`, aucune interception : on veut éprouver le fichier
 *   RÉELLEMENT déployé.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const RACINE = path.join(__dirname, '..');
const PORT = 8791;

const iUrl = process.argv.indexOf('--url');
const URL_EXTERNE = iUrl > 0 ? process.argv[iUrl + 1] : null;
const BAVARD = process.argv.indexOf('--bavard') > 0;
const iMoteur = process.argv.indexOf('--moteur');
const MOTEUR = iMoteur > 0 ? process.argv[iMoteur + 1] : 'chromium';

/* TROIS LARGEURS, ET LA DU MILIEU EST LA PLUS IMPORTANTE.
 *
 * Les essais tournaient a 390 et 1280. Une accolade manquante avait enferme
 * toute la feuille de style dans un `@media (max-width: 400px)` : sous 400 px
 * elle s'appliquait, au-dessus rien — et 1280 ne le voyait pas parce que les
 * cas n'y lisaient que le DOM. 430 px est la largeur d'un iPhone Plus ou Pro
 * Max : juste au-dessus du seuil, et c'est la que le defaut a ete signale. */
const ECRANS = [
  { nom: 'bureau',         largeur: 1280, hauteur: 900 },
  { nom: 'grand téléphone', largeur: 430, hauteur: 932 },
  { nom: 'téléphone',      largeur: 390,  hauteur: 844 }
];

function playwright() {
  try {
    return require('playwright');
  } catch (e) {
    console.log('playwright est absent.\n' +
      '  en local : npm i -g playwright && npx playwright install chromium\n' +
      '  puis      NODE_PATH="$(npm root -g)" node tools/acceptation-tete-nue.js');
    process.exit(1);
  }
}

function attends(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

/* ATTENDRE UNE CONDITION, PAS UNE DURÉE — la même règle que dans
 * acceptation.js, et pour la même raison : un délai calibré sur cette machine
 * mesure la patience de celui qui l'a écrit, pas l'état du serveur. */
async function serveurPret(url, limite) {
  const t0 = Date.now();
  while (Date.now() - t0 < (limite || 20000)) {
    const vivant = await new Promise(function (r) {
      const req = http.get(url, function (res) { res.resume(); r(res.statusCode < 500); });
      req.on('error', function () { r(false); });
      req.setTimeout(1500, function () { req.destroy(); r(false); });
    });
    if (vivant) return true;
    await attends(250);
  }
  return false;
}

async function passe(navigateur, base, ecran, interception) {
  const contexte = await navigateur.newContext({
    viewport: { width: ecran.largeur, height: ecran.hauteur }
  });
  /* ON POSE LA CONDITION QUE LE CAS EXIGE.
   *
   * Le bandeau « depuis ta dernière visite » ne s'affiche PAS au premier
   * passage — c'est voulu : accueillir un nouveau venu par la liste de ce
   * qu'il a manqué n'a aucun sens. Mais chaque execution part d'un navigateur
   * neuf : le cas qui verifie que sa croix ferme vraiment etait donc SAUTE a
   * tous les coups, et il l'a ete pendant des semaines.
   *
   * C'est le defaut qu'OZ avait signale a la main — « je n'arrive pas a
   * fermer Since your last visit ». Un controle qui ne s'execute jamais ne
   * protege de rien ; on lui donne la visite precedente qu'il lui faut. */
  await contexte.addInitScript(function () {
    try { localStorage.setItem('strava-studio-vu', '1.4'); } catch (e) { /* mode prive */ }
  });

  const page = await contexte.newPage();

  const erreurs = [];
  page.on('pageerror', function (e) { erreurs.push(String(e.message || e)); });

  /* --bavard recopie la console de la page. Quand un cas échoue ici et passe à
   * la main, c'est la première chose à regarder. */
  if (BAVARD) {
    page.on('console', function (m) {
      console.log('    [' + m.type() + '] ' + m.text().slice(0, 300));
    });
    page.on('requestfailed', function (r) {
      console.log('    [requête perdue] ' + r.url());
    });
    page.on('response', function (r) {
      if (r.status() >= 400) console.log('    [' + r.status() + '] ' + r.url());
    });
  }

  if (interception) {
    const source = fs.readFileSync(path.join(__dirname, 'acceptation.js'), 'utf8');
    await page.route('**/tools/acceptation.js', function (route) {
      route.fulfill({ status: 200, contentType: 'application/javascript; charset=utf-8',
                      body: source });
    });
  }

  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });

  /* L'application se met en place au chargement ; on attend un repère du DOM
   * plutôt qu'un délai.
   *
   * DEUX CHOSES ICI, ET LES DEUX ONT COÛTÉ UNE EXÉCUTION ROUGE.
   *
   * 1. `polling` EN MILLISECONDES, PAS EN IMAGES. Par défaut, une attente
   *    réévalue sa condition à chaque image (`requestAnimationFrame`). Une
   *    page qui n'est jamais peinte — c'est le cas dans un Chromium sans
   *    fenêtre — ne produit pas d'image : la condition serait évaluée une fois
   *    puis plus jamais.
   *
   * 2. UNE FONCTION, PAS UNE CHAÎNE. Avec une chaîne, le scrutateur que
   *    Playwright installe dans la page la compile sur place — et la page
   *    porte `script-src 'self'`, qui interdit exactement cela. Le lanceur
   *    rapportait alors « l'acceptation n'a rendu aucun résultat » sur une
   *    acceptation qui se terminait en cinq secondes : c'est la politique de
   *    sécurité qui bloquait le contrôle, pas le produit qui échouait.
   *    C'est la deuxième fois que cette CSP attrape notre propre outillage —
   *    le premier lanceur, dans la console, utilisait `new Function`. À chaque
   *    fois le bon réflexe est le même : ne pas l'affaiblir, passer autrement. */
  await page.waitForFunction(function () { return !!document.querySelector('#stage'); },
                             null, { timeout: 20000, polling: 250 });

  await page.evaluate(function () {
    var s = document.createElement('script');
    s.src = 'tools/acceptation.js';
    document.head.appendChild(s);
  });

  /* On garde la RAISON de l'attente perdue. Un `catch` qui renvoie `false`
   * transforme « playwright a refusé mes arguments » et « la page n'a jamais
   * fini » en un seul et même message — et on cherche alors le défaut dans le
   * produit alors qu'il est dans le lanceur. */
  let pourquoi = null;
  const arrive = await page.waitForFunction(function () { return !!window.__acceptation; },
                                            /* WEBKIT EST PLUS LENT, ET UN DEPASSEMENT
                                             * N'EST PAS UN DEFAUT DU PRODUIT : le
                                             * budget est large pour que l'echec, quand
                                             * il arrive, parle du studio et non de la
                                             * machine. */
                                            null, { timeout: 300000, polling: 250 })
    .then(function () { return true; })
    .catch(function (e) { pourquoi = String(e.message || e).split('\n')[0]; return false; });

  const resultats = arrive
    ? await page.evaluate(function () { return window.__acceptation; })
    : [];
  await contexte.close();
  return { resultats: resultats, arrive: arrive, erreurs: erreurs, pourquoi: pourquoi };
}

(async function () {
  const pw = playwright();
  const moteurs = MOTEUR === 'tous' ? ['chromium', 'webkit']
                : MOTEUR === 'webkit' ? ['webkit'] : ['chromium'];
  moteurs.forEach(function (m) {
    if (!pw[m]) {
      console.log('moteur inconnu : ' + m + '  (chromium, webkit, ou tous)');
      process.exit(1);
    }
  });
  let serveur = null;
  let base = URL_EXTERNE;

  if (!base) {
    serveur = spawn(process.execPath, [path.join(__dirname, 'dev-server.js'), String(PORT)],
                    { cwd: RACINE, stdio: 'ignore' });
    base = 'http://127.0.0.1:' + PORT + '/';
    if (!await serveurPret(base)) {
      console.log('le serveur de développement n\'a pas répondu sur ' + base);
      serveur.kill();
      process.exitCode = 1;
      return;
    }
  }

  /* ATTENDRE QUE LE SITE SERVE LA BONNE VERSION.
   *
   * En `--url`, ce lanceur tourne juste apres un deploiement, quand le reseau
   * de diffusion de Pages n'a pas fini de propager : il recoit alors un
   * melange d'ancien et de nouveau et rapporte des echecs qui ne parlent que
   * de propagation. Le studio, lui, allait bien — verifie a la main juste
   * apres, 195 cas sur 195.
   *
   * Un controle qui echoue une fois sur deux sans que rien ne soit casse est
   * pire qu'absent : on apprend a ignorer sa couleur.
   *
   * C'est la MEME faute que les delais fixes deja corriges dans ce fichier,
   * et c'est la troisieme fois qu'elle se paie : attendre une CONDITION,
   * jamais une duree. La condition, ici, est que le numero servi soit celui
   * du depot. */
  if (URL_EXTERNE) {
    const attendue = (/STUDIO_VERSION = '([\d.]+)'/
      .exec(fs.readFileSync(path.join(RACINE, 'src', 'version.js'), 'utf8')) || [])[1];
    if (attendue) {
      const t0 = Date.now();
      let servie = null;
      while (Date.now() - t0 < 180000) {
        servie = await new Promise(function (r) {
          const u = base.replace(/\/?$/, '/') + 'src/version.js?ci=' + Date.now();
          const mod = u.indexOf('https:') === 0 ? require('https') : http;
          mod.get(u, function (res) {
            let t = '';
            res.on('data', function (c) { t += c; });
            res.on('end', function () {
              const m = /STUDIO_VERSION = '([\d.]+)'/.exec(t);
              r(m ? m[1] : null);
            });
          }).on('error', function () { r(null); });
        });
        if (servie === attendue) break;
        await attends(5000);
      }
      if (servie !== attendue) {
        console.log('le site sert ' + servie + ' alors que le depot est en ' +
                    attendue + " — la propagation n'a pas abouti en trois minutes");
        process.exitCode = 1;
        return;
      }
      console.log('version servie : ' + servie + '  (obtenue apres ' +
                  Math.round((Date.now() - t0) / 1000) + ' s)');
    }
  }
  console.log('Acceptation tête nue — ' + base +
              '  ·  ' + moteurs.join(' + ') + '\n');

  let echecs = 0, cas = 0, sautes = 0;
  let navigateur = null;

  try {
    for (const nomMoteur of moteurs) {
    if (navigateur) await navigateur.close();
    navigateur = await pw[nomMoteur].launch();
    if (moteurs.length > 1) console.log('=== ' + nomMoteur.toUpperCase() + ' ===');
    for (const ecran of ECRANS) {
      const r = await passe(navigateur, base, ecran, !URL_EXTERNE);
      console.log(ecran.nom + '  ' + ecran.largeur + ' × ' + ecran.hauteur);

      if (!r.arrive) {
        echecs++; cas++;
        console.log('  ÉCHEC  l\'acceptation n\'a pas rendu de résultats' +
                    (r.pourquoi ? '\n         ' + r.pourquoi : ''));
      }
      r.resultats.forEach(function (x) {
        if (x.verdict === 'sauté') { sautes++; return; }
        cas++;
        if (x.verdict === 'ÉCHEC') {
          echecs++;
          console.log('  ÉCHEC  ' + x.cas + (x.detail ? '\n         ' + x.detail : ''));
        }
      });
      r.erreurs.forEach(function (e) {
        echecs++;
        console.log('  ÉCHEC  exception non rattrapée : ' + e);
      });
      console.log('  ' + r.resultats.filter(function (x) { return x.verdict === 'ok'; }).length +
                  ' cas passés\n');
    }
    }
  } finally {
    if (navigateur) await navigateur.close();
    if (serveur) serveur.kill();
  }

  console.log((cas - echecs) + ' / ' + cas + ' cas · ' + echecs + ' échec(s)' +
              (sautes ? ' · ' + sautes + ' sautés' : ''));
  console.log('NON COUVERT ICI : aperçu animé, export vidéo, séquence PNG — ils ' +
              'demandent MediaRecorder sur plusieurs secondes.');
  process.exitCode = echecs ? 1 : 0;
}());
