// Synthèse vocale native du navigateur (window.speechSynthesis) : gratuite,
// aucune dépendance externe, adaptée à la lecture de vrais mots (contrairement
// aux sons isolés du clavier — "ill", "oin"… n'existent pas comme mots, donc
// pas de TTS pour eux, voir la discussion produit).
//
// Piège classique : getVoices() renvoie souvent un tableau vide au tout
// premier appel, le temps que le navigateur charge la liste — il faut
// attendre l'événement voiceschanged plutôt que d'utiliser la voix par
// défaut (parfois anglaise) immédiatement.
let frenchVoicePromise: Promise<SpeechSynthesisVoice | null> | null = null

function loadFrenchVoice(): Promise<SpeechSynthesisVoice | null> {
  if (!frenchVoicePromise) {
    frenchVoicePromise = new Promise((resolve) => {
      const pick = (voices: SpeechSynthesisVoice[]) =>
        voices.find((v) => v.lang === 'fr-FR') ?? voices.find((v) => v.lang.startsWith('fr')) ?? null

      const immediate = window.speechSynthesis.getVoices()
      if (immediate.length > 0) {
        resolve(pick(immediate))
        return
      }
      window.speechSynthesis.onvoiceschanged = () => {
        resolve(pick(window.speechSynthesis.getVoices()))
      }
    })
  }
  return frenchVoicePromise
}

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/** Prononce un mot à voix haute. Sans effet si la synthèse vocale n'est pas disponible. */
export async function speak(text: string): Promise<void> {
  if (!speechSupported()) return

  // Coupe toute lecture en cours : cliquer un 2e mot pendant que le 1er se
  // prononce encore doit interrompre le 1er, pas les faire chevaucher.
  window.speechSynthesis.cancel()

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'fr-FR'
  const voice = await loadFrenchVoice()
  if (voice) utterance.voice = voice

  window.speechSynthesis.speak(utterance)
}
