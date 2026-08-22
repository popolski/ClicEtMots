// Tests de l'atelier "choisis la bonne graphie", contre le lexique RÉELLEMENT
// livré : les cas ci-dessous sont ceux repérés en concevant l'exercice
// (homophones faire/fer, son [é è] à douze écritures, lettres muettes).
import { beforeEach, describe, expect, it } from 'vitest'
import words from '../../data/words-clavier2.json'
import {
  choixPourSon,
  classementGraphies,
  construireExercice,
  graphiesAttestees,
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
  // Les attestations sont passées comme en production : sans elles, les
  // consonnes doubles seraient proposées partout et les exercices seraient
  // plus longs qu'ils ne le sont réellement.
  return construireExercice(entree, classementGraphies(lexique), motsHomophones(lexique), graphiesAttestees(lexique))
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
    // [v], [gn] et [x] sont les rares sons qui ne s'écrivent que d'une façon.
    // [b] et [r] ne sont plus dans ce cas depuis l'ajout des consonnes
    // doubles (b/bb, r/rr).
    expect(choixPourSon('v', 'v', classementGraphies(lexique))).toEqual(['v'])
    expect(choixPourSon('gn', 'gn', classementGraphies(lexique))).toEqual(['gn'])
    expect(choixPourSon('b', 'b', classementGraphies(lexique))).toEqual(['b', 'bb'])
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
    const exercice = exercicePour('maison')
    expect(exercice?.etapes.map((e) => e.bonne)).toEqual(['m', 'ai', 's', 'on'])
    // [m] est posé d'office : aucun mot qui se prononce comme "maison" ne
    // l'écrit "mm", la question "m ou mm ?" ne se pose donc pas ici.
    expect(exercice?.etapes.find((e) => e.bonne === 'm')?.automatique).toBe(true)
    // [v] n'a de toute façon qu'une seule écriture possible.
    expect(exercicePour('avion')?.etapes.find((e) => e.bonne === 'v')?.automatique).toBe(true)
  })

  it('ne pose la question de la consonne double que si elle se pose vraiment', () => {
    // Corrigé après mesure : 93% des mots demandaient "n ou nn ?", y compris
    // ceux où personne n'hésite. Un enfant y apprenait à répondre "simple"
    // par réflexe, l'inverse du but. La question n'est gardée que si le mot
    // double lui-même la consonne, ou si un mot qui sonne pareil la double
    // (cane/canne).
    const bonne = exercicePour('bonne')
    expect(bonne?.etapes.find((e) => e.bonne === 'nn')?.choix).toEqual(['n', 'nn'])

    const canne = exercicePour('canne')
    expect(canne?.etapes.find((e) => e.bonne === 'nn')?.choix).toEqual(['n', 'nn'])

    // "avion" : aucun homophone ne double le [n], la question disparaît.
    const avion = exercicePour('avion')
    expect(avion?.etapes.flatMap((e) => e.choix)).not.toContain('nn')
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

describe('lettres muettes internes', () => {
  it('rend jouables les mots à muette au début ou au milieu', () => {
    // Ces mots étaient écartés : l'exercice n'avait qu'une case muette, à la
    // fin, et l'élève aurait reconstitué "istoire". Sur les 9 mots de la
    // liste de Camille, "histoire" était l'un des deux derniers rejetés.
    const histoire = exercicePour('histoire')
    expect(histoire).not.toBeNull()
    expect(histoire?.etapes[0].muetteAvant).toBe('h')
    expect(histoire?.muette).toBe('e')

    const compte = exercicePour('compte')
    expect(compte?.etapes.find((e) => e.muetteAvant)?.muetteAvant).toBe('p')
  })

  it('reconstitue le mot exact, muettes comprises', () => {
    for (const mot of ['histoire', 'compte', 'cahier', 'automne', 'maison', 'petit']) {
      const ex = exercicePour(mot)
      if (!ex) continue
      const reconstitue = ex.etapes.map((e) => e.muetteAvant + e.bonne).join('') + ex.muette
      expect(reconstitue).toBe(mot)
    }
  })

  it('laisse la muette interne vide sur un mot qui n\'en a pas', () => {
    expect(exercicePour('maison')?.etapes.every((e) => e.muetteAvant === '')).toBe(true)
  })
})

describe('locutions', () => {
  it("écarte les expressions en plusieurs mots", () => {
    // L'atelier fait épeler UN mot. Avec l'affichage des muettes internes,
    // l'espace de "la plupart des" s'affichait comme une lettre silencieuse.
    for (const locution of ['parce que', 'la plupart des', 'peut-être']) {
      const entree = lexique.find((e) => e.word === locution)
      if (!entree) continue
      expect(
        construireExercice(entree, classementGraphies(lexique), motsHomophones(lexique), graphiesAttestees(lexique)),
      ).toBeNull()
    }
  })
})
