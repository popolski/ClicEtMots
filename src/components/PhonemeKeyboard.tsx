import type { Phoneme, PhonemeId } from '../types/phonetics'
import { PhonemeTile } from './PhonemeTile'

interface PhonemeKeyboardProps {
  phonemes: Phoneme[]
  /** null = no constraint yet (empty sequence, every tile is a valid start). */
  viableNext: Set<PhonemeId> | null
  onSelect: (id: PhonemeId) => void
  onShowInfo: (id: PhonemeId) => void
}

// Rangées façon "vrai clavier" (9/8/8/8, comme le Clavier Métalo physique)
// plutôt qu'une grille qui laisse une poignée de touches isolées sur la
// dernière ligne.
const ROW_SIZES = [9, 8, 8, 8]

function splitIntoRows<T>(items: T[], sizes: number[]): T[][] {
  const rows: T[][] = []
  let i = 0
  for (const size of sizes) {
    if (i >= items.length) break
    rows.push(items.slice(i, i + size))
    i += size
  }
  if (i < items.length) rows.push(items.slice(i)) // filet de sécurité si le nombre de touches change
  return rows
}

export function PhonemeKeyboard({ phonemes, viableNext, onSelect, onShowInfo }: PhonemeKeyboardProps) {
  const rows = splitIntoRows(phonemes, ROW_SIZES)

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row, rowIndex) => (
        <div key={rowIndex} className="flex flex-wrap gap-2">
          {row.map((phoneme) => (
            <div key={phoneme.id} className="min-w-[64px] flex-1 basis-0">
              <PhonemeTile
                phoneme={phoneme}
                disabled={viableNext !== null && !viableNext.has(phoneme.id)}
                onSelect={onSelect}
                onShowInfo={onShowInfo}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
