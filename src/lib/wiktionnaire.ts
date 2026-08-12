// Définition de repli quand Vikidia n'a rien (verbes, adjectifs, mots
// courants - Vikidia est une encyclopédie, pas un dictionnaire, voir
// src/lib/vikidia.ts). Contrairement à l'API "extracts" (conçue pour un
// paragraphe d'intro d'article encyclopédique), une page Wiktionnaire est un
// enchevêtrement de modèles wiki (étymologie, prononciation, citations
// littéraires) sans paragraphe d'intro exploitable — inutile d'essayer
// "extracts" ici, il faut extraire et nettoyer à la main la première ligne
// de définition numérotée (les lignes "#") de la bonne section grammaticale.
//
// La ligne de définition elle-même reste heureusement simple à nettoyer :
// seulement des liens wiki ([[mot]] ou [[mot|affichage]]) et parfois une
// étiquette d'usage en tête ({{par analogie|fr}}, {{félins|fr}}...) — la
// vraie complexité (citations, étymologie) est ailleurs sur la page,
// entièrement ignorée par ce parsing ciblé.
import type { WordCategory } from '../types/phonetics'

const API_BASE = 'https://fr.wiktionary.org/w/api.php'

// Étiquette de section Wiktionnaire ({{S|<étiquette>|fr}}) par catégorie —
// "invariable" n'a pas d'étiquette unique (conjonction, préposition,
// pronom...), pas de section ciblée pour lui : repli direct sur la première
// ligne "#" de la page entière, quelle que soit la section.
const SECTION_PAR_CATEGORIE: Partial<Record<WordCategory, string>> = {
  nom: 'nom',
  adjectif: 'adjectif',
  verbe: 'verbe',
  adverbe: 'adverbe',
}

// Wiktionnaire numérote ses définitions par ordre étymologique/grammatical,
// pas par fréquence d'usage courant — la première n'est donc pas toujours
// celle qu'un enfant attend. Ex. "propre" : sens 1 = "particulier à
// quelqu'un" (comme dans "son propre chat"), sens 7 = "nettoyé, lavé" (le
// sens courant, celui qu'un enfant cherche). Aucun moyen fiable de deviner
// automatiquement le bon sens parmi plusieurs - liste de corrections
// manuelles, découverte au cas par cas (même principe que EXCLUDED_WORDS,
// scripts/excluded-words.mjs), plutôt qu'une heuristique fragile.
// Index de la ligne "#" à choisir (0 = la première, comportement par défaut).
const INDEX_SENS_PREFERE: Record<string, number> = {
  propre: 6,
}

async function fetchWikitext(mot: string): Promise<string | null> {
  const url = `${API_BASE}?action=parse&page=${encodeURIComponent(mot)}&prop=wikitext&format=json&origin=*`
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()
    return data?.parse?.wikitext?.['*'] ?? null
  } catch {
    return null
  }
}

function extraireLigneDefinition(wikitext: string, categorie: WordCategory, mot: string): string | null {
  const etiquette = SECTION_PAR_CATEGORIE[categorie]
  let zone = wikitext
  if (etiquette) {
    const sectionRe = new RegExp(`\\{\\{S\\|${etiquette}\\|fr(?:\\|[^}]*)?\\}\\}([\\s\\S]*?)(?=\\n===|$)`, 'i')
    const trouvee = wikitext.match(sectionRe)
    if (trouvee) zone = trouvee[1]
  }
  // "#" = ligne de définition de premier niveau ; "#*" = citation d'exemple
  // et "##"/"##*" = sous-définition/sous-exemple (nuance d'un sens déjà
  // numéroté) - seules les vraies lignes "#" de premier niveau sont gardées.
  const lignes = zone.match(/^#(?![#*])\s*.+$/gm)
  if (!lignes) return null
  const index = INDEX_SENS_PREFERE[mot.toLowerCase()] ?? 0
  return lignes[index] ?? lignes[0]
}

/** Retire la syntaxe wiki d'une ligne de définition brute pour n'en garder que le texte lisible. */
function nettoyerLigne(ligne: string): string {
  let t = ligne.replace(/^#\s*/, '')
  t = t.replace(/^(\{\{[^}]*\}\}\s*)+/, '') // étiquette(s) d'usage en tête (ex. {{par analogie|fr}})
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2') // lien avec texte affiché différent
  t = t.replace(/\[\[([^\]]+)\]\]/g, '$1') // lien simple
  t = t.replace(/\{\{[^}]*\}\}/g, '') // modèle résiduel non traité, retiré plutôt qu'affiché brut
  t = t.replace(/'''?/g, '') // gras/italique wiki
  t = t.replace(/\s+/g, ' ').trim()
  return t
}

/** null si aucune ligne de définition trouvée (mot absent, page sans la bonne section). */
export async function fetchDefinitionWiktionnaire(mot: string, categorie: WordCategory): Promise<string | null> {
  const wikitext = await fetchWikitext(mot)
  if (!wikitext) return null
  const ligne = extraireLigneDefinition(wikitext, categorie, mot)
  if (!ligne) return null
  const nettoyee = nettoyerLigne(ligne)
  return nettoyee || null
}
