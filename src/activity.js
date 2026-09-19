/* activity.js — GPX  ->  objet "activité" propre.
 *
 * Rien de graphique ici. Ce fichier ne connaît pas le canvas.
 * Il produit la structure de données que tes templates consomment.
 */
(function (global) {
  'use strict';

  var R = 6371000; // rayon terrestre, mètres

  function rad(d) { return d * Math.PI / 180; }

  function haversine(a, b) {
    var dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Récupère un sous-élément par nom local, en ignorant les namespaces
  // (Garmin, Strava et Suunto ne les écrivent pas pareil).
  function childByLocalName(node, name) {
    var all = node.getElementsByTagName('*');
    for (var i = 0; i < all.length; i++) {
      if (all[i].localName === name) return all[i];
    }
    return null;
  }

  function num(node, name) {
    var el = childByLocalName(node, name);
    if (!el) return null;
    var v = parseFloat(el.textContent);
    return isFinite(v) ? v : null;
  }

  /* Dénivelé : on lisse avant de sommer, sinon le bruit GPS invente
   * 300 m de D+ sur une sortie plate. Fenêtre glissante + seuil. */
  function elevation(points) {
    var ele = [], i;
    for (i = 0; i < points.length; i++) {
      if (points[i].ele != null) ele.push({ i: i, e: points[i].ele });
    }
    if (ele.length < 3) return { gain: null, loss: null, min: null, max: null };

    var win = 5, smooth = [];
    for (i = 0; i < ele.length; i++) {
      var a = Math.max(0, i - win), b = Math.min(ele.length - 1, i + win), sum = 0, n = 0;
      for (var j = a; j <= b; j++) { sum += ele[j].e; n++; }
      smooth.push(sum / n);
    }

    var gain = 0, loss = 0, ref = smooth[0];
    for (i = 1; i < smooth.length; i++) {
      var d = smooth[i] - ref;
      if (d > 1.5) { gain += d; ref = smooth[i]; }       // seuil 1,5 m
      else if (d < -1.5) { loss += -d; ref = smooth[i]; }
    }
    var raw = ele.map(function (p) { return p.e; });
    return {
      gain: Math.round(gain),
      loss: Math.round(loss),
      min: Math.round(Math.min.apply(null, raw)),
      max: Math.round(Math.max.apply(null, raw))
    };
  }

  /* Temps en mouvement : on jette les pauses (trou > 20 s, ou vitesse
   * quasi nulle). C'est la définition que Strava affiche par défaut. */
  function movingTime(points) {
    var t = 0;
    for (var i = 1; i < points.length; i++) {
      var p = points[i - 1], q = points[i];
      if (p.t == null || q.t == null) continue;
      var dt = (q.t - p.t) / 1000;
      if (dt <= 0 || dt > 20) continue;
      var dd = q.d - p.d;
      if (dd / dt < 0.4) continue; // < 1,4 km/h = à l'arrêt
      t += dt;
    }
    return t ? Math.round(t) : null;
  }

  function splits(points) {
    var out = [], nextKm = 1000, prevT = points[0] && points[0].t, prevEle = points[0] && points[0].ele;
    for (var i = 1; i < points.length; i++) {
      while (points[i].d >= nextKm) {
        var p = points[i - 1], q = points[i];
        var ratio = (nextKm - p.d) / Math.max(1e-6, q.d - p.d);
        var t = (p.t != null && q.t != null) ? p.t.getTime() + ratio * (q.t - p.t) : null;
        var e = (p.ele != null && q.ele != null) ? p.ele + ratio * (q.ele - p.ele) : null;
        out.push({
          km: out.length + 1,
          pace_s: (t != null && prevT != null) ? Math.round((t - prevT) / 1000) : null,
          elev: (e != null && prevEle != null) ? Math.round(e - prevEle) : null
        });
        prevT = t != null ? new Date(t) : prevT;
        prevEle = e;
        nextKm += 1000;
      }
    }
    return out;
  }

  /* Projection de la trace en coordonnées 0..1, aspect conservé.
   * Mercator local suffit à l'échelle d'une sortie. */
  function project(points) {
    if (!points.length) return { pts: [], aspect: 1 };
    var lat0 = points.reduce(function (s, p) { return s + p.lat; }, 0) / points.length;
    var k = Math.cos(rad(lat0));
    var xs = [], ys = [];
    points.forEach(function (p) { xs.push(p.lon * k); ys.push(-p.lat); });
    var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
    var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
    var w = maxX - minX || 1e-9, h = maxY - minY || 1e-9;
    var s = Math.max(w, h);
    var pts = xs.map(function (x, i) {
      return { x: (x - minX) / s + (s - w) / (2 * s), y: (ys[i] - minY) / s + (s - h) / (2 * s) };
    });
    return { pts: pts, aspect: w / h };
  }

  function profile(points) {
    var out = [], total = points.length ? points[points.length - 1].d : 0;
    var eles = points.filter(function (p) { return p.ele != null; });
    if (eles.length < 2 || !total) return [];
    var lo = Math.min.apply(null, eles.map(function (p) { return p.ele; }));
    var hi = Math.max.apply(null, eles.map(function (p) { return p.ele; }));
    var span = (hi - lo) || 1;
    points.forEach(function (p) {
      if (p.ele == null) return;
      out.push({ x: p.d / total, y: (p.ele - lo) / span });
    });
    return out;
  }

  /* ---------- puissance lissée sur 3 secondes ----------
   * Le flux brut à 1 Hz est illisible : un capteur de pédalier oscille de
   * 80 W d'un tour à l'autre. Les 3 secondes sont la fenêtre qu'emploient
   * intervals.icu et les compteurs de vélo — c'est elle qui rend la courbe
   * lisible sans effacer les relances.
   *
   * L'échelle part de ZÉRO et non du minimum : 0 W veut dire « je ne pédale
   * pas », c'est une information. Une échelle partant du minimum ferait
   * croire à un effort constant sur une descente. */
  function powerSeries(points) {
    var brut = points.map(function (p) { return p.w; });
    if (!brut.some(function (w) { return w != null; })) {
      return { data: [], max: null, avg: null };
    }

    var lisse = [], i, j;
    for (i = 0; i < points.length; i++) {
      var t0 = points[i].t ? points[i].t.getTime() : null;
      var somme = 0, n = 0;
      // fenêtre centrée de 3 s ; à défaut d'horodatage, 3 échantillons
      for (j = i; j >= 0; j--) {
        if (t0 != null && points[j].t && t0 - points[j].t.getTime() > 1500) break;
        if (t0 == null && i - j > 1) break;
        if (brut[j] != null) { somme += brut[j]; n++; }
      }
      for (j = i + 1; j < points.length; j++) {
        if (t0 != null && points[j].t && points[j].t.getTime() - t0 > 1500) break;
        if (t0 == null && j - i > 1) break;
        if (brut[j] != null) { somme += brut[j]; n++; }
      }
      lisse.push(n ? somme / n : 0);
    }

    /* L'axe est la distance quand elle existe, le TEMPS sinon : une séance
     * de home trainer n'avance pas d'un mètre et doit quand même se tracer. */
    var axe = axeDeProgression(points);
    var max = Math.max.apply(null, lisse) || 1;
    var data = [];
    points.forEach(function (p, k) {
      data.push({ x: axe(p, k), y: lisse[k] / max, w: lisse[k] });
    });

    var valides = brut.filter(function (w) { return w != null; });
    return {
      data: data,
      max: Math.round(max),
      avg: valides.length ? Math.round(valides.reduce(function (a, b) { return a + b; }, 0) / valides.length) : null
    };
  }

  /* Position d'un point dans la sortie, entre 0 et 1 : par la distance si
   * elle progresse, sinon par le temps, sinon par le rang. */
  function axeDeProgression(points) {
    var n = points.length;
    var dTotal = n ? points[n - 1].d : 0;
    if (dTotal > 0) return function (p) { return p.d / dTotal; };
    var t0 = points[0] && points[0].t, t1 = points[n - 1] && points[n - 1].t;
    if (t0 && t1 && t1 - t0 > 0) {
      return function (p) { return p.t ? (p.t - t0) / (t1 - t0) : 0; };
    }
    return function (p, k) { return n > 1 ? k / (n - 1) : 0; };
  }

  /* ---------- allumettes brûlées ----------
   * Une « allumette » est un effort dur qu'on ne peut pas répéter
   * indéfiniment : au-dessus du seuil, tenu assez longtemps pour coûter.
   *
   * Aucune définition ne fait autorité — Strava, TrainingPeaks et les
   * entraîneurs comptent différemment. Celle-ci est explicite et réglable :
   * au-dessus de X % du FTP, pendant au moins N secondes. Le coût est
   * l'énergie dépensée AU-DESSUS du seuil, en kilojoules : c'est ce qui
   * distingue une relance de trente secondes d'un col de dix minutes.
   *
   * Sans capteur, on retombe sur la fréquence cardiaque — c'est une autre
   * grandeur, et le template doit le dire plutôt que de faire semblant. */
  function burnedMatches(points, power, opts) {
    opts = opts || {};
    var pct = opts.pct == null ? 1.05 : opts.pct;
    var minSec = opts.minSec == null ? 20 : opts.minSec;

    var serie, seuil, source, unite;

    if (power && power.data.length) {
      serie = power.data.map(function (p) { return p.w; });
      if (opts.ftp) seuil = opts.ftp * pct;
      else seuil = percentile(serie, 0.92);   // sans FTP déclaré, une estimation
      source = 'puissance';
      unite = 'W';
    } else {
      var hr = points.map(function (p) { return p.hr; });
      if (!hr.some(function (v) { return v != null; })) {
        return { list: [], source: null, seuil: null, unite: null, estime: false };
      }
      serie = hr;
      seuil = Math.max.apply(null, hr.filter(function (v) { return v != null; })) * 0.88;
      source = 'cardiaque';
      unite = 'bpm';
      minSec = Math.max(minSec, 30);          // le cœur est lent, il faut plus long
    }

    var list = [], debut = null, i;
    for (i = 0; i < serie.length; i++) {
      var v = serie[i];
      if (v != null && v > seuil) {
        if (debut === null) debut = i;
      } else if (debut !== null) {
        var fin = i - 1;
        var duree = secondes(points, debut, fin);
        if (duree >= minSec) list.push(mesure(points, serie, seuil, debut, fin, duree));
        debut = null;
      }
    }
    if (debut !== null) {
      var d2 = secondes(points, debut, serie.length - 1);
      if (d2 >= minSec) list.push(mesure(points, serie, seuil, debut, serie.length - 1, d2));
    }

    return {
      list: list, source: source, seuil: Math.round(seuil), unite: unite,
      estime: source === 'puissance' && !opts.ftp,
      total: list.reduce(function (s, m) { return s + m.cout; }, 0)
    };

    /* Écart en secondes entre deux points, null si l'un manque ou si le
     * trou dépasse 30 s (arrêt, perte de signal). */
    function ecartSec(pts, i, j) {
      if (!pts[i] || !pts[j]) return null;
      if (!pts[i].t || !pts[j].t) return 1;
      var d = (pts[j].t - pts[i].t) / 1000;
      return (d > 0 && d <= 30) ? d : null;
    }

    function secondes(pts, a, b) {
      if (pts[a] && pts[b] && pts[a].t && pts[b].t) return (pts[b].t - pts[a].t) / 1000;
      return b - a;   // à défaut d'horodatage, un point vaut une seconde
    }
    function mesure(pts, s, lim, a, b, duree) {
      /* L'énergie est une puissance MULTIPLIÉE par un temps. La somme des
       * watts divisée par 1000 supposait un point par seconde : sur un
       * enregistrement à 5 s, le même effort coûtait cinq fois moins. On
       * intègre sur l'intervalle réel, en ignorant les trous de mesure. */
      /* Règle du trapèze, écrite par INTERVALLES et non par points : sur
       * chaque segment [k, k+1] on prend la moyenne des deux puissances
       * excédentaires, multipliée par sa durée réelle. C'est la seule forme
       * exacte quel que soit l'échantillonnage.
       *
       * L'effort est en outre prolongé d'un demi-intervalle de part et
       * d'autre : il n'a pas commencé pile sur un point de mesure, il a
       * commencé quelque part entre le dernier point sous le seuil et le
       * premier au-dessus. Sans ça, un enregistrement à 10 s perd un sixième
       * du coût d'un effort d'une minute. */
      var cout = 0;
      for (var k = a; k < b; k++) {
        var dt = ecartSec(pts, k, k + 1);
        if (dt == null) continue;                 // trou d'enregistrement
        if (s[k] == null || s[k + 1] == null) continue;
        cout += ((s[k] - lim) + (s[k + 1] - lim)) / 2 * dt;
      }
      var bordA = ecartSec(pts, a - 1, a), bordB = ecartSec(pts, b, b + 1);
      if (bordA != null && s[a] != null) cout += (s[a] - lim) / 2 * (bordA / 2);
      if (bordB != null && s[b] != null) cout += (s[b] - lim) / 2 * (bordB / 2);
      var moy = 0, n = 0;
      for (k = a; k <= b; k++) if (s[k] != null) { moy += s[k]; n++; }
      var axe = axeDeProgression(pts);
      return {
        duree: Math.round(duree),
        moyenne: n ? Math.round(moy / n) : 0,
        cout: Math.round(cout / 1000 * 10) / 10,      // kJ au-dessus du seuil (W × s / 1000)
        x: pts[a] ? axe(pts[a], a) : 0                // position dans la sortie
      };
    }
    function percentile(arr, p) {
      var v = arr.filter(function (x) { return x != null && isFinite(x); }).slice().sort(function (a, b) { return a - b; });
      return v.length ? v[Math.floor(v.length * p)] : 0;
    }
  }

  function avg(arr) {
    var v = arr.filter(function (x) { return x != null; });
    return v.length ? Math.round(v.reduce(function (a, b) { return a + b; }, 0) / v.length) : null;
  }

  function parseGPX(text) {
    var doc = new DOMParser().parseFromString(text, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) {
      throw new Error('Ce fichier n’est pas un GPX valide.');
    }
    var raw = doc.getElementsByTagName('trkpt');
    if (!raw.length) raw = doc.getElementsByTagName('rtept');
    if (!raw.length) throw new Error('Aucun point de trace dans ce GPX.');

    var points = [], cum = 0, prev = null;
    for (var i = 0; i < raw.length; i++) {
      var n = raw[i];
      var p = {
        lat: parseFloat(n.getAttribute('lat')),
        lon: parseFloat(n.getAttribute('lon')),
        ele: num(n, 'ele'),
        hr: num(n, 'hr'),
        cad: num(n, 'cad'),
        /* LA PUISSANCE ÉTAIT LA SEULE MESURE QU'UN GPX NE LIVRAIT PAS.
         *
         * Tout existe en aval — `powerSeries()`, `burned()`, le FTP, et la
         * planche Allumettes — mais `p.w` n'était jamais rempli ici. La
         * puissance n'arrivait donc que par Strava ou intervals.icu : tout
         * fichier GPX donnait `has_power = false`, et Allumettes retombait
         * sur la fréquence cardiaque sans qu'on comprenne pourquoi.
         *
         * Deux noms circulent : `<power>` chez Garmin, `PowerInWatts` dans
         * l'extension de certains compteurs. `childByLocalName` descend dans
         * les extensions et ignore les préfixes — c'est déjà ainsi que `hr`
         * et `cad` remontent. */
        w: num(n, 'power') != null ? num(n, 'power') : num(n, 'PowerInWatts'),
        t: null
      };
      var tEl = childByLocalName(n, 'time');
      if (tEl) { var d = new Date(tEl.textContent); if (!isNaN(d)) p.t = d; }
      if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
      cum += prev ? haversine(prev, p) : 0;
      p.d = cum;
      points.push(p);
      prev = p;
    }

    var trk = doc.getElementsByTagName('trk')[0];
    var nameEl = trk ? childByLocalName(trk, 'name') : null;
    var typeEl = trk ? childByLocalName(trk, 'type') : null;

    var first = points[0], last = points[points.length - 1];
    var elapsed = (first.t && last.t) ? Math.round((last.t - first.t) / 1000) : null;
    var moving = movingTime(points) || elapsed;
    var dist = last.d;
    var el = elevation(points);

    return build({
      name: nameEl ? nameEl.textContent.trim() : 'Sortie',
      type: typeEl ? typeEl.textContent.trim() : '',
      date: first.t || null,
      distance_m: dist,
      duration_s: moving,
      elapsed_s: elapsed,
      elev_gain_m: el.gain,
      elev_loss_m: el.loss,
      elev_min_m: el.min,
      elev_max_m: el.max,
      hr_avg: avg(points.map(function (p) { return p.hr; })),
      hr_max: points.reduce(function (m, p) { return p.hr != null && p.hr > m ? p.hr : m; }, 0) || null,
      cadence_avg: avg(points.map(function (p) { return p.cad; })),
      splits: splits(points),
      track: points,
      route: project(points),
      profile: profile(points)
    });
  }

  /* ---------- depuis des points bruts ----------
   * Un projet rouvert apporte une trace et quelques agrégats, sans GPX ni
   * API. Plutôt que de refabriquer du GPX pour le reparser — ce qui perdrait
   * la puissance et la fréquence cardiaque au passage —, on entre ici.
   *
   * La distance cumulée est TOUJOURS recalculée : un fichier de projet peut
   * avoir été écrit par une version plus ancienne, et une distance héritée
   * qui ne correspond plus à la trace fausse tout ce qui en dépend. */
  function fromPoints(meta, points) {
    var pts = points.filter(function (p) { return isFinite(p.lat) && isFinite(p.lon); });
    var cum = 0, prev = null;
    pts.forEach(function (p) {
      cum += prev ? haversine(prev, p) : 0;
      p.d = cum;
      prev = p;
    });
    if (!pts.length) throw new Error('Trace vide.');
    var first = pts[0], last = pts[pts.length - 1];
    var elapsed = (first.t && last.t) ? Math.round((last.t - first.t) / 1000) : null;
    var el = elevation(pts);
    return build({
      name: meta.name || 'Sortie',
      type: meta.type || '',
      date: meta.date || first.t || null,
      distance_m: cum || meta.distance_m,
      duration_s: meta.duration_s || movingTime(pts) || elapsed,
      elapsed_s: elapsed,
      elev_gain_m: meta.elev_gain_m != null ? meta.elev_gain_m : el.gain,
      elev_loss_m: el.loss, elev_min_m: el.min, elev_max_m: el.max,
      hr_avg: avg(pts.map(function (p) { return p.hr; })),
      hr_max: pts.reduce(function (m, p) { return p.hr != null && p.hr > m ? p.hr : m; }, 0) || null,
      cadence_avg: avg(pts.map(function (p) { return p.cad; })),
      splits: splits(pts),
      track: pts,
      route: project(pts),
      profile: profile(pts)
    });
  }

  /* Recalcule les champs dérivés. Appelé après le parse ET après chaque
   * correction manuelle, pour que l'allure suive toujours la distance. */
  function build(a) {
    a.distance_km = a.distance_m != null ? a.distance_m / 1000 : null;
    if (a.distance_km && a.duration_s) {
      a.pace_s_per_km = a.duration_s / a.distance_km;
      a.speed_kmh = a.distance_km / (a.duration_s / 3600);
    } else {
      a.pace_s_per_km = null;
      a.speed_kmh = null;
    }
    a.splits = a.splits || [];
    a.track = a.track || [];
    a.route = a.route || { pts: [], aspect: 1 };
    a.profile = a.profile || [];
    /* Le dénivelé se dérive de la trace quand la source ne l'a pas donné.
     * build() calculait déjà la puissance et le profil : laisser l'altitude
     * de côté rendait l'objet incohérent selon le chemin d'entrée. */
    if (a.elev_gain_m == null && a.track.length) {
      var el = elevation(a.track);
      a.elev_gain_m = el.gain;
      if (a.elev_loss_m == null) a.elev_loss_m = el.loss;
      if (a.elev_min_m == null) a.elev_min_m = el.min;
      if (a.elev_max_m == null) a.elev_max_m = el.max;
    }
    if (!a.profile.length && a.track.length) a.profile = profile(a.track);

    // la puissance se recalcule depuis la trace, quelle que soit la source
    if (!a.power) a.power = powerSeries(a.track);
    a.has_power = !!(a.power && a.power.data.length);
    // les allumettes dépendent de réglages : le template peut les recalculer
    a.burned = function (opts) {
      opts = opts || {};
      if (opts.ftp === undefined) opts.ftp = a.ftp;
      return burnedMatches(a.track, a.power, opts);
    };
    return a;
  }

  /* ---------- depuis l'API Strava ----------
   * Les flux donnent la géométrie, le détail donne les agrégats.
   * On garde les agrégats de Strava plutôt que de les recalculer : ce sont
   * ceux que l'application affiche, et un écart entre l'image et l'appli
   * serait incompréhensible. */
  function fromStrava(detail, streams) {
    streams = streams || {};
    var latlng = (streams.latlng || {}).data || [];
    var alt = (streams.altitude || {}).data || [];
    var tim = (streams.time || {}).data || [];
    var dist = (streams.distance || {}).data || [];
    var hr = (streams.heartrate || {}).data || [];
    var cad = (streams.cadence || {}).data || [];
    var watts = (streams.watts || {}).data || [];

    var start = detail.start_date_local ? new Date(detail.start_date_local) : null;
    var points = [], cum = 0, prev = null;

    for (var i = 0; i < latlng.length; i++) {
      var p = {
        lat: latlng[i][0], lon: latlng[i][1],
        ele: alt[i] != null ? alt[i] : null,
        hr: hr[i] != null ? hr[i] : null,
        cad: cad[i] != null ? cad[i] : null,
        t: (start && tim[i] != null) ? new Date(start.getTime() + tim[i] * 1000) : null
      };
      if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
      // le flux distance fait foi ; sinon on cumule nous-même
      cum = dist[i] != null ? dist[i] : cum + (prev ? haversine(prev, p) : 0);
      p.d = cum;
      points.push(p);
      prev = p;
    }

    var el = elevation(points);
    return build({
      name: detail.name || 'Sortie',
      type: detail.sport_type || detail.type || '',
      date: start,
      distance_m: detail.distance != null ? detail.distance : cum,
      duration_s: detail.moving_time || null,
      elapsed_s: detail.elapsed_time || null,
      elev_gain_m: detail.total_elevation_gain != null
        ? Math.round(detail.total_elevation_gain) : el.gain,
      elev_loss_m: el.loss,
      elev_min_m: el.min,
      elev_max_m: el.max,
      hr_avg: detail.average_heartrate ? Math.round(detail.average_heartrate) : avg(points.map(function (p) { return p.hr; })),
      hr_max: detail.max_heartrate ? Math.round(detail.max_heartrate) : null,
      cadence_avg: detail.average_cadence ? Math.round(detail.average_cadence) : avg(points.map(function (p) { return p.cad; })),
      // Strava renvoie la puissance : elle était demandée puis ignorée
      ftp: detail.ftp || null,
      power_avg: detail.average_watts || null,
      power_weighted: detail.weighted_average_watts || null,
      splits: splits(points),
      track: points,
      route: project(points),
      profile: profile(points),
      strava_id: detail.id
    });
  }

  /* ---------- depuis intervals.icu ----------
   * Même principe que Strava — les agrégats font foi, les flux donnent la
   * géométrie — mais la forme diffère : intervals renvoie un TABLEAU de
   * { type, data }, là où Strava renvoie un objet indexé par type. */
  function fromIntervals(detail, streams) {
    var par = {};
    (streams || []).forEach(function (f) { if (f && f.type) par[f.type] = f; });
    function flux(nom) { return (par[nom] && par[nom].data) || []; }

    /* Particularité d'intervals.icu, absente de leur documentation : la
     * position n'est PAS une liste de paires. La latitude est dans `data`,
     * la longitude dans `data2` — deux tableaux parallèles. */
    var lat = flux('latlng');
    var lon = (par.latlng && par.latlng.data2) || [];

    var alt = flux('altitude');
    var tim = flux('time');
    var dist = flux('distance');
    var hr = flux('heartrate');
    var cad = flux('cadence');
    var watts = flux('watts');

    var start = detail.start_date_local ? new Date(detail.start_date_local) : null;
    var points = [], cum = 0, prev = null;

    /* Le nombre d'échantillons vient du flux le plus long, PAS des seules
     * positions : une séance de home trainer a du temps, de la distance et
     * des watts sans une seule coordonnée. Se caler sur latlng effaçait
     * toute la sortie. */
    var n = Math.max(lat.length, tim.length, dist.length, watts.length, alt.length, hr.length);
    var avecGPS = lat.length > 0;

    for (var i = 0; i < n; i++) {
      if (avecGPS && (lat[i] == null || lon[i] == null)) continue;
      var p = {
        lat: avecGPS ? lat[i] : null, lon: avecGPS ? lon[i] : null,
        ele: alt[i] != null ? alt[i] : null,
        hr: hr[i] != null ? hr[i] : null,
        cad: cad[i] != null ? cad[i] : null,
        w: watts[i] != null ? watts[i] : null,
        t: (start && tim[i] != null) ? new Date(start.getTime() + tim[i] * 1000) : null
      };
      if (avecGPS && (!isFinite(p.lat) || !isFinite(p.lon))) continue;
      cum = dist[i] != null ? dist[i] : (avecGPS && prev ? cum + haversine(prev, p) : cum);
      p.d = cum;
      points.push(p);
      prev = p;
    }

    var el = elevation(points);
    return build({
      name: detail.name || 'Sortie',
      type: detail.type || '',
      date: start,
      distance_m: detail.distance != null ? detail.distance : cum,
      duration_s: detail.moving_time || null,
      elapsed_s: detail.elapsed_time || null,
      elev_gain_m: detail.total_elevation_gain != null
        ? Math.round(detail.total_elevation_gain) : el.gain,
      elev_loss_m: el.loss,
      elev_min_m: el.min,
      elev_max_m: el.max,
      hr_avg: detail.average_heartrate ? Math.round(detail.average_heartrate) : avg(points.map(function (p) { return p.hr; })),
      hr_max: detail.max_heartrate ? Math.round(detail.max_heartrate) : null,
      cadence_avg: detail.average_cadence ? Math.round(detail.average_cadence) : avg(points.map(function (p) { return p.cad; })),
      // la puissance n'existe que si la sortie a un capteur : les templates
      // qui l'affichent doivent donc savoir se taire
      ftp: detail.icu_pm_ftp_watts || null,
      power_avg: detail.icu_average_watts || null,
      power_weighted: detail.icu_weighted_avg_watts || null,
      has_power: watts.length > 0,
      splits: splits(points),
      track: points,
      route: project(points),
      profile: profile(points),
      icu_id: detail.id
    });
  }

  /* Activité VIDE, au sens strict : aucun chiffre.
   *
   * Elle contenait 10 km, 50 minutes et 120 m de dénivelé — des valeurs de
   * démonstration. L'interface les masquait au démarrage, mais saisir un
   * simple titre suffisait à marquer l'activité comme chargée : on exportait
   * alors une affiche annonçant une sortie que personne n'avait faite.
   * Une donnée inventée qui atteint l'image est pire qu'une donnée absente. */
  function empty() {
    return build({
      name: '', type: '', date: null,
      distance_m: null, duration_s: null, elapsed_s: null,
      elev_gain_m: null, elev_loss_m: null, elev_min_m: null, elev_max_m: null,
      hr_avg: null, hr_max: null, cadence_avg: null
    });
  }

  global.Activity = {
    parseGPX: parseGPX, fromStrava: fromStrava, fromIntervals: fromIntervals,
    fromPoints: fromPoints, build: build, empty: empty
  };
}(window));
