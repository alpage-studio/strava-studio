/* partition.js — une sortie traduite en une courte pièce sonore.
 *
 * Deux objets : la PARTITION (des données, aucun son) et le LECTEUR (Web
 * Audio). Le même partage que partout ailleurs dans le studio : ce qui
 * calcule ne joue pas, ce qui joue ne calcule pas. Le template dessine la
 * partition sans savoir qu'un son existe, et l'export WAV rejoue exactement
 * la même partition hors ligne.
 *
 * Ce qui est promis, et comment c'est tenu :
 *
 *   - DÉTERMINISTE. Aucun hasard, nulle part. La même sortie avec les mêmes
 *     réglages donne la même suite de notes, donc le même fichier audio,
 *     octet pour octet. C'est ce qui permet de refaire un export sans
 *     découvrir une autre pièce.
 *   - LA CADENCE DONNE LA PULSATION, quand elle existe : l'intervalle entre
 *     deux notes suit les tours de pédale. Sans capteur de cadence, on pose
 *     une pulsation conventionnelle — et la partition l'écrit en toutes
 *     lettres, parce qu'une pulsation inventée présentée comme mesurée
 *     serait un mensonge tranquille.
 *   - LE RELIEF DONNE LA MÉLODIE : l'altitude choisit le degré dans la
 *     gamme. Pas la note exacte : une GAMME PENTATONIQUE, dont tous les
 *     accords sonnent bien ensemble. C'est ce qui garantit qu'aucune sortie,
 *     même en dents de scie, ne produit une bouillie dissonante.
 *   - LES PAUSES NE SONT REPRÉSENTÉES QUE SI ON PEUT LES IDENTIFIER : il
 *     faut des horodatages. Sans eux, il n'y a pas de silence inventé.
 */
