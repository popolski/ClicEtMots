import type { Phoneme, PhonemeId } from '../types/phonetics'
import { PhonemeTile } from './PhonemeTile'

interface PhonemeKeyboardProps {
  phonemes: Phoneme[]
  /** null = no constraint yet (empty sequence, every tile is a valid start). */
  viableNext: Set<PhonemeId> | null
  onSelect: (id: PhonemeId) => void
  onShowInfo: (id: PhonemeId) => void
}

export function PhonemeKeyboard({ phonemes, viableNext, onSelect, onShowInfo }: PhonemeKeyboardProps) {
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-7">
      {phonemes.map((phoneme) => (
        <PhonemeTile
          key={phoneme.id}
          phoneme={phoneme}
          disabled={viableNext !== null && !viableNext.has(phoneme.id)}
          onSelect={onSelect}
          onShowInfo={onShowInfo}
        />
      ))}
    </div>
  )
}
