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

  it('revient en arrière quand un premier choix condamne la suite', () => {
    // Sur "beau", prendre "e" pour [b]... non : le vrai cas est "seau", où le
    // son [o] doit prendre "eau" et non "o", sinon il reste "au" en trop.
    const r = decomposerMot('seau', ['s', 'o'], phonemes)
    expect(r.segments.map((s) => s.grapheme)).toEqual(['s', 'eau'])
    expect(r.muettes).toBe('')
    expect(r.fiable).toBe(true)
  })

  it('signale comme NON fiable une découpe où un son n\'a pas de graphie connue', () => {
    // Bug de production : le "h" muet initial de "hiver" décalait toute la
    // découpe, et la fiche affichait [i]->h, [v]->i, [é è]->v. Le drapeau
    // permet à l'affichage de se taire plutôt que de mentir. Aucune graphie
    // de [i] ne commence par "h", donc aucune découpe complète n'existe.
    expect(decomposerMot('hiver', ['i', 'v', 'e', 'r'], phonemes).fiable).toBe(false)
  })

  it('découpe "fer" correctement grâce au "e" simple et au retour arrière', () => {
    // Double correctif : "e" a été ajouté aux graphies de [é è] (il y manquait,
    // alors qu'il fait ce son dans fer/mer/sel/bec), et le retour arrière
    // empêche "er" d'avaler le [r] qui suit.
    const r = decomposerMot('fer', ['f', 'e', 'r'], phonemes)
    expect(r.segments.map((s) => s.grapheme)).toEqual(['f', 'e', 'r'])
    expect(r.fiable).toBe(true)
  })

  it('préfère toujours la graphie la plus longue quand elle permet une découpe complète', () => {
    // Le "e" simple ne doit pas voler la place de "ai"/"ei"/"et"/"er".
    expect(decomposerMot('maison', ['m', 'e', 'z', 'on'], phonemes).segments[1].grapheme).toBe('ai')
    expect(decomposerMot('nez', ['n', 'e'], phonemes).segments[1].grapheme).toBe('ez')
  })

  it('marque comme fiables les découpes correctes', () => {
    for (const [mot, sons] of [
      ['chat', ['ch', 'a']],
      ['maison', ['m', 'e', 'z', 'on']],
      ['jambe', ['j', 'an', 'b']],
    ] as [string, string[]][]) {
      expect(decomposerMot(mot, sons, phonemes).fiable).toBe(true)
    }
  })

  it('avance quand même sans planter si un son est absent de la table (mot ajouté avec données inattendues)', () => {
    const r = decomposerMot('xyz', ['inconnu'], phonemes)
    expect(r.segments).toEqual([{ phonemeId: 'inconnu', grapheme: 'x' }])
    expect(r.muettes).toBe('yz')
  })
})
