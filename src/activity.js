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

    for (var i = 0; i < lat.length; i++) {
      if (lat[i] == null || lon[i] == null) continue;
      var p = {
        lat: lat[i], lon: lon[i],
        ele: alt[i] != null ? alt[i] : null,
        hr: hr[i] != null ? hr[i] : null,
        cad: cad[i] != null ? cad[i] : null,
        w: watts[i] != null ? watts[i] : null,
        t: (start && tim[i] != null) ? new Date(start.getTime() + tim[i] * 1000) : null
      };
      if (!isFinite(p.lat) || !isFinite(p.lon)) continue;
      cum = dist[i] != null ? dist[i] : cum + (prev ? haversine(prev, p) : 0);
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

  function empty() {
    return build({
      name: 'Sortie', type: '', date: new Date(),
      distance_m: 10000, duration_s: 3000,
      elev_gain_m: 120, elev_loss_m: 120, elev_min_m: 400, elev_max_m: 520,
      hr_avg: null, hr_max: null, cadence_avg: null
    });
  }

  global.Activity = {
    parseGPX: parseGPX, fromStrava: fromStrava, fromIntervals: fromIntervals,
    build: build, empty: empty
  };
}(window));
