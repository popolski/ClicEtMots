import { useMemo } from 'react'
import { decomposerMot } from '../../lib/alignementGraphemes'
import { phonemes } from '../../lib/phonemes'
import type { PhonemeId } from '../../types/phonetics'

interface DecompositionSonGraphieProps {
  word: string
  phonemeSeq: PhonemeId[]
}

const phonemesParId = new Map(phonemes.map((p) => [p.id, p]))

/**
 * Montre explicitement le lien son -> lettres pour CE mot, geste Eduscol du
 * CP : chaque son affiché avec la graphie réellement utilisée, les autres
 * graphies possibles de ce son en rappel (ex. le son [o] peut aussi s'écrire
 * "o"/"au"/"ô"), et les lettres muettes finales en gris. Remplace le réflexe
 * "l'orthographe apparaît" du clavier par une vraie décomposition - signalé
 * par l'enseignante comme le vrai manque de l'outil.
 */
export function DecompositionSonGraphie({ word, phonemeSeq }: DecompositionSonGraphieProps) {
  const decomposition = useMemo(() => decomposerMot(word, phonemeSeq, phonemes), [word, phonemeSeq])

  return (
    <div className="mb-8 rounded-2xl border-2 border-gray-200 bg-gray-50 p-5">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">Son par son</h2>
      <div className="flex flex-wrap items-start gap-3">
        {decomposition.segments.map((segment, i) => {
          const phoneme = phonemesParId.get(segment.phonemeId)
          const autresGraphies = phoneme?.graphemes.filter((g) => g.grapheme !== segment.grapheme) ?? []
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-400">[{phoneme?.displaySymbol ?? segment.phonemeId}]</span>
              <span className="rounded-lg bg-brand-100 px-3 py-1 text-2xl font-semibold text-brand-700">
                {segment.grapheme}
              </span>
              {autresGraphies.length > 0 && (
                <span className="max-w-24 text-center text-xs text-gray-400">
                  aussi : {autresGraphies.map((g) => g.grapheme).join(', ')}
                </span>
              )}
              {phoneme?.note && <span className="max-w-28 text-center text-xs text-gray-400">{phoneme.note}</span>}
            </div>
          )
        })}
        {decomposition.muettes && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-gray-400">muet</span>
            <span className="px-3 py-1 text-2xl font-semibold text-gray-300">{decomposition.muettes}</span>
          </div>
        )}
      </div>
    </div>
  )
}
