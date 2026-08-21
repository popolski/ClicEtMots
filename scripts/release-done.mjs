// Marque le transfert FTP comme fait : enregistre le commit courant et la
// dernière migration SQL comme "déployés", pour que le prochain
// `npm run release` ne reparle que des nouveautés.
//
// Volontairement séparé de release.mjs : seul un humain sait si le
// transfert a réellement eu lieu. À ne lancer qu'APRÈS avoir transféré
// pour de bon - sinon le script sous-estimera ce qu'il reste à faire (déjà
// arrivé, avec deux correctifs de sécurité restés sur le poste).
//
//   npm run release:done
import { execSync } from 'node:child_process'
import { writeFileSync, readdirSync } from 'node:fs'

const ETAT_PATH = new URL('../.deploy-state.json', import.meta.url)
const ROOT = new URL('../', import.meta.url)

const headActuel = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()

let versionMax = 0
for (const f of readdirSync(new URL('../server/', import.meta.url))) {
  const m = f.match(/^schema-v(\d+)\.sql$/)
  if (m) versionMax = Math.max(versionMax, Number(m[1]))
}

writeFileSync(ETAT_PATH, JSON.stringify({ dernierCommit: headActuel, derniereVersionSchema: versionMax }, null, 2) + '\n')

console.log(`Déploiement enregistré : commit ${headActuel.slice(0, 8)}, schéma v${versionMax}.`)
