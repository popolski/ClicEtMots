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

// Noms de fichiers réservés par Windows (périphériques système) : un mot
// comme "nul" donnerait "nul.png", impossible à créer normalement sur ce
// système de fichiers - découvert en pratique (git refusait d'indexer le
// fichier, silencieusement "présent" pour `ls` mais illisible pour tout le
// reste). Simplement écarté plutôt que renommé, pour rester cohérent avec
// le principe "le nom de fichier = le mot" utilisé partout ailleurs.
const NOMS_RESERVES_WINDOWS = new Set([
  'con', 'prn', 'aux', 'nul',
  'com1', 'com2', 'com3', 'com4', 'com5', 'com6', 'com7', 'com8', 'com9',
  'lpt1', 'lpt2', 'lpt3', 'lpt4', 'lpt5', 'lpt6', 'lpt7', 'lpt8', 'lpt9',
])

// Homographes "nom" fantômes : ces mots sont bien étiquetés "nom" quelque
// part dans Lexique383 (sens rare — "son" = le bruit, "est" = le point
// cardinal...), mais leur fréquence très élevée dans le lexique vient en
// réalité de leur usage dominant comme mot-outil (déterminant possessif,
// verbe être, adverbe...), qui n'a rien à voir avec le sens nominal. ARASAAC,
// interrogé sur le mot seul, renvoie alors le pictogramme du sens dominant
// (pour "son" : la possession, pas le bruit) — trompeur pour un enfant.
// Liste manuelle, découverte au cas par cas (comme EXCLUDED_WORDS,
// scripts/excluded-words.mjs) : une détection automatique par fréquence
// partagée entre catégories s'est avérée bien trop large (elle exclurait
// aussi "grand"/"petit", légitimement nom ET adjectif tous les deux
// fréquents).
const HOMOGRAPHES_FANTOMES = new Set([
  'est', 'une', 'pas', 'pour', 'sur', 'son', 'plus', 'par',
  'dit', 'bien', 'ses', 'fait', 'moi', 'tout',
])

const noms = lexique
  .filter((e) => e.category === 'nom' && e.formRole === 'singulier' && !HOMOGRAPHES_FANTOMES.has(e.word))
  .sort((a, b) => b.frequency - a.frequency)
  .slice(0, LIMIT)
  .filter((e) => !(e.word in existing) && !NOMS_RESERVES_WINDOWS.has(e.word.toLowerCase()))

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
