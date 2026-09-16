/* « Territoires blancs » — ce que tu n'avais pas encore parcouru.
 *
 * Les sorties chargées sont mises en regard de l'HISTORIQUE enregistré dans
 * ce navigateur. Ce qui est déjà passé par là se dessine en retrait, ce qui
 * ne l'est pas prend la couleur d'accent.
 *
 * La phrase exacte compte autant que le dessin : « nouveau dans ton
 * historique chargé ». Le studio ne connaît pas ta vie sportive ; il connaît
 * les sorties que tu lui as données. Écrire « première fois » serait une
 * affirmation qu'il n'a aucun moyen de tenir.
 *
 * Comment la comparaison est faite — et pourquoi ainsi :
 *
 *   - PAR CASES, PAS PAR COURBES. L'historique est un ensemble de cases de
 *     cinquante mètres (voir historique.js). Comparer deux polylignes point
 *     à point demanderait un appariement coûteux, et surtout il faudrait le
 *     rendre insensible au sens du parcours — un aller-retour compterait
 *     sinon la moitié en neuf. Un ensemble n'a pas de sens : le problème
 *     disparaît au lieu d'être traité.
 *   - AVEC UNE TOLÉRANCE. Une case et ses huit voisines : environ 70 m de
 *     jeu, l'ordre de grandeur du bruit d'un GPS de guidon sous les arbres.
 *   - SANS DOUBLE COMPTE. Un tronçon neuf parcouru deux fois dans la période
 *     analysée ne compte qu'une fois : les cases découvertes s'ajoutent à
 *     l'ensemble connu au fur et à mesure du calcul.
 *
 * Sans historique, la planche ne prétend rien : elle dit que cette première
 * importation DEVIENT la référence.
 */
