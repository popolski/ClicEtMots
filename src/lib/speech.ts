// Prononciation des mots : fichiers mp3 pré-générés (Google Cloud TTS,
// fr-FR-Neural2-A — voir scripts/generate-word-audio.mjs) en priorité, avec
// repli sur window.speechSynthesis si le fichier n'existe pas encore (mot
// ajouté par l'enseignant après la dernière génération, par ex.). Neural2-A a
// été choisi après comparaison : window.speechSynthesis (et Azure Neural
// testé en parallèle) avalent les schwas de mots comme "chevauchée"
// ("ch'vauchée"), problème absent sur Neural2-A.
//
// Piège classique de speechSynthesis : getVoices() renvoie souvent un
// tableau vide au tout premier appel, le temps que le navigateur charge la
// liste — il faut attendre l'événement voiceschanged plutôt que d'utiliser
// la voix par défaut (parfois anglaise) immédiatement.
import type { WordCategory } from '../types/phonetics'
import { assetUrl } from './assetUrl'

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
  return (typeof Audio !== 'undefined') || (typeof window !== 'undefined' && 'speechSynthesis' in window)
}

// Même schéma de nom que generate-word-audio.mjs : {mot}_{categorie}_{lemme}.mp3.
// Le dernier segment de lemmaId, pas le 2e : le lexique statique a des
// lemmaId à 2 segments ("verbe:accueillir"), mais un mot ajouté par
// l'enseignant en a 3 ("ajout:verbe:motXYZ", voir lemmaIdAjout) — prendre
// l'avant-dernier segment donnerait la catégorie au lieu du mot.
function audioFileName(word: string, category: WordCategory, lemmaId: string): string {
  const segments = lemmaId.split(':')
  const lemme = segments[segments.length - 1] ?? lemmaId
  return `${word}_${category}_${lemme}.mp3`
}

let currentAudio: HTMLAudioElement | null = null

/** Tente de jouer le fichier pré-généré ; résout à false s'il n'existe pas (404/erreur réseau). */
function tryPlayAudioFile(word: string, category: WordCategory, lemmaId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio(assetUrl(`/audio/mots/${audioFileName(word, category, lemmaId)}`))
    currentAudio = audio
    audio.addEventListener('canplaythrough', () => {
      audio.play()
      resolve(true)
    }, { once: true })
    audio.addEventListener('error', () => resolve(false), { once: true })
  })
}

// Même correction que TEXTE_PRONONCIATION dans generate-word-audio.mjs (voir
// ce fichier pour le pourquoi) - dupliquée ici car ce fichier tourne dans le
// navigateur (pas d'accès direct au script Node). Ne s'applique qu'au repli
// synthèse vocale : le fichier pré-généré, prioritaire, porte déjà la bonne
// prononciation une fois régénéré.
const TEXTE_PRONONCIATION: Record<string, string> = {
  'nom:jean': 'djinne',
}

async function speakWithBrowserVoice(text: string, lemmaId?: string): Promise<void> {
  if (!(typeof window !== 'undefined' && 'speechSynthesis' in window)) return
  const utterance = new SpeechSynthesisUtterance((lemmaId && TEXTE_PRONONCIATION[lemmaId]) ?? text)
  utterance.lang = 'fr-FR'
  const voice = await loadFrenchVoice()
  if (voice) utterance.voice = voice
  window.speechSynthesis.speak(utterance)
}

/**
 * Prononce un mot à voix haute : fichier pré-généré si `category`/`lemmaId`
 * sont fournis et que le fichier existe, sinon repli sur la synthèse vocale
 * du navigateur. Sans effet si aucune des deux méthodes n'est disponible.
 */
export async function speak(word: string, info?: { category: WordCategory; lemmaId: string }): Promise<void> {
  // Coupe toute lecture en cours : cliquer un 2e mot pendant que le 1er se
  // prononce encore doit interrompre le 1er, pas les faire chevaucher.
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
  }
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }

  if (info) {
    const played = await tryPlayAudioFile(word, info.category, info.lemmaId)
    if (played) return
  }

  await speakWithBrowserVoice(word, info?.lemmaId)
}
