import type { Phoneme, PhonemeId } from '../types/phonetics'
import { assetUrl } from '../lib/assetUrl'

interface PhonemeTileProps {
  phoneme: Phoneme
  disabled: boolean
  /** Touche appartenant à la solution d'un mot révélé (quiz "recomposer le mot") - juste un repère visuel, pas un état désactivé. */
  misEnAvant?: boolean
  onSelect: (id: PhonemeId) => void
  onShowInfo: (id: PhonemeId) => void
}

// Repris de la photo du vrai Clavier Métalo fournie par l'enseignant :
// graphie principale en GRAND en haut, jusqu'à 2 graphies secondaires plus
// PETITES en dessous (pas la même taille — une tentative précédente les
// mettait toutes à la même taille "sur le modèle du Métalo", mais en
// regardant la vraie photo la principale est clairement plus grosse), texte
// à gauche et pictogramme à droite. Deux graphies secondaires maximum : au-
// delà, la touche devient illisible ; les autres variantes (ex. "ill" a 17
// graphies possibles) restent dans la fiche du son, pas sur la touche.
const MAX_SECONDARY_GRAPHEMES = 2

export function PhonemeTile({ phoneme, disabled, misEnAvant, onSelect, onShowInfo }: PhonemeTileProps) {
  const primary = phoneme.graphemes[0]
  const secondaryGraphemes = phoneme.graphemes.slice(1, 1 + MAX_SECONDARY_GRAPHEMES).map((g) => g.grapheme)

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onSelect(phoneme.id)}
        className={`flex w-full items-center justify-between gap-2 rounded-xl border-2 p-2 pt-3 text-left transition ${
          disabled
            ? 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
            : misEnAvant
              ? 'border-amber-400 bg-amber-100 text-gray-900 ring-2 ring-amber-300 hover:border-amber-500'
              : 'border-brand-200 bg-white text-gray-900 hover:border-brand-500 hover:bg-brand-50 active:scale-95'
        }`}
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-2xl leading-none font-bold whitespace-nowrap">{phoneme.displaySymbol}</span>
          {secondaryGraphemes.length > 0 && (
            <span className="text-xs leading-tight text-gray-500">{secondaryGraphemes.join(' ')}</span>
          )}
        </div>
        {primary?.exampleImage && (
          <img
            src={assetUrl(primary.exampleImage)}
            alt={primary.exampleWord}
            className={`h-10 w-10 shrink-0 object-contain ${disabled ? 'opacity-30 grayscale' : ''}`}
          />
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
