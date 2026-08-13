import { useEffect, useMemo, useState } from 'react'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { PhonemeInfoModal } from '../../components/PhonemeInfoModal'
import { assetUrl } from '../../lib/assetUrl'
import { speak, speechSupported } from '../../lib/speech'
import { lireHistorique, type EntreeHistorique } from '../../lib/historique'
import { genererDistracteurs } from '../../lib/quizErreurs'
import { loadWordIndex } from '../../lib/wordIndex'
import { LEMMA_IDS_DETERMINANTS, LEMMA_IDS_HOMOGRAPHES_FANTOMES } from '../clavier/clavierLogic'
import { phonemes } from '../../lib/phonemes'
import wordPictos from '../../data/word-pictos.json'
import type { PhonemeId, WordCategory, WordEntry } from '../../types/phonetics'

// Mêmes libellés/mascottes que la fiche mot (MotTool.tsx) - petite
// duplication assumée, comme ailleurs dans le projet (Historique.tsx).
const CATEGORY_LABEL: Record<WordCategory, string> = {
  nom: 'Nom',
  adjectif: 'Adjectif',
  verbe: 'Verbe',
  invariable: 'Mot invariable',
  adverbe: 'Adverbe',
}
const CATEGORY_MASCOT: Record<WordCategory, string> = {
  nom: '/mascottes/nom.png',
  adjectif: '/mascottes/adjectif.png',
  verbe: '/mascottes/verbe.png',
  invariable: '/mascottes/invariable.png',
  adverbe: '/mascottes/adverbe.png',
}

const NB_MOTS_SESSION = 8
const NB_MOTS_MIN = 3

// Rôle "de base" par catégorie (même logique que ROLE_DE_BASE dans
// wordIndex.ts) : pour piocher dans les mots les plus fréquents du lexique
// quand l'historique est trop court, on ne veut que la forme de base de
// chaque mot (pas "chevaux" séparément de "cheval").
const ROLE_DE_BASE: Record<WordCategory, WordEntry['formRole']> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

// Piochés dans les mots les plus fréquents du lexique (pas l'historique
// automatique) : utile pour tester le quiz sans avoir déjà consulté des
// fiches mots. Les mots les plus fréquents "bruts" sont presque tous des
// mots-outils (le, de, un, il, pas...) plutôt que du vocabulaire à réviser -
// on se limite aux noms/verbes/adjectifs (les adverbes/invariables les plus
// fréquents sont quasi exclusivement des mots-outils), aux mots d'au moins 3
// lettres, et on retire les mêmes listes noires que le clavier (déterminants,
// homographes mal étiquetés par le corpus).
function motsFrequentsPourQuiz(wordIndex: WordEntry[]): EntreeHistorique[] {
  return wordIndex
    .filter(
      (e) =>
        e.formRole === ROLE_DE_BASE[e.category] &&
        (e.category === 'nom' || e.category === 'verbe' || e.category === 'adjectif') &&
        e.word.length >= 3 &&
        !LEMMA_IDS_DETERMINANTS.has(e.lemmaId) &&
        !LEMMA_IDS_HOMOGRAPHES_FANTOMES.has(e.lemmaId),
    )
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, 200)
    .map((e) => ({ lemmaId: e.lemmaId, word: e.word, category: e.category, consulteLe: 0 }))
}

