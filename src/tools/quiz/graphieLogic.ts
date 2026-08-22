// Logique de l'atelier "choisis la bonne graphie" : l'élève entend un mot et
// choisit, son par son, comment chaque son s'écrit DANS CE MOT ([o] -> o, au,
// eau, ô). Transforme la décomposition son-par-son de la fiche mot (passive)
// en exercice d'encodage.
//
// Extrait dans son propre module pour être testable : c'est là que vivent les
// règles qui décident quels mots sont jouables et quelles propositions sont
// affichées - exactement le genre d'endroit où les bugs linguistiques du
// projet sont toujours apparus. Voir graphieLogic.test.ts.
import { decomposerMot } from '../../lib/alignementGraphemes'
import { phonemes } from '../../lib/phonemes'
import wordPictos from '../../data/word-pictos.json'
import type { PhonemeId, WordCategory, WordEntry } from '../../types/phonetics'

/** Nombre maximum de propositions affichées pour un son. */
export const MAX_CHOIX = 4

/**
 * Bornes du nombre de sons à choisir dans un mot. En dessous de 1, il n'y a
 * aucune décision à prendre ; au-dessus de 4, une seule question durerait
 * une éternité pour un enfant (certains mots du lexique montent à 10).
 */
export const MIN_SONS_A_CHOISIR = 1
export const MAX_SONS_A_CHOISIR = 4

/** Propositions de la dernière étape, toujours posée (voir EtapeMuette). */
export const CHOIX_MUETTE = ['rien', 'e', 't', 's', 'd'] as const

export interface EtapeSon {
  phonemeId: PhonemeId
  /** Symbole affiché du son, ex. "é è". */
  symbole: string
  /** Graphie réellement utilisée dans ce mot - la bonne réponse. */
  bonne: string
  /** Propositions affichées, bonne réponse comprise, dans l'ordre du clavier. */
  choix: string[]
  /** Vrai si le son n'a qu'une écriture possible : posé d'office, sans question. */
  automatique: boolean
}

export interface ExerciceGraphie {
  mot: string
  lemmaId: string
  etapes: EtapeSon[]
  /** Lettres muettes finales, chaîne vide si le mot n'en a pas. */
  muette: string
  /**
   * Pictogramme à afficher pour lever l'ambiguïté, seulement quand le mot est
   * homophone d'un autre : sur un mot non ambigu, l'image donnerait la réponse
   * trop facilement (décision produit).
   */
  picto: string | null
}

const graphiesUtilisables = new Map<PhonemeId, string[]>(
  phonemes.map((p) => [
    p.id,
    // Les graphies "composées" ("e+consonne double", "t+i") décrivent un
    // contexte, pas une suite de lettres : elles ne peuvent ni correspondre
    // littéralement à une portion du mot, ni être proposées telles quelles.
    p.graphemes.map((g) => g.grapheme).filter((g) => !g.includes('+')),
  ]),
)

const symboleParId = new Map(phonemes.map((p) => [p.id, p.displaySymbol]))

/**
 * Classement des graphies par fréquence réelle dans le lexique livré, pour
 * choisir quelles propositions afficher quand un son en a trop (le son [é è]
 * en a douze). Calculé à la demande puis mémorisé : l'ordre de phonemes.json
 * est curaté pédagogiquement, pas statistique - il place par exemple "ez"
 * avant "ai", alors que "ai" est six fois plus fréquent.
 */
let classementMemo: Map<PhonemeId, string[]> | null = null

export function classementGraphies(wordIndex: WordEntry[]): Map<PhonemeId, string[]> {
  if (classementMemo) return classementMemo
  const compte = new Map<PhonemeId, Map<string, number>>()
  for (const entree of wordIndex) {
    const { segments } = decomposerMot(entree.word, entree.phonemes, phonemes)
    for (const segment of segments) {
      const parGraphie = compte.get(segment.phonemeId) ?? new Map<string, number>()
      const cle = segment.grapheme.toLowerCase()
      parGraphie.set(cle, (parGraphie.get(cle) ?? 0) + 1)
      compte.set(segment.phonemeId, parGraphie)
    }
  }
  classementMemo = new Map(
    [...compte].map(([id, parGraphie]) => [id, [...parGraphie].sort((a, b) => b[1] - a[1]).map(([g]) => g)]),
  )
  return classementMemo
}

/** Réinitialise le cache — utilisé par les tests, jamais par l'application. */
export function reinitialiserClassement(): void {
  classementMemo = null
}

/**
 * Propositions pour un son : la bonne réponse TOUJOURS incluse (sans elle
 * l'exercice serait insoluble), complétée par les graphies les plus
 * fréquentes de ce son, jusqu'à MAX_CHOIX. Ordre stable (celui du clavier)
 * pour que la bonne réponse ne se repère pas à sa position.
 */
export function choixPourSon(phonemeId: PhonemeId, bonne: string, classement: Map<PhonemeId, string[]>): string[] {
  const toutes = graphiesUtilisables.get(phonemeId) ?? []
  if (toutes.length <= 1) return [bonne]

  const parFrequence = classement.get(phonemeId) ?? []
  const retenues = new Set<string>([bonne.toLowerCase()])
  for (const graphie of parFrequence) {
    if (retenues.size >= MAX_CHOIX) break
    if (toutes.some((g) => g.toLowerCase() === graphie)) retenues.add(graphie)
  }
  // Le classement ne couvre que les graphies vues dans le lexique ; on
  // complète au besoin avec les autres graphies connues du son.
  for (const graphie of toutes) {
    if (retenues.size >= MAX_CHOIX) break
    retenues.add(graphie.toLowerCase())
  }
  return toutes.filter((g) => retenues.has(g.toLowerCase()))
}

