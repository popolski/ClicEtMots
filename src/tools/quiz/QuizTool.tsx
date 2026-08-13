import { useEffect, useMemo, useState } from 'react'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { PhonemeInfoModal } from '../../components/PhonemeInfoModal'
import { assetUrl } from '../../lib/assetUrl'
import { speak, speechSupported } from '../../lib/speech'
import type { EntreeHistorique } from '../../lib/historique'
import { genererDistracteurs } from '../../lib/quizErreurs'
import { ajouterResultatQuiz, lireResultatsQuiz, type ModeQuiz } from '../../lib/quizHistorique'
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

const NB_MOTS_SESSION = 10

const MODE_LABEL: Record<ModeQuiz, string> = {
  qcm: 'Choix multiple',
  reconstitution: 'Recomposer le mot',
  grammaire: 'Catégorie grammaticale',
}

// Rôle "de base" par catégorie (même logique que ROLE_DE_BASE dans
// wordIndex.ts) : pour piocher dans les mots les plus fréquents du lexique,
// on ne veut que la forme de base de chaque mot (pas "chevaux" séparément de
// "cheval").
const ROLE_DE_BASE: Record<WordCategory, WordEntry['formRole']> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

// Piochés parmi les mots les plus fréquents du lexique - pas l'historique de
// consultation de l'élève (trop court/répétitif pour donner une vraie
// variété d'une partie à l'autre). Les mots les plus fréquents "bruts" sont
// presque tous des mots-outils (le, de, un, il, pas...) plutôt que du
// vocabulaire à réviser - on se limite aux noms/verbes/adjectifs (les
// adverbes/invariables les plus fréquents sont quasi exclusivement des
// mots-outils), aux mots d'au moins 3 lettres, et on retire les mêmes listes
// noires que le clavier (déterminants, homographes mal étiquetés par le
// corpus). Vivier large (1000 mots) pour qu'un tirage aléatoire donne une
// vraie variété d'une partie à l'autre.
const TAILLE_VIVIER = 1000

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
    .slice(0, TAILLE_VIVIER)
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

// Les 5 catégories sont toujours proposées comme réponses possibles, même si
// motsFrequentsPourQuiz ne pioche que des noms/verbes/adjectifs (voir plus
// haut - les adverbes/invariables les plus fréquents sont presque tous des
// mots-outils) : adverbe et invariable ne seront donc jamais la bonne
// réponse pour l'instant, mais restent visibles comme vrais choix parmi les
// "5 personnages".
const CATEGORIES: WordCategory[] = ['nom', 'adjectif', 'verbe', 'adverbe', 'invariable']

