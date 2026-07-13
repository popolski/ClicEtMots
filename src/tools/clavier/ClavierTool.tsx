import { useMemo, useState } from 'react'
import { ToolLayout } from '../../components/ToolLayout'
import { PhonemeKeyboard } from '../../components/PhonemeKeyboard'
import { SequenceBar } from '../../components/SequenceBar'
import { WordResultsPanel } from '../../components/WordResultsPanel'
import { buildPhonemeTrie, getMatches, getViableNextPhonemes } from './clavierLogic'
import { sampleWords } from './__fixtures__/sampleWords'
import { phonemes } from '../../lib/phonemes'
import type { PhonemeId } from '../../types/phonetics'

export function ClavierTool() {
  const [sequence, setSequence] = useState<PhonemeId[]>([])

  const trie = useMemo(() => buildPhonemeTrie(sampleWords), [])
  const phonemesById = useMemo(() => new Map(phonemes.map((p) => [p.id, p])), [])

  const viableNext = useMemo(
    () => (sequence.length === 0 ? null : getViableNextPhonemes(trie, sequence)),
    [trie, sequence],
  )
  const matches = useMemo(
    () => (sequence.length === 0 ? [] : getMatches(trie, sequence)),
    [trie, sequence],
  )

  return (
    <ToolLayout
      title="Clavier phonétique"
      description="Clique les sons que tu entends dans le mot, et regarde l'orthographe apparaître."
    >
      <SequenceBar
        sequence={sequence}
        phonemesById={phonemesById}
        onBackspace={() => setSequence((s) => s.slice(0, -1))}
        onClear={() => setSequence([])}
      />
      <WordResultsPanel
        key={sequence.join('-')}
        words={matches}
        hasSequence={sequence.length > 0}
        level={1}
      />
      <div className="mt-6">
        <PhonemeKeyboard
          phonemes={phonemes}
          viableNext={viableNext}
          onSelect={(id) => setSequence((s) => [...s, id])}
        />
      </div>
    </ToolLayout>
  )
}
