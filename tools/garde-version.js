/* garde-version.js — le numéro de version suit-il ce qu'on a changé ?
 *
 *   node tools/garde-version.js [base] [tête]
 *
 *   base : origin/main par défaut — la CI passe le commit d'avant la poussée.
 *   tête : HEAD par défaut. Les deux arguments servent aussi à éprouver le
 *          contrôle sur un cas réel de l'historique (voir le bas du fichier).
 *
 * POURQUOI CE CONTRÔLE EXISTE
 *   sw.js nomme son cache avec le numéro : `VERSION = 'studio-v' +
 *   STUDIO_VERSION`. Publier un fichier du SHELL sans monter le numéro laisse
 *   les visiteurs sur l'ANCIEN cache. Il n'y a ni erreur, ni message, ni rien
 *   à voir : le site est à jour, et eux voient l'ancienne version jusqu'à ce
 *   qu'un autre changement finisse par purger. C'est le genre de défaut qu'on
 *   ne découvre que par un utilisateur qui décrit un bogue corrigé depuis.
 *
 *   Le harnais vérifie déjà que le journal s'ouvre sur la version servie. Il ne
 *   peut pas vérifier celui-ci : il faut comparer DEUX états du dépôt, donc
 *   git. C'est pourquoi ce contrôle vit à part.
 *
 * CE QU'IL FAIT
 *   1. si un fichier servi hors ligne a changé, le numéro doit avoir changé ;
 *   2. un numéro déjà porté par une étiquette ne peut pas être réutilisé sur
 *      un autre commit — sinon « revenir à la 3.1 » ne veut plus rien dire.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const RACINE = path.join(__dirname, '..');
let echoues = 0;

function git(args, tolerant) {
  try {
    /* en mode tolérant on ferme aussi la sortie d'erreur : « unknown revision »
     * est ici une RÉPONSE (l'étiquette n'existe pas encore), pas un incident, et
     * un message rouge au milieu de contrôles verts se lit comme un échec */
    return execFileSync('git', args, {
      cwd: RACINE, encoding: 'utf8',
      stdio: tolerant ? ['ignore', 'pipe', 'ignore'] : undefined
    }).trim();
  } catch (e) {
    if (tolerant) return null;
    throw e;
  }
}

function ok(nom, condition, detail) {
  if (condition) { console.log('  ok    ' + nom); return; }
  echoues++;
  console.log('  ÉCHEC ' + nom + (detail ? '\n        ' + detail : ''));
}

function saute(nom, pourquoi) { console.log('  passé ' + nom + ' — ' + pourquoi); }

/* Le SHELL est une liste de chaînes './…' dans sw.js. On la lit par le texte
 * plutôt qu'en exécutant le fichier : sw.js commence par un importScripts()
 * qui n'existe que dans un service worker. */
function lisShell() {
  const src = fs.readFileSync(path.join(RACINE, 'sw.js'), 'utf8');
  const i = src.indexOf('const SHELL');
  const j = src.indexOf('];', i);
  if (i < 0 || j < 0) return null;
  const bloc = src.slice(i, j);
  const out = new Set();
  const re = /'\.\/([^']*)'/g;
  let m;
  while ((m = re.exec(bloc))) if (m[1]) out.add(m[1]);
  return out;
}

function versionA(ref) {
  const src = git(['show', ref + ':src/version.js'], true);
  if (!src) return null;
  const m = /STUDIO_VERSION = '([\d.]+)'/.exec(src);
  return m ? m[1] : null;
}

function main() {
  const base = process.argv[2] || process.env.BASE_REF || 'origin/main';
  const tete = process.argv[3] || 'HEAD';
  console.log('Garde de version — ' + base + ' → ' + tete + '\n');

  const shell = lisShell();
  if (!shell) { console.log('  SHELL illisible dans sw.js'); process.exitCode = 1; return; }

  const vTete = versionA(tete);
  ok('le numéro est lisible  (' + vTete + ')', !!vTete);

  /* ---------- 1. SHELL changé ⇒ numéro changé ---------- */
  const baseResolue = git(['rev-parse', '--verify', base + '^{commit}'], true);
  if (!baseResolue) {
    saute('SHELL ↔ version', 'base « ' + base + ' » introuvable ' +
          '(clone superficiel, ou première poussée d\'une branche)');
  } else {
    const changes = (git(['diff', '--name-only', baseResolue, tete]) || '')
      .split('\n').map(function (s) { return s.trim(); }).filter(Boolean);

    /* index.html et sw.js sont servis eux aussi : './' et './index.html' sont
     * dans le SHELL, et sw.js est le fichier qui porte la liste. */
    const servis = changes.filter(function (f) {
      const p = f.replace(/\\/g, '/');
      return shell.has(p) || p === 'index.html' || p === 'sw.js' ||
             p === 'manifest.webmanifest';
    });

    const vBase = versionA(baseResolue);
    if (!servis.length) {
      console.log('  ok    aucun fichier servi hors ligne n\'a changé');
    } else {
      ok('un fichier servi a changé ⇒ le numéro aussi  (' +
         vBase + ' → ' + vTete + ')',
         vBase !== vTete,
         servis.length + ' fichier(s) du cache modifiés sans montée de version :\n        ' +
         servis.slice(0, 8).join('\n        ') +
         (servis.length > 8 ? '\n        … et ' + (servis.length - 8) + ' autres' : '') +
         '\n        → changer STUDIO_VERSION dans src/version.js, et ajouter ' +
         'son entrée au journal');
    }
  }

  /* ---------- 2. un numéro ne se réutilise pas ---------- */
  const etiquette = 'v' + vTete;
  const cible = git(['rev-list', '-n', '1', etiquette], true);
  if (!cible) {
    console.log('  ok    ' + etiquette + ' pas encore posée — c\'est une version en cours');
  } else {
    const commitTete = git(['rev-parse', tete]);
    ok(etiquette + ' désigne bien ce commit', cible === commitTete,
       'la version ' + vTete + ' est déjà étiquetée sur ' + cible.slice(0, 8) +
       '.\n        Réutiliser un numéro rend « revenir à la ' + vTete +
       ' » ambigu : monter le numéro.');
  }

  console.log('\n' + (echoues ? echoues + ' échec(s)' : 'la version suit le contenu'));
  process.exitCode = echoues ? 1 : 0;
}

main();

/* LE TÉMOIN — ce contrôle a été vu rouge sur un cas réel du dépôt :
 *
 *     node tools/garde-version.js 405dc11 96129ff
 *
 * Entre ces deux commits, `src/templates/almanac.js` — servi hors ligne — a
 * changé, et le numéro est resté à 2.6. Les visiteurs qui avaient déjà ouvert
 * le studio ont gardé l'ancien Almanac dans leur cache. Un contrôle qu'on n'a
 * jamais vu échouer ne prouve rien ; celui-ci a un défaut daté à son actif. */

