import { describe, expect, it } from 'vitest'
import { agregerParMode } from './bilanLogic'
import type { ResultatQuiz } from './api'

function resultat(
  mode: ResultatQuiz['mode'],
  score: number,
  total: number,
  premierCoup: number | null = score,
  aideUtilisee: number | null = 0,
  dureeSecondes: number | null = null,
): ResultatQuiz {
  return { mode, score, total, premierCoup, aideUtilisee, dureeSecondes, termineLe: '2026-08-23T10:00:00Z' }
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
    // 10/10 = or, 7/10 = argent, 5/10 = bronze - même niveau (10), donc
    // regroupées dans la même ligne.
    const bilan = agregerParMode([resultat('qcm', 10, 10), resultat('qcm', 7, 10), resultat('qcm', 5, 10)])
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

  describe('niveaux (nombre de mots choisi au lancement)', () => {
    // Dictée et "Recomposer le mot" ont plusieurs niveaux possibles
    // (NIVEAUX_SEANCE dans QuizTool) : une dictée à 5 mots et une à 20 mots
    // ne doivent pas se retrouver moyennées dans la même ligne, sans quoi
    // un 5/5 et un 10/20 donneraient l'illusion trompeuse d'un même exercice.
    it('sépare les séances de niveaux différents dans le même mode', () => {
      const bilan = agregerParMode([resultat('dictee', 5, 5), resultat('dictee', 10, 20)])
      expect(bilan).toHaveLength(2)
      const parNiveau = new Map(bilan.map((b) => [b.niveau, b]))
      expect(parNiveau.get(5)?.scoreMoyenPct).toBe(100)
      expect(parNiveau.get(5)?.nbSeances).toBe(1)
      expect(parNiveau.get(20)?.scoreMoyenPct).toBe(50)
      expect(parNiveau.get(20)?.nbSeances).toBe(1)
    })

    it('regroupe bien les séances du même niveau ensemble', () => {
      const bilan = agregerParMode([
        resultat('dictee', 10, 10),
        resultat('dictee', 8, 10),
        resultat('dictee', 15, 20),
      ])
      expect(bilan).toHaveLength(2)
      const parNiveau = new Map(bilan.map((b) => [b.niveau, b]))
      expect(parNiveau.get(10)?.nbSeances).toBe(2)
      expect(parNiveau.get(20)?.nbSeances).toBe(1)
    })

    it('trie les niveaux du plus petit au plus grand', () => {
      const bilan = agregerParMode([resultat('reconstitution', 5, 10), resultat('reconstitution', 4, 5)])
      expect(bilan.map((b) => b.niveau)).toEqual([5, 10])
    })

    it('un mode à taille fixe (QCM) ne produit qu\'une seule ligne', () => {
      const bilan = agregerParMode([resultat('qcm', 8, 10), resultat('qcm', 6, 10), resultat('qcm', 9, 10)])
      expect(bilan).toHaveLength(1)
      expect(bilan[0].niveau).toBe(10)
    })
  })

  describe('réussi du premier coup (schema-v11.sql)', () => {
    // Le score ne distingue pas un mot réussi au 1er essai d'un mot réussi
    // au 3e (dictée, recomposition) : c'est précisément ce que premierCoup
    // vient éclairer séparément, sans changer le score lui-même.
    it('calcule la part des bonnes réponses obtenues du premier coup', () => {
      // 8 bonnes réponses sur 10, dont seulement 5 du premier coup.
      const bilan = agregerParMode([resultat('dictee', 8, 10, 5)])
      expect(bilan[0].premierCoupPct).toBe(63) // 5/8, arrondi
    })

    it('vaut null pour une séance enregistrée avant la migration (premierCoup absent)', () => {
      const bilan = agregerParMode([resultat('dictee', 8, 10, null)])
      expect(bilan[0].premierCoupPct).toBeNull()
    })

    it('ignore les séances non mesurées plutôt que de fausser la moyenne', () => {
      // Une séance d'avant la migration (null) mélangée à une séance mesurée :
      // seule la seconde doit compter dans le calcul.
      const bilan = agregerParMode([resultat('dictee', 10, 10, null), resultat('dictee', 10, 10, 10)])
      expect(bilan[0].premierCoupPct).toBe(100)
    })

    it("vaut toujours 100% pour un mode à essai unique (QCM)", () => {
      const bilan = agregerParMode([resultat('qcm', 8, 10)])
      expect(bilan[0].premierCoupPct).toBe(100)
    })
  })

  describe('filet de secours de la dictée (schema-v12.sql)', () => {
    // Le filet peut être ouvert sur un mot ensuite réussi ou raté : sa
    // fréquence se rapporte au nombre total de mots de la séance, pas au
    // score (contrairement à premierCoupPct).
    it("calcule la part des mots où le filet a été ouvert", () => {
      // Ouvert sur 3 des 10 mots de la séance.
      const bilan = agregerParMode([resultat('dictee', 8, 10, 5, 3)])
      expect(bilan[0].aideUtiliseePct).toBe(30)
    })

    it('vaut null pour une séance enregistrée avant la migration (aideUtilisee absent)', () => {
      const bilan = agregerParMode([resultat('dictee', 8, 10, 5, null)])
      expect(bilan[0].aideUtiliseePct).toBeNull()
    })

    it('ignore les séances non mesurées plutôt que de fausser la moyenne', () => {
      const bilan = agregerParMode([resultat('dictee', 10, 10, 10, null), resultat('dictee', 10, 10, 10, 2)])
      expect(bilan[0].aideUtiliseePct).toBe(20)
    })

    it("vaut 0% quand le filet n'a jamais été ouvert plutôt que null", () => {
      // 0 est une vraie mesure ("jamais utilisé"), à ne pas confondre avec
      // l'absence de mesure (séance d'avant la migration).
      const bilan = agregerParMode([resultat('dictee', 10, 10, 10, 0)])
      expect(bilan[0].aideUtiliseePct).toBe(0)
    })
  })

  describe('durée moyenne (schema-v13.sql)', () => {
    it("calcule la durée moyenne des séances mesurées", () => {
      const bilan = agregerParMode([
        resultat('qcm', 10, 10, 10, 0, 120),
        resultat('qcm', 8, 10, 8, 0, 180),
      ])
      expect(bilan[0].dureeMoyenneSec).toBe(150)
    })

    it('vaut null quand aucune séance de ce groupe ne porte cette donnée', () => {
      const bilan = agregerParMode([resultat('qcm', 10, 10, 10, 0, null)])
      expect(bilan[0].dureeMoyenneSec).toBeNull()
    })

    it('ignore les séances non mesurées plutôt que de fausser la moyenne', () => {
      const bilan = agregerParMode([resultat('qcm', 10, 10, 10, 0, null), resultat('qcm', 10, 10, 10, 0, 100)])
      expect(bilan[0].dureeMoyenneSec).toBe(100)
    })
  })
})
