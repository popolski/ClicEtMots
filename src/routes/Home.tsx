import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { assetUrl } from '../lib/assetUrl'
import { useAuth } from '../lib/authContext'

export function Home() {
  const { session, login } = useAuth()
  const [identifiant, setIdentifiant] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)
  const [enCours, setEnCours] = useState(false)

  if (session?.authenticated) {
    return <Navigate to="/clavier" replace />
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault()
    setErreur(null)
    setEnCours(true)
    try {
      await login(identifiant.trim(), motDePasse)
    } catch (e) {
      setErreur(e instanceof Error ? e.message : 'Une erreur est survenue')
      setEnCours(false)
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <img
        src={assetUrl('/logo.png')}
        alt="Clic &amp; Mots — le clavier phono-ludique du CP au CM2"
        className="mx-auto h-auto w-full max-w-md"
      />
      <p className="mt-3 text-gray-500">
        Un clavier phonétique pour aider les élèves à trouver l'orthographe des mots qu'ils veulent écrire.
      </p>

      {/* session === null : on ne sait pas encore si l'élève est déjà connecté
          (le cookie est HttpOnly, seul le serveur peut répondre) — afficher le
          formulaire tout de suite ferait clignoter un écran de login inutile
          pour quelqu'un de déjà connecté. */}
      {session === null ? (
        <p className="mt-10 text-gray-400">Chargement…</p>
      ) : (
        <form onSubmit={onSubmit} className="mt-10 text-left">
          <label className="block">
            <span className="text-sm font-semibold text-gray-700">Ton prénom</span>
            <input
              type="text"
              value={identifiant}
              onChange={(e) => setIdentifiant(e.target.value)}
              autoComplete="username"
              required
              className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-lg focus:border-brand-500 focus:outline-none"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-sm font-semibold text-gray-700">Ton mot de passe</span>
            <input
              type="password"
              value={motDePasse}
              onChange={(e) => setMotDePasse(e.target.value)}
              autoComplete="current-password"
              required
              className="mt-1 w-full rounded-lg border-2 border-gray-200 bg-white px-4 py-3 text-lg focus:border-brand-500 focus:outline-none"
            />
          </label>

          {erreur && (
            <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              {erreur}
            </p>
          )}

          <button
            type="submit"
            disabled={enCours}
            className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-lg font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {enCours ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      )}
    </div>
  )
}
