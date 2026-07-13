import type { WordEntry } from '../../../types/phonetics'

/**
 * Placeholder word list for the Phase 1 prototype only — NOT the final
 * Lexique383-derived lexicon (see the project plan, Phase 2). Phoneme
 * sequences use the real 33-tile ID space from `src/data/phonemes.json`.
 */
export const sampleWords: WordEntry[] = [
  { word: 'chat', phonemes: ['ch', 'a'], frequency: 100, level: 1, category: 'nom' },
  { word: 'chats', phonemes: ['ch', 'a'], frequency: 40, level: 1, category: 'nom' },
  { word: 'chien', phonemes: ['ch', 'i', 'in'], frequency: 95, level: 1, category: 'nom' },
  { word: 'papa', phonemes: ['p', 'a', 'p', 'a'], frequency: 90, level: 1, category: 'nom' },
  { word: 'maman', phonemes: ['m', 'a', 'm', 'an'], frequency: 90, level: 1, category: 'nom' },
  { word: 'moto', phonemes: ['m', 'o', 't', 'o'], frequency: 60, level: 1, category: 'nom' },
  { word: 'vélo', phonemes: ['v', 'e', 'l', 'o'], frequency: 65, level: 1, category: 'nom' },
  { word: 'école', phonemes: ['e', 'c', 'o', 'l'], frequency: 85, level: 1, category: 'nom' },
  { word: 'ballon', phonemes: ['b', 'a', 'l', 'on'], frequency: 70, level: 1, category: 'nom' },
  { word: 'ballons', phonemes: ['b', 'a', 'l', 'on'], frequency: 30, level: 1, category: 'nom' },
  { word: 'bateau', phonemes: ['b', 'a', 't', 'o'], frequency: 55, level: 1, category: 'nom' },
  { word: 'oiseau', phonemes: ['oi', 'z', 'o'], frequency: 50, level: 1, category: 'nom' },
  { word: 'souris', phonemes: ['s', 'ou', 'r', 'i'], frequency: 45, level: 1, category: 'nom' },
  { word: 'tortue', phonemes: ['t', 'o', 'r', 't', 'u'], frequency: 40, level: 1, category: 'nom' },
  { word: 'lion', phonemes: ['l', 'i', 'on'], frequency: 50, level: 1, category: 'nom' },
  { word: 'lions', phonemes: ['l', 'i', 'on'], frequency: 20, level: 1, category: 'nom' },
  { word: 'poisson', phonemes: ['p', 'oi', 's', 'on'], frequency: 55, level: 1, category: 'nom' },
  { word: 'poissons', phonemes: ['p', 'oi', 's', 'on'], frequency: 25, level: 1, category: 'nom' },
  { word: 'table', phonemes: ['t', 'a', 'b', 'l'], frequency: 60, level: 1, category: 'nom' },
  { word: 'robot', phonemes: ['r', 'o', 'b', 'o'], frequency: 45, level: 1, category: 'nom' },
  { word: 'fille', phonemes: ['f', 'ill'], frequency: 65, level: 1, category: 'nom' },
  { word: 'maison', phonemes: ['m', 'e', 'z', 'on'], frequency: 75, level: 1, category: 'nom' },
  { word: 'maisons', phonemes: ['m', 'e', 'z', 'on'], frequency: 25, level: 1, category: 'nom' },
  { word: 'gâteau', phonemes: ['g', 'a', 't', 'o'], frequency: 55, level: 1, category: 'nom' },
  { word: 'soleil', phonemes: ['s', 'o', 'l', 'ill'], frequency: 50, level: 1, category: 'nom' },
  { word: 'lapin', phonemes: ['l', 'a', 'p', 'in'], frequency: 50, level: 1, category: 'nom' },
  { word: 'nid', phonemes: ['n', 'i'], frequency: 20, level: 1, category: 'nom' },
  { word: 'domino', phonemes: ['d', 'o', 'm', 'i', 'n', 'o'], frequency: 15, level: 1, category: 'nom' },
  { word: 'fleur', phonemes: ['f', 'l', 'eu', 'r'], frequency: 40, level: 1, category: 'nom' },
  { word: 'fleurs', phonemes: ['f', 'l', 'eu', 'r'], frequency: 20, level: 1, category: 'nom' },
  { word: 'montagne', phonemes: ['m', 'on', 't', 'a', 'gn'], frequency: 30, level: 1, category: 'nom' },
  { word: 'petit', phonemes: ['p', 'eu', 't', 'i'], frequency: 60, level: 1, category: 'adjectif' },
  { word: 'petite', phonemes: ['p', 'eu', 't', 'i', 't'], frequency: 55, level: 1, category: 'adjectif' },
  { word: 'joli', phonemes: ['j', 'o', 'l', 'i'], frequency: 45, level: 1, category: 'adjectif' },
  { word: 'jolie', phonemes: ['j', 'o', 'l', 'i'], frequency: 40, level: 1, category: 'adjectif' },
  { word: 'manger', phonemes: ['m', 'an', 'j', 'e'], frequency: 50, level: 1, category: 'verbe' },
  { word: 'sauter', phonemes: ['s', 'o', 't', 'e'], frequency: 35, level: 1, category: 'verbe' },
  { word: 'avec', phonemes: ['a', 'v', 'e', 'c'], frequency: 65, level: 1, category: 'invariable' },
]
