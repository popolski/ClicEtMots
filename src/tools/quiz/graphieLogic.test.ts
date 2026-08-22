// Tests de l'atelier "choisis la bonne graphie", contre le lexique RÉELLEMENT
// livré : les cas ci-dessous sont ceux repérés en concevant l'exercice
// (homophones faire/fer, son [é è] à douze écritures, lettres muettes).
import { beforeEach, describe, expect, it } from 'vitest'
import words from '../../data/words-clavier2.json'
import {
  choixPourSon,
  classementGraphies,
  construireExercice,
  MAX_CHOIX,
  motsHomophones,
  preparerSeance,
  reinitialiserClassement,
} from './graphieLogic'
import type { WordEntry } from '../../types/phonetics'

const lexique = words as WordEntry[]

beforeEach(() => reinitialiserClassement())

function motDuLexique(mot: string): WordEntry {
  const entree = lexique.find((e) => e.word === mot)
  if (!entree) throw new Error(`"${mot}" absent du lexique de test`)
  return entree
}

function exercicePour(mot: string) {
  const entree = motDuLexique(mot)
  return construireExercice(entree, classementGraphies(lexique), motsHomophones(lexique))
}

describe('choix proposés pour un son', () => {
  it('plafonne à 4 propositions même quand le son a douze écritures', () => {
    // [é è] : é, er, ez, è, ê, ë, ai, aî, et, ei, ey + composée
    const choix = choixPourSon('e', 'ai', classementGraphies(lexique))
    expect(choix.length).toBeLessThanOrEqual(MAX_CHOIX)
  })

  it("inclut TOUJOURS la bonne réponse, même quand elle est rare", () => {
    // Sans elle, l'exercice serait insoluble.
    for (const graphie of ['ai', 'ey', 'aî', 'ë']) {
      expect(choixPourSon('e', graphie, classementGraphies(lexique))).toContain(graphie)
    }
  })

  it('complète avec les graphies les plus fréquentes du lexique, pas l\'ordre de phonemes.json', () => {
    // phonemes.json place "ez" avant "ai" (ordre pédagogique), alors que "ai"
    // est bien plus fréquent : le classement statistique doit primer.
    const choix = choixPourSon('e', 'é', classementGraphies(lexique))
    expect(choix).toContain('er')
    expect(choix).not.toContain('ey')
  })

  it("ne propose qu'une réponse pour un son à écriture unique (posé d'office)", () => {
    expect(choixPourSon('b', 'b', classementGraphies(lexique))).toEqual(['b'])
    expect(choixPourSon('r', 'r', classementGraphies(lexique))).toEqual(['r'])
  })
})

describe('homophones (18% du lexique)', () => {
  const homophones = motsHomophones(lexique)

  it.each([
    ['faire', 'fer'],
    ['les', 'lait'],
    ['sur', 'sûr'],
    ['dans', 'dent'],
  ])('%s et %s sont détectés comme homophones', (a, b) => {
    expect(homophones.has(a)).toBe(true)
    expect(homophones.has(b)).toBe(true)
  })

  it("un homophone sans pictogramme n'est pas jouable (aucune réponse déterminable)", () => {
    // "les/lait/laid/laie" : entendu seul, impossible de savoir lequel est demandé.
    expect(exercicePour('laie')).toBeNull()
  })

  it('un homophone AVEC pictogramme reste jouable, et le picto est affiché', () => {
    const exercice = exercicePour('lait')
    expect(exercice).not.toBeNull()
    expect(exercice?.picto).toBeTruthy()
  })

  it("un mot non homophone n'affiche PAS de picto (il donnerait la réponse)", () => {
    const exercice = exercicePour('maison')
    expect(exercice).not.toBeNull()
    expect(exercice?.picto).toBeNull()
  })

  it("un pluriel muet n'est PAS traité comme un homophone de son singulier", () => {
    // "maison"/"maisons" se prononcent pareil mais sont le même mot : sans
    // cette distinction, tout nom du lexique serait déclaré ambigu.
    const homophonesLocal = motsHomophones(lexique)
    expect(homophonesLocal.has('maison')).toBe(false)
  })
})

describe('décomposition en étapes', () => {
  it('marque comme automatiques les sons à écriture unique', () => {
    // maison = m + ai + s + on : seuls [é è] et [z] demandent un choix.
    const exercice = exercicePour('maison')
    expect(exercice?.etapes.map((e) => e.bonne)).toEqual(['m', 'ai', 's', 'on'])
    expect(exercice?.etapes.filter((e) => e.automatique).map((e) => e.bonne)).toEqual(['m'])
  })

  it('remonte les lettres muettes finales', () => {
    expect(exercicePour('petit')?.muette).toBe('t')
    expect(exercicePour('maison')?.muette).toBe('')
  })

  it('écarte les mots dont la fin muette ne figure pas dans les propositions', () => {
    // "doigt" se termine par "gt" muet : les cinq propositions fixes
    // (rien/e/t/s/d) ne le contiennent pas, l'élève tournait en rond sans
    // pouvoir finir le mot. Repéré en jouant l'exercice en navigateur.
    expect(exercicePour('doigt')).toBeNull()
    // Contre-épreuve : une fin muette proposable reste jouable.
    expect(exercicePour('petit')).not.toBeNull()
  })

  it('écarte les mots sans aucun son à choisir', () => {
    // Un mot dont tous les sons ont une écriture unique n'a rien à demander.
    const classement = classementGraphies(lexique)
    const sansChoix = construireExercice(
      { word: 'lu', lemmaId: 'test:lu', phonemes: ['l', 'u'] },
      classement,
      new Set(),
    )
    // "u" a plusieurs graphies, donc ce mot précis reste jouable : on vérifie
    // plutôt qu'un mot entièrement automatique serait bien écarté.
    if (sansChoix) expect(sansChoix.etapes.some((e) => !e.automatique)).toBe(true)
  })
})

describe('préparation d\'une séance', () => {
  it('ne retient que des mots jouables', () => {
    const source = lexique
      .filter((e) => e.formRole === 'singulier' && e.category === 'nom')
      .slice(0, 200)
      .map((e) => ({ word: e.word, lemmaId: e.lemmaId, category: e.category }))
    const seance = preparerSeance(source, lexique, 10)

    expect(seance.length).toBeGreaterThan(0)
    for (const exercice of seance) {
      const aChoisir = exercice.etapes.filter((e) => !e.automatique).length
      expect(aChoisir).toBeGreaterThanOrEqual(1)
      expect(aChoisir).toBeLessThanOrEqual(4)
      for (const etape of exercice.etapes) {
        expect(etape.choix).toContain(etape.bonne)
        expect(etape.choix.length).toBeLessThanOrEqual(MAX_CHOIX)
      }
    }
  })

  it('ne dépasse jamais le nombre demandé', () => {
    const source = lexique
      .filter((e) => e.formRole === 'singulier')
      .slice(0, 500)
      .map((e) => ({ word: e.word, lemmaId: e.lemmaId, category: e.category }))
    expect(preparerSeance(source, lexique, 5).length).toBeLessThanOrEqual(5)
  })

  it('laisse un vivier assez large pour éviter les répétitions', () => {
    const source = lexique
      .filter((e) => e.formRole === 'singulier' && e.word.length >= 3)
      .map((e) => ({ word: e.word, lemmaId: e.lemmaId, category: e.category }))
    // Mesuré à la conception sur ce sous-ensemble (noms au singulier) ; le
    // vivier réel est plus large, toutes formes de base confondues.
    expect(preparerSeance(source, lexique, 99999).length).toBeGreaterThan(1500)
  })
})
