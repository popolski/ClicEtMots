// Télécharge un pictogramme ARASAAC pour la graphie principale de chaque
// touche du clavier, et met à jour src/data/phonemes.json pour pointer vers
// l'image locale (public/pictos/{phonemeId}.png) au lieu de l'emoji actuel.
//
// ARASAAC (arasaac.org) : pictogrammes conçus pour la CAA (communication
// alternative et améliorée), auteur Sergio Palao, propriété du
// Gouvernement d'Aragon, licence CC BY-NC-SA — voir CREDITS.md. Usage
// hors-ligne uniquement : on résout et télécharge les images UNE FOIS au
// build, l'application ne fait jamais d'appel à l'API ARASAAC en direct
// depuis le navigateur d'un élève.
//
// Sélection du pictogramme : parmi les résultats de recherche, on préfère
// le premier taggé aac:true (pictogramme spécifiquement conçu/validé pour
// des tableaux de communication, donc plus lisible pour un enfant), sinon
// le premier résultat tout court.
//
// Lancé à la main (fait des appels réseau vers arasaac.org) :
//   node scripts/build-pictos.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const phonemesPath = new URL('../src/data/phonemes.json', import.meta.url)
const phonemes = JSON.parse(readFileSync(phonemesPath, 'utf8'))

const pictosDir = new URL('../public/pictos/', import.meta.url)
mkdirSync(pictosDir, { recursive: true })

async function searchPictogramId(word) {
  const url = `https://api.arasaac.org/api/pictograms/fr/search/${encodeURIComponent(word)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Recherche ARASAAC échouée pour "${word}" : HTTP ${res.status}`)
  const results = await res.json()
  if (!Array.isArray(results) || results.length === 0) return null
  return (results.find((r) => r.aac) ?? results[0])._id
}

async function downloadPictogram(id, destPath) {
  const url = `https://static.arasaac.org/pictograms/${id}/${id}_500.png`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Téléchargement ARASAAC échoué pour l'id ${id} : HTTP ${res.status}`)
  const buffer = Buffer.from(await res.arrayBuffer())
  writeFileSync(destPath, buffer)
}

let resolved = 0
let failed = 0
for (const phoneme of phonemes) {
  const primary = phoneme.graphemes[0]
  if (!primary?.exampleWord) continue
  try {
    const id = await searchPictogramId(primary.exampleWord)
    if (!id) {
      console.log(`❌ ${phoneme.id} ("${primary.exampleWord}") : aucun pictogramme trouvé`)
      failed++
      continue
    }
    const destPath = new URL(`${phoneme.id}.png`, pictosDir)
    await downloadPictogram(id, destPath)
    primary.exampleImage = `/pictos/${phoneme.id}.png`
    console.log(`✅ ${phoneme.id} ("${primary.exampleWord}") -> pictogramme ${id}`)
    resolved++
  } catch (err) {
    console.log(`❌ ${phoneme.id} ("${primary.exampleWord}") : ${err.message}`)
    failed++
  }
}

writeFileSync(phonemesPath, JSON.stringify(phonemes, null, 2) + '\n')

console.log(`\n${resolved} pictogrammes résolus, ${failed} échecs.`)
console.log('Écrit: public/pictos/*.png, src/data/phonemes.json')
