/* Serveur local : sert le dossier, expose l'API Strava et accepte
 * POST /__save (corps = dataURL) pour écrire tools/preview.png, ou
 * apercus/<nom>.png avec ?nom= (--debug uniquement).
 *
 *   node tools/dev-server.js [port]
 *
 * Le secret client ne transite JAMAIS par le navigateur : toutes les
 * requêtes Strava partent d'ici.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const strava = require('./strava');
const intervals = require('./intervals');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const PORT = parseInt(args.find(a => /^\d+$/.test(a)) || '8778', 10);
/* --lan ouvre le serveur au réseau local, pour ouvrir le studio depuis le
 * téléphone. À n'utiliser que sur un réseau de confiance : les routes /api
 * deviennent joignables par toute machine du réseau. */
const LAN = args.includes('--lan');
/* --debug rouvre l'écriture de tools/preview.png, utilisée pour contrôler
 * un rendu hors du navigateur. Jamais avec --lan. */
const DEBUG = args.includes('--debug');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const REDIRECT = 'http://localhost:' + PORT + '/exchange_token';

/* Jeton anti-rejeu du flux OAuth : Strava nous le rend tel quel, et il
 * prouve que le retour correspond à une connexion lancée depuis CE
 * serveur. Sans lui, n'importe quelle page peut nous faire échanger un
 * code qu'elle a choisi. */
const crypto = require('crypto');
let oauthState = null;

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.gpx': 'application/gpx+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

/* Tout ce qui vient d'une URL, d'un fournisseur ou d'un fichier est du
 * texte hostile tant qu'il n'est pas échappé. Les pages de retour OAuth
 * recopiaient `error` et `scope` tels quels : une URL forgée y plaçait du
 * JavaScript, exécuté sous l'origine du studio — donc avec accès aux
 * routes locales du compte connecté. */
function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function page(res, title, body) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    // rien d'extérieur ne doit pouvoir s'exécuter dans ces pages
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'"
  });
  res.end('<!doctype html><meta charset="utf-8"><title>' + esc(title) + '</title>' +
    '<body style="font:15px/1.6 system-ui;background:#0c0e12;color:#e9ecf2;padding:60px;max-width:640px">' +
    body + '</body>');
}

/* Le gestionnaire est asynchrone : toute exception non rattrapée devient
 * une promesse rejetée, que Node peut traiter en arrêtant le processus.
 * On l'enveloppe une fois pour toutes. */
const server = http.createServer((req, res) => {
  Promise.resolve(traite(req, res)).catch(e => {
    console.error('erreur non rattrapée :', e && e.message);
    if (!res.headersSent) { res.writeHead(500); res.end('erreur interne'); }
  });
});

