import { describe, expect, it } from 'vitest'
import { decomposerMot } from './alignementGraphemes'
import { phonemes } from './phonemes'

describe('decomposerMot', () => {
  it('sépare une lettre muette finale', () => {
    const r = decomposerMot('chat', ['ch', 'a'], phonemes)
    expect(r.segments).toEqual([
      { phonemeId: 'ch', grapheme: 'ch' },
      { phonemeId: 'a', grapheme: 'a' },
    ])
    expect(r.muettes).toBe('t')
  })

  it('choisit la bonne graphie parmi plusieurs possibles pour le son [o]', () => {
    expect(decomposerMot('beau', ['b', 'o'], phonemes).segments).toContainEqual({ phonemeId: 'o', grapheme: 'eau' })
    expect(decomposerMot('seau', ['s', 'o'], phonemes).segments).toContainEqual({ phonemeId: 'o', grapheme: 'eau' })
  })

  it('applique la règle du m/b/p sans logique dédiée (juste par correspondance littérale)', () => {
    const r = decomposerMot('jambe', ['j', 'an', 'b'], phonemes)
    expect(r.segments).toEqual([
      { phonemeId: 'j', grapheme: 'j' },
      { phonemeId: 'an', grapheme: 'am' },
      { phonemeId: 'b', grapheme: 'b' },
    ])
    expect(r.muettes).toBe('e')
  })

  it('retrouve une graphie non triviale pour un son ([e] écrit "ai" dans maison)', () => {
    const r = decomposerMot('maison', ['m', 'e', 'z', 'on'], phonemes)
    expect(r.segments).toEqual([
      { phonemeId: 'm', grapheme: 'm' },
      { phonemeId: 'e', grapheme: 'ai' },
      { phonemeId: 'z', grapheme: 's' },
      { phonemeId: 'on', grapheme: 'on' },
    ])
    expect(r.muettes).toBe('')
  })

  it("consomme tout le mot sans reste quand il n'y a pas de lettre muette", () => {
    const r = decomposerMot('oiseau', ['oi', 'z', 'o'], phonemes)
    expect(r.muettes).toBe('')
    expect(r.segments.map((s) => s.grapheme).join('')).toBe('oiseau')
  })

  it('avance quand même sans planter si un son est absent de la table (mot ajouté avec données inattendues)', () => {
    const r = decomposerMot('xyz', ['inconnu'], phonemes)
    expect(r.segments).toEqual([{ phonemeId: 'inconnu', grapheme: 'x' }])
    expect(r.muettes).toBe('yz')
  })
})
