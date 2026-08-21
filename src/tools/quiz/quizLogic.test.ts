// Corpus de régression : chaque cas ci-dessous correspond à un vrai
// problème remonté par l'enseignante en classe, pas à un cas théorique.
// Les tests tournent contre le lexique RÉELLEMENT livré (words-clavier2.json),
// pas contre des données inventées - c'est le seul moyen de détecter qu'une
// regénération du lexique réintroduit un mot piégeux.
import { describe, expect, it } from 'vitest'
import words from '../../data/words-clavier2.json'
import wordPictos from '../../data/word-pictos.json'
import {
  CATEGORIES_GRAMMAIRE,
  equilibrerParNature,
  motsAmbigus,
  motsFrequentsPourGrammaire,
  motsFrequentsPourQuiz,
  natureGrammaireDe,
} from './quizLogic'
import { natureInvariable } from '../../lib/natureInvariable'
import { LEMMA_IDS_HOMOGRAPHES_FANTOMES } from '../clavier/clavierLogic'
import type { WordEntry } from '../../types/phonetics'

const lexique = words as WordEntry[]
const ambigus = motsAmbigus(lexique)
const vivierQcm = motsFrequentsPourQuiz(lexique).filter((e) => !ambigus.has(e.word.toLowerCase()))
const vivierGrammaire = motsFrequentsPourGrammaire(lexique).filter((e) => !ambigus.has(e.word.toLowerCase()))

describe('mots à double nature signalés en classe', () => {
  // Chaque entrée : [mot, les deux natures qui coexistent réellement].
  // "bonne" et "revient" ont été proposés comme NOM dans le quiz, alors
  // qu'un enfant y voit spontanément un adjectif / un verbe.
  const cas: [string, string][] = [
    ['bonne', 'nom (une bonne) et adjectif (féminin de bon)'],
    ['revient', 'verbe (il revient) et nom (prix de revient)'],
    ['paysan', 'nom et adjectif'],
    ['grand', 'nom et adjectif'],
    ['pouvoir', 'verbe et nom'],
  ]

  it.each(cas)('%s est détecté comme ambigu (%s)', (mot) => {
    expect(ambigus.has(mot)).toBe(true)
  })

  it.each(cas)('%s n\'est jamais proposé dans le quiz de grammaire', (mot) => {
    expect(vivierGrammaire.some((e) => e.word.toLowerCase() === mot)).toBe(false)
  })

  // Ces modes n'interrogent pas la nature du mot, mais l'affichent à côté :
  // une étiquette arbitraire reste trompeuse (signalé à l'usage).
  it.each(cas)('%s n\'est jamais proposé en QCM/reconstitution non plus', (mot) => {
    expect(vivierQcm.some((e) => e.word.toLowerCase() === mot)).toBe(false)
  })
})

describe('homographes fantômes (erreurs de corpus, pas de vraies doubles natures)', () => {
  it("rocher n'existe pas comme verbe dans le lexique", () => {
    expect(lexique.some((e) => e.lemmaId === 'verbe:rocher')).toBe(false)
  })

  // Ces mots-outils sont étiquetés "adjectif" à tort par Lexique383. Les
  // entrées restent dans le lexique brut (on ne réécrit pas le corpus) mais
  // la liste noire du clavier doit les écarter partout : sans ça, le quiz
  // afficherait "il" ou "quoi" avec la mascotte ADJECTIF.
  it.each(['il', 'quoi', 'ici', 'personne', 'souris'])('%s (faux adjectif) est écarté du quiz', (mot) => {
    expect(LEMMA_IDS_HOMOGRAPHES_FANTOMES.has(`adjectif:${mot}`)).toBe(true)
    expect(vivierQcm.some((e) => e.word === mot)).toBe(false)
    expect(vivierGrammaire.some((e) => e.word === mot)).toBe(false)
  })
})

describe('pictogrammes retirés parce que trompeurs', () => {
  // Le matching automatique ARASAAC avait associé une image sans rapport :
  // un casse-croûte pour "cas", "façonner de la pâte" pour "façon".
  it.each(['façon', 'cas'])('%s n\'a plus de pictogramme', (mot) => {
    expect((wordPictos as Record<string, string>)[mot]).toBeUndefined()
  })
})

describe('natures du quiz de grammaire', () => {
  it("« invariable » n'est jamais une réponse proposée (c'est une propriété, pas une nature)", () => {
    expect(CATEGORIES_GRAMMAIRE).not.toContain('invariable')
  })

  it('pronoms personnels et prépositions sont bien reconnus', () => {
    expect(natureGrammaireDe({ word: 'nous', category: 'invariable' })).toBe('pronom')
    expect(natureGrammaireDe({ word: 'avec', category: 'invariable' })).toBe('preposition')
  })

  it("un invariable de nature inconnue (conjonction) est écarté, pas deviné", () => {
    expect(natureGrammaireDe({ word: 'mais', category: 'invariable' })).toBeNull()
    expect(vivierGrammaire.some((e) => e.word === 'mais')).toBe(false)
  })

  it('le vivier contient bien au moins un pronom et une préposition', () => {
    const natures = new Set(vivierGrammaire.map((e) => natureGrammaireDe(e)))
    expect(natures.has('pronom')).toBe(true)
    expect(natures.has('preposition')).toBe(true)
  })

  it('tout mot du vivier a une nature déterminable (aucun ne sera écarté au tirage)', () => {
    expect(vivierGrammaire.every((e) => natureGrammaireDe(e) !== null)).toBe(true)
  })
})

describe('taille et équilibre du vivier', () => {
  // Signalé à l'usage : un vivier trop petit fait tourner les mêmes mots
  // quand un élève enchaîne les parties. ~1000 mots utilisables est la
  // taille visée après filtrage des ambigus (~45% du brut).
  it('laisse assez de mots utilisables pour éviter les répétitions', () => {
    expect(vivierQcm.length).toBeGreaterThan(800)
    expect(vivierGrammaire.length).toBeGreaterThan(800)
  })

  it('une session de 10 questions couvre au moins 4 natures différentes', () => {
    const tirage = equilibrerParNature(vivierGrammaire, 10)
    expect(tirage).toHaveLength(10)
    expect(new Set(tirage.map((t) => t.nature)).size).toBeGreaterThanOrEqual(4)
  })

  it('la nature attendue correspond toujours au mot tiré', () => {
    for (const { entree, nature } of equilibrerParNature(vivierGrammaire, 10)) {
      expect(nature).toBe(natureGrammaireDe(entree))
    }
  })
})

describe('listes blanches pronoms/prépositions', () => {
  // Ces mots servent de bonnes réponses au quiz : si l'un d'eux devenait
  // ambigu (nouvelle version du lexique), il disparaîtrait silencieusement
  // du vivier - ce test rend la perte visible.
  it.each(['nous', 'vous', 'elle', 'eux', 'dans', 'avec', 'chez', 'sans'])(
    '%s reste utilisable comme bonne réponse',
    (mot) => {
      expect(natureInvariable(mot)).not.toBeNull()
      expect(ambigus.has(mot)).toBe(false)
    },
  )
})