Studio.template({
  id: 'exploration',
  name: 'Territoires blancs — ce qui est nouveau',
  famille: 'serie',
  multi: true,

  options: [
    { key: 'fond', type: 'color', label: 'Fond', default: '#0C0C0F' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Nouveau', default: '#C8F04E' },
    { key: 'vue', type: 'select', label: 'Vue', default: 'carte',
      choices: [['carte', 'Carte de la période'],
                ['vignette', 'Vignette — la zone découverte']] },
    { key: 'titre', type: 'text', label: 'Titre', default: '' },
    { key: 'connu', type: 'range', label: 'Discrétion du connu', default: 22, min: 5, max: 60, step: 1 },
    { key: 'chiffres', type: 'toggle', label: 'Kilomètres nouveaux', default: true }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, faint = melange(ink, 0.5), hair = melange(ink, 0.16);

    var entrees = (s.library || []).filter(function (e) {
      return e.activity && e.activity.track && e.activity.track.some(function (p) { return p.lat != null; });
    });

    H.fill(o.fond);
    var g = H.grid({ cols: 6, margin: u(7) });

    if (!entrees.length) {
      H.text('Charge la période à analyser', g.left, g.top + g.height * 0.45,
             H.t('title', { color: ink, maxWidth: g.width }));
      H.text('elle sera comparée à l’historique de ce navigateur',
             g.left, g.top + g.height * 0.45 + u(5), H.t('label', { color: faint, maxWidth: g.width }));
      return;
    }

    var hist = s.historique;          // { set, sorties, km, cases } ou null
    var reference = hist && hist.sorties ? hist : null;

    /* ---------- le calcul ---------- */
    var analyse = analyseSegments(entrees, reference);

    /* ---------- en-tête ---------- */
    H.text(String(o.titre || '').trim() || (reference ? 'Territoires blancs' : 'La référence'),
           g.left, g.top + u(3.6), H.t('title', { color: ink, maxWidth: g.w(4) }));
    H.text(entrees.length + (entrees.length > 1 ? ' sorties' : ' sortie'),
           g.right, g.top + u(3.6), H.t('label', { color: faint, align: 'right' }));

    /* ---------- la carte ---------- */
    var basChiffres = o.chiffres ? u(20) : u(9);
    var zone = { x: g.left, y: g.top + u(10), w: g.width, h: g.height - u(10) - basChiffres };
    if (o.vue === 'vignette') carteVignette(zone); else cartePeriode(zone);

    /* ---------- le pied ---------- */
    if (o.chiffres) {
      var y = g.bottom - u(11);
      H.rule(g.left, y - u(3), g.right, { color: hair });
      if (reference) {
        [['nouveaux', H.fmt.km(analyse.kmNeufs, 1) + ' km'],
         ['sur', H.fmt.km(analyse.kmTotal, 0) + ' km'],
         ['référence', reference.sorties + (reference.sorties > 1 ? ' sorties' : ' sortie')]]
         .forEach(function (c, i) {
          H.field(c[0], c[1], g.left + i * (g.width / 3), y + u(1.5), {
            color: i === 0 ? o.accent : ink, labelColor: faint,
            size: 5.4, maxWidth: g.width / 3 - u(2)
          });
        });
        H.text('NOUVEAU DANS TON HISTORIQUE CHARGÉ — LE STUDIO NE CONNAÎT QUE CE QUE TU LUI AS DONNÉ',
               g.left, g.bottom, H.t('label', { color: faint, maxWidth: g.width }));
      } else {
        H.text('aucun historique : cette importation devient la référence',
               g.left, y + u(4), H.t('title', { size: 4.2, color: ink, maxWidth: g.width }));
        H.text('AJOUTE CES SORTIES À L’HISTORIQUE, PUIS REVIENS AVEC LA SEMAINE SUIVANTE',
               g.left, g.bottom, H.t('label', { color: faint, maxWidth: g.width }));
      }
    }

    /* ================= cartes ================= */

    /* Cadrage commun à toutes les sorties de la période : c'est une carte,
     * pas une grille de vignettes. */
    function cartePeriode(box) {
      var cadre = cadreCommun(entrees);
      var cote = Math.min(box.w, box.h);
      var ox = box.x + (box.w - cote) / 2, oy = box.y + (box.h - cote) / 2;
      dessineSegments(analyse.segments, cadre, ox, oy, cote);
    }

    /* La vignette : on recadre sur la seule zone NEUVE. C'est l'image qu'on
     * garde — la découverte, pas la sortie. */
    function carteVignette(box) {
      var neufs = analyse.segments.filter(function (sg) { return sg.neuf; });
      if (!neufs.length) {
        H.text(reference ? 'rien de nouveau cette fois' : 'tout est nouveau : c’est la référence',
               box.x, box.y + box.h * 0.5, H.t('title', { color: faint, maxWidth: box.w }));
        return;
      }
      var pts = [];
      neufs.forEach(function (sg) { sg.pts.forEach(function (p) { pts.push(p); }); });
      var cadre = cadreDe(pts, 1.25);
      var cote = Math.min(box.w, box.h);
      var ox = box.x + (box.w - cote) / 2, oy = box.y + (box.h - cote) / 2;
      dessineSegments(analyse.segments, cadre, ox, oy, cote);
      ctx.save();
      ctx.strokeStyle = hair; ctx.lineWidth = u(0.12);
      ctx.strokeRect(ox, oy, cote, cote);
      ctx.restore();
    }

    function dessineSegments(segments, cadre, ox, oy, cote) {
      var vus = H.progressCount(segments.length);
      ctx.save();
      ctx.beginPath(); ctx.rect(ox, oy, cote, cote); ctx.clip();
      ctx.lineJoin = ctx.lineCap = 'round';
      // le connu d'abord, le neuf par-dessus : c'est le neuf qu'on regarde
      [false, true].forEach(function (neuf) {
        segments.forEach(function (sg, i) {
          if (sg.neuf !== neuf || i >= vus || sg.pts.length < 2) return;
          ctx.beginPath();
          sg.pts.forEach(function (p, k) {
            var q = cadre.proj(p.lat, p.lon);
            var X = ox + q.x * cote, Y = oy + q.y * cote;
            if (k === 0) ctx.moveTo(X, Y); else ctx.lineTo(X, Y);
          });
          ctx.strokeStyle = neuf ? o.accent : melange(ink, o.connu / 100);
          ctx.lineWidth = neuf ? u(0.85) : u(0.45);
          ctx.stroke();
        });
      });
      ctx.restore();
    }

    /* ================= analyse ================= */

    /* Découpe chaque sortie en segments homogènes (connu / neuf) et somme la
     * distance des segments neufs.
     *
     * Le point clé : `vues` grandit AU FUR ET À MESURE. Un tronçon neuf
     * parcouru deux fois dans la période n'est neuf que la première fois —
     * sans quoi un aller-retour sur une route découverte compterait double,
     * et une boucle refaite trois fois triplerait la découverte. */
    function analyseSegments(list, ref) {
      var connuSet = ref ? ref.set : Object.create(null);
      var vues = Object.create(null);
      var segments = [], kmNeufs = 0, kmTotal = 0;

      list.forEach(function (e) {
        var t = e.activity.track;
        var courant = null;
        for (var i = 0; i < t.length; i++) {
          var p = t[i];
          if (p.lat == null) continue;
          var k = Historique.cle(p.lat, p.lon);
          /* Deux notions distinctes, et les confondre casse les deux :
           *   `neuf`   — pas dans l'historique de référence : c'est ce qu'on
           *              DESSINE en accent, et ça ne change pas parce qu'on
           *              vient de repasser au même endroit ;
           *   `compte` — en plus, pas déjà compté dans cette période : c'est
           *              ce qu'on ADDITIONNE.
           * Le premier jet n'avait que `compte`, et le retour d'un aller-
           * retour basculait en « connu » point par point : la portion neuve
           * se dessinait en pointillés. */
          var neuf = !(ref && Historique.connue(connuSet, p.lat, p.lon));
          var compte = neuf && !vues[k];
          if (!courant || courant.neuf !== neuf) {
            // on répète le point de bascule dans les deux segments : sans ça
            // la carte montre un trou d'un trait à chaque changement d'état
            if (courant) courant.pts.push(p);
            courant = { neuf: neuf, pts: [], couleur: e.couleur };
            segments.push(courant);
          }
          courant.pts.push(p);
          if (neuf) vues[k] = 1;

          if (i > 0 && t[i - 1].d != null && p.d != null) {
            var dl = p.d - t[i - 1].d;
            kmTotal += dl / 1000;
            if (compte) kmNeufs += dl / 1000;
          }
        }
      });
      return { segments: segments, kmNeufs: kmNeufs, kmTotal: kmTotal };
    }

    /* ================= cadrages ================= */

    function cadreCommun(list) {
      var pts = [];
      list.forEach(function (e) {
        e.activity.track.forEach(function (p) { if (p.lat != null) pts.push(p); });
      });
      return cadreDe(pts, 1.04);
    }

    function cadreDe(pts, marge) {
      var laMin = Infinity, laMax = -Infinity, loMin = Infinity, loMax = -Infinity;
      pts.forEach(function (p) {
        if (p.lat < laMin) laMin = p.lat;
        if (p.lat > laMax) laMax = p.lat;
        if (p.lon < loMin) loMin = p.lon;
        if (p.lon > loMax) loMax = p.lon;
      });
      var cLat = (laMin + laMax) / 2, cLon = (loMin + loMax) / 2;
      var c = Math.cos(cLat * Math.PI / 180);
      var ech = (Math.max((loMax - loMin) * c, laMax - laMin) || 0.001) * marge;
      return {
        proj: function (lat, lon) {
          return { x: 0.5 + ((lon - cLon) * c) / ech, y: 0.5 - (lat - cLat) / ech };
        }
      };
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
