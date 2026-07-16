import { describe, expect, it, vi, beforeEach } from 'vitest'

// Le vrai lexique fait ~8 Mo : on le remplace par deux entrées, seule la
// fusion avec les mots ajoutés par l'enseignante est testée ici.
vi.mock('../data/words-clavier2.json', () => ({
  default: [
    {
      word: 'chat',
      phonemes: ['ch', 'a'],
      frequency: 80,
      level: 1,
      category: 'nom',
      lemmaId: 'nom:chat',
      formRole: 'singulier',
      genre: 'm',
    },
  ],
}))

const listLexicon = vi.fn()
vi.mock('./api', () => ({ api: { listLexicon: () => listLexicon() } }))

describe('loadWordIndex : fusion des mots ajoutés par l’enseignante', () => {
  beforeEach(() => {
    // loadWordIndex met son résultat en cache dans un module-level `cached` :
    // sans reset, le 2e test relirait le résultat du 1er.
    vi.resetModules()
    listLexicon.mockReset()
  })

  it('ajoute les mots de la base au lexique statique', async () => {
    listLexicon.mockResolvedValue({
      words: [{ id: 1, mot: 'wapiti', categorie: 'nom', phonemes: ['w', 'a', 'p', 'i', 't', 'i'], genre: 'm' }],
    })
    const { loadWordIndex } = await import('./wordIndex')
    const words = await loadWordIndex()

    expect(words).toHaveLength(2)
    const ajoute = words.find((w) => w.word === 'wapiti')!
    expect(ajoute.lemmaId).toBe('ajout:nom:wapiti')
    expect(ajoute.formRole).toBe('singulier') // rôle de base d'un nom (BASE_ROLE)
    expect(ajoute.genre).toBe('m')
  })

  it("garde le lexique statique utilisable si l'API est injoignable", async () => {
    listLexicon.mockRejectedValue(new Error('hors ligne'))
    const { loadWordIndex } = await import('./wordIndex')
    const words = await loadWordIndex()

    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('chat')
  })

  it('déclare un verbe ajouté à l’infinitif, sans genre', async () => {
    listLexicon.mockResolvedValue({
      words: [{ id: 2, mot: 'zoomer', categorie: 'verbe', phonemes: ['z', 'ou', 'm', 'e'], genre: null }],
    })
    const { loadWordIndex } = await import('./wordIndex')
    const words = await loadWordIndex()

    const verbe = words.find((w) => w.word === 'zoomer')!
    expect(verbe.formRole).toBe('infinitif')
    expect(verbe.genre).toBeUndefined()
  })

  it('un adjectif sans forme féminine saisie ne donne qu’une seule entrée', async () => {
    listLexicon.mockResolvedValue({
      words: [{ id: 3, mot: 'zarbi', categorie: 'adjectif', phonemes: ['z', 'a', 'r', 'b', 'i'], genre: null }],
    })
    const { loadWordIndex } = await import('./wordIndex')
    const words = await loadWordIndex()

    expect(words.filter((w) => w.lemmaId === 'ajout:adjectif:zarbi')).toHaveLength(1)
  })

  it('un adjectif avec forme féminine saisie donne 2 entrées partageant le même lemmaId', async () => {
    listLexicon.mockResolvedValue({
      words: [
        {
          id: 4,
          mot: 'zarbi',
          categorie: 'adjectif',
          phonemes: ['z', 'a', 'r', 'b', 'i'],
          genre: null,
          feminin_mot: 'zarbie',
          feminin_phonemes: ['z', 'a', 'r', 'b', 'i'],
        },
      ],
    })
    const { loadWordIndex } = await import('./wordIndex')
    const words = await loadWordIndex()

    const formes = words.filter((w) => w.lemmaId === 'ajout:adjectif:zarbi')
    expect(formes).toHaveLength(2)
    expect(formes.map((f) => [f.word, f.formRole])).toEqual([
      ['zarbi', 'masculin'],
      ['zarbie', 'féminin'],
    ])
  })
})
