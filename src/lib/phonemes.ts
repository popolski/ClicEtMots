import type { PhonemeTable } from '../types/phonetics'
import phonemesData from '../data/phonemes.json'

/**
 * The 33 phoneme tiles, same order and grapheme groupings as the real Clavier
 * Métalo (traced from its official quick-start PDF) — not yet reviewed by a
 * teacher, so treat as a strong first draft rather than final Phase 2 content.
 */
export const phonemes: PhonemeTable = phonemesData as PhonemeTable
