import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { verifierRotationAnneeScolaire } from './lib/rotationAnneeScolaire.ts'

// Avant tout rendu : purge les données locales (historique/favoris/quiz) si
// on a changé d'année scolaire depuis la dernière visite sur cet appareil.
verifierRotationAnneeScolaire()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
