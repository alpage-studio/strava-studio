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

  /* Les réglages d'import n'apparaissent QUE connecté : un bouton
   * « Importer la période » offert sans clé ne pourrait que produire un
   * message d'erreur, et un réglage qui n'a jamais d'effet apprend à ne plus
   * lire les réglages. */
  function formulaireCle(visible) {
    $('#icu-form').style.display = visible ? '' : 'none';
    $('#icu-forget').style.display = visible ? 'none' : '';
    var p = $('#opt-icu-periode'), b = $('#icu-importer'), n = $('#icu-progres');
    if (p) p.style.display = visible ? 'none' : '';
    if (b) b.style.display = visible ? 'none' : '';
    if (n && visible) n.textContent = '';
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

  /* ================= IMPORTER UNE PÉRIODE =================
   *
   * LE MANQUE : depuis intervals.icu on ne pouvait charger qu'UNE sortie à la
   * fois, choisie parmi les cinq dernières. Les neuf planches multi-sorties
   * — Almanac, Atlas, Strates, Métro… — n'avaient donc aucun moyen d'être
   * nourries autrement qu'en glissant des GPX un par un. « Je vois pas comment
   * charger les sorties plus que 1 » : c'était exact.
   *
   * CE QUI EST INJECTÉ, ET POURQUOI. `liste` et `charge` sont passées en
   * paramètres plutôt qu'appelées directement. Ce n'est pas de l'abstraction
   * gratuite : je n'ai pas de clé intervals.icu, et me servir de celle de
   * quelqu'un d'autre pour éprouver mon code n'est pas à moi de le décider.
   * Cette forme permet au banc d'acceptation d'exercer POUR DE VRAI la
   * boucle, le dédoublonnage, la progression, l'arrêt sur quota et le compte
   * final, avec une source fabriquée. Le chemin réseau, lui, reste éprouvé
   * par l'usage — et c'est dit plutôt que sous-entendu.
   *
   * UNE REQUÊTE PAR SORTIE. Le détail et les flux se demandent sortie par
   * sortie : une année, c'est quelques centaines d'appels. On les mène trois
   * de front — au-delà, on approche du quota sans gagner grand-chose — et on
   * écrit ce qu'on fait pendant qu'on le fait.
   */
  var importEnCours = false;

  async function importePeriode(opts) {
    var liste = opts.liste;
    var charge = opts.charge;
    var jours = opts.jours;
    var dit = opts.dit || function () {};
    var PLAFOND = opts.plafond || 400;
    var FRONT = opts.front || 3;

    var trouvees;
    try {
      trouvees = await liste(jours);
    } catch (e) {
      dit({ etat: 'erreur', message: messageIcu(e) });
      return { charges: 0, ignorees: 0, total: 0, arret: 'liste' };
    }
    trouvees = Array.isArray(trouvees) ? trouvees : [];

    /* CE QU'ON A DÉJÀ NE SE RETÉLÉCHARGE PAS. Sans ce filtre, réimporter une
     * période après en avoir chargé une autre repayait toutes les sorties
     * communes, et la bibliothèque les aurait comptées deux fois. */
    var deja = {};
    Library.list().forEach(function (e) {
      /* `source_id`, pas `id` : `id` est celui que la bibliothèque attribue
       * (« a1 », « a2 »), qui ne dit rien de la sortie d'origine. */
      var id = e.activity && e.activity.source_id;
      if (id != null) deja[String(id)] = true;
    });
    var aFaire = trouvees.filter(function (a) { return !deja[String(a.id)]; });
    var ignorees = trouvees.length - aFaire.length;

    var tronquee = aFaire.length > PLAFOND;
    if (tronquee) aFaire = aFaire.slice(0, PLAFOND);

    if (!aFaire.length) {
      dit({ etat: 'fini', charges: 0, ignorees: ignorees, total: trouvees.length });
      return { charges: 0, ignorees: ignorees, total: trouvees.length, arret: null };
    }

    var faits = 0, echoues = 0, arret = null, i = 0;
    dit({ etat: 'debut', total: aFaire.length, ignorees: ignorees, tronquee: tronquee });

    async function ouvrier() {
      while (i < aFaire.length && !arret) {
        var a = aFaire[i++];
        try {
          var j = await charge(a.id);
          Library.add(Activity.fromIntervals(j.detail, j.streams));
          faits++;
        } catch (e) {
          /* UN QUOTA ARRÊTE TOUT, une sortie illisible non. Continuer après
           * un quota atteint, c'est cent requêtes refusées de plus et un
           * message qui arrive cent fois trop tard. */
          if (e && (e.message === 'QUOTA' || e.message === 'CLE_REFUSEE')) {
            arret = e.message;
          } else {
            echoues++;
          }
        }
        dit({ etat: 'avance', faits: faits, echoues: echoues, total: aFaire.length });
      }
    }

    var ouvriers = [];
    for (var k = 0; k < Math.min(FRONT, aFaire.length); k++) ouvriers.push(ouvrier());
    await Promise.all(ouvriers);

    dit({ etat: 'fini', charges: faits, echoues: echoues, ignorees: ignorees,
          total: trouvees.length, tronquee: tronquee, arret: arret });
    return { charges: faits, echoues: echoues, ignorees: ignorees,
             total: trouvees.length, arret: arret };
  }
  A.importePeriode = importePeriode;

  /* Le compte rendu, en une ligne. Il dit TOUT ce qui s'est passé : ce qui est
   * entré, ce qui était déjà là, ce qui a échoué, et si l'on s'est arrêté. Une
   * ligne qui ne dirait que « 42 chargées » laisserait croire que la période
   * en comptait 42. */
  function ditImport(e) {
    var n = $('#icu-progres');
    if (!n) return;
    if (e.etat === 'erreur') { n.textContent = e.message; return; }
    if (e.etat === 'debut') {
      n.textContent = e.total + ' ' + T(e.total > 1 ? 'sorties' : 'sortie') + ' à charger…';
      return;
    }
    if (e.etat === 'avance') {
      n.textContent = e.faits + ' / ' + e.total + '…';
      return;
    }
    var bouts = [];
    bouts.push(e.charges + ' ' + T(e.charges > 1 ? 'sorties' : 'sortie') + ' ' +
               T(e.charges > 1 ? 'chargées' : 'chargée'));
    if (e.ignorees) bouts.push(e.ignorees + ' ' + T('déjà présentes'));
    if (e.echoues) bouts.push(e.echoues + ' ' + T('illisibles'));
    if (e.tronquee) bouts.push(T('période tronquée'));
    if (e.arret === 'QUOTA') bouts.push(T('arrêté : quota atteint'));
    if (e.arret === 'CLE_REFUSEE') bouts.push(T('arrêté : clé refusée'));
    n.textContent = bouts.join(' · ');
  }
  A.ditImport = ditImport;

  var bImport = $('#icu-importer');
  if (bImport) {
    bImport.addEventListener('click', async function () {
      if (importEnCours) return;
      importEnCours = true;
      bImport.disabled = true;
      var jours = parseInt($('#icu-periode').value, 10) || 31;
      try {
        var r = await importePeriode({
          jours: jours,
          dit: ditImport,
          liste: function (j) { return IcuWeb.activities(0, j); },
          charge: function (id) { return IcuWeb.activity(id); }
        });
        if (r.charges) {
          E.overrides = {};
          E.chargee = true;
          syncBibliotheque();
          syncManualFields();
          summary();
          buildOptions();
          draw();
        }
      } finally {
        importEnCours = false;
        bImport.disabled = false;
      }
    });
  }

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

  /* L'EXPORT PNG A DEMENAGE dans src/app/exports.js.
   *
   * Il y rejoint la video et la sequence : les trois sont desormais des
   * formats d'un MEME bouton, et le choix se fait dans un menu. Le garder ici
   * aurait pose un second ecouteur sur `#export`, donc deux exports pour un
   * clic le jour ou l'un des deux aurait cesse de decider seul. */

  /* Le démarrage l'appelle : il doit repasser par A. */
  A.stravaInit = stravaInit;
}(window.App));
