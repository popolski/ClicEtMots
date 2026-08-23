import { describe, expect, it } from 'vitest'
import { agregerParMode } from './bilanLogic'
import type { ResultatQuiz } from './api'

function resultat(mode: ResultatQuiz['mode'], score: number, total: number): ResultatQuiz {
  return { mode, score, total, termineLe: '2026-08-23T10:00:00Z' }
}

describe('agregerParMode', () => {
  it("n'affiche que les modes réellement joués", () => {
    const bilan = agregerParMode([resultat('qcm', 8, 10)])
    expect(bilan.map((b) => b.mode)).toEqual(['qcm'])
  })

  it('renvoie un bilan vide pour aucun résultat', () => {
    expect(agregerParMode([])).toEqual([])
  })

  it('compte le nombre de séances et la moyenne des scores', () => {
    const bilan = agregerParMode([resultat('qcm', 10, 10), resultat('qcm', 5, 10)])
    expect(bilan[0].nbSeances).toBe(2)
    expect(bilan[0].scoreMoyenPct).toBe(75)
  })

  it('compte les médailles selon les mêmes règles que le quiz (badgePour)', () => {
    // 10/10 = or, 7/10 = argent, 5/10 = bronze, 1/2 = aucune (moins de 5 questions).
    const bilan = agregerParMode([
      resultat('qcm', 10, 10),
      resultat('qcm', 7, 10),
      resultat('qcm', 5, 10),
      resultat('qcm', 1, 2),
    ])
    expect(bilan[0].medailles).toEqual({ or: 1, argent: 1, bronze: 1 })
  })

  it('sépare les modes les uns des autres', () => {
    const bilan = agregerParMode([resultat('qcm', 10, 10), resultat('dictee', 3, 10)])
    const parMode = new Map(bilan.map((b) => [b.mode, b]))
    expect(parMode.get('qcm')?.scoreMoyenPct).toBe(100)
    expect(parMode.get('dictee')?.scoreMoyenPct).toBe(30)
  })

  it('ne divise jamais par zéro sur un total à 0', () => {
    expect(() => agregerParMode([resultat('qcm', 0, 0)])).not.toThrow()
  })
})