/**
 * Mots partageant exactement la même suite de sons (faire/fer, les/lait/laid,
 * mais/mes/mets...). 18% du lexique est concerné : entendu seul, un tel mot
 * n'a pas d'orthographe déterminable, l'exercice serait insoluble. Même
 * principe que motsAmbigus pour le quiz de grammaire (voir quizLogic.ts).
 */
export function motsHomophones(wordIndex: WordEntry[]): Set<string> {
  // La collision se mesure entre LEMMES, pas entre mots : "maison" et son
  // pluriel "maisons" se prononcent pareil mais sont le même mot. Sans cette
  // distinction, presque tout le lexique serait déclaré homophone (tout nom a
  // un pluriel muet) et l'exercice n'aurait plus aucun mot à proposer.
  //
  // Deux passes, et pas une seule map lemme -> mot : un lemme porte plusieurs
  // formes homophones entre elles ("maison"/"maisons"), et n'en garder qu'une
  // ferait manquer les autres au moment de marquer les mots concernés.
  const lemmesParSons = new Map<string, Set<string>>()
  for (const entree of wordIndex) {
    const cle = entree.phonemes.join('-')
    const lemmes = lemmesParSons.get(cle) ?? new Set<string>()
    lemmes.add(entree.lemmaId)
    lemmesParSons.set(cle, lemmes)
  }

  const homophones = new Set<string>()
  for (const entree of wordIndex) {
    if ((lemmesParSons.get(entree.phonemes.join('-'))?.size ?? 0) > 1) {
      homophones.add(entree.word.toLowerCase())
    }
  }
  return homophones
}

/**
 * Construit l'exercice pour un mot, ou null si le mot n'est pas jouable :
 * décomposition non fiable, aucun son à choisir, trop de sons à choisir, ou
 * homophone sans pictogramme pour lever l'ambiguïté.
 */
export function construireExercice(
  entree: { word: string; lemmaId: string; phonemes: PhonemeId[] },
  classement: Map<PhonemeId, string[]>,
  homophones: Set<string>,
): ExerciceGraphie | null {
  const { segments, muettes, fiable } = decomposerMot(entree.word, entree.phonemes, phonemes)

  // Découpe douteuse : l'exercice demanderait une graphie qui n'est pas la
  // bonne. Le drapeau vient de decomposerMot, qui sait si CHAQUE son a été
  // rattaché à une graphie réellement répertoriée pour lui.
  if (!fiable) return null

  const etapes = segments.map((s) => {
    const choix = choixPourSon(s.phonemeId, s.grapheme, classement)
    return {
      phonemeId: s.phonemeId,
      symbole: symboleParId.get(s.phonemeId) ?? s.phonemeId,
      bonne: s.grapheme,
      choix,
      automatique: choix.length <= 1,
    }
  })

  // La liste des lettres muettes proposées est fixe et courte : un mot dont
  // la fin muette n'y figure pas serait tout simplement insoluble. Repéré sur
  // "doigt" ("gt"), qu'on pouvait atteindre sans jamais pouvoir le finir.
  if (muettes !== '' && !CHOIX_MUETTE.includes(muettes.toLowerCase() as (typeof CHOIX_MUETTE)[number])) return null

  const aChoisir = etapes.filter((e) => !e.automatique).length
  if (aChoisir < MIN_SONS_A_CHOISIR || aChoisir > MAX_SONS_A_CHOISIR) return null

  const picto = (wordPictos as Record<string, string>)[entree.word] ?? null
  if (homophones.has(entree.word.toLowerCase()) && !picto) return null

  return {
    mot: entree.word,
    lemmaId: entree.lemmaId,
    etapes,
    muette: muettes,
    // Le pictogramme n'est montré que sur les homophones : ailleurs il
    // donnerait le mot trop facilement (décision produit).
    picto: homophones.has(entree.word.toLowerCase()) ? picto : null,
  }
}

export interface MotSource {
  word: string
  lemmaId: string
  category: WordCategory
}

/**
 * Prépare les exercices d'une séance à partir d'une liste de mots candidats
 * (mots de la semaine ou vivier fréquent), en écartant silencieusement ceux
 * qui ne sont pas jouables.
 */
export function preparerSeance(
  source: MotSource[],
  wordIndex: WordEntry[],
  nombre: number,
): ExerciceGraphie[] {
  const classement = classementGraphies(wordIndex)
  const homophones = motsHomophones(wordIndex)
  const parMot = new Map(wordIndex.map((e) => [`${e.lemmaId}|${e.word}`, e]))

  const exercices: ExerciceGraphie[] = []
  for (const mot of source) {
    if (exercices.length >= nombre) break
    const entree = parMot.get(`${mot.lemmaId}|${mot.word}`)
    if (!entree) continue
    const exercice = construireExercice(
      { word: entree.word, lemmaId: entree.lemmaId, phonemes: entree.phonemes },
      classement,
      homophones,
    )
    if (exercice) exercices.push(exercice)
  }
  return exercices
}