async function traite(req, res) {
  let u;
  try {
    u = new URL(req.url, 'http://localhost');
  } catch (e) {
    res.writeHead(400); res.end('URL invalide'); return;
  }
  const p = u.pathname;

  /* ---------- écriture d'un aperçu ----------
   * Cette route écrivait n'importe quel fichier du projet (?name=…), sans
   * authentification ni limite de taille, et restait ouverte en --lan :
   * toute machine du réseau pouvait remplacer un script de l'application.
   *
   * Elle est désormais ABSENTE par défaut. Avec --debug, elle ne fait plus
   * qu'une chose : écrire tools/preview.png, en local, sous 16 Mo. Aucun
   * nom de destination n'est accepté. */
  if (req.method === 'POST' && p === '/__save') {
    if (!DEBUG || LAN) { res.writeHead(404); res.end('404'); return; }
    /* D'OÙ vient la requête. Un POST en text/plain est une requête CORS
     * « simple » : aucun pré-vol, donc n'importe quelle page ouverte dans le
     * même navigateur pouvait écrire dans apercus/ tant que --debug tournait.
     * L'écriture reste bornée — un PNG, un dossier ignoré — mais elle était
     * bien déclenchée par un tiers.
     *
     * Une origine absente est acceptée : c'est le cas d'un `curl`, qui n'est
     * pas un navigateur et n'a donc rien à usurper. */
    const origine = req.headers.origin;
    if (origine && origine !== 'http://127.0.0.1:' + PORT &&
        origine !== 'http://localhost:' + PORT) {
      res.writeHead(403); res.end('origine refusée'); return;
    }
    let taille = 0;
    const morceaux = [];
    req.on('data', c => {
      taille += c.length;
      /* Répondre AVANT de couper : `destroy()` seul laisse le client
       * attendre une réponse qui ne viendra jamais. */
      if (taille > 16 * 1024 * 1024) {
        res.writeHead(413); res.end('trop gros');
        req.destroy(); return;
      }
      morceaux.push(c);
    });
    req.on('end', () => {
      try {
        const b64 = morceaux.join('').replace(/^data:[^;]+;base64,/, '');
        /* Un nom est accepté, mais RECONSTRUIT : on ne garde que des
         * minuscules, des chiffres et des tirets, et la destination est
         * toujours apercus/. Reprendre le nom reçu — même « nettoyé »
         * par un remplacement de « .. » — laisse passer « ....//» et écrit
         * où l'on veut. Reconstruire ne laisse rien passer du tout. */
        const brut = u.searchParams.get('nom') || '';
        const nom = brut.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 60);
        let dest, rendu;
        if (nom) {
          /* À la RACINE, pas dans tools/ : le serveur refuse de servir
           * tools/ (durcissement de sécurité), et des aperçus qu'on ne peut
           * pas ouvrir dans le navigateur ne servent à rien. */
          const dossier = path.join(__dirname, '..', 'apercus');
          if (!fs.existsSync(dossier)) fs.mkdirSync(dossier);
          dest = path.join(dossier, nom + '.png');
          rendu = 'apercus/' + nom + '.png';
        } else {
          dest = path.join(__dirname, 'preview.png');
          rendu = 'preview.png';
        }
        fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
        res.writeHead(200); res.end(rendu);
      } catch (e) { res.writeHead(400); res.end('corps invalide'); }
    });
    return;
  }

  /* ---------- OAuth ---------- */
  if (p === '/connect') {
    try {
      oauthState = crypto.randomBytes(16).toString('hex');
      res.writeHead(302, { Location: strava.authorizeURL(REDIRECT) + '&state=' + oauthState });
      res.end();
    } catch (e) {
      page(res, 'Configuration', '<h2>Configuration absente</h2><p>' + esc(e.message) + '</p>');
    }
    return;
  }

  if (p === '/exchange_token') {
    const code = u.searchParams.get('code');
    const err = u.searchParams.get('error');

    // le retour doit correspondre à une connexion lancée ici
    if (!oauthState || u.searchParams.get('state') !== oauthState) {
      page(res, 'Retour non reconnu',
        '<h2>Retour non reconnu</h2><p>Ce retour ne correspond à aucune connexion ' +
        'lancée depuis ce serveur. <a style="color:#C8F04E" href="/connect">Recommencer</a></p>');
      return;
    }
    oauthState = null;   // à usage unique

    if (err || !code) {
      page(res, 'Autorisation refusée',
        '<h2>Autorisation refusée</h2><p>Strava a répondu : ' + esc(err || 'aucun code') + '</p>');
      return;
    }
    const granted = (u.searchParams.get('scope') || '');
    if (granted.indexOf('activity:read') < 0) {
      page(res, 'Portée insuffisante',
        '<h2>Portée insuffisante</h2><p>Strava n’a accordé que « ' + esc(granted) +
        ' ». Il faut cocher l’accès aux activités. <a style="color:#C8F04E" href="/connect">Réessayer</a></p>');
      return;
    }
    try {
      const j = await strava.exchange(code);
      page(res, 'Connecté',
        '<h2>Connecté à Strava</h2><p>Bonjour ' + esc((j.athlete && j.athlete.firstname) || '') +
        '. Les jetons sont enregistrés hors du dossier du projet.</p>' +
        '<p><a style="color:#C8F04E" href="/index.html">Retour au studio</a></p>');
    } catch (e) {
      page(res, 'Échec', '<h2>Échec de l’échange</h2><pre>' + esc(e.message) + '</pre>');
    }
    return;
  }

  /* ---------- API ---------- */
  if (p.startsWith('/api/')) {
    try {
      if (p === '/api/status') return json(res, 200, strava.status());

      /* ---- intervals.icu ---- */
      if (p === '/api/icu/status') return json(res, 200, intervals.status());

      if (p === '/api/icu/activities') {
        const n = parseInt(u.searchParams.get('limit') || '5', 10);
        return json(res, 200, await intervals.activities(n));
      }

      const mi = p.match(/^\/api\/icu\/activity\/([\w.-]+)$/);
      if (mi) {
        const [detail, st] = await Promise.all([
          intervals.activity(mi[1]),
          intervals.streams(mi[1]).catch(() => [])
        ]);
        return json(res, 200, { detail: detail, streams: st });
      }

      if (p === '/api/activities') {
        const list = await strava.activities(
          parseInt(u.searchParams.get('page') || '1', 10),
          parseInt(u.searchParams.get('per_page') || '30', 10)
        );
        // on ne renvoie que ce dont la page a besoin
        return json(res, 200, list.map(a => ({
          id: a.id, name: a.name, type: a.sport_type || a.type,
          start_date_local: a.start_date_local,
          distance: a.distance, moving_time: a.moving_time,
          total_elevation_gain: a.total_elevation_gain,
          has_map: !!(a.map && a.map.summary_polyline)
        })));
      }

      const m = p.match(/^\/api\/activity\/(\d+)$/);
      if (m) {
        const [detail, st] = await Promise.all([
          strava.activity(m[1]),
          strava.streams(m[1]).catch(() => ({}))
        ]);
        return json(res, 200, { detail: detail, streams: st });
      }

      return json(res, 404, { error: 'inconnu' });
    } catch (e) {
      if (e.message === 'NOT_AUTHORIZED') return json(res, 401, { error: 'NOT_AUTHORIZED' });
      if (e.message === 'NOT_CONFIGURED') return json(res, 501, { error: 'NOT_CONFIGURED' });
      if (e.message === 'BAD_KEY') return json(res, 401, { error: 'BAD_KEY' });
      if (e.message === 'RATE_LIMIT') return json(res, 429, { error: 'RATE_LIMIT' });
      return json(res, 500, { error: e.message });
    }
  }

  /* ---------- fichiers ---------- */
  /* decodeURIComponent lève sur une séquence invalide (/%ZZ). Dans un
   * gestionnaire asynchrone, la promesse rejetée pouvait terminer le
   * processus : une URL mal formée suffisait à arrêter le serveur. */
  let rel;
  try {
    rel = decodeURIComponent(p);
  } catch (e) {
    res.writeHead(400); res.end('URL mal formée'); return;
  }
  /* Un dossier se sert par son index, comme le fera l'hébergement une fois
   * le site en ligne. Sans cette ligne, /apercus/ renvoyait 404 en local
   * alors qu'il s'ouvre en ligne : le serveur de développement ne montrait
   * donc PAS ce qui allait être publié, ce qui est exactement ce qu'on lui
   * demande. */
  if (rel.endsWith('/')) rel += 'index.html';

  const file = path.resolve(ROOT, '.' + path.posix.normalize(rel.replace(/\\/g, '/')));
  /* startsWith(ROOT) ne teste qu'un préfixe de texte : un dossier voisin
   * nommé « strava-studio-private » le satisfaisait. On vérifie
   * l'appartenance réelle, via le chemin relatif. */
  const dedans = path.relative(ROOT, file);
  if (dedans.startsWith('..') || path.isAbsolute(dedans)) {
    res.writeHead(403); res.end('403'); return;
  }
  // rien de ce qui n'appartient pas à l'application ne se sert
  if (/(^|[\\/])(\.git|node_modules|tools|design)([\\/]|$)/.test(dedans)) {
    res.writeHead(403); res.end('403'); return;
  }

  /* EN RÉSEAU, les traces réelles ne sortent pas.
   *
   * --lan sert le répertoire de travail. Or c'est là qu'atterrissent les
   * .gpx exportés de Strava — ceux que .gitignore écarte précisément parce
   * que leur premier point est un domicile. Ils étaient donc lisibles par
   * toute machine du Wi-Fi. Seuls les exemples SYNTHÉTIQUES, ceux que le
   * dépôt publie, restent accessibles ; la liste suit celle du .gitignore.
   *
   * En local (127.0.0.1) rien ne change : c'est ta propre machine. */
  if (LAN && /\.gpx$/i.test(dedans)) {
    const base = path.basename(dedans);
    const publiable = /^(exemple|exemple-[a-z]+|demo-[a-z]+|sem-[a-z0-9]+|loin-[a-z])\.gpx$/i.test(base);
    if (!publiable) { res.writeHead(403); res.end('403'); return; }
  }

  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
}

server.listen(PORT, HOST, () => {
  const s = strava.status();
  console.log('http://127.0.0.1:' + PORT);
  if (LAN) {
    const nets = require('os').networkInterfaces();
    Object.keys(nets).forEach(name => {
      (nets[name] || []).forEach(n => {
        if (n.family === 'IPv4' && !n.internal) {
          console.log('  depuis le téléphone : http://' + n.address + ':' + PORT);
        }
      });
    });
    console.log('  (réseau local ouvert — les routes /api sont joignables)');
  }
  console.log('Strava : ' + (s.configured ? 'configuré' : 'NON configuré (' + s.configPath + ')') +
    ', ' + (s.authorized ? 'autorisé' : 'non autorisé → http://localhost:' + PORT + '/connect'));
});
