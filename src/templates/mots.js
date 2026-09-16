/* « Sans chiffres » — une trace, trois mots, rien d'autre.
 *
 * Tous les autres templates racontent une performance. Celui-ci raconte un
 * souvenir : la forme du parcours, et trois mots que l'utilisateur choisit.
 * Aucun chiffre, aucune unité, aucun badge — et surtout aucune émotion
 * déduite des données : les mots ne sont jamais proposés à sa place, les
 * exemples de l'interface restent des exemples.
 *
 * La garantie « pas de chiffres » n'est pas une intention, c'est une
 * propriété du fichier : ce template ne lit AUCUN champ chiffré de
 * l'activité. Pas de distance_km, pas de duration_s, pas d'elev_gain_m,
 * pas de splits. Il ne lit que `route`. Un cas du harnais le vérifie sur
 * le texte source, pour qu'un ajout distrait ne le réintroduise pas.
 *
 * La date et le titre existent mais sont MASQUÉS par défaut : proposés,
 * jamais imposés.
 */
Studio.template({
  id: 'mots',
  name: 'Sans chiffres — trois mots',
  famille: 'affiche',

  options: [
    { key: 'compo', type: 'select', label: 'Composition', default: 'trace',
      choices: [['trace', 'Trace seule'],
                ['photo', 'Photo dominante'],
                ['typo', 'Affiche typographique']] },
    { key: 'fond', type: 'color', label: 'Fond', default: '#0E0E10' },
    { key: 'encre', type: 'color', label: 'Encre', default: '#F2F0EA' },
    { key: 'accent', type: 'color', label: 'Accent', default: '#E5502D' },
    { key: 'mot1', type: 'text', label: 'Premier mot', default: '' },
    { key: 'mot2', type: 'text', label: 'Deuxième mot', default: '' },
    { key: 'mot3', type: 'text', label: 'Troisième mot', default: '' },
    { key: 'titre', type: 'text', label: 'Titre (facultatif)', default: '' },
    { key: 'montrerDate', type: 'toggle', label: 'Afficher la date', default: false },
    { key: 'grain', type: 'range', label: 'Grain', default: 10, min: 0, max: 40 }
  ],

  draw: function (s) {
    var ctx = s.ctx, w = s.w, h = s.h, a = s.a, o = s.o, H = s.H, u = H.u;
    var ink = o.encre, fond = o.fond;
    var mots = [o.mot1, o.mot2, o.mot3]
      .map(function (m) { return String(m || '').trim(); })
      .filter(Boolean);

    var aPhoto = o.compo === 'photo' && H.photo();
    if (!aPhoto) H.fill(fond);

    var g = H.grid({ cols: 6, margin: u(9) });
    /* Sur photo l'encre est forcément claire, quel que soit le réglage :
     * une encre sombre sur une image sombre ne se rattrape pas. */
    var encre = aPhoto ? '#FFFFFF' : ink;
    var voile = aPhoto ? melange(fond, 0.62) : melange(encre, 0.5);

    if (o.compo === 'typo') dessineTypo();
    else if (aPhoto) dessinePhoto();
    else dessineTrace();

    if (!aPhoto && o.grain) H.grain(o.grain / 1000);

    /* ---------- trace seule ---------- */
    function dessineTrace() {
      var basY = blocMots(g.bottom, encre, voile);
      var zone = { x: g.left, y: g.top, w: g.width, h: basY - u(8) - g.top };
      H.route(a.route, zone, {
        color: o.accent, width: u(1.1), pad: u(2),
        dots: u(0.95), startColor: o.accent, endColor: encre
      });
      entete(encre, voile);
    }

    /* ---------- photo dominante ---------- */
    function dessinePhoto() {
      /* Un dégradé du bas : sans lui, un mot clair sur un ciel clair
       * disparaît. C'est le seul réglage de lisibilité — on n'en ajoute pas
       * une demi-douzaine, on en pose un qui marche partout. */
      ctx.save();
      ctx.fillStyle = H.gradient(
        [[0, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,.45)'], [1, 'rgba(0,0,0,.86)']],
        0, h * 0.42, 0, h);
      ctx.fillRect(0, h * 0.42, w, h * 0.58);
      ctx.fillStyle = H.gradient([[0, 'rgba(0,0,0,.5)'], [1, 'rgba(0,0,0,0)']], 0, 0, 0, h * 0.28);
      ctx.fillRect(0, 0, w, h * 0.28);
      ctx.restore();

      blocMots(g.bottom, encre, 'rgba(255,255,255,.62)');
      // la trace devient une petite marque, pas un graphique
      H.route(a.route, { x: g.right - u(20), y: g.top, w: u(20), h: u(20) },
              { color: 'rgba(255,255,255,.9)', width: u(0.55) });
      entete(encre, 'rgba(255,255,255,.62)');
    }

    /* ---------- affiche typographique ---------- */
    function dessineTypo() {
      /* Les mots portent la page ; la trace n'est plus qu'un filigrane.
       * Le corps est calculé sur le mot le plus long, puis appliqué à tous :
       * trois tailles différentes casseraient le bloc. */
      H.route(a.route, { x: g.left, y: g.top + u(6), w: g.width, h: g.height - u(22) },
              { color: melange(o.accent, 0.22), width: u(2.6), pad: u(2) });

      if (!mots.length) { videxpl(); entete(encre, voile); return; }

      var ligne = u(15);
      var corps = 15;
      mots.forEach(function (m) {
        var essai = H.t('hero', { size: corps, maxWidth: g.width });
        var large = H.measureWith(m.toUpperCase(), essai, essai.size);
        if (large > g.width) corps = corps * (g.width / large) * 0.99;
      });
      var st = H.t('hero', { size: corps, color: encre });
      ligne = st.size * 0.94;

      var haut = g.top + g.height / 2 - (mots.length - 1) * ligne / 2 + ligne * 0.3;
      mots.forEach(function (m, i) {
        H.text(m.toUpperCase(), g.left, haut + i * ligne,
               H.t('hero', { size: corps, color: i === 0 ? o.accent : encre }));
      });
      entete(encre, voile);
    }

    /* ---------- briques ---------- */
    /* Les trois mots sur une ligne de base commune, séparés par un point
     * médian. S'ils ne tiennent pas, ils s'empilent — on ne rétrécit pas
     * indéfiniment un mot jusqu'à l'illisible. */
    function blocMots(bas, couleur, second) {
      if (!mots.length) { videxpl(); return bas - u(6); }
      var style = H.t('title', { size: 5.2, color: couleur });
      var sep = '   ·   ';
      var uneLigne = mots.join(sep);
      if (H.measureWith(uneLigne.toUpperCase(), style, style.size) <= g.width) {
        H.text(uneLigne.toUpperCase(), g.left, bas,
               H.t('title', { size: 5.2, color: couleur, tracking: u(0.35), maxWidth: g.width }));
        return bas - u(5.2);
      }
      var pas = u(6.4);
      mots.forEach(function (m, i) {
        H.text(m.toUpperCase(), g.left, bas - (mots.length - 1 - i) * pas,
               H.t('title', { size: 5.2, color: i === 0 ? couleur : second, maxWidth: g.width }));
      });
      return bas - (mots.length - 1) * pas - u(5.2);
    }

    /* Un rendu vide doit dire quoi faire, pas rester muet. */
    function videxpl() {
      H.text('TROIS MOTS, À TOI', g.left, g.bottom,
             H.t('label', { color: melange(encre, 0.45), maxWidth: g.width }));
    }

    function entete(couleur, second) {
      var t = String(o.titre || '').trim();
      if (t) H.text(t, g.left, g.top + u(2), H.t('title', { color: couleur, maxWidth: g.width }));
      if (o.montrerDate && a.date) {
        H.text(a.date.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' }),
               g.left, g.top + (t ? u(6.4) : u(2)), H.t('label', { color: second }));
      }
    }

    function melange(hex, k) {
      var v = parseInt(String(hex).replace('#', ''), 16);
      return 'rgba(' + ((v >> 16) & 255) + ',' + ((v >> 8) & 255) + ',' + (v & 255) + ',' + k + ')';
    }
  }
});
