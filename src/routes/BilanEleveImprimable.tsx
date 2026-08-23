import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { ResultatQuiz } from '../lib/api'
import {
  agregerParModeGlobal,
  MODE_DESCRIPTION,
  MODE_LABEL,
  MODES_AVEC_AIDE,
  MODES_AVEC_ESSAIS,
  resultatsDeLaPeriode,
} from '../lib/bilanLogic'
import { BADGE_EMOJI } from '../lib/quizBadges'
import { anneesDisponibles, periodesDe } from '../lib/periodesPedagogiques'
import type { Zone } from '../lib/periodesPedagogiques'

/**
 * Version imprimable du bilan élève (Admin.tsx, panneau "Bilan de..."),
 * pensée pour être jointe au bulletin : demandé par Camille avec, en plus,
 * une phrase par exercice reliée aux compétences du programme officiel
 * (MODE_DESCRIPTION) et un filtrage par période pédagogique (P1-P5), les
 * bulletins étant eux-mêmes remis par période. studentId/prenom passés en
 * query params depuis Admin.tsx plutôt qu'une route imbriquée : cette page
 * n'a besoin de rien d'autre de l'espace enseignant.
 */
export function BilanEleveImprimable() {
  const [params] = useSearchParams()
  const studentId = Number(params.get('studentId') ?? 0)
  const prenom = params.get('prenom') ?? ''

  const [resultats, setResultats] = useState<ResultatQuiz[] | null>(null)
  const [erreur, setErreur] = useState(false)
  // Reprend le choix déjà fait par l'enseignante dans Admin.tsx (même
  // sélecteur) si le lien les transporte - sinon valeurs par défaut.
  const [zone, setZone] = useState<Zone>((params.get('zone') as Zone | null) ?? 'B')
  const [periodeId, setPeriodeId] = useState<string>(params.get('periode') ?? 'toutes')

  useEffect(() => {
    if (!studentId) return
    api
      .bilanEleve(studentId)
      .then((r) => setResultats(r.resultats))
      .catch(() => setErreur(true))
  }, [studentId])

  const annee = anneesDisponibles()[0]
  const periodes = useMemo(() => periodesDe(annee, zone), [annee, zone])
  const periodeChoisie = periodes.find((p) => p.id === periodeId) ?? null

  const resultatsFiltres = useMemo(() => {
    if (!resultats) return null
    if (!periodeChoisie) return resultats
    return resultatsDeLaPeriode(resultats, periodeChoisie.debut, periodeChoisie.fin)
  }, [resultats, periodeChoisie])

  const bilan = resultatsFiltres ? agregerParModeGlobal(resultatsFiltres) : null

  if (!studentId) {
    return <p className="p-8 text-center text-gray-400">Élève manquant.</p>
  }

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
          disabled={!bilan}
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-40"
        >
          🖨️ Imprimer
        </button>
      </div>

      <div className="no-print mb-8 flex flex-wrap items-end gap-4 rounded-2xl border-2 border-gray-200 bg-gray-50 p-4">
        <label>
          <span className="text-sm font-semibold text-gray-700">Zone (vacances hiver/printemps)</span>
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
            value={periodeId}
            onChange={(e) => setPeriodeId(e.target.value)}
            className="mt-1 block rounded-lg border-2 border-gray-200 bg-white px-3 py-2 focus:border-brand-500 focus:outline-none"
          >
            <option value="toutes">Toute l'année</option>
            {periodes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {erreur && <p className="py-10 text-center text-red-600">Impossible de charger le bilan pour l'instant.</p>}

      {!erreur && !bilan && <p className="py-10 text-center text-gray-400">Chargement…</p>}

      {bilan && (
        <div className="border-2 border-gray-800 p-8">
          <h1 className="mb-1 text-center text-2xl font-bold text-gray-900">Bilan de {prenom}</h1>
          <p className="mb-6 text-center text-gray-600">
            {periodeChoisie
              ? `${periodeChoisie.label} (${new Date(`${periodeChoisie.debut}T00:00:00`).toLocaleDateString('fr-FR')} au ${new Date(`${periodeChoisie.fin}T00:00:00`).toLocaleDateString('fr-FR')})`
              : "Toute l'année"}
          </p>

          {bilan.length === 0 ? (
            <p className="py-6 text-center text-gray-400">Aucun exercice fait sur cette période.</p>
          ) : (
            <div className="space-y-6">
              {bilan.map((b) => (
                <div key={b.mode} className="border-b border-gray-300 pb-4 last:border-0">
                  <h2 className="text-base font-bold text-gray-900">{MODE_LABEL[b.mode]}</h2>
                  <p className="mt-1 text-sm text-gray-600 italic">{MODE_DESCRIPTION[b.mode]}</p>
                  <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-4">
                    <div>
                      <dt className="text-gray-500">Séances</dt>
                      <dd className="font-semibold text-gray-900">{b.nbSeances}</dd>
                    </div>
                    <div>
                      <dt className="text-gray-500">Score moyen</dt>
                      <dd className="font-semibold text-gray-900">{b.scoreMoyenPct}%</dd>
                    </div>
                    {MODES_AVEC_ESSAIS.has(b.mode) && b.premierCoupPct !== null && (
                      <div>
                        <dt className="text-gray-500">Réussi du 1er coup</dt>
                        <dd className="font-semibold text-gray-900">{b.premierCoupPct}%</dd>
                      </div>
                    )}
                    {MODES_AVEC_AIDE.has(b.mode) && b.aideUtiliseePct !== null && (
                      <div>
                        <dt className="text-gray-500">Filet de secours utilisé</dt>
                        <dd className="font-semibold text-gray-900">{b.aideUtiliseePct}%</dd>
                      </div>
                    )}
                    {(b.medailles.or > 0 || b.medailles.argent > 0 || b.medailles.bronze > 0) && (
                      <div>
                        <dt className="text-gray-500">Médailles</dt>
                        <dd className="font-semibold text-gray-900">
                          {b.medailles.or > 0 && `${BADGE_EMOJI.or}×${b.medailles.or} `}
                          {b.medailles.argent > 0 && `${BADGE_EMOJI.argent}×${b.medailles.argent} `}
                          {b.medailles.bronze > 0 && `${BADGE_EMOJI.bronze}×${b.medailles.bronze}`}
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
