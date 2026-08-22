import { useEffect, useMemo, useRef, useState } from 'react'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { decomposerMot } from '../../lib/alignementGraphemes'
import { phonemes } from '../../lib/phonemes'
import { speak, speechSupported } from '../../lib/speech'
import type { MotCandidat } from './quizLogic'
import type { PhonemeId, WordEntry } from '../../types/phonetics'

interface QuestionDicteeProps {
  entree: MotCandidat
  /** Entrée complète du lexique, pour la suite de sons du mot (aide + décomposition). */
  entreeCible: WordEntry | undefined
  /** Filet de secours autorisé par l'enseignante pour CET élève (voir schema-v8.sql). */
  aideAutorisee: boolean
  onReponse: (correct: boolean) => void
}

/**
 * Dictée : le mot est prononcé, jamais montré, et l'élève l'écrit au clavier
 * normal - c'est bien l'orthographe qu'on vérifie, contrairement au mode
 * "recomposer" qui travaille les sons. Réécoutable autant de fois que voulu :
 * l'exercice porte sur l'écriture, pas sur la mémoire auditive.
 *
 * Après validation, la correction montre la décomposition son par son du mot
 * attendu (même rendu que la fiche mot), pour que l'élève voie POURQUOI ça
 * s'écrit comme ça et pas seulement que c'était faux.
 */
export function QuestionDictee({ entree, entreeCible, aideAutorisee, onReponse }: QuestionDicteeProps) {
  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [valide, setValide] = useState<boolean | null>(null)
  const [aideOuverte, setAideOuverte] = useState(false)
  const [sequence, setSequence] = useState<PhonemeId[]>([])
  const champRef = useRef<HTMLInputElement>(null)
  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  useEffect(() => {
    setSaisie('')
    setErreur(null)
    setValide(null)
    setAideOuverte(false)
    setSequence([])
    champRef.current?.focus()
  }, [entree])

  // Le mot est prononcé automatiquement à l'arrivée : sans ça, l'élève doit
  // penser à cliquer avant de pouvoir commencer.
  useEffect(() => {
    if (speechSupported()) speak(entree.word, { category: entree.category, lemmaId: entree.lemmaId })
  }, [entree])

  const decomposition = useMemo(
    () => (entreeCible ? decomposerMot(entree.word, entreeCible.phonemes, phonemes) : null),
    [entree.word, entreeCible],
  )

  function valider() {
    const propose = saisie.trim().toLowerCase()
    if (!propose) {
      setErreur("Écris le mot avant de valider")
      return
    }
    setErreur(null)
    const correct = propose === entree.word.toLowerCase()
    setValide(correct)
    onReponse(correct)
  }

  if (valide !== null) {
    return (
      <div className="text-center">
        <p className={`mb-1 text-xl font-semibold ${valide ? 'text-green-600' : 'text-red-600'}`}>
          {valide ? "Bravo, c'est ça !" : 'Pas tout à fait.'}
        </p>
        {!valide && (
          <p className="mb-4 text-gray-500">
            Tu as écrit <span className="font-medium text-gray-700">{saisie.trim()}</span>, on écrit{' '}
            <span className="font-medium text-gray-900">{entree.word}</span>
          </p>
        )}

        {decomposition && (
          <div className="mx-auto mb-4 flex max-w-lg flex-wrap items-start justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
            {decomposition.segments.map((segment, i) => (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-400">
                  [{phonemesById.get(segment.phonemeId)?.displaySymbol ?? segment.phonemeId}]
                </span>
                <span className="rounded-lg bg-brand-100 px-3 py-1 text-2xl font-semibold text-brand-700">
                  {segment.grapheme}
                </span>
              </div>
            ))}
            {decomposition.muettes && (
              <div className="flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-400">muet</span>
                <span className="px-3 py-1 text-2xl font-semibold text-gray-300">{decomposition.muettes}</span>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="text-center">
      {speechSupported() && (
        <button
          type="button"
          onClick={() => speak(entree.word, { category: entree.category, lemmaId: entree.lemmaId })}
          className="mb-6 inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg text-white shadow-sm hover:bg-brand-700 active:scale-95"
        >
          🔊 Écouter le mot
        </button>
      )}

      <div>
        <input
          ref={champRef}
          type="text"
          value={saisie}
          onChange={(e) => {
            setSaisie(e.target.value)
            if (erreur) setErreur(null)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
          }}
          placeholder="Écris le mot"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className="w-64 rounded-lg border-2 border-gray-200 px-4 py-3 text-center text-2xl focus:border-brand-400 focus:outline-none"
        />
        <p className="mt-2 min-h-5 text-sm text-red-600">{erreur}</p>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={valider}
          className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
        >
          Valider
        </button>
        {aideAutorisee && !aideOuverte && (
          <button
            type="button"
            onClick={() => setAideOuverte(true)}
            className="text-sm text-gray-500 hover:text-brand-600"
          >
            Je ne sais pas l'écrire
          </button>
        )}
      </div>

      {/* Filet de secours : le clavier phonétique aide à retrouver
          l'orthographe, mais ne remplit PAS le champ - l'élève doit toujours
          écrire le mot lui-même, sinon la dictée ne vérifie plus rien. */}
      {aideOuverte && (
        <div className="mt-6">
          <p className="mb-2 text-sm text-gray-500">Clique les sons que tu entends, puis écris le mot toi-même.</p>
          <SequenceBar
            sequence={sequence}
            phonemesById={phonemesById}
            onBackspace={() => setSequence((s) => s.slice(0, -1))}
            onClear={() => setSequence([])}
          />
          <div className="mt-4">
            <PhonemeKeyboard
              phonemes={phonemes}
              viableNext={null}
              onSelect={(id) => setSequence((s) => [...s, id])}
              onShowInfo={() => {}}
            />
          </div>
        </div>
      )}
    </div>
  )
}
