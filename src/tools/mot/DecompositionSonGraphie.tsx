import { useMemo } from 'react'
import { decomposerMot } from '../../lib/alignementGraphemes'
import { phonemes } from '../../lib/phonemes'
import { useConfortLecture } from '../../lib/confortLectureContext'
import type { PhonemeId } from '../../types/phonetics'

interface DecompositionSonGraphieProps {
  word: string
  phonemeSeq: PhonemeId[]
}

const phonemesParId = new Map(phonemes.map((p) => [p.id, p]))

// Distinction voyelles/consonnes du clavier (les 11 premiers phonèmes de
// phonemes.json).
const VOYELLES: Set<PhonemeId> = new Set(['a', 'e', 'i', 'o', 'u', 'ou', 'on', 'an', 'in', 'oi', 'eu'])

// Code couleur repris de LireCouleur (Éduscol - primabord.eduscol.education.fr/lirecouleur),
// convention la plus reprise en orthophonie/classe pour les dys, PAS mon
// invention (une première version en vert/turquoise avait été corrigée après
// vérification - le vert seul posait aussi un souci de daltonisme) :
// rouge = voyelle simple, bleu = consonne simple, vert = graphème complexe
// (digramme/trigramme comme "ch"/"ou"/"eau" - pour éviter de le lire lettre
// par lettre), gris = muet (géré séparément plus bas).
function couleurGrapheme(phonemeId: PhonemeId, grapheme: string): string {
  if (grapheme.length > 1) return 'bg-green-100 text-green-900'
  return VOYELLES.has(phonemeId) ? 'bg-red-100 text-red-900' : 'bg-blue-100 text-blue-900'
}

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
  const { actif: confort } = useConfortLecture()

  return (
    <div className="mb-8 rounded-2xl border-2 border-gray-200 bg-gray-50 p-5">
      <h2 className="mb-3 text-sm font-semibold tracking-wide text-gray-500 uppercase">Son par son</h2>
      <div className="flex flex-wrap items-start gap-3">
        {decomposition.segments.map((segment, i) => {
          const phoneme = phonemesParId.get(segment.phonemeId)
          const autresGraphies = phoneme?.graphemes.filter((g) => g.grapheme !== segment.grapheme) ?? []
          const couleurConfort = confort ? couleurGrapheme(segment.phonemeId, segment.grapheme) : 'bg-brand-100 text-brand-700'
          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <span className="text-xs font-medium text-gray-400">[{phoneme?.displaySymbol ?? segment.phonemeId}]</span>
              <span className={`rounded-lg px-3 py-1 text-2xl font-semibold ${couleurConfort}`}>{segment.grapheme}</span>
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
