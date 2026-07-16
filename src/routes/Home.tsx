import { Link } from 'react-router-dom'

export function Home() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 text-center">
      <img src="/logo.png" alt="Clic &amp; Mots — le clavier phono-ludique du CP au CM2" className="mx-auto h-auto w-full max-w-md" />
      <p className="mt-3 text-gray-500">
        Un clavier phonétique pour aider les élèves à trouver l'orthographe des mots qu'ils veulent écrire.
      </p>
      <Link
        to="/clavier"
        className="mt-8 inline-flex items-center justify-center rounded-lg bg-brand-600 px-6 py-3 text-lg font-medium text-white hover:bg-brand-700"
      >
        Commencer
      </Link>
    </div>
  )
}
