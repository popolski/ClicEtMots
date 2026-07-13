import type { Phoneme, PhonemeId } from '../types/phonetics'

interface PhonemeTileProps {
  phoneme: Phoneme
  disabled: boolean
  onSelect: (id: PhonemeId) => void
}

export function PhonemeTile({ phoneme, disabled, onSelect }: PhonemeTileProps) {
  const example = phoneme.graphemes[0]
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(phoneme.id)}
      className={`flex flex-col items-center justify-center rounded-xl border-2 p-3 text-center transition ${
        disabled
          ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
          : 'border-brand-200 bg-white text-gray-900 hover:border-brand-500 hover:bg-brand-50 active:scale-95'
      }`}
    >
      <span className="text-2xl font-bold">{phoneme.displaySymbol}</span>
      {example && <span className="mt-1 text-xs text-gray-400">{example.exampleWord}</span>}
    </button>
  )
}
