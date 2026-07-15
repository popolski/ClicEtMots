// Valide decodePhon() sur ~20 mots de contrôle choisis à la main (voir le plan).
import { readFileSync } from 'node:fs'
import { decodePhon } from './lexiquePhonemeMap.ts'

const tsvPath = new URL('../third_party/lexique383/Lexique383.tsv', import.meta.url)
const text = readFileSync(tsvPath, 'utf8')
const lines = text.split(/\r\n|\n/).filter(Boolean)
const header = lines[0].split('\t')
const orthoIdx = header.indexOf('ortho')
const phonIdx = header.indexOf('phon')

const byWord = new Map()
for (let i = 1; i < lines.length; i++) {
  const cols = lines[i].split('\t')
  const ortho = cols[orthoIdx]
  if (!byWord.has(ortho)) byWord.set(ortho, cols[phonIdx])
}

// mot -> séquence de touches attendue (ce qu'un enfant/enseignant cliquerait)
const controlWords = {
  chat: ['ch', 'a'],
  eau: ['o'],
  bateau: ['b', 'a', 't', 'o'],
  maison: ['m', 'e', 'z', 'on'],
  oiseau: ['oi', 'z', 'o'],
  fille: ['f', 'ill'],
  pain: ['p', 'in'],
  oignon: ['o', 'gn', 'on'],
  taxi: ['t', 'a', 'x', 'i'],
  moi: ['m', 'oi'],
  coin: ['c', 'oin'],
  huit: ['ui', 't'],
  lui: ['l', 'ui'],
  nuage: ['n', 'u', 'a', 'j'],
  chien: ['ch', 'i', 'in'],
  avion: ['a', 'v', 'i', 'on'],
  piano: ['p', 'i', 'a', 'n', 'o'],
  illusion: ['i', 'l', 'u', 'z', 'i', 'on'],
  brillant: ['b', 'r', 'ill', 'an'],
  gâteau: ['g', 'a', 't', 'o'],
  souris: ['s', 'ou', 'r', 'i'],
  vélo: ['v', 'e', 'l', 'o'],
  fleur: ['f', 'l', 'eu', 'r'],
  montagne: ['m', 'on', 't', 'a', 'gn'],
}

let pass = 0
let fail = 0
for (const [word, expected] of Object.entries(controlWords)) {
  const phon = byWord.get(word)
  if (!phon) {
    console.log(`❌ ${word}: absent de Lexique383`)
    fail++
    continue
  }
  let decoded
  try {
    decoded = decodePhon(phon)
  } catch (e) {
    console.log(`❌ ${word} (phon="${phon}"): ${e.message}`)
    fail++
    continue
  }
  const match = JSON.stringify(decoded) === JSON.stringify(expected)
  console.log(
    `${match ? '✅' : '❌'} ${word} (phon="${phon}") -> [${decoded.join(',')}]` +
      (match ? '' : ` (attendu [${expected.join(',')}])`),
  )
  if (match) pass++
  else fail++
}

console.log(`\n${pass}/${pass + fail} mots de contrôle corrects`)
