import type { PhonemeId, WordEntry } from '../../types/phonetics'

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