// Contrairement à QuestionCarte, n'affiche NI la mascotte/l'étiquette de
// catégorie NI le picto du mot : c'est justement la catégorie qu'on demande
// de deviner ici, la révéler à l'avance viderait l'exercice de son sens.
function QuestionGrammaire({
  question,
  onReponse,
}: {
  question: Question
  onReponse: (correct: boolean) => void
}) {
  const [choisi, setChoisi] = useState<WordCategory | null>(null)

  useEffect(() => setChoisi(null), [question])

  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3">
        <p className="text-3xl font-semibold text-gray-900">{question.entree.word}</p>
        {speechSupported() && (
          <button
            type="button"
            onClick={() => speak(question.entree.word, { category: question.entree.category, lemmaId: question.entree.lemmaId })}
            className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-5 py-2 text-white shadow-sm hover:bg-brand-700 active:scale-95"
          >
            🔊 Écouter le mot
          </button>
        )}
      </div>
      <p className="mb-3 text-center text-gray-500">Quelle est sa catégorie grammaticale ?</p>
      <div className="mx-auto grid max-w-md grid-cols-5 gap-2">
        {CATEGORIES.map((categorie) => {
          const estCorrect = categorie === question.entree.category
          const style =
            choisi === null
              ? 'border-gray-200 hover:bg-gray-50'
              : estCorrect
                ? 'border-green-400 bg-green-50'
                : choisi === categorie
                  ? 'border-red-400 bg-red-50'
                  : 'border-gray-200 opacity-60'
          return (
            <button
              key={categorie}
              type="button"
              disabled={choisi !== null}
              onClick={() => {
                setChoisi(categorie)
                onReponse(estCorrect)
              }}
              className={`flex flex-col items-center gap-1 rounded-lg border-2 p-2 ${style}`}
            >
              <img src={assetUrl(CATEGORY_MASCOT[categorie])} alt="" className="h-14 w-14 object-contain" />
              <span className="text-xs font-medium text-gray-600">{CATEGORY_LABEL[categorie]}</span>
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
  const [wordIndex, setWordIndex] = useState<WordEntry[] | null>(null)
  // null = pas encore choisi, écran de départ. Fixé pour toute la partie -
  // changer de mode en cours de route mélangerait une question déjà
  // comptabilisée avec une nouvelle tentative dans l'autre mode.
  const [mode, setMode] = useState<ModeQuiz | null>(null)
  const [questions, setQuestions] = useState<Question[] | null>(null)
  const [index, setIndex] = useState(0)
  const [score, setScore] = useState(0)
  const [aRepondu, setARepondu] = useState(false)
  const [termine, setTermine] = useState(false)

  useEffect(() => {
    loadWordIndex().then(setWordIndex)
  }, [])

  useEffect(() => {
    if (questions || !wordIndex || !mode) return
    const choisis: Question[] = []
    for (const entree of melanger(motsFrequentsPourQuiz(wordIndex))) {
      if (choisis.length >= NB_MOTS_SESSION) break
      if (mode !== 'qcm') {
        choisis.push({ entree })
        continue
      }
      // Un mot sans aucune confusion de son plausible donnerait un QCM à une
      // seule option (donc pas un vrai choix) - on pioche un autre mot du
      // vivier plutôt que d'inventer une fausse orthographe.
      const distracteurs = genererDistracteurs(entree.word, 2)
      if (distracteurs.length === 0) continue
      choisis.push({ entree, options: melanger([entree.word, ...distracteurs]) })
    }
    setQuestions(choisis)
  }, [wordIndex, mode, questions])

  function handleReponse(correct: boolean) {
    if (aRepondu) return
    setARepondu(true)
    if (correct) setScore((s) => s + 1)
  }

  function motSuivant() {
    if (!questions || !mode) return
    if (index + 1 >= questions.length) {
      ajouterResultatQuiz({ mode, score, total: questions.length })
      setTermine(true)
      return
    }
    setIndex((i) => i + 1)
    setARepondu(false)
  }

  if (!mode) {
    return (
      <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
        <p className="mb-4 text-center text-gray-500">Choisis comment tu veux jouer :</p>
        <div className="mx-auto flex max-w-sm flex-col gap-3">
          {(Object.keys(MODE_LABEL) as ModeQuiz[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className="rounded-lg border-2 border-gray-200 px-4 py-3 text-lg font-medium hover:bg-gray-50"
            >
              {MODE_LABEL[m]}
            </button>
          ))}
        </div>
      </ToolLayout>
    )
  }

  if (!questions) {
    return (
      <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
        <p className="py-10 text-center text-gray-400">Préparation du quiz…</p>
      </ToolLayout>
    )
  }

  const question = questions[index]
  const entreeCible = wordIndex?.find(
    (e) => e.lemmaId === question.entree.lemmaId && e.word === question.entree.word,
  )

  if (termine) {
    const resultats = lireResultatsQuiz()
    return (
      <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
        <div className="py-6 text-center">
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
        {resultats.length > 1 && (
          <div className="mx-auto max-w-sm">
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-gray-500 uppercase">Parties précédentes</h2>
            <ul className="divide-y divide-gray-100 rounded-lg border border-gray-200">
              {resultats.slice(1).map((r) => (
                <li key={r.termineLe} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span className="text-gray-500">
                    {new Date(r.termineLe).toLocaleDateString('fr-FR')} · {MODE_LABEL[r.mode]}
                  </span>
                  <span className="font-medium text-gray-800">
                    {r.score} / {r.total}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </ToolLayout>
    )
  }

  return (
    <ToolLayout title="Petit quiz" description="Révise l'orthographe des mots les plus courants." showBackToKeyboard>
      <div className="mb-6 flex items-center justify-between">
        <span className="text-sm text-gray-500">
          Mot {index + 1} sur {questions.length}
        </span>
        <span className="text-sm font-medium text-brand-600">Score : {score}</span>
      </div>

      {mode === 'qcm' ? (
        <QuestionQCM key={index} question={question} onReponse={handleReponse} />
      ) : mode === 'reconstitution' ? (
        <QuestionReconstitution key={index} question={question} entreeCible={entreeCible} onReponse={handleReponse} />
      ) : (
        <QuestionGrammaire key={index} question={question} onReponse={handleReponse} />
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
