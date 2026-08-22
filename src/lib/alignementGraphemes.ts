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
  /**
   * Lettres muettes situées JUSTE AVANT ce son (le "h" de "hiver", le "p" de
   * "compte"), chaîne vide s'il n'y en a pas. Les muettes de fin de mot sont
   * à part, dans DecompositionMot.muettes.
   */
  muetteAvant: string
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
  budget: number,
): SegmentGrapheme[] | null {
  if (index >= phonemeSeq.length) return []

  const phonemeId = phonemeSeq[index]
  const phoneme = parId.get(phonemeId)
  const candidats = phoneme ? [...phoneme.graphemes].sort((a, b) => b.grapheme.length - a.grapheme.length) : []

  // Nombre de lettres muettes sautées avant ce son. On essaie 0 d'abord :
  // une découpe sans muette interne est toujours préférée à une découpe qui
  // en invente une.
  for (let saut = 0; saut <= budget; saut++) {
    const debut = position + compterSeparateurs(word, position) + saut
    if (debut > word.length) break
    if (!muettePlausible(word, position + compterSeparateurs(word, position), debut)) break
    // Les traits d'union, apostrophes et espaces ("aujourd'hui", "peut-être",
    // "parce que") ne sont pas des lettres muettes : ils ne coûtent rien et
    // sont simplement absorbés avec elles.
    const avant = word.slice(position, debut + compterSeparateurs(word, debut))
    const depart = debut + compterSeparateurs(word, debut)

    for (const { grapheme } of candidats) {
      // Les graphies "composées" ("e+consonne double", "t+i") décrivent un
      // contexte, pas une suite de lettres : elles ne peuvent pas correspondre
      // littéralement à une portion du mot.
      if (grapheme.includes('+')) continue
      if (word.slice(depart, depart + grapheme.length).toLowerCase() !== grapheme.toLowerCase()) continue

      const suite = chercherDecoupe(
        word,
        phonemeSeq,
        parId,
        index + 1,
        depart + grapheme.length,
        budget - saut,
      )
      if (suite) {
        return [
          { phonemeId, grapheme: word.slice(depart, depart + grapheme.length), muetteAvant: avant },
          ...suite,
        ]
      }
    }
  }
  return null
}

/**
 * Une lettre ne peut être déclarée muette que si elle peut réellement l'être
 * en français : les consonnes (h de "hiver", p de "compte", m de "automne")
 * et la seule voyelle qui se tait, le "e". Sans cette règle, la recherche
 * s'autorisait des muettes impossibles pour compenser une graphie absente de
 * la table - sur "oeil" elle déclarait le "o" muet et rattachait [e] au "e",
 * enseignant une correspondance fausse au lieu de reconnaître "oe".
 */
function muettePlausible(word: string, debut: number, fin: number): boolean {
  for (let i = debut; i < fin; i++) {
    // Le "l" est exclu en plus des voyelles : à l'intérieur d'un mot il
    // n'est pratiquement jamais muet, et l'autoriser faisait passer le "ll"
    // de "taillis" ou "mitrailleur" pour une lettre silencieuse alors que
    // c'est justement lui qui produit le son.
    if (/[aiouyâàîïôûùéèêël]/i.test(word[i])) return false
  }
  return true
}

/** Longueur du groupe de caractères non alphabétiques à partir de `position`. */
function compterSeparateurs(word: string, position: number): number {
  let n = 0
  while (position + n < word.length && /[^a-zà-öø-ÿ]/i.test(word[position + n])) n++
  return n
}

/**
 * Plafond de lettres muettes internes cherchées. Au-delà, on n'a plus affaire
 * à un mot dont quelques lettres se taisent mais à une découpe inventée de
 * toutes pièces : mieux vaut alors se déclarer non fiable et ne rien montrer.
 */
const MAX_MUETTES_INTERNES = 3

export function decomposerMot(word: string, phonemeSeq: PhonemeId[], table: PhonemeTable): DecompositionMot {
  const parId = phonemeParId(table)

  // Approfondissement progressif : on cherche d'abord une découpe SANS
  // aucune lettre muette interne, puis on en autorise une, puis deux. La
  // première trouvée est donc celle qui en invente le moins - sans ça, rien
  // n'empêcherait de déclarer muettes des lettres qui se prononcent.
  for (let budget = 0; budget <= MAX_MUETTES_INTERNES; budget++) {
    const decoupe = chercherDecoupe(word, phonemeSeq, parId, 0, 0, budget)
    if (decoupe) {
      const consomme = decoupe.reduce((n, s) => n + s.muetteAvant.length + s.grapheme.length, 0)
      return { segments: decoupe, muettes: word.slice(consomme), fiable: true }
    }
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

    segments.push({ phonemeId, grapheme: word.slice(position, position + longueur), muetteAvant: '' })
    position += longueur
  }

  return { segments, muettes: word.slice(position), fiable: false }
}
