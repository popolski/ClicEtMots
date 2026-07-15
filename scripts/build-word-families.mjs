// Génère src/data/word-families.json : pour chaque mot de notre lexique
// (src/data/words-clavier2.json), la liste des autres mots de la même famille
// dérivationnelle, d'après Démonette 2.0 (CC-BY-SA 4.0, Namer et al. 2023,
// voir third_party/demonette/lexemes.csv — colonnes lid/fid/graphie/cat :
// fid = identifiant de famille).
//
// Deux niveaux d'inclusion pour un membre de la famille :
//  - il est dans notre lexique principal (Manulex, seuil de fréquence
//    FREQ_SEUIL de build-word-index.mjs) -> cliquable, a sa propre fiche mot.
//  - il est dans Manulex mais SOUS ce seuil (ex. "maisonnette", trop rare
//    pour le lexique principal mais pas absent de Manulex) -> affiché quand
//    même, à titre indicatif, mais pas cliquable (inLexicon: false, pas de
//    fiche à ouvrir). Volontairement plus permissif ici : une suggestion de
//    famille n'a pas besoin du même seuil de fréquence qu'un mot cherchable.
// On exige au moins une présence dans Manulex pour éviter le bruit de
// Démonette brut (argot, variantes rares, noms propres) sans relecture
// manuelle séparée.
//
// Désambiguïsation des homographes (ex. "beau" existe chez nous en nom,
// adjectif ET adverbe) : on croise TOUJOURS graphie + catégorie grammaticale,
// jamais la graphie seule, pour ne pas confondre "beau" (adjectif, famille de
// "embellir"/"beauté") avec "beau" (nom, "le beau", autre famille).
//
// Filtre "même radical" : les familles Démonette regroupent aussi des mots
// liés seulement par le SENS (ex. "arc-en-ciel"/"iris", "chat"/"félin") sans
// aucune racine visible en commun — pertinent pour un linguiste, mais
// trompeur pour un enfant qui ne verra pas le rapport. On n'inclut donc un
// membre que si son mot partage une racine orthographique avec le mot de
// base (shareRadical), quelle que soit la raison du rapprochement Démonette.
//
// Prérequis : third_party/demonette/lexemes.csv (fichier "lexemes.csv" du
// dossier Démonext fourni par l'enseignante, non versionné).
//
// Lancé à la main, après build-word-index.mjs : node scripts/build-word-families.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { EXCLUDED_WORDS } from './excluded-words.mjs'

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

// Vrai si `a` et `b` partagent une racine orthographique : le plus court des
// deux (éventuellement amputé de lettres finales, pour absorber une
// terminaison simple) apparaît quelque part dans le plus long. Pas une vraie
// lemmatisation, mais suffisant pour distinguer "chatière" (contient "chat")
// de "félin" (ne contient rien de "chat") sans dépendre de la classification
// interne de Démonette (voir plus haut).
//
// La troncature autorisée dépend de la longueur du mot le plus court : sur un
// mot court (chat, 4 lettres), amputer ne serait-ce qu'une lettre donnerait
// un fragment de 3 lettres présent un peu partout par hasard. Trouvé en
// testant l'appli : "voyage" (6 lettres) amputé de 2 lettres donne "voya",
// que "prévoyant" contient par pure coïncidence alors qu'ils n'ont aucun
// lien réel — d'où une troncature qui grandit seulement sur des mots plus
// longs, où un fragment de 5-6 lettres reste suffisamment spécifique.
function shareRadical(a, b) {
  const shorter = a.length <= b.length ? a : b
  const longer = a.length <= b.length ? b : a
  if (shorter.length < 3) return false
  const maxCut = shorter.length >= 8 ? 2 : shorter.length >= 6 ? 1 : 0
  for (let cut = 0; cut <= maxCut; cut++) {
    if (longer.includes(shorter.slice(0, shorter.length - cut))) return true
  }
  return false
}

// Résout un membre de famille Démonette (mot + catégorie) vers un
// WordFamilyMember + sa fréquence (pour trier les plus courants d'abord) :
// priorité à notre lexique principal (cliquable), sinon repli sur Manulex
// seul (affiché mais pas cliquable), sinon ignoré.
function resolveMember(memberKey, originalWord) {
  const inLexiconEntry = baseEntriesByKey.get(memberKey)
  if (inLexiconEntry) {
    return {
      member: { word: inLexiconEntry.word, category: inLexiconEntry.category, lemmaId: inLexiconEntry.lemmaId, inLexicon: true },
      frequency: inLexiconEntry.frequency,
    }
  }
  const word = originalWord.toLowerCase()
  if (!manulexWords.has(word)) return null
  const category = memberKey.split('::')[1]
  // Le repli Manulex ne passe pas par build-word-index.mjs : sans cette
  // vérification, un mot de la liste noire (ex. "bête" adjectif) pourrait
  // réapparaître ici alors qu'il a été délibérément retiré du lexique.
  if (EXCLUDED_WORDS.has(word) || EXCLUDED_WORDS.has(`${word}::${category}`)) return null
  // Pas dans notre lexique principal : fréquence 0 pour le tri, ces mots
  // passent de toute façon après tous les membres du lexique principal.
  return { member: { word, category, lemmaId: memberKey, inLexicon: false }, frequency: 0 }
}

// --- Croisement : pour chaque mot de base de notre lexique, sa famille ----
// Limité à 3, les plus fréquents/parlants d'abord (même principe que les
// synonymes) plutôt que l'ordre alphabétique.
const MAX_FAMILY_SIZE = 3
const families = {}
let manulexOnlyMembers = 0
let droppedNoSharedRadical = 0
for (const [key, entry] of baseEntriesByKey) {
  const fids = fidsByKey.get(key)
  if (!fids) continue
  const baseWord = entry.word.toLowerCase()

  const membersByLemma = new Map()
  for (const fid of fids) {
    for (const { key: memberKey, word: originalWord } of membersByFid.get(fid)) {
      if (memberKey === key) continue
      if (!shareRadical(baseWord, originalWord.toLowerCase())) {
        droppedNoSharedRadical++
        continue
      }
      const resolved = resolveMember(memberKey, originalWord)
      if (!resolved || resolved.member.lemmaId === entry.lemmaId) continue
      if (!membersByLemma.has(resolved.member.lemmaId)) {
        membersByLemma.set(resolved.member.lemmaId, resolved)
        if (!resolved.member.inLexicon) manulexOnlyMembers++
      }
    }
  }
  if (membersByLemma.size === 0) continue

  families[entry.lemmaId] = [...membersByLemma.values()]
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, MAX_FAMILY_SIZE)
    .map((r) => r.member)
}

const outPath = new URL('../src/data/word-families.json', import.meta.url)
writeFileSync(outPath, JSON.stringify(families))

const lemmaCount = Object.keys(families).length
console.log(`${lemmaCount} mots de notre lexique ont au moins un "mot de la même famille" trouvé.`)
console.log(`(sur ${baseEntriesByKey.size} mots de base au total)`)
console.log(`Dont ${manulexOnlyMembers} occurrences de mots sous le seuil de fréquence (non cliquables).`)
console.log(`${droppedNoSharedRadical} rapprochements Démonette écartés car aucune racine commune (ex. "chat"/"félin").`)
console.log('Écrit: src/data/word-families.json')
