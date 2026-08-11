// Définition simplifiée via l'API publique de Vikidia (encyclopédie pour les
// 8-13 ans, moteur MediaWiki) — contenu déjà calibré pour des enfants,
// contrairement à Wiktionnaire. Appelé à la demande (clic sur "Voir la
// définition"), jamais pré-généré : contrairement à l'audio des mots, c'est
// un appel léger et non systématique, pas la peine de le pré-générer.
//
// Couverture partielle À NE PAS SUR-PROMETTRE : Vikidia est une encyclopédie
// (sujets : animaux, lieux, sciences, histoire...), pas un dictionnaire — les
// verbes, adjectifs et mots abstraits n'ont souvent aucun contenu utile
// (page vide ou inexistante). D'où le repli sur Wiktionnaire (voir
// src/lib/wiktionnaire.ts et src/lib/definition.ts, qui combine les deux).
const API_BASE = 'https://fr.vikidia.org/w/api.php'

/** Coupe l'extrait aux ~2 premières phrases : Vikidia renvoie souvent un article entier. */
function premieresPhrases(texte: string, max = 2): string {
  const phrases = texte.split(/(?<=[.!?])\s+/).filter(Boolean)
  return phrases.slice(0, max).join(' ')
}

/** null si aucune définition utilisable (mot absent, page vide, erreur réseau). */
export async function fetchDefinitionVikidia(mot: string): Promise<string | null> {
  const url = `${API_BASE}?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(mot)}&format=json&origin=*`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    const pages = data?.query?.pages
    if (!pages) return null
    const page = Object.values(pages)[0] as { extract?: string } | undefined
    const extract = page?.extract?.trim()
    if (!extract) return null
    return premieresPhrases(extract)
  } catch {
    return null
  }
}
