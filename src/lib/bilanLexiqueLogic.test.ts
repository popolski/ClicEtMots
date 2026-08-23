import { describe, expect, it } from 'vitest'
import { agregerVocabulaire, listesDeLaPeriode } from './bilanLexiqueLogic'
import type { ListeMotsSemaine, MotDeListe } from './api'

function mot(word: string, category: MotDeListe['category'], lemmaId = `${category}:${word}`): MotDeListe {
  return { lemmaId, word, category }
}

function liste(id: number, updatedAt: string, mots: MotDeListe[]): ListeMotsSemaine {
  return { id, nom: `Semaine ${id}`, updatedAt, mots }
}

describe('listesDeLaPeriode', () => {
  const listes = [
    liste(1, '2026-08-01T10:00:00Z', []),
    liste(2, '2026-08-15T10:00:00Z', []),
    liste(3, '2026-09-01T10:00:00Z', []),
  ]

  it('ne garde que les listes dans la période, bornes incluses', () => {
    const r = listesDeLaPeriode(listes, new Date('2026-08-01T00:00:00Z'), new Date('2026-08-31T23:59:59Z'))
    expect(r.map((l) => l.id)).toEqual([1, 2])
  })

  it('inclut une liste enregistrée exactement à la date de début ou de fin', () => {
    const r = listesDeLaPeriode(listes, new Date('2026-08-01T10:00:00Z'), new Date('2026-09-01T10:00:00Z'))
    expect(r.map((l) => l.id)).toEqual([1, 2, 3])
  })

  it('renvoie vide si aucune liste ne tombe dans la période', () => {
    expect(listesDeLaPeriode(listes, new Date('2027-01-01'), new Date('2027-01-31'))).toEqual([])
  })
})

describe('agregerVocabulaire', () => {
  it('groupe les mots par nature grammaticale', () => {
    const bilan = agregerVocabulaire([liste(1, '2026-08-01', [mot('chat', 'nom'), mot('courir', 'verbe')])])
    const labels = bilan.parCategorie.map((g) => g.label)
    expect(labels).toEqual(['Noms', 'Verbes'])
  })

  it("ne compte un mot revu plusieurs semaines qu'une seule fois", () => {
    const bilan = agregerVocabulaire([
      liste(1, '2026-08-01', [mot('chat', 'nom')]),
      liste(2, '2026-08-08', [mot('chat', 'nom'), mot('chien', 'nom')]),
    ])
    expect(bilan.totalMots).toBe(2)
    expect(bilan.parCategorie[0].mots.map((m) => m.word)).toEqual(['chat', 'chien'])
  })

  it('trie les mots alphabétiquement dans chaque catégorie', () => {
    const bilan = agregerVocabulaire([liste(1, '2026-08-01', [mot('zèbre', 'nom'), mot('abeille', 'nom')])])
    expect(bilan.parCategorie[0].mots.map((m) => m.word)).toEqual(['abeille', 'zèbre'])
  })

  it("détaille les mots invariables en pronoms/prépositions/autres, comme le quiz de grammaire", () => {
    const bilan = agregerVocabulaire([
      liste(1, '2026-08-01', [mot('elle', 'invariable'), mot('avec', 'invariable'), mot('donc', 'invariable')]),
    ])
    const labels = bilan.parCategorie.map((g) => g.label)
    expect(labels).toEqual(['Pronoms personnels', 'Prépositions', 'Autres mots invariables'])
  })

  it('ne renvoie que les catégories réellement présentes', () => {
    const bilan = agregerVocabulaire([liste(1, '2026-08-01', [mot('chat', 'nom')])])
    expect(bilan.parCategorie).toHaveLength(1)
  })

  it('gère une agrégation vide sans erreur', () => {
    const bilan = agregerVocabulaire([])
    expect(bilan.totalMots).toBe(0)
    expect(bilan.parCategorie).toEqual([])
  })

  it('compte le nombre de listes agrégées', () => {
    const bilan = agregerVocabulaire([liste(1, '2026-08-01', []), liste(2, '2026-08-08', [])])
    expect(bilan.nbListes).toBe(2)
  })
})
