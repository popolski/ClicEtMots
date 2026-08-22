// Télécharge un pictogramme ARASAAC pour les mots les plus fréquents du
// lexique (noms, verbes à l'infinitif, adjectifs au masculin), pour illustrer
// la fiche mot (voir MotTool.tsx) en complément de la mascotte générique de
// catégorie.
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
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs'

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

// Homographes fantômes : ces mots sont bien étiquetés nom/adjectif quelque
// part dans Lexique383 (sens rare, voire carrément une erreur du corpus -
// "tu"/"il"/"animaux"/"ici" y sont littéralement tagués ADJ), mais leur
// fréquence très élevée dans le lexique vient en réalité de leur usage
// dominant comme mot-outil (déterminant possessif, pronom, verbe être,
// adverbe...), qui n'a rien à voir avec le sens nom/adjectif retenu.
// ARASAAC, interrogé sur le mot seul, renvoie alors le pictogramme du sens
// dominant (pour "son" : la possession, pas le bruit) - trompeur pour un
// enfant. Liste manuelle, découverte au cas par cas (comme EXCLUDED_WORDS,
// scripts/excluded-words.mjs) : une détection automatique par fréquence
// partagée entre catégories s'est avérée bien trop large (elle exclurait
// aussi "grand"/"petit", légitimement nom ET adjectif tous les deux
// fréquents).
const HOMOGRAPHES_FANTOMES = new Set([
  // Détectés côté noms.
  'est', 'une', 'pas', 'pour', 'sur', 'son', 'plus', 'par',
  'dit', 'bien', 'ses', 'fait', 'moi', 'tout',
  // Détectés côté adjectifs : déterminants (possessifs/démonstratifs, même
  // liste que LEMMA_IDS_DETERMINANTS dans clavierLogic.ts) et mots-outils
  // divers mal étiquetés adjectif dans Lexique383.
  'mon', 'ma', 'mes', 'ton', 'ta', 'tes', 'sa', 'notre', 'nos', 'votre', 'vos',
  'leur', 'leurs', 'ce', 'cet', 'cette', 'ces',
  'il', 'tu', 'quel', 'non', 'quoi', 'pendant', 'avant', 'vite', 'ici',
  'vu', 'feu', 'animaux', 'un', 'fin', 'souris', 'mis', 'personne', 'quelque',
  // Prénoms tagués adjectif par erreur (sans lien avec le nom de famille
  // Lexique383, juste une erreur d'annotation du corpus) - découverts au fil
  // de l'usage, pas via le tri par fréquence (ceux-ci sont rares). Ne pas en
  // déduire une règle générale "prénom = à exclure" : "pascal" est un vrai
  // adjectif ("l'agneau pascal", relatif à Pâques), gardé volontairement.
  'walter', 'julien',
  // "jean" (le pantalon) : ARASAAC renvoie le picto de la Saint-Jean (feu de
  // joie, saint auréolé) au lieu du vêtement - sens religieux/culturel très
  // dominant sur ARASAAC, sans lien avec le mot recherché par un enfant.
  'jean',
  // "tas" (le tas de sable, etc.) : ARASAAC renvoie une tasse à boire -
  // confusion avec "tasse" côté recherche ARASAAC elle-même, pas un problème
  // d'étiquette Lexique383 cette fois, mais même symptôme (image trompeuse).
  'tas',
  // "panne" (la voiture en panne) : ARASAAC renvoie un panneau de bois, la
  // "panne" étant aussi une pièce de charpente. Sens technique inconnu d'un
  // enfant, et l'image n'évoque rien du sens courant. Repéré par Camille
  // dans l'atelier de graphie.
  'panne',
  // "façon" et "cas" : signalés en classe comme illustrés par des images sans
  // rapport (mots abstraits, ARASAAC renvoie n'importe quoi de vaguement
  // associé). Ils avaient été retirés du JSON à la main la première fois -
  // voir la purge juste en dessous, qui existe à cause de ça.
  'façon', 'cas',
])

// Le script est incrémental : il n'ajoute que les mots absents du fichier et
// ne recalcule jamais l'existant. La liste ci-dessus empêchait donc seulement
// d'AJOUTER un mot, pas de retirer ceux déjà présents - "façon" et "cas",
// écartés à la main du JSON lors d'un signalement, sont revenus dès le
// premier relancement du script. Elle est maintenant autoritaire : on purge à
// chaque exécution, et retirer un picto trompeur consiste à ajouter le mot
// ci-dessus, rien d'autre.
for (const mot of HOMOGRAPHES_FANTOMES) {
  if (!(mot in existing)) continue
  delete existing[mot]
  const fichier = new URL(`${mot}.png`, pictosDir)
  if (existsSync(fichier)) rmSync(fichier)
  console.log(`Retiré (liste d'exclusion) : ${mot}`)
}

// Une catégorie = une forme "de base" ciblée (celle affichée sur la fiche
// mot, voir BASE_ROLE dans src/lib/wordIndex.ts) : singulier pour un nom,
// infinitif pour un verbe, masculin pour un adjectif.
const CATEGORIES_CIBLEES = [
  { categorie: 'nom', formRole: 'singulier' },
  { categorie: 'verbe', formRole: 'infinitif' },
  { categorie: 'adjectif', formRole: 'masculin' },
]

const noms = CATEGORIES_CIBLEES.flatMap(({ categorie, formRole }) =>
  lexique
    .filter((e) => e.category === categorie && e.formRole === formRole && !HOMOGRAPHES_FANTOMES.has(e.word))
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, LIMIT)
    .filter((e) => !(e.word in existing) && !NOMS_RESERVES_WINDOWS.has(e.word.toLowerCase())),
)

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

console.log(`${noms.length} mot(s) à rechercher (déjà résolus ignorés).`)

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
