// Génère un fichier mp3 par mot du lexique via Google Cloud Text-to-Speech
// (voix fr-FR-Neural2-A), pour remplacer window.speechSynthesis en
// production : contrairement à Neural2, la synthèse navigateur (et Azure
// Neural testé en comparaison) avale les schwas de mots comme "chevauchée"
// ("ch'vauchée"), "chemisier" ("ch'misier") — problème absent sur Neural2-A.
//
// Nom de fichier : {mot}_{categorie}_{lemme}.mp3 — désambigüise les
// homographes qui se prononcent différemment selon leur rôle grammatical
// (couvent_nom_couvent.mp3 vs couvent_verbe_couver.mp3, est_nom_est.mp3 vs
// est_verbe_etre.mp3), en reprenant categorie+lemme déjà présents dans
// lemmaId ("categorie:lemme") du lexique généré par build-word-index.mjs.
//
// Prérequis :
//   - variable d'environnement GOOGLE_APPLICATION_CREDENTIALS pointant vers
//     un fichier de clé de compte de service Google Cloud (JSON), avec l'API
//     Cloud Text-to-Speech activée sur le projet.
//   - npm install (dépendance @google-cloud/text-to-speech déjà ajoutée)
//
// Usage :
//   node scripts/generate-word-audio.mjs                 génère les mots manquants
//   node scripts/generate-word-audio.mjs --limit=200      limite à N mots (test)
//   node scripts/generate-word-audio.mjs --mot=chevauchée regénère un seul mot (tous ses homographes)
//   node scripts/generate-word-audio.mjs --force          régénère même si le fichier existe déjà
//   node scripts/generate-word-audio.mjs --dry-run        compte les caractères sans appeler l'API
//
// Sortie :
//   public/audio/mots/*.mp3
//   scripts/output/tts-errors.log   (mot, clé de fichier, message d'erreur — un par ligne)
import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import textToSpeech from '@google-cloud/text-to-speech'

const AUDIO_DIR = join(import.meta.dirname, '..', 'public', 'audio', 'mots')
const ERROR_LOG = join(import.meta.dirname, 'output', 'tts-errors.log')
const BATCH_SIZE = 10
const BATCH_DELAY_MS = 3000

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=')
    return [k, v ?? true]
  }),
)

// Certains mots ont une orthographe qui laisse le moteur TTS hésiter entre
// deux prononciations, et il choisit parfois la mauvaise sans qu'on puisse
// lever l'ambiguïté autrement. Deux cas rencontrés :
// - emprunt à l'anglais lu "à la française" : "jean" (le pantalon, /dʒin/)
//   lu comme le prénom "Jean" (/ʒɑ̃/).
// - homographe avec un mot d'une autre catégorie qui se prononce
//   différemment : "vis" (la vis, /vis/) lu comme la forme verbale "vis"
//   (je vis/tu vis, /vi/, sans le s).
// Corrigé en donnant au moteur un texte respectant la prononciation voulue
// plutôt que l'orthographe réelle (jamais affiché, uniquement envoyé à
// l'API de synthèse) - découvert au cas par cas à l'usage.
const TEXTE_PRONONCIATION = {
  'nom:jean': 'djinne',
  'nom:vis': 'visse',
}

function texteAPrononcer(entry) {
  return TEXTE_PRONONCIATION[entry.lemmaId] ?? entry.word
}

function audioFileName(entry) {
  const lemme = entry.lemmaId.split(':')[1] ?? entry.lemmaId
  return `${entry.word}_${entry.category}_${lemme}.mp3`
}

function loadEntries() {
  const data = JSON.parse(readFileSync(join(import.meta.dirname, '..', 'src', 'data', 'words-clavier2.json'), 'utf8'))
  let entries = data
  if (args.mot) {
    entries = entries.filter((e) => e.word === args.mot)
    if (entries.length === 0) {
      console.error(`Aucune entrée trouvée pour « ${args.mot} ».`)
      process.exit(1)
    }
  }
  if (!args.force) {
    entries = entries.filter((e) => !existsSync(join(AUDIO_DIR, audioFileName(e))))
  }
  if (args.limit) {
    entries = entries.slice(0, Number(args.limit))
  }
  return entries
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// Le quota "requêtes par minute" du projet peut être dépassé même avec un
// BATCH_SIZE/délai prudents (quota par défaut assez bas sur un projet neuf) —
// une nouvelle tentative après une pause plus longue suffit en général.
async function synthesize(client, entry, attempt = 1) {
  const fileName = audioFileName(entry)
  try {
    const [response] = await client.synthesizeSpeech({
      input: { text: texteAPrononcer(entry) },
      voice: { languageCode: 'fr-FR', name: 'fr-FR-Neural2-A' },
      audioConfig: { audioEncoding: 'MP3' },
    })
    writeFileSync(join(AUDIO_DIR, fileName), response.audioContent, 'binary')
  } catch (err) {
    if (err.message.includes('RESOURCE_EXHAUSTED') && attempt < 4) {
      await sleep(attempt * 5000)
      return synthesize(client, entry, attempt + 1)
    }
    throw err
  }
}

async function main() {
  mkdirSync(AUDIO_DIR, { recursive: true })
  mkdirSync(join(import.meta.dirname, 'output'), { recursive: true })

  const entries = loadEntries()
  const totalChars = entries.reduce((sum, e) => sum + e.word.length, 0)
  console.log(`${entries.length} mot(s) à générer, ${totalChars} caractères au total.`)

  if (args['dry-run']) {
    return
  }
  if (entries.length === 0) {
    console.log('Rien à faire.')
    return
  }

  const client = new textToSpeech.TextToSpeechClient()
  let done = 0
  let errors = 0

  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE)
    await Promise.all(
      batch.map(async (entry) => {
        try {
          await synthesize(client, entry)
          done++
        } catch (err) {
          errors++
          appendFileSync(ERROR_LOG, `${entry.word}\t${audioFileName(entry)}\t${err.message}\n`)
        }
      }),
    )
    console.log(`${Math.min(i + BATCH_SIZE, entries.length)}/${entries.length} traités (${errors} erreur(s))`)
    if (i + BATCH_SIZE < entries.length) {
      await sleep(BATCH_DELAY_MS)
    }
  }

  console.log(`Terminé : ${done} fichier(s) généré(s), ${errors} erreur(s).`)
  if (errors > 0) {
    console.log(`Détail des erreurs : ${ERROR_LOG}`)
  }
}

main()