function melanger<T>(items: T[]): T[] {
  const copie = [...items]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

type Mode = 'qcm' | 'reconstitution'

interface Question {
  entree: EntreeHistorique
  /** Uniquement en mode QCM : mot correct + distracteurs, mélangés. */
  options?: string[]
}

function QuestionCarte({ entree }: { entree: EntreeHistorique }) {
  const picto = (wordPictos as Record<string, string>)[entree.word]
  return (
    <div className="mb-6 flex flex-col items-center">
      <div className="mb-2 flex items-end gap-2">
        <div className="flex flex-col items-center gap-1">
          <img src={assetUrl(CATEGORY_MASCOT[entree.category])} alt="" className="h-16 w-16 object-contain" />
          <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
            {CATEGORY_LABEL[entree.category]}
          </span>
        </div>
        {picto && <img src={assetUrl(picto)} alt="" className="h-16 w-16 object-contain" />}
      </div>
      {speechSupported() && (
        <button
          type="button"
          onClick={() => speak(entree.word, { category: entree.category, lemmaId: entree.lemmaId })}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-white shadow-sm hover:bg-brand-700 active:scale-95"
        >
          🔊 Écouter le mot
        </button>
      )}
    </div>
  )
}

function QuestionQCM({
  question,
  onReponse,
}: {
  question: Question
  onReponse: (correct: boolean) => void
}) {
  const [choisi, setChoisi] = useState<string | null>(null)

  useEffect(() => setChoisi(null), [question])

  return (
    <>
      <QuestionCarte entree={question.entree} />
      <p className="mb-3 text-center text-gray-500">Quelle est la bonne orthographe ?</p>
      <div className="mx-auto grid max-w-sm gap-3">
        {question.options?.map((option) => {
          const estCorrect = option === question.entree.word
          const style =
            choisi === null
              ? 'border-gray-200 hover:bg-gray-50'
              : estCorrect
                ? 'border-green-400 bg-green-50'
                : choisi === option
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 opacity-60'
          return (
            <button
              key={option}
              type="button"
              disabled={choisi !== null}
              onClick={() => {
                setChoisi(option)
                onReponse(estCorrect)
              }}
              className={`rounded-lg border-2 px-4 py-3 text-xl font-medium ${style}`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </>
  )
}

function QuestionReconstitution({
  question,
  entreeCible,
  onReponse,
}: {
  question: Question
  entreeCible: WordEntry | undefined
  onReponse: (correct: boolean) => void
}) {
  const [sequence, setSequence] = useState<PhonemeId[]>([])
  const [valide, setValide] = useState(false)
  const [infoPhonemeId, setInfoPhonemeId] = useState<PhonemeId | null>(null)
  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  useEffect(() => {
    setSequence([])
    setValide(false)
  }, [question])

  const infoPhoneme = infoPhonemeId ? phonemesById.get(infoPhonemeId) : undefined

  function valider() {
    if (!entreeCible) return
    const correct = JSON.stringify(sequence) === JSON.stringify(entreeCible.phonemes)
    setValide(true)
    onReponse(correct)
  }

  return (
    <>
      <QuestionCarte entree={question.entree} />
      <p className="mb-3 text-center text-gray-500">Recompose le mot avec les sons du clavier.</p>
      <SequenceBar
        sequence={sequence}
        phonemesById={phonemesById}
        onBackspace={() => setSequence((s) => s.slice(0, -1))}
        onClear={() => setSequence([])}
      />
      {!valide ? (
        <div className="mt-4 text-center">
          <button
            type="button"
            disabled={sequence.length === 0 || !entreeCible}
            onClick={valider}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95 disabled:opacity-40"
          >
            Valider
          </button>
        </div>
      ) : (
        <p
          className={`mt-4 text-center text-lg font-semibold ${
            JSON.stringify(sequence) === JSON.stringify(entreeCible?.phonemes) ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {JSON.stringify(sequence) === JSON.stringify(entreeCible?.phonemes)
            ? 'Bravo, c’est ça !'
            : `Pas tout à fait. La bonne orthographe : ${question.entree.word}`}
        </p>
      )}
      <div className="mt-6">
        <PhonemeKeyboard
          phonemes={phonemes}
          viableNext={null}
          onSelect={(id) => !valide && setSequence((s) => [...s, id])}
          onShowInfo={setInfoPhonemeId}
        />
      </div>
      {infoPhoneme && <PhonemeInfoModal phoneme={infoPhoneme} onClose={() => setInfoPhonemeId(null)} />}
    </>
  )
}

export function QuizTool() {
  const [historique] = useState(() => lireHistorique())
  const [wordIndex, setWordIndex] = useState<WordEntry[] | null>(null)
  const [mode, setMode] = useState<Mode>('qcm')
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [aRepondu, setARepondu] = useState(false)
  const [termine, setTermine] = useState(false)

  useEffect(() => {
    loadWordIndex().then(setWordIndex)
  }, [])

  useEffect(() => {
    if (questions) return
    // L'historique suffit tel quel ; sinon on attend le lexique complet pour
    // piocher parmi les mots fréquents (rien à faire tant qu'il n'est pas chargé).
    const source = historique.length >= NB_MOTS_MIN ? historique : wordIndex ? motsFrequentsPourQuiz(wordIndex) : null
    if (!source) return
    const choisis = melanger(source).slice(0, NB_MOTS_SESSION)
    setQuestions(
      choisis.map((entree) => ({
        entree,
        options: melanger([entree.word, ...genererDistracteurs(entree.word, 2)]),
      })),
    )
  }, [historique, wordIndex, questions])

  function handleReponse(correct: boolean) {
    if (aRepondu) return
    setARepondu(true)
    if (correct) setScore((s) => s + 1)
  }

  function motSuivant() {
    if (!questions) return
    if (index + 1 >= questions.length) {
      setTermine(true)
      return
    }
    setIndex((i) => i + 1)
    setARepondu(false)
  }

  if (!questions) {
    return (
      <ToolLayout title="Petit quiz" description="Révise les mots que tu as déjà consultés." showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Préparation du quiz…</p>
      </ToolLayout>
    )
  }

  const question = questions[index]
  const entreeCible = wordIndex?.find(
    (e) => e.lemmaId === question.entree.lemmaId && e.word === question.entree.word,
  )

  if (termine) {
    return (
      <ToolLayout title="Petit quiz" description="Révise les mots que tu as déjà consultés." showBackToKeyboard>
        <div className="py-10 text-center">
          <p className="mb-4 text-2xl font-semibold text-gray-800">
            Score : {score} / {questions.length}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            Recommencer
          </button>
        </div>
      </ToolLayout>
    )
  }

  return (
    <ToolLayout title="Petit quiz" description="Révise les mots que tu as déjà consultés." showBackToKeyboard>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Mot {index + 1} sur {questions.length}
        </span>
        <span className="text-sm font-medium text-brand-600">Score : {score}</span>
      </div>

      <div className="mb-6 flex justify-center gap-2">
        {(['qcm', 'reconstitution'] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              mode === m ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {m === 'qcm' ? 'Choix multiple' : 'Recomposer le mot'}
          </button>
        ))}
      </div>

      {mode === 'qcm' ? (
        <QuestionQCM key={index} question={question} onReponse={handleReponse} />
      ) : (
        <QuestionReconstitution key={index} question={question} entreeCible={entreeCible} onReponse={handleReponse} />
      )}

      {aRepondu && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={motSuivant}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            Mot suivant →
          </button>
        </div>
      )}
    </ToolLayout>
  )
}
