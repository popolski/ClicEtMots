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
  const [identifiantEnseignant, setIdentifiantEnseignant] = useState('')
  const [motDePasseEnseignant, setMotDePasseEnseignant] = useState('')
  const [erreurEnseignant, setErreurEnseignant] = useState<string | null>(null)
  const [enCoursEnseignant, setEnCoursEnseignant] = useState(false)

  if (session?.authenticated) {
    return <Navigate to="/clavier" replace />
  }

  async function onSubmitEleve(event: React.FormEvent) {
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

  async function onSubmitEnseignant(event: React.FormEvent) {
    event.preventDefault()
    setErreurEnseignant(null)
    setEnCoursEnseignant(true)
    try {
      await login(identifiantEnseignant.trim(), motDePasseEnseignant)
    } catch (e) {
      setErreurEnseignant(e instanceof Error ? e.message : 'Une erreur est survenue')
      setEnCoursEnseignant(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-[940px] px-4 py-10 text-center sm:py-12">
      <div className="mb-3 text-center">
        <a
          href="/"
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300/70 bg-white/60 px-4 py-2 text-sm font-medium text-gray-700 transition hover:-translate-y-0.5 hover:border-brand-500 hover:bg-white/90"
        >
          ← Retour au portail
        </a>
      </div>

      <img
        src={assetUrl('/logo.png')}
        alt="Clic &amp; Mots — le clavier phono-ludique du CP au CM2"
        className="mx-auto h-auto w-full max-w-xl"
      />
      <p className="mt-3 text-base text-gray-500">
        Un clavier phonétique pour aider les élèves à trouver l'orthographe des mots qu'ils veulent écrire.
      </p>

      {/* session === null : on ne sait pas encore si l'élève est déjà connecté
          (le cookie est HttpOnly, seul le serveur peut répondre) — afficher le
          formulaire tout de suite ferait clignoter un écran de login inutile
          pour quelqu'un de déjà connecté. */}
      {session === null ? (
        <p className="mt-10 text-gray-400">Chargement…</p>
      ) : (
        <div className="mx-auto mt-8 grid max-w-[920px] grid-cols-1 gap-6 md:grid-cols-2">
          <section className="relative min-h-[390px] overflow-hidden rounded-[14px] border border-gray-700/10 bg-white/60 px-8 py-7 text-left shadow-[0_5px_14px_rgba(0,0,0,.07)]">
            <span className="absolute inset-y-6 left-0 w-[5px] rounded-r bg-brand-500" aria-hidden="true" />
            <span className="mb-2.5 inline-block rounded-full bg-brand-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-brand-700">Élève</span>
            <h1 className="m-0 text-2xl font-semibold text-gray-800">Accès élève</h1>
            <p className="mt-1.5 text-sm text-gray-500">Connecte-toi pour utiliser ton clavier phonétique.</p>

            <form onSubmit={onSubmitEleve} className="mt-6">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Ton prénom</span>
                <input type="text" value={identifiant} onChange={(e) => setIdentifiant(e.target.value)} autoComplete="username" required className="mt-1.5 h-11 w-full rounded-lg border border-[#c9c3ae] bg-white px-3 text-base outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20" />
              </label>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-gray-700">Ton mot de passe</span>
                <input type="password" value={motDePasse} onChange={(e) => setMotDePasse(e.target.value)} autoComplete="current-password" required className="mt-1.5 h-11 w-full rounded-lg border border-[#c9c3ae] bg-white px-3 text-base outline-none focus:border-brand-500 focus:ring-3 focus:ring-brand-500/20" />
              </label>
              {erreur && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreur}</p>}
              <button type="submit" disabled={enCours} className="mt-6 min-h-11 w-full rounded-lg bg-brand-600 px-6 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-brand-700 hover:shadow-md disabled:opacity-50">
                {enCours ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </section>

          <section className="relative min-h-[390px] overflow-hidden rounded-[14px] border border-gray-700/10 bg-white/60 px-8 py-7 text-left shadow-[0_5px_14px_rgba(0,0,0,.07)]">
            <span className="absolute inset-y-6 left-0 w-[5px] rounded-r bg-accent-500" aria-hidden="true" />
            <span className="mb-2.5 inline-block rounded-full bg-accent-500/15 px-2.5 py-1 text-xs font-bold uppercase tracking-wider text-[#9b6b00]">Enseignant</span>
            <h1 className="m-0 text-2xl font-semibold text-gray-800">Accès enseignant</h1>
            <p className="mt-1.5 text-sm text-gray-500">Connectez-vous pour gérer les élèves et leurs résultats.</p>

            <form onSubmit={onSubmitEnseignant} className="mt-6">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Identifiant</span>
                <input type="text" value={identifiantEnseignant} onChange={(e) => setIdentifiantEnseignant(e.target.value)} autoComplete="username" required className="mt-1.5 h-11 w-full rounded-lg border border-[#c9c3ae] bg-white px-3 text-base outline-none focus:border-accent-500 focus:ring-3 focus:ring-accent-500/20" />
              </label>
              <label className="mt-4 block">
                <span className="text-sm font-semibold text-gray-700">Mot de passe</span>
                <input type="password" value={motDePasseEnseignant} onChange={(e) => setMotDePasseEnseignant(e.target.value)} autoComplete="current-password" required className="mt-1.5 h-11 w-full rounded-lg border border-[#c9c3ae] bg-white px-3 text-base outline-none focus:border-accent-500 focus:ring-3 focus:ring-accent-500/20" />
              </label>
              {erreurEnseignant && <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{erreurEnseignant}</p>}
              <button type="submit" disabled={enCoursEnseignant} className="mt-6 min-h-11 w-full rounded-lg bg-accent-500 px-6 text-base font-bold text-white transition hover:-translate-y-0.5 hover:bg-accent-600 hover:shadow-md disabled:opacity-50">
                {enCoursEnseignant ? 'Connexion…' : 'Se connecter'}
              </button>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}
