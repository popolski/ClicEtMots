// Aligne la séquence de sons d'un mot (WordEntry.phonemes) avec son
// orthographe réelle, son par son - pour montrer explicitement le lien
// graphème-phonème (geste Eduscol du CP), pas juste "voici l'orthographe".
// Signalé par l'enseignante : aujourd'hui le clavier affiche l'orthographe
// d'un coup, sans montrer POURQUOI (quelle lettre fait quel son, quelles
// lettres sont muettes).
//
// Algorithme glouton : pour chaque son, on essaie ses graphies connues
// (phonemes.json), la plus longue d'abord, sur ce qui reste du mot à partir
// de la position courante - la première qui correspond littéralement à
// l'orthographe est la bonne (une graphie "composée" comme "e+consonne
// double" ou "t+i" ne peut jamais matcher une sous-chaîne littérale, elle
// est donc ignorée ici plutôt que de fausser l'alignement). Ce qui reste à
// la fin (jamais consommé par un son) est la partie muette du mot.
//
// Vérifié à la main sur des mots réels du lexique (chat, beau, manteau,
// petit, maison, jambe, oiseau...) : fonctionne correctement y compris sur
// les cas piégeux (maison -> m/ai/s/on, jambe -> j/am/b + e muet).
import type { Phoneme, PhonemeId, PhonemeTable } from '../types/phonetics'

export interface SegmentGrapheme {
  phonemeId: PhonemeId
  /** Portion du mot réellement utilisée pour ce son (peut différer de displaySymbol). */
  grapheme: string
}

export interface DecompositionMot {
  segments: SegmentGrapheme[]
  /** Lettres finales non rattachées à un son (ex. le "t" muet de "chat"). Vide si aucune. */
  muettes: string
}

function phonemeParId(table: PhonemeTable): Map<PhonemeId, Phoneme> {
  return new Map(table.map((p) => [p.id, p]))
}

export function decomposerMot(word: string, phonemeSeq: PhonemeId[], table: PhonemeTable): DecompositionMot {
  const parId = phonemeParId(table)
  let position = 0
  const segments: SegmentGrapheme[] = []

  for (const phonemeId of phonemeSeq) {
    const phoneme = parId.get(phonemeId)
    const candidats = phoneme ? [...phoneme.graphemes].sort((a, b) => b.grapheme.length - a.grapheme.length) : []

    let longueur: number | null = null
    for (const { grapheme } of candidats) {
      if (grapheme.includes('+')) continue
      if (word.slice(position, position + grapheme.length).toLowerCase() === grapheme.toLowerCase()) {
        longueur = grapheme.length
        break
      }
    }
    // Aucune graphie connue ne correspond (mot ajouté par l'enseignante avec
    // une graphie non répertoriée, erreur de données...) : on avance d'une
    // lettre plutôt que de bloquer toute la décomposition.
    if (longueur === null) longueur = 1

    segments.push({ phonemeId, grapheme: word.slice(position, position + longueur) })
    position += longueur
  }

  return { segments, muettes: word.slice(position) }
}
