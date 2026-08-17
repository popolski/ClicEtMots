// Petite émulation sans comparaison entre élèves (pas de classement, pas de
// moyenne de classe - écarté volontairement même après la centralisation
// des scores côté serveur, voir server/schema-v6.sql). Un badge ne dépend
// que du score de SA PROPRE partie, jamais de celui des autres.
export type Badge = 'or' | 'argent' | 'bronze'

export const BADGE_EMOJI: Record<Badge, string> = {
  or: '🥇',
  argent: '🥈',
  bronze: '🥉',
}

export const BADGE_LABEL: Record<Badge, string> = {
  or: 'Médaille d’or',
  argent: 'Médaille d’argent',
  bronze: 'Médaille de bronze',
}

/** null si le score ne suffit pas pour une médaille (moins de la moitié de bon). */
export function badgePour(score: number, total: number): Badge | null {
  if (total <= 0) return null
  const taux = score / total
  if (taux === 1) return 'or'
  if (taux >= 0.7) return 'argent'
  if (taux >= 0.5) return 'bronze'
  return null
}
