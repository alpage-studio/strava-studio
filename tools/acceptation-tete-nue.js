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

const ECRANS = [
  { nom: 'bureau',    largeur: 1280, hauteur: 900 },
  { nom: 'téléphone', largeur: 390,  hauteur: 844 }
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
