// Logique de sélection des mots du quiz, extraite de QuizTool.tsx pour être
// testable : c'est là que vivent les règles linguistiques du projet
// (quels mots sont proposables, avec quelle nature attendue), et donc là
// que sont apparus la plupart des bugs signalés à l'usage - "bonne" proposé
// comme nom, "revient" comme nom, "paysan" comme nom... Voir quizLogic.test.ts,
// qui rejoue ces cas réels contre le lexique livré.
import {
  LEMMA_IDS_ADJECTIFS_PARASITES,
  LEMMA_IDS_DETERMINANTS,
  LEMMA_IDS_HOMOGRAPHES_FANTOMES,
} from '../clavier/clavierLogic'
import { natureInvariable } from '../../lib/natureInvariable'
import type { WordCategory, WordEntry } from '../../types/phonetics'

// Catégories proposées par le quiz "grammaire" - un sur-ensemble de
// WordCategory, puisque le lexique ne distingue pas pronom/préposition à
// l'intérieur de "invariable" (voir natureInvariable.ts). "invariable" n'est
// plus une réponse possible : ce n'est pas une nature de mot mais une
// propriété (signalé à l'usage) - on demande maintenant la vraie nature
// quand on la connaît (pronom personnel, préposition), sinon le mot est
// simplement écarté du quiz de grammaire (voir natureGrammaireDe).
export type CategorieGrammaireQuiz = 'nom' | 'adjectif' | 'verbe' | 'adverbe' | 'pronom' | 'preposition'

export const CATEGORIES_GRAMMAIRE: CategorieGrammaireQuiz[] = [
  'nom',
  'adjectif',
  'verbe',
  'adverbe',
  'pronom',
  'preposition',
]

/** Mot candidat pour une question de quiz - un sous-ensemble de WordEntry/MotDeListe. */
export interface MotCandidat {
  lemmaId: string
  word: string
  category: WordCategory
}

/** nom/adjectif/verbe/adverbe : la catégorie EST la nature. Invariable : la
 * nature précise vient de natureInvariable (pronom/préposition), sinon on ne
 * sait pas (conjonction, interjection...) et le mot est écarté du quiz. */
export function natureGrammaireDe(entree: { word: string; category: WordCategory }): CategorieGrammaireQuiz | null {
  if (entree.category !== 'invariable') return entree.category
  return natureInvariable(entree.word)
}

// Rôle "de base" par catégorie (même logique que ROLE_DE_BASE dans
// wordIndex.ts) : pour piocher dans les mots les plus fréquents du lexique,
// on ne veut que la forme de base de chaque mot (pas "chevaux" séparément de
// "cheval").
const ROLE_DE_BASE: Record<WordCategory, WordEntry['formRole']> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

// Piochés parmi les mots les plus fréquents du lexique - pas l'historique de
// consultation de l'élève (trop court/répétitif pour donner une vraie
// variété d'une partie à l'autre). Les mots les plus fréquents "bruts" sont
// presque tous des mots-outils (le, de, un, il, pas...) plutôt que du
// vocabulaire à réviser - on se limite aux noms/verbes/adjectifs (les
// adverbes/invariables les plus fréquents sont quasi exclusivement des
// mots-outils), aux mots d'au moins 3 lettres, et on retire les mêmes listes
// noires que le clavier (déterminants, homographes mal étiquetés par le
// corpus). Vivier volontairement large : ~45% de ces mots sont ensuite
// écartés par motsAmbigus (double nature - "paysan" nom ET adjectif, etc.),
// donc 1000 mots bruts ne laissent plus que ~500 mots réellement utilisables
// - repéré comme insuffisant pour un élève qui enchaîne beaucoup de parties
// (trop de répétitions). 2000 mots bruts donnent environ 1000 mots
// utilisables, la vraie taille visée.
export const TAILLE_VIVIER = 2000

export function motsFrequentsPourQuiz(wordIndex: WordEntry[]): MotCandidat[] {
  return wordIndex
    .filter(
      (e) =>
        e.formRole === ROLE_DE_BASE[e.category] &&
        (e.category === 'nom' || e.category === 'verbe' || e.category === 'adjectif') &&
        e.word.length >= 3 &&
        !LEMMA_IDS_DETERMINANTS.has(e.lemmaId) &&
        !LEMMA_IDS_HOMOGRAPHES_FANTOMES.has(e.lemmaId) &&
        !LEMMA_IDS_ADJECTIFS_PARASITES.has(e.lemmaId),
    )
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, TAILLE_VIVIER)
    .map((e) => ({ lemmaId: e.lemmaId, word: e.word, category: e.category }))
}

// Adverbes réels d'usage courant (pas des mots-outils comme "pas"/"y"/
// "comme", qui dominent le classement par fréquence brute) - liste choisie
// à la main, seule façon fiable de proposer de vrais adverbes au quiz de
// grammaire sans reprendre tout le bruit du corpus (même logique que
// EXCLUDED_WORDS/HOMOGRAPHES_FANTOMES ailleurs dans le projet, en positif
// cette fois : une liste blanche plutôt qu'une liste noire).
export const ADVERBES_SURS = new Set([
  'bien', 'mal', 'vite', 'souvent', 'toujours', 'jamais', 'encore', 'beaucoup', 'trop', 'peu',
  'aussi', 'ainsi', 'dehors', 'dedans', 'ici', 'là', 'loin', 'près', "aujourd'hui", 'demain',
  'hier', 'ensuite', 'enfin', 'vraiment', 'gentiment', 'doucement', 'lentement', 'rapidement',
  'joyeusement', 'tristement', 'fortement', 'calmement', 'simplement', 'parfaitement',
  'heureusement', 'malheureusement', 'exactement', 'certainement', 'probablement', 'autrefois',
  'longtemps', 'partout', 'ailleurs', 'dessus', 'dessous', 'maintenant', 'bientôt', 'tard', 'tôt',
])

