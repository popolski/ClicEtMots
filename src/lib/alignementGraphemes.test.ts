import { describe, expect, it } from 'vitest'
import { decomposerMot } from './alignementGraphemes'
import { phonemes } from './phonemes'

describe('decomposerMot', () => {
  it('sépare une lettre muette finale', () => {
    const r = decomposerMot('chat', ['ch', 'a'], phonemes)
    expect(r.segments).toEqual([
      { phonemeId: 'ch', grapheme: 'ch', muetteAvant: '' },
      { phonemeId: 'a', grapheme: 'a', muetteAvant: '' },
    ])
    expect(r.muettes).toBe('t')
  })

  it('choisit la bonne graphie parmi plusieurs possibles pour le son [o]', () => {
    expect(decomposerMot('beau', ['b', 'o'], phonemes).segments).toContainEqual({ phonemeId: 'o', grapheme: 'eau', muetteAvant: '' })
    expect(decomposerMot('seau', ['s', 'o'], phonemes).segments).toContainEqual({ phonemeId: 'o', grapheme: 'eau', muetteAvant: '' })
  })

  it('applique la règle du m/b/p sans logique dédiée (juste par correspondance littérale)', () => {
    const r = decomposerMot('jambe', ['j', 'an', 'b'], phonemes)
    expect(r.segments).toEqual([
      { phonemeId: 'j', grapheme: 'j', muetteAvant: '' },
      { phonemeId: 'an', grapheme: 'am', muetteAvant: '' },
      { phonemeId: 'b', grapheme: 'b', muetteAvant: '' },
    ])
    expect(r.muettes).toBe('e')
  })

  it('retrouve une graphie non triviale pour un son ([e] écrit "ai" dans maison)', () => {
    const r = decomposerMot('maison', ['m', 'e', 'z', 'on'], phonemes)
    expect(r.segments).toEqual([
      { phonemeId: 'm', grapheme: 'm', muetteAvant: '' },
      { phonemeId: 'e', grapheme: 'ai', muetteAvant: '' },
      { phonemeId: 'z', grapheme: 's', muetteAvant: '' },
      { phonemeId: 'on', grapheme: 'on', muetteAvant: '' },
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

  it('reconnaît les lettres muettes en début et en milieu de mot', () => {
    // Bug de production : le "h" muet initial de "hiver" décalait toute la
    // découpe, et la fiche affichait [i]->h, [v]->i, [é è]->v. La découpe a
    // d'abord appris à se taire, puis à modéliser ces muettes-là.
    const hiver = decomposerMot('hiver', ['i', 'v', 'e', 'r'], phonemes)
    expect(hiver.fiable).toBe(true)
    expect(hiver.segments.map((s) => s.muetteAvant + s.grapheme)).toEqual(['hi', 'v', 'e', 'r'])
    expect(hiver.segments[0].muetteAvant).toBe('h')

    // Muette au milieu, et pas seulement au début.
    const compte = decomposerMot('compte', ['c', 'on', 't'], phonemes)
    expect(compte.segments.map((s) => s.muetteAvant + s.grapheme)).toEqual(['c', 'om', 'pt'])
    expect(compte.segments[2].muetteAvant).toBe('p')
    expect(compte.muettes).toBe('e')
  })

  it("n'invente pas de muette là où une graphie manque simplement à la table", () => {
    // Garde-fou : la recherche de muettes pourrait masquer n'importe quelle
    // graphie inconnue en la déclarant silencieuse. Les voyelles autres que
    // "e" et le "l" en sont donc exclues - sans ça, "oeil" devenait
    // "(o) + e + il", enseignant que le "o" ne se prononce pas.
    const oeil = decomposerMot('oeil', ['eu', 'ill'], phonemes)
    expect(oeil.segments[0].muetteAvant).toBe('')
    expect(oeil.segments[0].grapheme).toBe('oe')

    // "femme" reste non fiable : son "e" fait le son [a], une correspondance
    // qu'aucune muette ne peut expliquer. On préfère toujours ne rien montrer.
    expect(decomposerMot('femme', ['f', 'a', 'm'], phonemes).fiable).toBe(false)
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

  it('reconnaît les consonnes doubles', () => {
    // Elles manquaient à la table : sur "bonne", [n] prenait un seul "n" et
    // laissait "ne" en muet, alors que seul le "e" l'est. Sur un mot long
    // comme "tyrannosaure" (ajouté à la main par l'enseignante), le décalage
    // se propageait et affichait [o]->n, [z]->o, [o]->s, [r]->a.
    const bonne = decomposerMot('bonne', ['b', 'o', 'n'], phonemes)
    expect(bonne.segments.map((s) => s.grapheme)).toEqual(['b', 'o', 'nn'])
    expect(bonne.muettes).toBe('e')

    const tyranno = decomposerMot('tyrannosaure', ['t', 'i', 'r', 'a', 'n', 'o', 'z', 'o', 'r'], phonemes)
    expect(tyranno.segments.map((s) => s.grapheme)).toEqual(['t', 'y', 'r', 'a', 'nn', 'o', 's', 'au', 'r'])
    expect(tyranno.muettes).toBe('e')
    expect(tyranno.fiable).toBe(true)

    for (const [mot, sons] of [
      ['pomme', ['p', 'o', 'm']],
      ['belle', ['b', 'e', 'l']],
      ['patte', ['p', 'a', 't']],
      ['panne', ['p', 'a', 'n']],
    ] as [string, string[]][]) {
      expect(decomposerMot(mot, sons, phonemes).muettes).toBe('e')
    }
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
    expect(r.segments).toEqual([{ phonemeId: 'inconnu', grapheme: 'x', muetteAvant: '' }])
    expect(r.muettes).toBe('yz')
  })
})
