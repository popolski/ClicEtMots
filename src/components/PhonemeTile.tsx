import type { Phoneme, PhonemeId } from '../types/phonetics'

interface PhonemeTileProps {
  phoneme: Phoneme
  disabled: boolean
  onSelect: (id: PhonemeId) => void
  onShowInfo: (id: PhonemeId) => void
}

export function PhonemeTile({ phoneme, disabled, onSelect, onShowInfo }: PhonemeTileProps) {
  const [primary, ...rest] = phoneme.graphemes
  const secondaryGraphemes = rest.slice(0, 2).map((g) => g.grapheme)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(phoneme.id)}
        className={`flex w-full flex-col items-center justify-center rounded-xl border-2 p-2 pt-3 text-center transition ${
          disabled
            ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
            : 'border-brand-200 bg-white text-gray-900 hover:border-brand-500 hover:bg-brand-50 active:scale-95'
        }`}
      >
        <span className="text-2xl font-bold">{phoneme.displaySymbol}</span>
        {secondaryGraphemes.length > 0 && (
          <span className="text-[10px] text-gray-400">{secondaryGraphemes.join(' · ')}</span>
        )}
        {phoneme.gestureImage ? (
          <img
            src={phoneme.gestureImage}
            alt={`Geste Borel-Maisonny — ${phoneme.displaySymbol}`}
            className={`mt-1 h-10 w-10 object-contain ${disabled ? 'opacity-30 grayscale' : ''}`}
          />
        ) : (
          primary?.exampleImage && (
            <span className={`mt-1 text-xl leading-none ${disabled ? 'opacity-30 grayscale' : ''}`}>
              {primary.exampleImage}
            </span>
          )
        )}
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onShowInfo(phoneme.id)
        }}
        aria-label={`Détails du son ${phoneme.displaySymbol}`}
        className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-white text-[11px] leading-none text-gray-500 shadow-sm hover:bg-gray-100"
      >
        i
      </button>
    </div>
  )
}
