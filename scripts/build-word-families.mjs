// Génère src/data/word-families.json : pour chaque mot de notre lexique
// (src/data/words-clavier2.json), la liste des autres mots de la même famille
// dérivationnelle, d'après Démonette 2.0 (CC-BY-SA 4.0, Namer et al. 2023,
// voir third_party/demonette/lexemes.csv — colonnes lid/fid/graphie/cat :
// fid = identifiant de famille).
//
// Deux niveaux d'inclusion pour un membre de la famille :
//  - il est dans notre lexique principal (Manulex + EQOL) -> cliquable, a sa
//    propre fiche mot.
//  - il est SEULEMENT dans Manulex (scolaire) mais pas dans EQOL, donc absent
//    du lexique principal (ex. "maisonnette") -> affiché quand même, à titre
//    indicatif, mais pas cliquable (inLexicon: false, pas de fiche à ouvrir).
// On exige au moins Manulex pour éviter le bruit de Démonette brut (argot,
// variantes rares, noms propres) sans relecture manuelle séparée.
//
// Désambiguïsation des homographes (ex. "beau" existe chez nous en nom,
// adjectif ET adverbe) : on croise TOUJOURS graphie + catégorie grammaticale,
// jamais la graphie seule, pour ne pas confondre "beau" (adjectif, famille de
// "embellir"/"beauté") avec "beau" (nom, "le beau", autre famille).
//
// Prérequis : third_party/demonette/lexemes.csv (fichier "lexemes.csv" du
// dossier Démonext fourni par l'enseignante, non versionné).
//
// Lancé à la main, après build-word-index.mjs : node scripts/build-word-families.mjs
import { readFileSync, writeFileSync } from 'node:fs'

const wordIndexPath = new URL('../src/data/words-clavier2.json', import.meta.url)
const wordIndex = JSON.parse(readFileSync(wordIndexPath, 'utf8'))

const manulexPath = new URL('../third_party/manulex/manulex-forms.csv', import.meta.url)
const manulexLines = readFileSync(manulexPath, 'utf8').split(/\r\n|\n/).filter(Boolean)
const manulexWords = new Set()
for (let i = 1; i < manulexLines.length; i++) {
  const word = manulexLines[i].split(',')[0]
  if (word) manulexWords.add(word)
}

// Rôle "de base" par catégorie : la forme qu'on affiche dans les résultats
// et qui sert de clé de recherche dans Démonette (les autres formes -
// pluriel, féminin, participe passé - restent dans la fiche mot, pas ici).
const BASE_ROLE = { nom: 'singulier', adjectif: 'masculin', verbe: 'infinitif', adverbe: 'simple', invariable: 'simple' }

// Démonette "cat" (Nm, Nf, Npx, Adj, V, Adv, Prep...) -> notre WordCategory.
function ourCategoryFor(demonetteCat) {
  if (demonetteCat.startsWith('N')) return 'nom'
  if (demonetteCat === 'Adj') return 'adjectif'
  if (demonetteCat === 'V') return 'verbe'
  if (demonetteCat === 'Adv') return 'adverbe'
  return null
}

// `${mot}::${catégorie}` -> l'entrée de base correspondante dans notre lexique
const baseEntriesByKey = new Map()
for (const e of wordIndex) {
  if (e.formRole !== BASE_ROLE[e.category]) continue
  baseEntriesByKey.set(`${e.word.toLowerCase()}::${e.category}`, e)
}

// --- Lecture de Démonette --------------------------------------------------
const lexemesPath = new URL('../third_party/demonette/lexemes.csv', import.meta.url)
const lines = readFileSync(lexemesPath, 'utf8').split(/\r\n|\n/).filter(Boolean)
const header = lines[0].split('\t')
const fidIdx = header.indexOf('fid')
const graphieIdx = header.indexOf('graphie')
const catIdx = header.indexOf('cat')

// fid -> liste de { key: "mot::catégorie", word: graphie d'origine } (uniquement
// les catégories qu'on sait relier aux nôtres ; on ignore prépositions/
// pronoms/etc. qui n'ont pas de "forme de base")
const membersByFid = new Map()
// `${mot}::${catégorie}` -> ensemble de fid auxquels ce couple appartient
const fidsByKey = new Map()

for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const fid = cols[fidIdx]
  const graphie = cols[graphieIdx]
  const cat = ourCategoryFor(cols[catIdx] ?? '')
  if (!fid || !graphie || !cat) continue
  const key = `${graphie.toLowerCase()}::${cat}`

  let members = membersByFid.get(fid)
  if (!members) {
    members = []
    membersByFid.set(fid, members)
  }
  members.push({ key, word: graphie })

  let fidSet = fidsByKey.get(key)
  if (!fidSet) {
    fidSet = new Set()
    fidsByKey.set(key, fidSet)
  }
  fidSet.add(fid)
}

// Résout un membre de famille Démonette (mot + catégorie) vers un
// WordFamilyMember : priorité à notre lexique principal (cliquable), sinon
// repli sur Manulex seul (affiché mais pas cliquable), sinon ignoré.
function resolveMember(memberKey, originalWord) {
  const inLexiconEntry = baseEntriesByKey.get(memberKey)
  if (inLexiconEntry) {
    return { word: inLexiconEntry.word, category: inLexiconEntry.category, lemmaId: inLexiconEntry.lemmaId, inLexicon: true }
  }
  const word = originalWord.toLowerCase()
  if (!manulexWords.has(word)) return null
  const category = memberKey.split('::')[1]
  return { word, category, lemmaId: memberKey, inLexicon: false }
}

// --- Croisement : pour chaque mot de base de notre lexique, sa famille ----
const MAX_FAMILY_SIZE = 12
const families = {}
let manulexOnlyMembers = 0
for (const [key, entry] of baseEntriesByKey) {
  const fids = fidsByKey.get(key)
  if (!fids) continue

  const membersByLemma = new Map()
  for (const fid of fids) {
    for (const { key: memberKey, word: originalWord } of membersByFid.get(fid)) {
      if (memberKey === key) continue
      const member = resolveMember(memberKey, originalWord)
      if (!member || member.lemmaId === entry.lemmaId) continue
      if (!membersByLemma.has(member.lemmaId)) {
        membersByLemma.set(member.lemmaId, member)
        if (!member.inLexicon) manulexOnlyMembers++
      }
    }
  }
  if (membersByLemma.size === 0) continue

  families[entry.lemmaId] = [...membersByLemma.values()]
    .sort((a, b) => a.word.localeCompare(b.word, 'fr'))
    .slice(0, MAX_FAMILY_SIZE)
}

const outPath = new URL('../src/data/word-families.json', import.meta.url)
writeFileSync(outPath, JSON.stringify(families))

const lemmaCount = Object.keys(families).length
console.log(`${lemmaCount} mots de notre lexique ont au moins un "mot de la même famille" trouvé.`)
console.log(`(sur ${baseEntriesByKey.size} mots de base au total)`)
console.log(`Dont ${manulexOnlyMembers} occurrences de mots "Manulex seul" (pas dans EQOL, non cliquables).`)
console.log('Écrit: src/data/word-families.json')
