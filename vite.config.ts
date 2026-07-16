import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => ({
  // Déployé dans un sous-dossier sur OVH (https://www.cours-vandewalle.fr/clicmots/),
  // pas à la racine du domaine comme sur Vercel — d'où le base uniquement en
  // production ; le serveur de dev reste à la racine pour plus de simplicité.
  base: command === 'build' ? '/clicmots/' : '/',
  plugins: [react(), tailwindcss()],
  // Le backend est en PHP : impossible à faire tourner dans le serveur de dev
  // Vite. On proxie donc /clicmots/api vers le vrai serveur OVH — le dev tape
  // sur la vraie base (attention : créer un élève en dev le crée pour de bon).
  server: {
    proxy: {
      '/clicmots/api': {
        target: 'https://www.cours-vandewalle.fr',
        changeOrigin: true,
        // Le cookie de session est posé sur le chemin /clicmots/ par le
        // serveur ; en dev le site est servi depuis /, donc sans réécriture
        // le navigateur ne le renverrait jamais.
        cookiePathRewrite: { '/clicmots/': '/' },
      },
    },
  },
  test: {
    environment: 'node',
  },
}))
