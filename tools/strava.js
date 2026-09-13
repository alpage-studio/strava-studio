/* strava.js — OAuth et appels API, CÔTÉ SERVEUR uniquement.
 *
 * Le secret client ne doit jamais atteindre le navigateur : une page web est
 * lisible par quiconque l'ouvre. Il vit donc ici, dans un fichier de
 * configuration situé HORS du dossier servi, avec les jetons.
 *
 *   ~/.strava-studio/config.json   { client_id, client_secret }
 *   ~/.strava-studio/tokens.json   { access_token, refresh_token, expires_at }
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const DIR = path.join(os.homedir(), '.strava-studio');
const CONFIG = path.join(DIR, 'config.json');
const TOKENS = path.join(DIR, 'tokens.json');

const SCOPE = 'activity:read_all';   // « read » seul ne donne PAS les activités
const API = 'https://www.strava.com/api/v3';

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
}

function writeJSON(file, obj) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 1), 'utf8');
}

function config() {
  const c = readJSON(CONFIG);
  if (!c || !c.client_id || !c.client_secret) {
    throw new Error('Configuration absente : ' + CONFIG +
      ' doit contenir { "client_id": …, "client_secret": … }');
  }
  return c;
}

function tokens() { return readJSON(TOKENS); }

function authorizeURL(redirectURI) {
  const c = config();
  const q = new URLSearchParams({
    client_id: String(c.client_id),
    redirect_uri: redirectURI,
    response_type: 'code',
    approval_prompt: 'auto',
    scope: SCOPE
  });
  return 'https://www.strava.com/oauth/authorize?' + q;
}

async function exchange(code) {
  const c = config();
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: c.client_id,
      client_secret: c.client_secret,
      code: code,
      grant_type: 'authorization_code'
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Échange du code refusé : ' + JSON.stringify(j));
  writeJSON(TOKENS, {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at,
    athlete: j.athlete ? { id: j.athlete.id, firstname: j.athlete.firstname } : null
  });
  return j;
}

/* Renvoie un jeton d'accès valide, en le rafraîchissant si besoin.
 * Strava donne un expires_at en secondes epoch ; on prend 60 s de marge. */
async function accessToken() {
  const t = tokens();
  if (!t) throw new Error('NOT_AUTHORIZED');
  if (t.expires_at && t.expires_at - 60 > Math.floor(Date.now() / 1000)) {
    return t.access_token;
  }
  const c = config();
  const r = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: c.client_id,
      client_secret: c.client_secret,
      grant_type: 'refresh_token',
      refresh_token: t.refresh_token
    })
  });
  const j = await r.json();
  if (!r.ok) throw new Error('Rafraîchissement refusé : ' + JSON.stringify(j));
  writeJSON(TOKENS, {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at,
    athlete: t.athlete
  });
  return j.access_token;
}

async function call(pathname, params) {
  const token = await accessToken();
  const url = API + pathname + (params ? '?' + new URLSearchParams(params) : '');
  const r = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (r.status === 429) throw new Error('RATE_LIMIT');   // 200 / 15 min, 2000 / jour
  const j = await r.json();
  if (!r.ok) throw new Error('Strava ' + r.status + ' : ' + JSON.stringify(j));
  return j;
}

function activities(page, perPage) {
  return call('/athlete/activities', { page: page || 1, per_page: perPage || 30 });
}

function activity(id) { return call('/activities/' + id); }

function streams(id) {
  return call('/activities/' + id + '/streams', {
    keys: 'latlng,altitude,time,distance,heartrate,cadence',
    key_by_type: 'true'
  });
}

function status() {
  const t = tokens();
  let cfg = true;
  try { config(); } catch (e) { cfg = false; }
  return {
    configured: cfg,
    authorized: !!t,
    athlete: t && t.athlete ? t.athlete : null,
    expires_at: t ? t.expires_at : null,
    scope: SCOPE,
    configPath: CONFIG
  };
}

module.exports = {
  DIR, CONFIG, TOKENS, SCOPE,
  authorizeURL, exchange, activities, activity, streams, status, writeJSON
};
