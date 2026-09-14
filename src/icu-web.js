/* icu-web.js — intervals.icu appelé DIRECTEMENT depuis le navigateur.
 *
 * C'est la version sans serveur : chacun colle sa propre clé, et elle ne
 * quitte jamais son navigateur. Rien n'est partagé, rien ne transite par
 * un hébergement — il n'y en a pas.
 *
 * Possible parce qu'intervals.icu autorise les appels d'origine croisée :
 * vérifié depuis alpage-studio.github.io, la réponse est lisible. Si un
 * jour ils ferment ça, cette voie disparaît et il ne reste que le GPX.
 *
 * OÙ VIT LA CLÉ, et pourquoi là :
 *   sessionStorage, pas localStorage. Elle survit à un rechargement, elle
 *   meurt à la fermeture de l'onglet. Une clé d'API vaut un mot de passe :
 *   elle n'a pas à traîner des mois dans un navigateur partagé.
 *
 * Elle n'est jamais journalisée, jamais envoyée ailleurs qu'à intervals.icu,
 * et la page ne charge aucun script tiers — c'est ce qui rend ce stockage
 * défendable. Le jour où on ajoute une bibliothèque externe, cette
 * affirmation tombe.
 */
(function (global) {
  'use strict';

  var CLE = 'icu-key';
  var API = 'https://intervals.icu/api/v1';

  function key() {
    try { return sessionStorage.getItem(CLE) || null; } catch (e) { return null; }
  }
  function setKey(k) {
    try { sessionStorage.setItem(CLE, String(k || '').trim()); } catch (e) { /* mode privé */ }
  }
  function forget() {
    try { sessionStorage.removeItem(CLE); } catch (e) { /* rien à faire */ }
  }

  function auth() {
    return 'Basic ' + btoa('API_KEY:' + key());
  }

  async function call(pathname, params) {
    if (!key()) throw new Error('PAS_DE_CLE');
    var url = API + pathname + (params ? '?' + new URLSearchParams(params) : '');
    var r;
    try {
      r = await fetch(url, { headers: { Authorization: auth() } });
    } catch (e) {
      // origine croisée refusée, ou pas de réseau : on ne peut pas distinguer
      throw new Error('RESEAU');
    }
    if (r.status === 401 || r.status === 403) throw new Error('CLE_REFUSEE');
    if (r.status === 429) throw new Error('QUOTA');
    var j = await r.json();
    if (!r.ok) throw new Error('intervals ' + r.status);
    return j;
  }

  function iso(d) { return d.toISOString().slice(0, 10); }

  /* Les N dernières sorties. L'API EXIGE une fenêtre oldest/newest — sans
   * elle, 422. On élargit une fois si la moisson est maigre. */
  async function activities(limit) {
    limit = limit || 5;

    async function fenetre(jours) {
      return call('/athlete/0/activities', {
        oldest: iso(new Date(Date.now() - jours * 86400000)),
        newest: iso(new Date())
      });
    }

    var liste = await fenetre(60);
    if (!Array.isArray(liste) || liste.length < limit) {
      try {
        var large = await fenetre(365);
        if (Array.isArray(large) && large.length > liste.length) liste = large;
      } catch (e) { /* on garde la première fenêtre */ }
    }

    return (liste || [])
      .filter(function (a) { return a.distance > 500; })
      .slice(0, limit)
      .map(function (a) {
        return {
          id: a.id, name: a.name, type: a.type,
          start_date_local: a.start_date_local,
          distance: a.distance, moving_time: a.moving_time,
          total_elevation_gain: a.total_elevation_gain,
          has_power: !!(a.stream_types || []).includes('watts')
        };
      });
  }

  /* Détail + flux, dans la forme que src/activity.js sait lire. */
  async function activity(id) {
    var detail = await call('/activity/' + id);
    var streams = [];
    try {
      streams = await call('/activity/' + id + '/streams', {
        types: 'latlng,altitude,time,distance,heartrate,watts,cadence'
      });
    } catch (e) { /* une sortie sans flux reste affichable */ }
    return { detail: detail, streams: streams };
  }

  global.IcuWeb = {
    key: key, setKey: setKey, forget: forget,
    activities: activities, activity: activity
  };
}(window));
