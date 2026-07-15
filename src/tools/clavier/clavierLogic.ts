import type { PhonemeId, WordCard, WordEntry, WordFormRole } from '../../types/phonetics'

export interface PhonemeTrieNode {
  children: Map<PhonemeId, PhonemeTrieNode>
  /** Words whose phoneme sequence ends exactly at this node. */
  words: WordEntry[]
}

function createNode(): PhonemeTrieNode {
  return { children: new Map(), words: [] }
}

export function buildPhonemeTrie(words: WordEntry[]): PhonemeTrieNode {
  const root = createNode()
  for (const entry of words) {
    let node = root
    for (const phonemeId of entry.phonemes) {
      let child = node.children.get(phonemeId)
      if (!child) {
        child = createNode()
        node.children.set(phonemeId, child)
      }
      node = child
    }
    node.words.push(entry)
  }
  return root
}

function walk(trie: PhonemeTrieNode, sequence: PhonemeId[]): PhonemeTrieNode | undefined {
  let node = trie
  for (const phonemeId of sequence) {
    const child = node.children.get(phonemeId)
    if (!child) return undefined
    node = child
  }
  return node
}

function collectWords(node: PhonemeTrieNode): WordEntry[] {
  const out: WordEntry[] = [...node.words]
  for (const child of node.children.values()) {
    out.push(...collectWords(child))
  }
  return out
}

/** All words whose phoneme sequence starts with `sequence`, most frequent first. */
export function getMatches(trie: PhonemeTrieNode, sequence: PhonemeId[], limit = 50): WordEntry[] {
  const node = walk(trie, sequence)
  if (!node) return []
  return collectWords(node)
    .sort((a, b) => b.frequency - a.frequency)
    .slice(0, limit)
}

/** Phonemes that can extend `sequence` into at least one known word. */
export function getViableNextPhonemes(trie: PhonemeTrieNode, sequence: PhonemeId[]): Set<PhonemeId> {
  const node = walk(trie, sequence)
  if (!node) return new Set()
  return new Set(node.children.keys())
}

// Forme "de base" par catégorie, affichée dans les résultats et utilisée
// comme clé de recherche des mots de la même famille (Démonette) — les
// autres formes (pluriel, féminin, participe passé) restent dans la fiche
// mot. Pour les noms, on préfère le masculin quand les deux genres existent
// (chat/chatte, renard/renarde) : c'est la forme "neutre" par défaut.
const BASE_ROLE: Record<string, WordFormRole> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

export function pickPrimaryForm(forms: WordEntry[]): WordEntry {
  const category = forms[0]?.category
  const baseRole = category ? BASE_ROLE[category] : undefined
  return (
    forms.find((f) => f.formRole === baseRole && f.genre !== 'f') ??
    forms.find((f) => f.formRole === baseRole) ??
    forms[0]
  )
}

const FORM_ROLE_ORDER: WordFormRole[] = [
  'simple',
  'singulier',
  'pluriel',
  'masculin',
  'féminin',
  'infinitif',
  'participe_passé',
  'il_elle_on',
  'ils_elles',
]

/**
 * Groups matched entries by word family (lemmaId) into cards, matching the
 * original tool's results page — one card per word, its inflected forms
 * shown together rather than as separate results.
 */
export function groupIntoCards(entries: WordEntry[]): WordCard[] {
  const byLemma = new Map<string, WordEntry[]>()
  for (const entry of entries) {
    const forms = byLemma.get(entry.lemmaId)
    if (forms) {
      if (!forms.some((f) => f.word === entry.word)) forms.push(entry)
    } else {
      byLemma.set(entry.lemmaId, [entry])
    }
  }

  const cards: WordCard[] = Array.from(byLemma.values()).map((forms) => ({
    lemmaId: forms[0].lemmaId,
    category: forms[0].category,
    forms: [...forms].sort((a, b) => FORM_ROLE_ORDER.indexOf(a.formRole) - FORM_ROLE_ORDER.indexOf(b.formRole)),
    frequency: Math.max(...forms.map((f) => f.frequency)),
  }))

  return cards.sort((a, b) => b.frequency - a.frequency)
}
