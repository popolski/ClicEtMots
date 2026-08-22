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
  /**
   * Vrai si CHAQUE son a été rattaché à une graphie réellement répertoriée
   * pour lui. Faux quand la découpe a dû improviser : le résultat est alors
   * probablement décalé et ne doit pas être montré à un enfant.
   *
   * Repéré en production sur "hiver", dont le "h" initial (muet, non
   * répertorié) décalait tout : la fiche affichait [i]->h, [v]->i, [é è]->v,
   * [r]->e. L'appelant DOIT vérifier ce drapeau avant d'afficher.
   */
  fiable: boolean
}

function phonemeParId(table: PhonemeTable): Map<PhonemeId, Phoneme> {
  return new Map(table.map((p) => [p.id, p]))
}

/**
 * Cherche une découpe où chaque son correspond à une de ses graphies connues,
 * avec retour arrière : un premier choix glouton peut condamner la suite.
 * Sur "fer", prendre "er" pour [é è] ne laisse rien pour [r] — il faut
 * revenir en arrière et prendre "e". Les graphies les plus longues restent
 * essayées d'abord ("eau" avant "e"), le retour arrière ne sert qu'en cas
 * d'impasse.
 *
 * Renvoie null si aucune découpe complète n'existe (graphie absente de
 * phonemes.json, lettre muette en début de mot...).
 */
function chercherDecoupe(
  word: string,
  phonemeSeq: PhonemeId[],
  parId: Map<PhonemeId, Phoneme>,
  index: number,
  position: number,
): SegmentGrapheme[] | null {
  if (index >= phonemeSeq.length) return []

  const phonemeId = phonemeSeq[index]
  const phoneme = parId.get(phonemeId)
  const candidats = phoneme ? [...phoneme.graphemes].sort((a, b) => b.grapheme.length - a.grapheme.length) : []

  for (const { grapheme } of candidats) {
    // Les graphies "composées" ("e+consonne double", "t+i") décrivent un
    // contexte, pas une suite de lettres : elles ne peuvent pas correspondre
    // littéralement à une portion du mot.
    if (grapheme.includes('+')) continue
    if (word.slice(position, position + grapheme.length).toLowerCase() !== grapheme.toLowerCase()) continue

    const suite = chercherDecoupe(word, phonemeSeq, parId, index + 1, position + grapheme.length)
    if (suite) return [{ phonemeId, grapheme: word.slice(position, position + grapheme.length) }, ...suite]
  }
  return null
}

export function decomposerMot(word: string, phonemeSeq: PhonemeId[], table: PhonemeTable): DecompositionMot {
  const parId = phonemeParId(table)

  const decoupe = chercherDecoupe(word, phonemeSeq, parId, 0, 0)
  if (decoupe) {
    const consomme = decoupe.reduce((n, s) => n + s.grapheme.length, 0)
    return { segments: decoupe, muettes: word.slice(consomme), fiable: true }
  }

  // Aucune découpe complète : on retombe sur l'ancienne approche gloutonne,
  // qui avance d'une lettre quand rien ne correspond. Le résultat est marqué
  // non fiable — il sert encore à des usages tolérants (repérage approximatif)
  // mais ne doit pas être affiché tel quel.
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
    if (longueur === null) longueur = 1

    segments.push({ phonemeId, grapheme: word.slice(position, position + longueur) })
    position += longueur
  }

  return { segments, muettes: word.slice(position), fiable: false }
}
