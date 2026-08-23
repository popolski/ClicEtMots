import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { ListeMotsSemaine } from '../lib/api'
import { agregerVocabulaire, listesDeLaPeriode } from '../lib/bilanLexiqueLogic'
import { anneesDisponibles, periodesDe } from '../lib/periodesPedagogiques'
import type { Zone } from '../lib/periodesPedagogiques'

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Première liste enregistrée, ou aujourd'hui s'il n'y en a aucune - borne de début par défaut. */
function dateLaPlusAncienne(listes: ListeMotsSemaine[]): string {
  if (listes.length === 0) return aujourdhui()
  const plusAncienne = listes.reduce((a, b) => (b.updatedAt < a.updatedAt ? b : a))
  return plusAncienne.updatedAt.slice(0, 10)
}

/**
 * Bilan imprimable du vocabulaire vu en classe sur une période, groupé par
 * nature grammaticale - demandé par Camille dans un format "plus
 * professionnel, style Éducation nationale". Distinct du bilan de scores de
 * quiz (Admin.tsx, bouton 📊) : celui-ci porte sur les MOTS vus, à partir
 * des listes de mots de la semaine déjà enregistrées, pas sur les résultats.
 */
export function BilanLexique() {
  const [listes, setListes] = useState<ListeMotsSemaine[] | null>(null)
  const [debut, setDebut] = useState('')
  const [fin, setFin] = useState(aujourdhui())
  // Sélecteur de période pédagogique (P1-P5), en plus des dates libres déjà
  // existantes - choisir une période remplit juste debut/fin, qui restent
  // modifiables ensuite à la main (pas de mode exclusif entre les deux).
  const [zone, setZone] = useState<Zone>('B')
  const annee = anneesDisponibles()[0]
  const periodes = useMemo(() => periodesDe(annee, zone), [annee, zone])

  useEffect(() => {
    api
      .listListesMotsSemaine()
      .then((r) => {
        const toutes = Array.isArray(r.listes) ? r.listes : []
        setListes(toutes)
        setDebut(dateLaPlusAncienne(toutes))
      })
      .catch(() => setListes([]))
  }, [])

  const bilan = useMemo(() => {
    if (!listes || !debut || !fin) return null
    // Fin de journée incluse : une liste enregistrée le jour même choisi
    // comme borne de fin doit être comptée, pas exclue par son horodatage.
    const finJournee = new Date(`${fin}T23:59:59`)
    const retenues = listesDeLaPeriode(listes, new Date(`${debut}T00:00:00`), finJournee)
    return agregerVocabulaire(retenues)
  }, [listes, debut, fin])

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          @page { margin: 1.5cm; }
        }
      `}</style>

      <div className="no-print mb-6 flex items-center justify-between">
        <Link to="/enseignant" className="text-sm text-gray-500 hover:text-brand-600">
          ← Espace enseignant
        </Link>
        <button
          type="button"
          disabled={!bilan || bilan.totalMots === 0}
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
        >
          🖨️ Imprimer
        </button>
      </div>

      <div className="no-print mb-8 flex flex-wrap items-end gap-4 rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
        <label>
          <span className="text-sm font-semibold text-gray-700">Zone</span>
          <select
            value={zone}
            onChange={(e) => setZone(e.target.value as Zone)}
            className="mt-1 block rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          >
            <option value="A">Zone A</option>
            <option value="B">Zone B</option>
            <option value="C">Zone C</option>
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold text-gray-700">Période</span>
          <select
            value=""
            onChange={(e) => {
              const periode = periodes.find((p) => p.id === e.target.value)
              if (periode) {
                setDebut(periode.debut)
                setFin(periode.fin)
              }
            }}
            className="mt-1 block rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          >
            <option value="" disabled>
              Choisir une période...
            </option>
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="text-sm font-semibold text-gray-700">Du</span>
          <input
            type="date"
            value={debut}
            onChange={(e) => setDebut(e.target.value)}
            className="mt-1 block rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <label>
          <span className="text-sm font-semibold text-gray-700">Au</span>
          <input
            type="date"
            value={fin}
            onChange={(e) => setFin(e.target.value)}
            className="mt-1 block rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          />
        </label>
        <p className="text-sm text-gray-500">
          {listes === null
            ? 'Chargement…'
            : bilan
              ? `${bilan.nbListes} liste(s) hebdomadaire(s) sur cette période.`
              : ''}
        </p>
      </div>

      {listes === null ? (
        <p className="py-10 text-center text-gray-400">Chargement…</p>
      ) : !bilan || bilan.totalMots === 0 ? (
        <p className="py-10 text-center text-gray-400">Aucun mot de la semaine enregistré sur cette période.</p>
      ) : (
        <div className="border-2 border-gray-800 p-8">
          <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">Bilan du vocabulaire</h1>
          <p className="mb-6 text-center text-gray-600">
            Du {new Date(`${debut}T00:00:00`).toLocaleDateString('fr-FR')} au{' '}
            {new Date(`${fin}T00:00:00`).toLocaleDateString('fr-FR')}
          </p>

          <table className="mb-6 w-full border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-gray-800">
                <th className="py-2 text-left">Nature</th>
                <th className="py-2 text-right">Nombre de mots</th>
              </tr>
            </thead>
            <tbody>
              {bilan.parCategorie.map((groupe) => (
                <tr key={groupe.categorie} className="border-b border-gray-300">
                  <td className="py-1">{groupe.label}</td>
                  <td className="py-1 text-right">{groupe.mots.length}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-gray-800 font-semibold">
                <td className="py-2">Total (mots distincts)</td>
                <td className="py-2 text-right">{bilan.totalMots}</td>
              </tr>
            </tbody>
          </table>

          {bilan.parCategorie.map((groupe) => (
            <div key={groupe.categorie} className="mb-4">
              <h2 className="mb-1 text-sm font-bold tracking-wide text-gray-800 uppercase">
                {groupe.label} ({groupe.mots.length})
              </h2>
              <p className="text-gray-700">{groupe.mots.map((m) => m.word).join(', ')}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
