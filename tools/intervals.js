/* intervals.js — connecteur intervals.icu, CÔTÉ SERVEUR uniquement.
 *
 * Pourquoi intervals plutôt que Strava : l'API est en libre-service (une clé
 * se génère dans /settings), elle est alimentée DIRECTEMENT depuis Garmin,
 * et elle ne dépend donc pas de l'abonnement Strava.
 *
 * La clé vaut un mot de passe : elle donne accès à toutes tes données. Elle
 * vit dans ~/.strava-studio/config.json, hors du dossier servi, et ne
 * descend jamais dans la page.
 *
 * Deux particularités apprises en testant l'API, pas dans la doc :
 *   - /activities EXIGE une fenêtre oldest/newest, sinon 422 ;
 *   - l'identifiant d'athlète « 0 » désigne le titulaire de la clé.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');

const CONFIG = path.join(os.homedir(), '.strava-studio', 'config.json');
const API = 'https://intervals.icu/api/v1';

function config() {
  let c = null;
  try { c = JSON.parse(fs.readFileSync(CONFIG, 'utf8')); } catch (e) { /* absent */ }
  const i = c && c.intervals;
  if (!i || !i.api_key) {
    throw new Error('NOT_CONFIGURED');
  }
  return { key: i.api_key, athlete: i.athlete_id || '0' };
}

function auth(key) {
  return 'Basic ' + Buffer.from('API_KEY:' + key).toString('base64');
}

async function call(pathname, params) {
  const c = config();
  const url = API + pathname + (params ? '?' + new URLSearchParams(params) : '');
  const r = await fetch(url, { headers: { Authorization: auth(c.key) } });
  if (r.status === 401 || r.status === 403) throw new Error('BAD_KEY');
  if (r.status === 429) throw new Error('RATE_LIMIT');  // 5000/jour, 2500/15 min
  const j = await r.json();
  if (!r.ok) throw new Error('intervals ' + r.status + ' : ' + JSON.stringify(j).slice(0, 200));
  return j;
}

/* Les N dernières activités. On remonte d'abord sur 60 jours ; si la moisson
 * est maigre (reprise après blessure, hiver), on élargit une fois plutôt que
 * de renvoyer une liste vide. */
async function activities(limit) {
  const c = config();
  limit = limit || 5;

  async function fenetre(jours) {
    const fin = new Date();
    const debut = new Date(Date.now() - jours * 86400000);
    const iso = d => d.toISOString().slice(0, 10);
    return call('/athlete/' + c.athlete + '/activities', {
      oldest: iso(debut), newest: iso(fin)
    });
  }

  let liste = await fenetre(60);
  if (!Array.isArray(liste) || liste.length < limit) {
    const large = await fenetre(365);
    if (Array.isArray(large) && large.length > liste.length) liste = large;
  }

  return (liste || [])
    .filter(a => a.distance > 500)                    // on écarte les non-sorties
    .slice(0, limit)
    .map(a => ({
      id: a.id,
      name: a.name,
      type: a.type,
      start_date_local: a.start_date_local,
      distance: a.distance,
      moving_time: a.moving_time,
      total_elevation_gain: a.total_elevation_gain,
      // stream_types dit ce que la sortie contient VRAIMENT : c'est lui qui
      // permet de ne proposer la puissance que quand elle existe
      streams: a.stream_types || [],
      has_power: !!(a.stream_types || []).includes('watts')
    }));
}

function activity(id) { return call('/activity/' + id); }

function streams(id) {
  return call('/activity/' + id + '/streams', {
    types: 'latlng,altitude,time,distance,heartrate,watts,cadence'
  });
}

function status() {
  try {
    const c = config();
    return { configured: true, athlete: c.athlete, source: 'intervals.icu' };
  } catch (e) {
    return { configured: false, source: 'intervals.icu', configPath: CONFIG };
  }
}

module.exports = { activities, activity, streams, status, CONFIG };
