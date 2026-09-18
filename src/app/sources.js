/* sources.js — d'ou viennent les sorties : intervals.icu, Strava, et le formulaire de cle
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;
  var canvas = A.canvas;
  var SIZES = A.SIZES;
  var syncBibliotheque = A.syncBibliotheque;
  var draw = A.draw;
  var buildOptions = A.buildOptions;
  var summary = A.summary;
  var slug = A.slug;
  var escapeHtml = A.escapeHtml;
  var syncManualFields = A.syncManualFields;

  /* ---------- source d'activités ----------
   * Deux fournisseurs possibles, même interface : intervals.icu d'abord —
   * sa clé est en libre-service et il se synchronise directement depuis
   * Garmin, donc il ne dépend pas de l'abonnement Strava — puis Strava en
   * repli si quelqu'un d'autre reprend ce code avec un compte abonné. */
  var stravaActs = [];
  var source = null;          // 'icu' | 'strava'

  function stravaState(html) { $('#strava-state').innerHTML = html; }

  async function stravaInit() {
    var icu = null, st = null;
    try {
      icu = await (await fetch('api/icu/status')).json();
      st = await (await fetch('api/status')).json();
    } catch (e) {
      /* Pas de serveur local : le studio tourne depuis un hébergement
       * statique. On ne tombe plus dans le vide — intervals.icu accepte les
       * appels d'origine croisée, donc chacun peut coller SA clé, gardée
       * dans son seul navigateur. */
      source = 'icu-web';
      if (IcuWeb.key()) { connecteIcuWeb(); }
      else { stravaState('intervals.icu — colle ta clé pour charger tes sorties.'); formulaireCle(true); }
      return;
    }

    if (icu && icu.configured) {
      source = 'icu';
      stravaState(T('intervals.icu — connecté'));
      $('#strava-refresh').style.display = '';
      loadList();
      return;
    }

    if (st && st.configured && st.authorized) {
      source = 'strava';
      /* Le prénom vient de l'API et part dans innerHTML : il s'échappe, comme
       * tout ce qui n'a pas été écrit ici. C'est la seule chaîne de cette
       * fonction qui ne soit pas de nous. */
      stravaState(T('Strava — connecté') +
        (st.athlete && st.athlete.firstname ? ' · ' + escapeHtml(st.athlete.firstname) : ''));
      $('#strava-refresh').style.display = '';
      loadList();
      return;
    }

    if (st && st.configured && !st.authorized) {
      stravaState('Strava — <a href="/connect">connecter mon compte</a> ' +
        '(portée <code>' + escapeHtml(st.scope) + '</code>, obligatoire pour lire les activités).');
      return;
    }
    stravaState('Aucune source configurée — charge un fichier GPX.');
  }

  function formulaireCle(visible) {
    $('#icu-form').style.display = visible ? '' : 'none';
    $('#icu-forget').style.display = visible ? 'none' : '';
  }

  function connecteIcuWeb() {
    source = 'icu-web';
    stravaState(T('intervals.icu — connecté depuis ce navigateur'));
    formulaireCle(false);
    $('#strava-refresh').style.display = '';
    loadList();
  }

  $('#icu-connect').addEventListener('click', function () {
    var k = $('#icu-key').value.trim();
    if (!k) return;
    IcuWeb.setKey(k);
    $('#icu-key').value = '';        // on ne la laisse pas dans le champ
    connecteIcuWeb();
  });
  $('#icu-key').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') $('#icu-connect').click();
  });

  $('#icu-forget').addEventListener('click', function () {
    IcuWeb.forget();
    $('#strava-list').style.display = 'none';
    $('#strava-refresh').style.display = 'none';
    stravaState('intervals.icu — clé oubliée.');
    formulaireCle(true);
  });

  async function loadList() {
    var sel = $('#strava-list');
    sel.style.display = '';
    sel.innerHTML = '<option>chargement…</option>';
    try {
      /* Cinq sorties suffisent : on fait une affiche de la sortie du jour,
       * pas de l'historique. Et chaque appel compte dans le quota. */
      if (source === 'icu-web') {
        var web = await IcuWeb.activities(5);
        remplitListe(web);
        return;
      }
      var url = source === 'icu' ? 'api/icu/activities?limit=5' : 'api/activities?per_page=30';
      var r = await fetch(url);
      if (r.status === 401) { stravaState('Autorisation refusée — clé ou jeton à refaire.'); return; }
      if (r.status === 429) { stravaState('Quota atteint. Réessaie plus tard.'); return; }
      var data = await r.json();
      /* Une réponse d'erreur est un objet, pas un tableau : sans ce garde-fou
       * on tombe sur « .map n'est pas une fonction » au lieu de lire la cause. */
      if (!Array.isArray(data)) {
        sel.style.display = 'none';
        var msg = String(data && data.error || 'réponse inattendue');
        if (msg.indexOf('Inactive') >= 0) {
          msg = 'application désactivée par Strava — l’API est réservée aux abonnés.';
        }
        stravaState('Strava — ' + escapeHtml(msg));
        return;
      }
      remplitListe(data);
    } catch (e) {
      stravaState(messageIcu(e));
    }
  }

  function messageIcu(e) {
    /* Pas de lien : rien n'a jamais écouté ce `#re`. Le formulaire revient
     * de lui-même quand la clé est refusée. */
    if (e.message === 'CLE_REFUSEE') return T('intervals.icu — clé refusée.');
    if (e.message === 'QUOTA') return 'intervals.icu — quota atteint (2 500 / 15 min).';
    if (e.message === 'RESEAU') return 'intervals.icu — injoignable depuis ce navigateur.';
    return 'intervals.icu — ' + escapeHtml(e.message);
  }

  function remplitListe(data) {
    var sel = $('#strava-list');
    if (!Array.isArray(data)) {
      sel.style.display = 'none';
      stravaState('Réponse inattendue.');
      return;
    }
      stravaActs = data;
      sel.style.display = '';
      sel.innerHTML = '<option value="">' + T('— choisir une sortie —') + '</option>' +
        stravaActs.map(function (x) {
          var d = new Date(x.start_date_local);
          /* L'identifiant vient de l'API, comme le nom : il s'échappe aussi.
           * Un guillemet sortirait de l'attribut. */
          return '<option value="' + escapeHtml(x.id) + '">' +
            d.toLocaleDateString('fr-CH', { day: '2-digit', month: '2-digit' }) + ' · ' +
            escapeHtml(x.name) + ' · ' + (x.distance / 1000).toFixed(1) + ' km' +
            (x.total_elevation_gain ? ' · ' + Math.round(x.total_elevation_gain) + ' m' : '') +
            (x.has_power ? ' · W' : '') + '</option>';
        }).join('');
  }

  $('#strava-refresh').addEventListener('click', loadList);

  $('#strava-list').addEventListener('change', async function () {
    var id = $('#strava-list').value;
    if (!id) return;
    stravaState('Chargement de la sortie…');
    try {
      var j;
      if (source === 'icu-web') {
        j = await IcuWeb.activity(id);
      } else {
        var r = await fetch((source === 'icu' ? 'api/icu/activity/' : 'api/activity/') + id);
        j = await r.json();
        if (!r.ok) throw new Error(j.error || 'erreur');
      }
      Library.add((source === 'icu' || source === 'icu-web')
        ? Activity.fromIntervals(j.detail, j.streams)
        : Activity.fromStrava(j.detail, j.streams));
      E.overrides = {};
      E.chargee = true;
      syncBibliotheque();
      $('#gpx-err').textContent = '';
      stravaState(T(source === 'icu-web' ? 'intervals.icu — connecté depuis ce navigateur'
        : source === 'icu' ? 'intervals.icu — connecté' : 'Strava — connecté'));
      syncManualFields();
      summary();
      buildOptions();
      draw();
    } catch (e) {
      stravaState(messageIcu(e));
    }
  });

  $('#export').addEventListener('click', function () {
    var size = SIZES[$('#size').value];
    /* `var slug = …` masquait ici la fonction `slug()` du même nom, avec
     * le même corps à une écriture près. Deux assainissements de nom de
     * fichier, c'est deux comportements qui finiront par diverger. */
    Studio.exportPNG(canvas, slug() + '_' + E.current.id + '_' + size[0] + 'x' + size[1] + '.png');
  });

  /* Le démarrage l'appelle : il doit repasser par A. */
  A.stravaInit = stravaInit;
}(window.App));
