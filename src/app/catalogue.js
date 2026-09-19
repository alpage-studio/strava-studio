/* catalogue.js — le choix du style, en deux temps : la famille puis sa variante
 *
 * Sorti de src/app.js lors du découpage. Le contexte partagé arrive par
 * `App` — voir src/app/noyau.js pour ce qu'il contient et pourquoi.
 */
(function (A) {
  'use strict';

  var $ = A.$;
  var E = A.etat;
  var save = A.save;
  var effective = A.effective;
  var resolvedOptions = A.resolvedOptions;
  var poseEtatGlobal = A.poseEtatGlobal;
  var draw = A.draw;
  var buildOptions = A.buildOptions;

  /* ---------- LE CHOIX DE STYLE, EN DEUX TEMPS ----------
   *
   * Trente-trois noms dans un menu déroulant demandent de connaître le
   * catalogue par cœur. On montre donc d'abord des FAMILLES, avec une
   * vignette rendue depuis les sorties chargées — puis, une fois la famille
   * choisie, ses variantes.
   *
   * Les vignettes sont de vrais rendus, pas des images figées : elles
   * suivent la sortie, la couleur, le support et le noir & blanc en cours.
   * Une image figée aurait menti dès le premier réglage.
   *
   * Le regroupement est de la NAVIGATION, pas de la donnée : il vit ici et
   * non dans les templates, qui n'ont pas à connaître le rangement du
   * magasin. Tout template absent d'un groupe retombe dans « Autres » — en
   * ajouter un ne peut donc pas le faire disparaître de l'interface. */
  var GROUPES_STYLE = [
    { id: 'affiches', nom: 'Affiches',
      ids: ['encre', 'empreinte', 'mots', 'editorial', 'trace', 'chiffres',
            'allumettes', 'pente', 'radiale', 'sommet-ligne', 'sommet-barres'] },
    { id: 'cartes', nom: 'Cartes',
      ids: ['medaillon', 'atlas', 'metro', 'exploration', 'sous-bois'] },
    { id: 'reliefs', nom: 'Reliefs et données',
      ids: ['strates', 'gravure', 'gravure-puissance', 'versants', 'ressenti', 'almanac', 'tissage'] },
    { id: 'souvenirs', nom: 'Souvenirs',
      ids: ['saisons', 'serie', 'fresque'] },
    { id: 'films', nom: 'Films et son', ids: ['film', 'partition'] },
    /* CE QUI DISTINGUE CETTE FAMILLE N'EST PLUS LA TRANSPARENCE.
     *
     * Toutes les planches se posent sur une photo depuis que le support est
     * global : appeler ces huit-là « Surcouches » laissait croire aux autres
     * qu'elles ne le pouvaient pas. Ce qu'elles ont en propre, et que la
     * mesure montre, c'est leur VOILE : elles couvrent 19 à 68 % du cadre là
     * où les autres en laissent 91 à 98 % nus. Elles garantissent la
     * lisibilité sans qu'on ait à y penser. */
    { id: 'surcouches', nom: 'Voile compris',
      ids: ['ov-filet', 'ov-profil', 'ov-trace', 'ov-ardoise', 'ov-heros',
            'ov-tranche', 'ov-sommet-ligne', 'ov-sommet-barres'] }
  ];

  var groupeCourant = 'affiches';

  /* La phrase sous le nom vient du template lui-même : « Encre — le geste
   * du terrain » se coupe en « Encre » et « le geste du terrain ». Aucune
   * liste de descriptions à tenir à jour en parallèle. */
  function nomEtDit(tpl) {
    var n = T(tpl.name);
    var i = n.indexOf(' — ');
    return i > 0 ? { nom: n.slice(0, i), dit: n.slice(i + 3) } : { nom: n, dit: '' };
  }

  /* LES VARIANTES D'UNE FAMILLE — un JEU d'options, pas une valeur.
   *
   * Par défaut, ce sont les valeurs de la PREMIÈRE liste déroulante du
   * template, hors fond et voile qui sont devenus des réglages globaux. Pour
   * la plupart des planches c'est exact : leur premier réglage EST la
   * composition, et Encre, Empreinte ou Atlas exposent ainsi toutes leurs
   * variantes.
   *
   * Trois familles ne rentraient pas dans cette forme, et leurs plus belles
   * variantes étaient introuvables dans l'outil alors qu'elles figuraient dans
   * la galerie de revue :
   *   · Médaillon « Fragment »        = cadrage 58 + décalage −15, deux CURSEURS
   *   · Almanac « Gravity »           = trois clés à la fois
   *   · Strates « Massif · accent »   = une composition PLUS un accent
   * Aucune carte ne pouvait les montrer : le catalogue n'affichait qu'un seul
   * axe. Ces templates déclarent donc `variantes` en clair.
   *
   * Un template ne déclare cette liste que si l'axe unique lui ment. */
  function variantesDe(tpl) {
    if (tpl && tpl.variantes && tpl.variantes.length) return tpl.variantes;
    var def = ((tpl && tpl.options) || []).filter(function (d) {
      return d.type === 'select' && d.key !== 'fond' && d.key !== 'voile';
    })[0];
    if (!def) return null;
    return def.choices.map(function (c) {
      var o = {};
      o[def.key] = c[0];
      return { nom: c[1], o: o };
    });
  }

  /* Toutes les clés qu'une famille fait varier. Choisir une variante remet
   * CES clés au défaut du template avant d'appliquer les siennes : sans ça,
   * passer de « Fragment » à « Nocturne » garderait le cadrage de Fragment et
   * la carte montrerait autre chose que son aperçu. */
  function clesVariantes(liste) {
    var vues = {};
    liste.forEach(function (v) {
      Object.keys(v.o).forEach(function (k) { vues[k] = 1; });
    });
    return Object.keys(vues);
  }

  function defautDe(tpl, cle) {
    var d = (tpl.options || []).filter(function (x) { return x.key === cle; })[0];
    return d ? d.default : undefined;
  }

  /* La variante active : celle dont TOUTES les options correspondent, et la
   * plus précise quand plusieurs correspondent — « Massif » et
   * « Massif · accent » partagent une clé, seule la seconde décrit l'état
   * complet. */
  function varianteActive(tpl, liste, vals) {
    var gagnante = -1, precision = -1;
    liste.forEach(function (v, i) {
      var cles = Object.keys(v.o);
      var colle = cles.every(function (k) {
        var courant = vals[k] === undefined ? defautDe(tpl, k) : vals[k];
        return String(courant) === String(v.o[k]);
      });
      if (colle && cles.length > precision) { precision = cles.length; gagnante = i; }
    });
    return gagnante;
  }

  /* Une vignette : un vrai rendu, en petit. On rend à 300 px de large et on
   * laisse le CSS réduire — en dessous, les textes des planches deviennent
   * des taches grises et toutes les familles se ressemblent. */
  function vignette(cv, tplId, valeurs) {
    var L = 300, H2 = Math.round(L * 16 / 9);
    /* Les réglages posés avant de peindre, comme pour la scène — sinon la
     * vignette ment d'un cran sur le noir & blanc et le support.
     *
     * Et surtout : les options passent par resolvedOptions(), donc par la
     * COLLECTION. Sans cela une collection choisie pilotait la planche mais
     * pas les vignettes, et la carte montrait autre chose que ce qu'elle
     * allait produire — exactement ce qu'un rendu vivant était censé éviter.
     *
     * Studio.render attrape déjà toute exception et peint une carte d'erreur :
     * pas de try/catch ici, il ne pourrait rien attraper. */
    poseEtatGlobal();
    Studio.render(cv, tplId, effective(), resolvedOptions(tplId, valeurs), [L, H2]);
  }

  function construitChoixStyle() {
    var boite = $('#choix-style');
    if (!boite) return;
    boite.innerHTML = '';
    /* Le damier derrière les vignettes quand le support est transparent :
     * sans lui, une encre sombre sur une carte sombre est invisible. */
    boite.classList.toggle('surcouche', $('#support').value === 'surcouche');
    var tousIds = Studio.all().map(function (t) { return t.id; });
    var ranges = {};
    GROUPES_STYLE.forEach(function (g) {
      g.ids.forEach(function (i) { ranges[i] = 1; });
    });
    var orphelins = tousIds.filter(function (i) { return !ranges[i]; });
    var groupes = GROUPES_STYLE.slice();
    if (orphelins.length) groupes.push({ id: 'autres', nom: 'Autres', ids: orphelins });

    if (E.familleOuverte) return construitVariantes(boite);

    var chips = document.createElement('div');
    chips.className = 'groupes-style';
    groupes.forEach(function (g) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = T(g.nom);
      b.className = g.id === groupeCourant ? 'on' : '';
      b.addEventListener('click', function () {
        groupeCourant = g.id; construitChoixStyle();
      });
      chips.appendChild(b);
    });
    boite.appendChild(chips);

    var grille = document.createElement('div');
    grille.className = 'familles';
    var g0 = groupes.filter(function (x) { return x.id === groupeCourant; })[0] || groupes[0];
    g0.ids.forEach(function (id) {
      var tpl = Studio.get(id);
      if (!tpl) return;
      var d = nomEtDit(tpl);
      var carte = document.createElement('button');
      carte.type = 'button';
      carte.className = 'carte-style' + (id === $('#tpl').value ? ' on' : '');
      var cv = document.createElement('canvas');
      carte.appendChild(cv);
      var nom = document.createElement('span');
      nom.className = 'nom'; nom.textContent = d.nom;
      carte.appendChild(nom);
      if (d.dit) {
        var dit = document.createElement('span');
        dit.className = 'dit'; dit.textContent = d.dit;
        carte.appendChild(dit);
      }
      carte.addEventListener('click', function () {
        if (E.exportEnCours) return;          // un export en cours a la priorité
        $('#tpl').value = id;
        $('#tpl').dispatchEvent(new Event('change'));
        E.familleOuverte = variantesDe(tpl) ? id : null;
        construitChoixStyle();
      });
      grille.appendChild(carte);
      vignette(cv, id, (E.optionValues[id] || {}));
    });
    boite.appendChild(grille);
  }

  function construitVariantes(boite) {
    var tpl = Studio.get(E.familleOuverte);
    var liste = tpl && variantesDe(tpl);
    if (!tpl || !liste) { E.familleOuverte = null; return construitChoixStyle(); }

    var retour = document.createElement('button');
    retour.type = 'button';
    retour.className = 'retour-familles';
    retour.textContent = '← ' + T('Toutes les familles');
    retour.addEventListener('click', function () {
      E.familleOuverte = null; construitChoixStyle();
    });
    boite.appendChild(retour);

    var vals = E.optionValues[tpl.id] || (E.optionValues[tpl.id] = {});
    var cles = clesVariantes(liste);
    var active = varianteActive(tpl, liste, vals);

    /* L'état d'une variante : on part des réglages courants, on remet au
     * défaut toutes les clés que la famille fait varier, puis on applique les
     * siennes. Le même calcul sert à l'aperçu ET au clic — une vignette qui
     * montrerait autre chose que ce qu'un clic produit serait pire qu'absente. */
    function etatDe(v) {
      var o = {};
      Object.keys(vals).forEach(function (k) { o[k] = vals[k]; });
      cles.forEach(function (k) {
        var d = defautDe(tpl, k);
        if (d === undefined) delete o[k]; else o[k] = d;
      });
      Object.keys(v.o).forEach(function (k) { o[k] = v.o[k]; });
      return o;
    }

    var grille = document.createElement('div');
    grille.className = 'variantes';
    liste.forEach(function (v, i) {
      var carte = document.createElement('button');
      carte.type = 'button';
      carte.className = 'carte-style' + (i === active ? ' on' : '');
      var cv = document.createElement('canvas');
      carte.appendChild(cv);
      var nom = document.createElement('span');
      nom.className = 'nom';
      /* Le nom seul : « Original · Sceau — disque décentré » dans une carte
       * de cent-cinquante pixels ne se lit pas. L'histoire du développement
       * (Original / Exploration) n'a rien à faire dans le parcours. */
      var lib = T(v.nom).replace(/^(Original|Exploration)\s*·\s*/, '').split(' — ')[0];
      nom.textContent = lib;
      carte.appendChild(nom);
      if (v.dit) {
        var dit = document.createElement('span');
        dit.className = 'dit';
        dit.textContent = T(v.dit);
        carte.appendChild(dit);
      }
      carte.addEventListener('click', function () {
        if (E.exportEnCours) return;
        var etat = etatDe(v);
        E.optionValues[tpl.id] = etat;
        buildOptions();
        construitChoixStyle();
        draw();
        save();
      });
      grille.appendChild(carte);
      vignette(cv, tpl.id, etatDe(v));
    });
    boite.appendChild(grille);
  }

  A.GROUPES_STYLE = GROUPES_STYLE;
  A.construitChoixStyle = construitChoixStyle;
}(window.App));
