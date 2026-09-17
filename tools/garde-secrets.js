/* garde-secrets.js — ce qui ne doit jamais partir dans le dépôt.
 *
 *   node tools/garde-secrets.js
 *
 * Deux choses, et elles n'ont pas la même nature.
 *
 * LES SECRETS. Le `client_secret` Strava vit dans ~/.strava-studio/config.json,
 * hors du dépôt, et il n'y a jamais eu de jeton dans un fichier suivi. Ce
 * contrôle n'est donc pas là pour réparer quelque chose : il est là pour que le
 * jour où un collage malheureux en introduit un, ce soit la CI qui le dise et
 * non un inconnu qui le trouve. Un secret publié une seconde est un secret
 * brûlé — l'historique de git le garde même après suppression.
 *
 * LES POSITIONS. Une trace GPX dit où on est passé ; un projet exporté est un
 * .json avec des latitudes à six décimales, c'est-à-dire l'adresse du domicile
 * au mètre près. .gitignore refuse déjà les *.json avec une liste blanche, mais
 * rien n'empêche un `git add -f`, et rien ne regarde les .gpx. Ici, tout fichier
 * de position suivi doit être NOMMÉ dans la liste ci-dessous. Ajouter une vraie
 * sortie devient alors un acte délibéré — il faut écrire son nom — au lieu d'un
 * oubli.
 *
 * Le contrôle ne lit que les fichiers SUIVIS : ce qui n'est pas suivi n'est pas
 * publié, et le répertoire de travail est plein de sorties réelles.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
let trouves = 0;

/* ---------- les fichiers de position autorisés ----------
 *
 * Tous sont SYNTHÉTIQUES : fabriqués par tools/make-exemples.js,
 * tools/make-demos.js et tools/make-sample-gpx.js, autour de coordonnées
 * inventées. Aucun ne vient d'une sortie réelle, et c'est la raison de cette
 * liste : elle rend l'ajout d'une trace vécue visible dans le diff. */
const POSITIONS_AUTORISEES = new Set([
  'exemple.gpx', 'exemple-boucle.gpx', 'exemple-aller.gpx',
  'exemple-ailleurs.gpx', 'exemple-variante.gpx', 'exemple-annee.json',
  'demo-boucle.gpx', 'demo-aller.gpx', 'demo-ouvert.gpx', 'demo-croisements.gpx',
  'loin-a.gpx', 'loin-b.gpx',
  'sem-lun.gpx', 'sem-mar.gpx', 'sem-jeu.gpx', 'sem-ven.gpx', 'sem-dim.gpx',
  'sem-01.gpx', 'sem-02.gpx', 'sem-03.gpx', 'sem-04.gpx',
  'sem-05.gpx', 'sem-06.gpx', 'sem-07.gpx', 'sem-08.gpx',
  /* la géométrie extraite des templates : des coordonnées de dessin, pas de
   * terrain — aucune latitude là-dedans */
  'tools/geometry.json'
]);

/* ---------- les motifs ----------
 *
 * Chacun cherche une AFFECTATION à une valeur qui ressemble à un secret, pas la
 * simple mention du mot. `tools/strava.js` parle de client_secret à six
 * endroits parce qu'il le LIT depuis un fichier de configuration : un contrôle
 * qui s'arrêterait au mot crierait au loup à chaque exécution, et on finirait
 * par ne plus le lire. */
const MOTIFS = [
  { nom: 'clé privée',
    re: /-----BEGIN (?:RSA |EC |OPENSSH |PGP )?PRIVATE KEY-----/ },
  { nom: 'jeton GitHub',
    re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{50,}\b/ },
  { nom: 'clé AWS',
    re: /\bAKIA[0-9A-Z]{16}\b/ },
  { nom: 'clé OpenAI / Anthropic',
    re: /\b(?:sk-[A-Za-z0-9]{32,}|sk-ant-[A-Za-z0-9-]{40,})\b/ },
  { nom: 'secret affecté à une valeur littérale',
    /* client_secret / api_key / apikey / password / access_token / bearer,
     * suivi de : ou = puis d'une chaîne d'au moins 16 caractères qui n'est pas
     * un appel, une variable ni un texte à trous. */
    re: /\b(?:client_secret|api[_-]?key|secret[_-]?key|access[_-]?token|refresh[_-]?token|password|passwd)\b\s*[:=]\s*['"`]([A-Za-z0-9_\-/+=.]{16,})['"`]/i },
  { nom: 'en-tête Bearer en dur',
    re: /\bBearer\s+[A-Za-z0-9_\-.]{20,}/ }
];

/* Les valeurs qui déclenchent un motif sans être un secret : ce sont des
 * gabarits, des exemples volontairement inertes ou des noms de champs. Toute
 * ligne ajoutée ici doit être lisible comme manifestement inoffensive. */
const INOFFENSIF = [
  /votre[_-]?cle|ta[_-]?cle|xxx+|\.{3}|<[^>]+>|\$\{|%s\b/i,
  /['"`](?:client_secret|api_key|password)['"`]\s*[:=]/i   /* le NOM du champ */
];

function estBinaire(buf) {
  const n = Math.min(buf.length, 4096);
  for (let i = 0; i < n; i++) if (buf[i] === 0) return true;
  return false;
}

function suivis() {
  const sortie = execFileSync('git', ['ls-files', '-z'], { cwd: RACINE });
  return sortie.toString('utf8').split('\0').filter(Boolean);
}

function echec(quoi, ou, extrait) {
  trouves++;
  console.log('  ÉCHEC  ' + quoi + '\n         ' + ou +
              (extrait ? '\n         ' + extrait : ''));
}

function main() {
  const fichiers = suivis();
  console.log('Garde — ' + fichiers.length + ' fichiers suivis\n');

  /* 1. les positions */
  const positions = fichiers.filter(function (f) {
    return /\.(gpx|json)$/i.test(f);
  });
  positions.forEach(function (f) {
    const cle = f.replace(/\\/g, '/');
    if (!POSITIONS_AUTORISEES.has(cle)) {
      echec('fichier de position non déclaré', cle,
            'si cette trace est synthétique, ajoute son nom à POSITIONS_AUTORISEES ; ' +
            'si elle est réelle, elle ne doit pas être publiée');
    }
  });
  console.log('  ' + positions.length + ' fichiers de position, ' +
              (positions.length - trouves) + ' déclarés');

  /* 2. les secrets */
  const avant = trouves;
  fichiers.forEach(function (f) {
    const abs = path.join(RACINE, f);
    let buf;
    try { buf = fs.readFileSync(abs); } catch (e) { return; }   /* lien mort */
    if (estBinaire(buf) || buf.length > 2 * 1024 * 1024) return;
    const lignes = buf.toString('utf8').split(/\r?\n/);
    lignes.forEach(function (ligne, i) {
      if (INOFFENSIF.some(function (r) { return r.test(ligne); })) return;
      MOTIFS.forEach(function (m) {
        if (!m.re.test(ligne)) return;
        echec(m.nom, f + ':' + (i + 1),
              ligne.trim().slice(0, 100));
      });
    });
  });
  console.log('  ' + (trouves - avant) + ' secret(s) apparent(s)');

  console.log('\n' + (trouves ? trouves + ' problème(s)' : 'rien à signaler'));
  process.exitCode = trouves ? 1 : 0;
}

main();
