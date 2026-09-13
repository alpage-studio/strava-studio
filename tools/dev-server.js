/* Serveur local : sert le dossier, expose l'API Strava et accepte
 * POST /__save (corps = dataURL) pour écrire tools/preview.png.
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

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const PORT = parseInt(args.find(a => /^\d+$/.test(a)) || '8778', 10);
/* --lan ouvre le serveur au réseau local, pour ouvrir le studio depuis le
 * téléphone. À n'utiliser que sur un réseau de confiance : les routes /api
 * deviennent joignables par toute machine du réseau. */
const LAN = args.includes('--lan');
const HOST = LAN ? '0.0.0.0' : '127.0.0.1';
const REDIRECT = 'http://localhost:' + PORT + '/exchange_token';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.gpx': 'application/gpx+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json'
};

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(body);
}

function page(res, title, body) {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end('<!doctype html><meta charset="utf-8"><title>' + title + '</title>' +
    '<body style="font:15px/1.6 system-ui;background:#0c0e12;color:#e9ecf2;padding:60px;max-width:640px">' +
    body + '</body>');
}

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const p = u.pathname;

  /* ---------- écriture d'un aperçu (débogage) ---------- */
  if (req.method === 'POST' && p === '/__save') {
    let body = '';
    req.on('data', c => { body += c; });
    req.on('end', () => {
      const b64 = body.replace(/^data:[^;]+;base64,/, '');
      /* ?name=assets/icon-512.png écrit dans le projet ; sans nom, l'aperçu
       * de débogage. Le nom est bridé : pas de remontée d'arborescence. */
      const asked = u.searchParams.get('name');
      let out = path.join(__dirname, 'preview.png');
      if (asked && /^[\w/-]+\.(png|webmanifest|json)$/.test(asked) && !asked.includes('..')) {
        out = path.join(ROOT, asked);
        fs.mkdirSync(path.dirname(out), { recursive: true });
      }
      fs.writeFileSync(out, Buffer.from(b64, 'base64'));
      res.writeHead(200); res.end(path.relative(ROOT, out));
    });
    return;
  }

  /* ---------- OAuth ---------- */
  if (p === '/connect') {
    try {
      res.writeHead(302, { Location: strava.authorizeURL(REDIRECT) });
      res.end();
    } catch (e) {
      page(res, 'Configuration', '<h2>Configuration absente</h2><p>' + e.message + '</p>');
    }
    return;
  }

  if (p === '/exchange_token') {
    const code = u.searchParams.get('code');
    const err = u.searchParams.get('error');
    if (err || !code) {
      page(res, 'Autorisation refusée',
        '<h2>Autorisation refusée</h2><p>Strava a répondu : ' + (err || 'aucun code') + '</p>');
      return;
    }
    const granted = (u.searchParams.get('scope') || '');
    if (granted.indexOf('activity:read') < 0) {
      page(res, 'Portée insuffisante',
        '<h2>Portée insuffisante</h2><p>Strava n’a accordé que « ' + granted +
        ' ». Il faut cocher l’accès aux activités. <a style="color:#E8FF54" href="/connect">Réessayer</a></p>');
      return;
    }
    try {
      const j = await strava.exchange(code);
      page(res, 'Connecté',
        '<h2>Connecté à Strava</h2><p>Bonjour ' + ((j.athlete && j.athlete.firstname) || '') +
        '. Les jetons sont enregistrés hors du dossier du projet.</p>' +
        '<p><a style="color:#E8FF54" href="/index.html">Retour au studio</a></p>');
    } catch (e) {
      page(res, 'Échec', '<h2>Échec de l’échange</h2><pre>' + e.message + '</pre>');
    }
    return;
  }

  /* ---------- API ---------- */
  if (p.startsWith('/api/')) {
    try {
      if (p === '/api/status') return json(res, 200, strava.status());

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
      if (e.message === 'RATE_LIMIT') return json(res, 429, { error: 'RATE_LIMIT' });
      return json(res, 500, { error: e.message });
    }
  }

  /* ---------- fichiers ---------- */
  let rel = decodeURIComponent(p);
  if (rel === '/') rel = '/index.html';
  const file = path.join(ROOT, rel);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); res.end('404'); return; }
    res.writeHead(200, {
      'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  });
});

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
