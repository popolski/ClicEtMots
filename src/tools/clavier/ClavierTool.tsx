import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { PhonemeInfoModal } from '../../components/PhonemeInfoModal'
import { SequenceBar } from '../../components/SequenceBar'
import { WordResultsPanel } from '../../components/WordResultsPanel'
import { buildPhonemeTrie, getMatches, getViableNextPhonemes, groupIntoCards } from './clavierLogic'
import type { PhonemeTrieNode } from './clavierLogic'
import { loadWordIndex } from '../../lib/wordIndex'
import { phonemes } from '../../lib/phonemes'
import type { PhonemeId } from '../../types/phonetics'

export function ClavierTool() {
  // La séquence vit dans l'URL (?seq=ch,ou,e,t), pas dans un simple useState :
  // en cliquant un résultat on quitte cette page (fiche mot), ce qui démonte
  // le composant. Sans ça, le bouton "Retour" (navigate(-1)) revenait sur un
  // clavier vidé au lieu de retrouver la recherche en cours.
  const [searchParams, setSearchParams] = useSearchParams()
  const sequence = useMemo(() => {
    const raw = searchParams.get('seq')
    return raw ? (raw.split(',') as PhonemeId[]) : []
  }, [searchParams])
  const [infoPhonemeId, setInfoPhonemeId] = useState<PhonemeId | null>(null)
  const [trie, setTrie] = useState<PhonemeTrieNode | null>(null)
  // Les résultats restent cachés tant qu'on ne les demande pas explicitement
  // (comme le bouton "résultats" du vrai Clavier Métalo) — avec 32 000 mots,
  // tout afficher dès le premier son cliqué est illisible. Se recache dès
  // qu'on ajoute/retire un son, pour ne montrer les résultats que quand la
  // séquence est vraiment celle qu'on veut consulter.
  const [resultsRevealed, setResultsRevealed] = useState(false)

  useEffect(() => {
    let cancelled = false
    loadWordIndex().then((words) => {
      if (!cancelled) setTrie(buildPhonemeTrie(words))
    })
    return () => {
      cancelled = true
    }
  }, [])

  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  const viableNext = useMemo(
    () => (!trie || sequence.length === 0 ? null : getViableNextPhonemes(trie, sequence)),
    [trie, sequence],
  )
  const cards = useMemo(
    () => (!trie || sequence.length === 0 ? [] : groupIntoCards(getMatches(trie, sequence))),
    [trie, sequence],
  )

  const infoPhoneme = infoPhonemeId ? phonemesById.get(infoPhonemeId) : undefined

  function updateSequence(updater: (s: PhonemeId[]) => PhonemeId[]) {
    const next = updater(sequence)
    // replace (pas push) : chaque son cliqué ne doit pas créer une entrée
    // d'historique séparée, sinon "Précédent" du navigateur n'irait retirer
    // qu'un seul phonème à la fois au lieu de sortir du clavier.
    setSearchParams(next.length > 0 ? { seq: next.join(',') } : {}, { replace: true })
    setResultsRevealed(false)
  }

  return (
    <ToolLayout
      title="Clavier phonétique"
      description="Clique les sons que tu entends dans le mot, et regarde l'orthographe apparaître."
      hideBackButton
    >
      {!trie ? (
        <p className="py-10 text-center text-gray-400">Chargement du lexique…</p>
      ) : (
        <>
          <SequenceBar
            sequence={sequence}
            phonemesById={phonemesById}
            onBackspace={() => updateSequence((s) => s.slice(0, -1))}
            onClear={() => updateSequence(() => [])}
          />

          {sequence.length > 0 && !resultsRevealed && (
            <div className="mt-4 text-center">
              {cards.length > 0 ? (
                <button
                  type="button"
                  onClick={() => setResultsRevealed(true)}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-600 px-6 py-3 text-lg font-medium text-white shadow-sm hover:bg-brand-700 active:scale-95"
                >
                  🔍 Voir les mots
                </button>
              ) : (
                <p className="text-gray-400">Aucun mot trouvé.</p>
              )}
            </div>
          )}

          {sequence.length > 0 && resultsRevealed && (
            <WordResultsPanel key={sequence.join('-')} cards={cards} hasSequence level={2} />
          )}

          <div className="mt-6">
            <PhonemeKeyboard
              phonemes={phonemes}
              viableNext={viableNext}
              onSelect={(id) => updateSequence((s) => [...s, id])}
              onShowInfo={setInfoPhonemeId}
            />
          </div>
        </>
      )}
      {infoPhoneme && <PhonemeInfoModal phoneme={infoPhoneme} onClose={() => setInfoPhonemeId(null)} />}
    </ToolLayout>
  )
}
