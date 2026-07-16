import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../lib/authContext'

interface RequireAuthProps {
  children: ReactNode
  /** Restreint en plus à l'enseignante (espace d'administration). */
  teacherOnly?: boolean
}

// Garde côté client : confort de navigation seulement, PAS une sécurité. Le
// vrai contrôle est côté serveur (requireAuth/requireTeacher dans l'API) —
// contourner ce composant dans le navigateur ne donne accès à aucune donnée.
export function RequireAuth({ children, teacherOnly }: RequireAuthProps) {
  const { session } = useAuth()

  if (session === null) {
    return <p className="py-10 text-center text-gray-400">Chargement…</p>
  }
  if (!session.authenticated) {
    return <Navigate to="/" replace />
  }
  if (teacherOnly && session.role !== 'teacher') {
    return <Navigate to="/clavier" replace />
  }
  return <>{children}</>
}
