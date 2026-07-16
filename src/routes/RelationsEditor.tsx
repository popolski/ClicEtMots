import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { LexiconWord, RelationTarget, RelationType } from '../lib/api'
import { loadWordIndex } from '../lib/wordIndex'
import { lemmaIdAjout } from '../lib/addedLexicon'
import { pickPrimaryForm } from '../tools/clavier/clavierLogic'

const TYPES: { type: RelationType; label: string }[] = [
  { type: 'synonyme', label: 'Synonymes' },
  { type: 'antonyme', label: 'Contraires' },
  { type: 'famille', label: 'Mots de la même famille' },
]

const MAX_SUGGESTIONS = 8

/** Un mot proposable comme cible : la forme principale de chaque lemme. */
interface Candidat {
  word: string
  lemmaId: string
  category: string
}

/**
 * Liste des cibles proposables, construite une fois depuis le lexique complet
 * (formes principales seulement : proposer "chat" ET "chats" n'aurait pas de
 * sens, les relations se posent entre lemmes).
 */
function useCandidats(): Candidat[] | null {
  const [candidats, setCandidats] = useState<Candidat[] | null>(null)
  useEffect(() => {
    let annule = false
    loadWordIndex().then((index) => {
      if (annule) return
      const parLemme = new Map<string, typeof index>()
      for (const e of index) {
        const list = parLemme.get(e.lemmaId) ?? []
        list.push(e)
        parLemme.set(e.lemmaId, list)
      }
      const out: Candidat[] = []
      for (const [lemmaId, formes] of parLemme) {
        const principale = pickPrimaryForm(formes)
        out.push({ word: principale.word, lemmaId, category: principale.category })
      }
      setCandidats(out)
    })
    return () => {
      annule = true
    }
  }, [])
  return candidats
}

function ChampRelation({
  word,
  type,
  cibles,
  candidats,
  onChange,
}: {
  word: LexiconWord
  type: RelationType
  cibles: RelationTarget[]
  candidats: Candidat[] | null
  onChange: () => void
}) {
  const [saisie, setSaisie] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  const lemmaSource = lemmaIdAjout(word.mot, word.categorie)

  const suggestions = useMemo(() => {
    const q = saisie.trim().toLowerCase()
    if (q.length < 2 || !candidats) return []
    const dejaLies = new Set(cibles.map((c) => c.lemmaId))
    return candidats
      .filter(
        (c) =>
          // Même catégorie uniquement pour synonymes/contraires (c'est la
          // règle appliquée au lexique généré, et le serveur la refait
          // respecter). "Famille" n'a pas cette contrainte : dans le lexique
          // généré, 75% des liens de famille changent de catégorie
          // (trouille/nom -> trouillard/adjectif) — c'est le principe même
          // d'une famille de mots.
          (type === 'famille' || c.category === word.categorie) &&
          c.lemmaId !== lemmaSource &&
          !dejaLies.has(c.lemmaId) &&
          c.word.toLowerCase().startsWith(q),
      )
      .slice(0, MAX_SUGGESTIONS)
  }, [saisie, candidats, cibles, word.categorie, lemmaSource, type])

  async function lier(c: Candidat) {
    setErreur(null)
    try {
      await api.addRelation(word.id, type, { lemmaId: c.lemmaId, word: c.word, category: c.category as never })
      setSaisie('')
      onChange()
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue')
    }
  }

  async function delier(cible: RelationTarget) {
    await api.deleteRelation(word.id, type, cible.lemmaId)
    onChange()
  }

  return (
    <div className="mt-3">
      <span className="text-xs font-semibold tracking-wide text-gray-500 uppercase">
        {TYPES.find((t) => t.type === type)?.label}
      </span>

      <div className="mt-1 flex flex-wrap items-center gap-2">
        {cibles.map((c) => (
          <span key={c.lemmaId} className="flex items-center gap-2 rounded-lg bg-white px-3 py-1 text-sm">
            {c.word}
            <button
              type="button"
              onClick={() => delier(c)}
              aria-label={`Retirer ${c.word}`}
              className="text-gray-400 hover:text-red-600"
            >
              ✕
            </button>
          </span>
        ))}
      </div>

      <div className="relative mt-2">
        <input
          type="text"
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          placeholder={candidats ? 'Chercher un mot du lexique…' : 'Chargement du lexique…'}
          disabled={!candidats}
          className="w-full rounded-lg border-2 border-gray-200 bg-white px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none disabled:opacity-50"
        />
        {suggestions.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border-2 border-gray-200 bg-white shadow-lg">
            {suggestions.map((s) => (
              <li key={s.lemmaId}>
                <button
                  type="button"
                  onClick={() => lier(s)}
                  className="block w-full px-3 py-1.5 text-left text-sm hover:bg-brand-50"
                >
                  {s.word}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {erreur && <p className="mt-1 text-xs text-red-700">{erreur}</p>}
    </div>
  )
}

export function RelationsEditor({ word, onChange }: { word: LexiconWord; onChange: () => void }) {
  const candidats = useCandidats()
  return (
    <div className="mt-2 rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">
        Ces liens ne peuvent pas être devinés : les bases lexicales ne connaissent pas ce mot. Pour les synonymes
        et les contraires, seuls des mots de la même catégorie ({word.categorie}) sont proposés — la famille,
        elle, peut mélanger les catégories (ex. « trouille » nom et « trouillard » adjectif).
      </p>
      {TYPES.map(({ type }) => (
        <ChampRelation
          key={type}
          word={word}
          type={type}
          cibles={word.relations?.[type] ?? []}
          candidats={candidats}
          onChange={onChange}
        />
      ))}
    </div>
  )
}
