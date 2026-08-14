import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { loadWordIndex } from '../../lib/wordIndex'
import { api } from '../../lib/api'
import { useFicheMot } from './useFicheMot'
import { BandeauMot } from './BandeauMot'
import type { WordCategory, WordEntry } from '../../types/phonetics'

const ROLE_DE_BASE: Record<WordCategory, WordEntry['formRole']> = {
  nom: 'singulier',
  adjectif: 'masculin',
  verbe: 'infinitif',
  adverbe: 'simple',
  invariable: 'simple',
}

// Persiste la liste en cours (localStorage, local à l'appareil - même
// principe que historique.ts) : une enseignante qui compose sa liste de
// mots de la semaine ne doit pas la perdre en rechargeant ou en imprimant.
const CLE_LISTE = 'clicmots:fiches-liste'

function lireListe(): string[] {
  try {
    const brut = localStorage.getItem(CLE_LISTE)
    const valeur = brut ? JSON.parse(brut) : []
    return Array.isArray(valeur) ? valeur : []
  } catch {
    return []
  }
}

function ecrireListe(liste: string[]): void {
  try {
    localStorage.setItem(CLE_LISTE, JSON.stringify(liste))
  } catch {
    // liste non sauvegardée : pas grave, elle reste utilisable pour la session en cours.
  }
}

function FicheEnListe({ lemmaId, onRetirer }: { lemmaId: string; onRetirer: () => void }) {
  const donnees = useFicheMot(lemmaId)
  if (!donnees.primary) return null
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onRetirer}
        aria-label={`Retirer « ${donnees.primary.word} » de la liste`}
        className="no-print absolute -top-2 -right-2 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-gray-700 text-xs text-white hover:bg-gray-900"
      >
        ✕
      </button>
      <BandeauMot {...donnees} />
    </div>
  )
}

/**
 * Compose plusieurs fiches à la fois (ex. liste de mots de la semaine) pour
 * les imprimer sur une même page - contrairement à FicheImprimable.tsx (un
 * seul mot). Recherche par orthographe (pas par phonèmes, plus rapide pour
 * une enseignante qui sait déjà comment le mot s'écrit).
 */
export function FichesMultiples() {
  const [wordIndex, setWordIndex] = useState<WordEntry[] | null>(null)
  const [recherche, setRecherche] = useState('')
  const [liste, setListe] = useState<string[]>(() => lireListe())

  useEffect(() => {
    loadWordIndex().then(setWordIndex)
  }, [])

  useEffect(() => {
    ecrireListe(liste)
  }, [liste])

  const suggestions = useMemo(() => {
    const terme = recherche.trim().toLowerCase()
    if (!terme || !wordIndex) return []
    return wordIndex
      .filter(
        (e) =>
          e.formRole === ROLE_DE_BASE[e.category] &&
          e.word.toLowerCase().startsWith(terme) &&
          !liste.includes(e.lemmaId),
      )
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 8)
  }, [recherche, wordIndex, liste])

  function ajouter(lemmaId: string) {
    setListe((l) => (l.includes(lemmaId) ? l : [...l, lemmaId]))
    setRecherche('')
  }

  function retirer(lemmaId: string) {
    setListe((l) => l.filter((id) => id !== lemmaId))
  }

  async function chargerListeSemaine() {
    const r = await api.getListeMotsSemaine().catch(() => null)
    if (!r || !Array.isArray(r.mots) || r.mots.length === 0) return
    setListe((l) => [...l, ...r.mots.filter((m) => !l.includes(m.lemmaId)).map((m) => m.lemmaId)])
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          .fiche-carte { box-shadow: none !important; }
          @page { margin: 1cm; }
        }
      `}</style>

      <div className="no-print mb-6">
        <div className="mb-4 flex items-center justify-between">
          <Link to="/clavier" className="text-sm text-gray-500 hover:text-brand-600">
            ⌨️ Retour au clavier
          </Link>
          <button
            type="button"
            disabled={liste.length === 0}
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            🖨️ Imprimer la liste
          </button>
        </div>

        <h1 className="mb-1 text-2xl font-semibold text-gray-900">Composer une liste de mots</h1>
        <p className="mb-4 text-gray-500">
          Ajoute les mots à imprimer (ex. la liste de la semaine), puis imprime-les toutes ensemble.
        </p>

        <button
          type="button"
          onClick={chargerListeSemaine}
          className="mb-4 text-sm text-brand-600 hover:underline"
        >
          📋 Charger les mots de la semaine
        </button>

        <div className="relative">
          <input
            type="text"
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            placeholder="Tape le début d'un mot…"
            className="w-full max-w-sm rounded-lg border-2 border-gray-200 px-4 py-2 focus:border-brand-400 focus:outline-none"
          />
          {suggestions.length > 0 && (
            <div className="absolute z-10 mt-1 w-full max-w-sm rounded-lg border border-gray-200 bg-white shadow-lg">
              {suggestions.map((e) => (
                <button
                  key={e.lemmaId}
                  type="button"
                  onClick={() => ajouter(e.lemmaId)}
                  className="block w-full px-4 py-2 text-left hover:bg-gray-50"
                >
                  {e.word} <span className="text-xs text-gray-400">({e.category})</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {liste.length === 0 ? (
        <p className="no-print py-10 text-center text-gray-400">Aucun mot dans la liste pour l'instant.</p>
      ) : (
        <div className="space-y-4">
          {liste.map((lemmaId) => (
            <FicheEnListe key={lemmaId} lemmaId={lemmaId} onRetirer={() => retirer(lemmaId)} />
          ))}
        </div>
      )}
    </div>
  )
}
