// Prépare une mise en prod : lance lint/tests/build, puis affiche la liste
// précise de ce qu'il faut transférer par FTP - fichiers PHP modifiés,
// migrations SQL pas encore exécutées, si dist/ est concerné, et si les
// gros dossiers (audio/pictos/pictos-mots/mascottes) peuvent être exclus du
// transfert. Signalé comme un vrai point de friction récurrent (l'ordre
// SQL -> PHP -> dist et les dossiers à exclure se retiennent mal à la main
// d'une session à l'autre).
//
// Compare uniquement l'état commité (HEAD) au dernier déploiement connu -
// commit tout ce que tu veux transférer avant de lancer ce script.
//
//   npm run release        vérifie et affiche quoi transférer
//   npm run release:done   marque le transfert comme fait
//
// Les deux sont volontairement séparés : seul un humain sait si le
// transfert FTP a réellement eu lieu. Confondre les deux a déjà marqué
// comme "déployés" des correctifs de sécurité qui ne l'étaient pas, et
// le script a ensuite sous-estimé ce qu'il restait à faire.
import { execSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'

const ETAT_PATH = new URL('../.deploy-state.json', import.meta.url)
const ROOT = new URL('../', import.meta.url)

function run(commande) {
  execSync(commande, { stdio: 'inherit', cwd: ROOT })
}

function sortie(commande) {
  return execSync(commande, { cwd: ROOT }).toString().trim()
}

function lireEtat() {
  if (!existsSync(ETAT_PATH)) return { dernierCommit: null, derniereVersionSchema: 0 }
  try {
    return JSON.parse(readFileSync(ETAT_PATH, 'utf8'))
  } catch {
    return { dernierCommit: null, derniereVersionSchema: 0 }
  }
}

function versionSchemaMax() {
  const fichiers = readdirSync(new URL('../server/', import.meta.url))
  let max = 0
  for (const f of fichiers) {
    const m = f.match(/^schema-v(\d+)\.sql$/)
    if (m) max = Math.max(max, Number(m[1]))
  }
  return max
}

console.log('--- lint ---')
run('npm run lint')
console.log('--- tests ---')
run('npm run test')
console.log('--- build ---')
run('npm run build')

const etat = lireEtat()
const headActuel = sortie('git rev-parse HEAD')
const versionMax = versionSchemaMax()

console.log('\n=== Récapitulatif du déploiement ===\n')

if (!etat.dernierCommit) {
  console.log(
    "Aucun déploiement connu par ce script (première utilisation). Transfère tout au moins une fois " +
      '(dist/, tous les fichiers server/api/, toutes les migrations server/schema-v*.sql dans l\'ordre), ' +
      'puis confirme ci-dessous pour que les prochains lancements soient précis.',
  )
} else if (etat.dernierCommit === headActuel) {
  console.log('Rien de nouveau à déployer depuis le dernier déploiement enregistré.')
  process.exit(0)
} else {
  const fichiersChanges = sortie(`git diff --name-only ${etat.dernierCommit} ${headActuel}`)
    .split('\n')
    .filter(Boolean)

  const phpChanges = fichiersChanges.filter((f) => f.startsWith('server/api/') && f.endsWith('.php'))
  const migrationsAFaire = []
  for (let v = etat.derniereVersionSchema + 1; v <= versionMax; v++) migrationsAFaire.push(`server/schema-v${v}.sql`)

  const prefixesFrontend = ['src/', 'public/', 'index.html', 'package.json', 'package-lock.json', 'vite.config', 'tsconfig']
  const distConcerne = fichiersChanges.some((f) => prefixesFrontend.some((p) => f.startsWith(p)))

  const dossiersLourds = ['public/audio/', 'public/pictos/', 'public/pictos-mots/', 'public/mascottes/']
  const dossiersInchanges = dossiersLourds.filter((d) => !fichiersChanges.some((f) => f.startsWith(d)))

  if (migrationsAFaire.length > 0) {
    console.log(`1. Exécuter dans l'ordre, dans phpMyAdmin :\n   ${migrationsAFaire.join('\n   ')}`)
  }
  if (phpChanges.length > 0) {
    console.log(`${migrationsAFaire.length > 0 ? '2' : '1'}. Uploader ces fichiers PHP :\n   ${phpChanges.join('\n   ')}`)
  }
  if (distConcerne) {
    console.log(`${migrationsAFaire.length + (phpChanges.length > 0 ? 1 : 0) + 1}. Transférer dist/`)
    if (dossiersInchanges.length === dossiersLourds.length) {
      console.log(`   Tu peux exclure : ${dossiersLourds.map((d) => d.replace('public/', '').replace('/', '')).join(', ')} (inchangés).`)
    } else if (dossiersInchanges.length > 0) {
      console.log(
        `   Tu peux exclure : ${dossiersInchanges.map((d) => d.replace('public/', '').replace('/', '')).join(', ')} (inchangés) - ` +
          `mais pas ${dossiersLourds.filter((d) => !dossiersInchanges.includes(d)).map((d) => d.replace('public/', '').replace('/', '')).join(', ')}.`,
      )
    }
  }
  if (migrationsAFaire.length === 0 && phpChanges.length === 0 && !distConcerne) {
    console.log('Rien à transférer (changements hors serveur/frontend, ex. documentation).')
  }
}

console.log('\nUne fois le transfert fait, enregistre-le avec :  npm run release:done')
