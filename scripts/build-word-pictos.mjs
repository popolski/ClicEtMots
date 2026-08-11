// Télécharge un pictogramme ARASAAC pour les noms communs les plus
// fréquents du lexique (test initial : 1000 mots), pour illustrer la fiche
// mot (voir MotTool.tsx) en complément de la mascotte générique "nom".
//
// ARASAAC (arasaac.org) : voir scripts/build-pictos.mjs pour la licence et
// le principe (recherche + téléchargement UNE FOIS au build, jamais d'appel
// API depuis le navigateur d'un élève).
//
// Couverture attendue partielle (~50-60% sur un échantillon test) : ARASAAC
// est conçu pour du vocabulaire concret du quotidien (CAA), pas pour tout le
// vocabulaire scolaire — un nom sans pictogramme trouvé reste simplement
// absent de word-pictos.json, la fiche mot retombe sur la mascotte
// générique (déjà le comportement actuel, voir MotTool.CATEGORY_MASCOT).
//
// Relance sûre : ignore les mots déjà résolus dans word-pictos.json.
//
// Lancé à la main (fait des appels réseau vers arasaac.org) :
//   node scripts/build-word-pictos.mjs [--limit=1000]
//
// Les images téléchargées ont un fond blanc plein cadre : passer ensuite un
// détourage (même principe que pour les mascottes - flood-fill depuis les
// bords, tolérance ~30, sans toucher aux zones blanches internes du dessin)
// pour qu'elles s'intègrent proprement au thème du site. Script Python one-off,
// pas encore intégré à ce pipeline Node - voir l'historique du projet pour
// l'implémentation de référence.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)
const LIMIT = args.limit ? Number(args.limit) : 1000

const lexiquePath = new URL('../src/data/words-clavier2.json', import.meta.url)
const lexique = JSON.parse(readFileSync(lexiquePath, 'utf8'))

const outputPath = new URL('../src/data/word-pictos.json', import.meta.url)
const existing = existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : {}

const pictosDir = new URL('../public/pictos-mots/', import.meta.url)
mkdirSync(pictosDir, { recursive: true })

const noms = lexique
  .filter((e) => e.category === 'nom' && e.formRole === 'singulier')
  .sort((a, b) => b.frequency - a.frequency)
  .slice(0, LIMIT)
  .filter((e) => !(e.word in existing))

async function searchPictogramId(word) {
  const url = `https://api.arasaac.org/api/pictograms/fr/search/${encodeURIComponent(word)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const results = await res.json()
  if (!Array.isArray(results) || results.length === 0) return null
  return (results.find((r) => r.aac) ?? results[0])._id
}

async function downloadPictogram(id, destPath) {
  const url = `https://static.arasaac.org/pictograms/${id}/${id}_500.png`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buffer)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

console.log(`${noms.length} nom(s) à rechercher (déjà résolus ignorés).`)

let resolved = 0
let notFound = 0
let errors = 0
for (let i = 0; i < noms.length; i++) {
  const { word } = noms[i]
  try {
    const id = await searchPictogramId(word)
    if (!id) {
      notFound++
    } else {
      const destPath = new URL(`${word}.png`, pictosDir)
      await downloadPictogram(id, destPath)
      existing[word] = `/pictos-mots/${word}.png`
      resolved++
    }
  } catch (err) {
    errors++
    console.log(`Erreur pour "${word}": ${err.message}`)
  }
  if ((i + 1) % 50 === 0) {
    console.log(`${i + 1}/${noms.length} traités (${resolved} trouvés, ${notFound} absents, ${errors} erreurs)`)
    writeFileSync(outputPath, JSON.stringify(existing, null, 2) + '\n')
  }
  await sleep(150) // rythme prudent, pas de garantie de débit côté ARASAAC
}

writeFileSync(outputPath, JSON.stringify(existing, null, 2) + '\n')
console.log(`\nTerminé : ${resolved} pictogramme(s) résolu(s), ${notFound} absent(s), ${errors} erreur(s).`)
console.log('Écrit: public/pictos-mots/*.png, src/data/word-pictos.json')
