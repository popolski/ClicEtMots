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

/**
 * Coupe l'extrait aux ~2 premières phrases : Vikidia renvoie souvent un
 * article entier. Un retour à la ligne compte comme une limite de phrase au
 * même titre qu'un point : certains articles structurent leur intro en
 * liste à puces (une puce par ligne, séparées par \n plutôt que par une
 * ponctuation de fin de phrase) - sans ce découpage sur \n, "coupe aux 2
 * premières phrases" continuait de gober une bonne partie de la liste avant
 * de trouver un vrai point final, produisant un texte à rallonge sans
 * ponctuation claire (vu sur "ordinateur", "bibliothèque").
 */
function premieresPhrases(texte: string, max = 2): string {
  const phrases = texte.split(/\n+|(?<=[.!?])\s+/).filter(Boolean)
  const retenues = phrases.slice(0, max)
  // Une phrase retenue qui se termine par ":" annonçait une liste coupée
  // net par la limite ci-dessus (ex. "...deux grandes parties :") - mieux
  // vaut la retirer que de laisser une promesse sans suite.
  while (retenues.length > 0 && /:\s*$/.test(retenues[retenues.length - 1])) {
    retenues.pop()
  }
  return retenues.join(' ')
}

// Certains articles ont un widget de prononciation audio juste après le mot
// en gras ("La fenêtre 🔉 Écouter est..."), qui survit même en texte brut
// (explaintext) - résidu d'interface sans rapport avec la définition,
// retiré avant de couper aux premières phrases. Ne nettoie QUE les espaces
// simples autour, sans toucher aux retours à la ligne (\s+ les aurait aussi
// écrasés, empêchant premieresPhrases() de s'en servir comme limites).
function retirerWidgetsAudio(texte: string): string {
  return texte.replace(/[ \t]*🔉[ \t]*Écouter[ \t]*/g, ' ').trim()
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
    return premieresPhrases(retirerWidgetsAudio(extract))
  } catch {
    return null
  }
}