(function (global) {
  'use strict';

  /* Pentatonique mineure sur trois octaves : quinze degrés, aucun demi-ton
   * voisin. Deux notes prises au hasard là-dedans sonnent toujours. */
  var DEGRES = [0, 3, 5, 7, 10];
  var BASE = 220;                      // la3

  function frequence(degre) {
    var oct = Math.floor(degre / DEGRES.length);
    var demi = DEGRES[degre % DEGRES.length] + 12 * oct;
    return BASE * Math.pow(2, demi / 12);
  }

  var AMBIANCES = {
    nappe:  { onde: 'sine',     attaque: 0.09, chute: 0.9,  coupe: 1800, gain: 0.5, harmonique: 0 },
    pince:  { onde: 'triangle', attaque: 0.005, chute: 0.38, coupe: 3200, gain: 0.55, harmonique: 0 },
    cloche: { onde: 'sine',     attaque: 0.002, chute: 1.4, coupe: 5200, gain: 0.42, harmonique: 2.76 }
  };

  /* ---------- construction ---------- */

  function construire(activity, opts) {
    opts = opts || {};
    var duree = Math.max(10, Math.min(20, opts.duree || 14));
    var octaves = 3;
    var pts = (activity && activity.track) || [];

    var utiles = pts.filter(function (p) { return p.lat != null || p.ele != null || p.w != null; });
    if (utiles.length < 4) {
      return { notes: [], duree: duree, echelle: DEGRES.length * octaves,
               source: { pulsation: 'aucune', hauteur: 'aucune', pauses: false },
               vide: true };
    }

    /* --- la pulsation --- */
    var aCadence = pts.some(function (p) { return p.cad != null && p.cad > 20; });
    /* --- la hauteur --- */
    var eles = pts.filter(function (p) { return p.ele != null; }).map(function (p) { return p.ele; });
    var aRelief = eles.length > 3;
    var eMin = aRelief ? Math.min.apply(null, eles) : 0;
    var eMax = aRelief ? Math.max.apply(null, eles) : 1;
    var eSpan = (eMax - eMin) || 1;
    /* --- les pauses : seulement si on a des horodatages --- */
    var aTemps = pts.some(function (p) { return p.t; });

    /* Un premier passage pose les durées à partir de la cadence, un second
     * les ramène à la durée voulue. Impossible de faire l'inverse : on ne
     * sait pas combien de notes il y aura avant de les avoir posées. */
    var N = Math.max(12, Math.min(220, Math.round(duree * 3.2)));
    var brut = [];
    for (var i = 0; i < N; i++) {
      var p = echantillon(pts, i / (N - 1));
      var cad = (p.cad != null && p.cad > 20) ? p.cad : 78;     // 78 tr/min : la convention
      // une note tous les deux tours de pédale : c'est le tempo d'une phrase
      var dt = 120 / cad;
      var degre = aRelief && p.ele != null
        ? Math.round(((p.ele - eMin) / eSpan) * (DEGRES.length * octaves - 1))
        : Math.round((DEGRES.length * octaves - 1) * 0.42);
      var pause = aTemps && p.arret;
      var force = p.w != null ? Math.max(0.25, Math.min(1, p.w / (activity.power && activity.power.max || 300)))
                : p.v != null ? Math.max(0.25, Math.min(1, p.v / 12))
                : 0.6;
      brut.push({ dt: dt, degre: degre, pause: pause, force: force });
    }

    var total = brut.reduce(function (s, n) { return s + n.dt; }, 0) || 1;
    var k = duree / total;
    var t = 0, notes = [];
    brut.forEach(function (n) {
      var d = n.dt * k;
      notes.push({ t: t, duree: d, degre: n.degre, freq: frequence(n.degre),
                   force: n.force, pause: n.pause });
      t += d;
    });

    return {
      notes: notes, duree: duree, echelle: DEGRES.length * octaves,
      source: {
        pulsation: aCadence ? 'cadence' : 'convention',
        hauteur: aRelief ? 'altitude' : 'aucune',
        pauses: aTemps
      },
      ambiance: opts.ambiance || 'nappe'
    };
  }

  /* Échantillon à la position t ∈ [0,1] de la progression. On y calcule
   * aussi si la sortie était à l'arrêt : la même règle que le temps en
   * mouvement — un trou de plus de vingt secondes, ou moins de 1,4 km/h. */
  function echantillon(pts, t) {
    var n = pts.length;
    var i = Math.min(n - 1, Math.max(0, Math.round(t * (n - 1))));
    var p = pts[i], q = pts[Math.min(n - 1, i + 1)];
    var v = null, arret = false;
    if (p.t && q.t && q !== p) {
      var dt = (q.t - p.t) / 1000;
      var dd = (q.d != null && p.d != null) ? q.d - p.d : null;
      if (dt > 20) arret = true;
      else if (dd != null && dt > 0) { v = dd / dt; if (v < 0.4) arret = true; }
    }
    return { ele: p.ele, cad: p.cad, w: p.w, v: v, arret: arret };
  }

  /* ---------- synthèse ----------
   * Une même fonction sert au direct et à l'export : si l'export sonnait
   * autrement que l'aperçu, on n'aurait aucun moyen de s'en apercevoir avant
   * d'avoir monté la vidéo. */
  function pose(ctx, sortie, partition, opts) {
    var amb = AMBIANCES[partition.ambiance] || AMBIANCES.nappe;
    var volume = Math.max(0, Math.min(1, opts.volume == null ? 0.7 : opts.volume));
    var t0 = opts.t0 || 0;

    var maitre = ctx.createGain();
    maitre.gain.value = volume * 0.55;          // volume maîtrisé, par principe
    var filtre = ctx.createBiquadFilter();
    filtre.type = 'lowpass';
    filtre.frequency.value = amb.coupe;
    filtre.connect(maitre);
    maitre.connect(sortie);

    partition.notes.forEach(function (n) {
      if (n.pause) return;                       // un silence est un silence
      var debut = t0 + n.t;
      var fin = debut + Math.max(0.08, Math.min(n.duree * 2.4, amb.chute));
      poseVoix(n.freq, 1);
      if (amb.harmonique) poseVoix(n.freq * amb.harmonique, 0.22);

      function poseVoix(f, poids) {
        var osc = ctx.createOscillator();
        var g = ctx.createGain();
        osc.type = amb.onde;
        osc.frequency.value = f;
        var pic = amb.gain * n.force * poids;
        g.gain.setValueAtTime(0.0001, debut);
        g.gain.exponentialRampToValueAtTime(Math.max(0.0002, pic), debut + amb.attaque);
        g.gain.exponentialRampToValueAtTime(0.0001, fin);
        osc.connect(g); g.connect(filtre);
        osc.start(debut);
        osc.stop(fin + 0.02);
      }
    });
    return maitre;
  }

  /* ---------- lecteur ----------
   * Le son ne démarre QUE sur une action explicite : un contexte audio créé
   * au chargement est bloqué par tous les navigateurs, et ce serait de toute
   * façon un son qu'on n'a pas demandé. `stop()` coupe pour de bon — pas un
   * volume à zéro avec des oscillateurs qui continuent. */
  function Lecteur() {
    this.ctx = null;
    this.maitre = null;
    this.debutAudio = 0;
    this.pausePos = 0;
    this.etat = 'arrete';        // arrete | joue | pause
    this.partition = null;
    this.opts = {};
  }

  Lecteur.prototype.jouer = function (partition, opts) {
    this.arreter();
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) throw new Error('Ce navigateur n’a pas de Web Audio.');
    this.ctx = new AC();
    this.partition = partition;
    this.opts = opts || {};
    var depart = this.pausePos || 0;
    var reste = { notes: partition.notes.filter(function (n) { return n.t >= depart; })
                    .map(function (n) { return { t: n.t - depart, duree: n.duree, freq: n.freq,
                                                 force: n.force, pause: n.pause }; }),
                  duree: partition.duree - depart, ambiance: partition.ambiance };
    this.maitre = pose(this.ctx, this.ctx.destination, reste,
                       { volume: this.opts.volume, t0: this.ctx.currentTime + 0.06 });
    this.debutAudio = this.ctx.currentTime + 0.06 - depart;
    this.etat = 'joue';
  };

  Lecteur.prototype.position = function () {
    if (this.etat === 'joue' && this.ctx) {
      return Math.max(0, Math.min(this.partition.duree, this.ctx.currentTime - this.debutAudio));
    }
    return this.pausePos;
  };

  Lecteur.prototype.pause = function () {
    if (this.etat !== 'joue') return;
    this.pausePos = this.position();
    this.couper();
    this.etat = 'pause';
  };

  Lecteur.prototype.arreter = function () {
    this.couper();
    this.pausePos = 0;
    this.etat = 'arrete';
  };

  /* Fermer le contexte tue tous les oscillateurs programmés, y compris ceux
   * dont le `start()` est encore dans le futur. Baisser le gain ne suffirait
   * pas : ils reviendraient au premier changement de volume. */
  Lecteur.prototype.couper = function () {
    if (!this.ctx) return;
    try { this.ctx.close(); } catch (e) { /* déjà fermé */ }
    this.ctx = null;
    this.maitre = null;
  };

  /* ---------- export audio ----------
   * OfflineAudioContext rejoue la partition plus vite que le temps réel et
   * rend les échantillons ; on les emballe en WAV à la main — un encodeur
   * WAV tient en quarante lignes et évite une dépendance. */
  function exporterWav(partition, opts) {
    opts = opts || {};
    var taux = 44100;
    var OAC = global.OfflineAudioContext || global.webkitOfflineAudioContext;
    if (!OAC) return Promise.reject(new Error('Ce navigateur ne sait pas rendre d’audio hors ligne.'));
    var queue = 1.6;                    // de quoi laisser mourir la dernière note
    var ctx = new OAC(2, Math.ceil((partition.duree + queue) * taux), taux);
    pose(ctx, ctx.destination, partition, { volume: opts.volume, t0: 0 });
    return ctx.startRendering().then(function (buf) { return wav(buf); });
  }

  function wav(buf) {
    var canaux = buf.numberOfChannels, n = buf.length;
    var octets = 44 + n * canaux * 2;
    var vue = new DataView(new ArrayBuffer(octets));
    var p = 0;
    function txt(s) { for (var i = 0; i < s.length; i++) vue.setUint8(p++, s.charCodeAt(i)); }
    function u32(v) { vue.setUint32(p, v, true); p += 4; }
    function u16(v) { vue.setUint16(p, v, true); p += 2; }
    txt('RIFF'); u32(octets - 8); txt('WAVE');
    txt('fmt '); u32(16); u16(1); u16(canaux); u32(buf.sampleRate);
    u32(buf.sampleRate * canaux * 2); u16(canaux * 2); u16(16);
    txt('data'); u32(n * canaux * 2);
    var pistes = [];
    for (var c = 0; c < canaux; c++) pistes.push(buf.getChannelData(c));
    for (var i = 0; i < n; i++) {
      for (var k = 0; k < canaux; k++) {
        var v = Math.max(-1, Math.min(1, pistes[k][i]));
        vue.setInt16(p, v < 0 ? v * 0x8000 : v * 0x7FFF, true);
        p += 2;
      }
    }
    return new Blob([vue.buffer], { type: 'audio/wav' });
  }

  global.Partition = {
    construire: construire, exporterWav: exporterWav,
    Lecteur: Lecteur, DEGRES: DEGRES, AMBIANCES: AMBIANCES, frequence: frequence
  };
}(window));
