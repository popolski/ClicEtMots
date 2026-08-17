import { beforeEach, describe, expect, it } from 'vitest'
import { verifierRotationAnneeScolaire } from './rotationAnneeScolaire'

// Environnement de test 'node' (voir vite.config.ts) : pas de localStorage
// réel, on simule le strict minimum utilisé par ce module.
function mockLocalStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (cle: string) => store.get(cle) ?? null,
    setItem: (cle: string, valeur: string) => void store.set(cle, valeur),
    removeItem: (cle: string) => void store.delete(cle),
  }
}

beforeEach(() => {
  // @ts-expect-error mock minimal, pas l'API Storage complète
  globalThis.localStorage = mockLocalStorage()
})

describe('verifierRotationAnneeScolaire', () => {
  it('ne purge rien au tout premier lancement (rien à purger)', () => {
    globalThis.localStorage.setItem('clicmots:historique', '[{"word":"chat"}]')
    verifierRotationAnneeScolaire(new Date('2025-10-01'))
    expect(globalThis.localStorage.getItem('clicmots:historique')).not.toBeNull()
    expect(globalThis.localStorage.getItem('clicmots:derniere-annee-scolaire')).toBe('2025-2026')
  })

  it('ne purge rien tant que la même année scolaire continue', () => {
    verifierRotationAnneeScolaire(new Date('2025-10-01')) // rentrée
    globalThis.localStorage.setItem('clicmots:historique', '[{"word":"chat"}]')
    verifierRotationAnneeScolaire(new Date('2026-05-01')) // même année scolaire (2025-2026)
    expect(globalThis.localStorage.getItem('clicmots:historique')).not.toBeNull()
  })

  it('purge historique/favoris/quiz au changement d\'année scolaire', () => {
    verifierRotationAnneeScolaire(new Date('2025-10-01')) // année 2025-2026
    globalThis.localStorage.setItem('clicmots:historique', '[{"word":"chat"}]')
    globalThis.localStorage.setItem('clicmots:favoris', '[{"word":"chien"}]')
    globalThis.localStorage.setItem('clicmots:quiz-historique', '[{"score":8}]')

    verifierRotationAnneeScolaire(new Date('2026-09-15')) // rentrée suivante, année 2026-2027

    expect(globalThis.localStorage.getItem('clicmots:historique')).toBeNull()
    expect(globalThis.localStorage.getItem('clicmots:favoris')).toBeNull()
    expect(globalThis.localStorage.getItem('clicmots:quiz-historique')).toBeNull()
    expect(globalThis.localStorage.getItem('clicmots:derniere-annee-scolaire')).toBe('2026-2027')
  })

  it('la rentrée est le 1er septembre : fin août = ancienne année, début septembre = nouvelle', () => {
    verifierRotationAnneeScolaire(new Date('2025-08-31'))
    expect(globalThis.localStorage.getItem('clicmots:derniere-annee-scolaire')).toBe('2024-2025')

    globalThis.localStorage.setItem('clicmots:historique', '[{"word":"chat"}]')
    verifierRotationAnneeScolaire(new Date('2025-09-01'))
    expect(globalThis.localStorage.getItem('clicmots:historique')).toBeNull()
    expect(globalThis.localStorage.getItem('clicmots:derniere-annee-scolaire')).toBe('2025-2026')
  })
})