// Vivier du quiz de grammaire : comme motsFrequentsPourQuiz, mais inclut
// aussi les adverbes de la liste blanche ci-dessus ainsi que les mots
// invariables dont on connaît la nature précise (pronom personnel ou
// préposition, voir natureInvariable.ts) - sans ça, seuls noms/verbes/
// adjectifs sont proposables, et le tri par fréquence brute favorise
// nettement les noms (signalé comme déséquilibré). Le tirage lui-même est
// équilibré ensuite par equilibrerParNature, nature par nature.
export function motsFrequentsPourGrammaire(wordIndex: WordEntry[]): MotCandidat[] {
  const base = motsFrequentsPourQuiz(wordIndex)
  const adverbes = wordIndex
    .filter((e) => e.category === 'adverbe' && e.formRole === 'simple' && ADVERBES_SURS.has(e.word))
    .map((e) => ({ lemmaId: e.lemmaId, word: e.word, category: e.category }))
  const pronomsEtPrepositions = wordIndex
    .filter((e) => e.category === 'invariable' && e.formRole === 'simple' && natureInvariable(e.word) !== null)
    .map((e) => ({ lemmaId: e.lemmaId, word: e.word, category: e.category }))
  return [...base, ...adverbes, ...pronomsEtPrepositions]
}

// Un mot qui existe réellement dans plusieurs catégories ("grand" nom ET
// adjectif, "pouvoir" verbe ET nom, "paysan" nom ET adjectif, "revient" verbe
// ET nom...) n'a pas de nature unique - contrairement aux erreurs de corpus
// déjà nettoyées (LEMMA_IDS_HOMOGRAPHES_FANTOMES), ici les deux catégories
// sont vraies. Pour le quiz "catégorie grammaticale", ça n'a pas de bonne
// réponse tant que le mot est montré seul, sans phrase - on écarte ces mots
// plutôt que de pénaliser un élève qui répond juste mais "pas la bonne case
// attendue". Pour les autres modes (QCM/reconstitution), la catégorie n'est
// qu'une étiquette affichée à côté du mot, jamais notée - mais une étiquette
// tout aussi arbitraire ("revient" étiqueté NOM alors que l'enfant y pense
// comme un verbe) reste trompeuse, d'où ce même filtre partout (signalé à
// l'usage). Vérifié sur le lexique complet (pas seulement le vivier), une
// même orthographe pouvant partager sa fréquence avec une catégorie hors du
// vivier.
//
// Compare TOUTES les formes, pas seulement les formes de base : "bonne" est
// la forme de base du nom ("une bonne" = domestique) mais la forme FÉMININE
// (pas de base) de l'adjectif "bon" - en ne comparant que les formes de
// base, cette collision passait inaperçue ("bonne" proposé comme nom, sans
// jamais détecter qu'un enfant y verrait tout aussi légitimement un
// adjectif). Signalé à l'usage.
export function motsAmbigus(wordIndex: WordEntry[]): Set<string> {
  const categoriesParMot = new Map<string, Set<WordCategory>>()
  for (const e of wordIndex) {
    const cle = e.word.toLowerCase()
    const categories = categoriesParMot.get(cle) ?? new Set<WordCategory>()
    categories.add(e.category)
    categoriesParMot.set(cle, categories)
  }
  const ambigus = new Set<string>()
  for (const [mot, categories] of categoriesParMot) {
    if (categories.size > 1) ambigus.add(mot)
  }
  return ambigus
}

export function melanger<T>(items: T[]): T[] {
  const copie = [...items]
  for (let i = copie.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copie[i], copie[j]] = [copie[j], copie[i]]
  }
  return copie
}

/** Une entrée retenue pour le quiz de grammaire, avec la nature attendue. */
export interface TirageGrammaire {
  entree: MotCandidat
  nature: CategorieGrammaireQuiz
}

// Répartit le tirage à peu près également entre les natures présentes dans
// `source` (un tour par nature, dans un ordre mélangé), plutôt que de
// piocher au hasard dans un tas dominé par les noms. Les entrées dont on ne
// connaît pas la nature précise (mot invariable hors pronom/préposition,
// ex. "et"/"mais") sont écartées ici, pas avant, pour rester la SEULE
// fonction responsable de ce filtre.
export function equilibrerParNature(source: MotCandidat[], count: number): TirageGrammaire[] {
  const parNature = new Map<CategorieGrammaireQuiz, MotCandidat[]>()
  for (const entree of melanger(source)) {
    const nature = natureGrammaireDe(entree)
    if (!nature) continue
    const liste = parNature.get(nature) ?? []
    liste.push(entree)
    parNature.set(nature, liste)
  }
  const natures = melanger([...parNature.keys()])
  const resultat: TirageGrammaire[] = []
  let progression = true
  while (resultat.length < count && progression) {
    progression = false
    for (const nature of natures) {
      if (resultat.length >= count) break
      const liste = parNature.get(nature)
      const suivant = liste?.shift()
      if (suivant) {
        resultat.push({ entree: suivant, nature })
        progression = true
      }
    }
  }
  return resultat
}
