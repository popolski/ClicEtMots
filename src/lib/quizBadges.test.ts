import { describe, expect, it } from 'vitest'
import { badgePour, MIN_QUESTIONS_POUR_MEDAILLE } from './quizBadges'

describe('badgePour', () => {
  it('récompense selon le taux de réussite', () => {
    expect(badgePour(10, 10)).toBe('or')
    expect(badgePour(7, 10)).toBe('argent')
    expect(badgePour(5, 10)).toBe('bronze')
    expect(badgePour(4, 10)).toBeNull()
  })

  it("ne donne aucune médaille sur une séance écourtée", () => {
    // Signalé par Camille : une séance de graphie n'avait que 2 questions
    // (peu de mots jouables dans la liste de la semaine), et 1 bonne réponse
    // sur 2 décrochait une médaille de bronze. À ce format, la médaille
    // récompense le hasard.
    expect(badgePour(1, 2)).toBeNull()
    expect(badgePour(2, 2)).toBeNull()
    expect(badgePour(MIN_QUESTIONS_POUR_MEDAILLE, MIN_QUESTIONS_POUR_MEDAILLE)).toBe('or')
  })

  it('reste sans médaille sur un total absurde', () => {
    expect(badgePour(0, 0)).toBeNull()
    expect(badgePour(1, -1)).toBeNull()
  })
})
