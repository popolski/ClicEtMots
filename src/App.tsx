import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './routes/Home'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/authContext'
import { RequireAuth } from './components/RequireAuth'

const ClavierTool = lazy(() => import('./tools/clavier/ClavierTool').then((m) => ({ default: m.ClavierTool })))
const ConjugueurTool = lazy(() =>
  import('./tools/conjugueur/ConjugueurTool').then((m) => ({ default: m.ConjugueurTool })),
)
const MotTool = lazy(() => import('./tools/mot/MotTool').then((m) => ({ default: m.MotTool })))
const FicheImprimable = lazy(() =>
  import('./tools/mot/FicheImprimable').then((m) => ({ default: m.FicheImprimable })),
)
const FichesMultiples = lazy(() =>
  import('./tools/mot/FichesMultiples').then((m) => ({ default: m.FichesMultiples })),
)
const DefinitionTool = lazy(() =>
  import('./tools/definition/DefinitionTool').then((m) => ({ default: m.DefinitionTool })),
)
const Admin = lazy(() => import('./routes/Admin').then((m) => ({ default: m.Admin })))
const Historique = lazy(() => import('./routes/Historique').then((m) => ({ default: m.Historique })))
const Favoris = lazy(() => import('./routes/Favoris').then((m) => ({ default: m.Favoris })))
const MotsSemaine = lazy(() => import('./routes/MotsSemaine').then((m) => ({ default: m.MotsSemaine })))
const QuizTool = lazy(() => import('./tools/quiz/QuizTool').then((m) => ({ default: m.QuizTool })))

/**
 * Applique la classe CSS du mode confort de lecture (police Lexend +
 * espacement, voir index.css) sur toute l'app quand l'enseignante l'a
 * activé pour cet élève (voir SectionEleves dans Admin.tsx) - un réglage
 * décidé par elle, pas par l'élève lui-même (revu après un premier essai en
 * auto-activation côté élève).
 */
function ZoneConfortLecture({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const confort = session?.role === 'student' && session.confortLecture === true
  return <div className={confort ? 'confort-lecture' : undefined}>{children}</div>
}

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
        <ZoneConfortLecture>
          <div className="min-h-screen">
            <Suspense fallback={<div className="p-10 text-center text-gray-400">Chargement…</div>}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route
                  path="/clavier"
                  element={
                    <RequireAuth>
                      <ClavierTool />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/conjugueur/:verbe"
                  element={
                    <RequireAuth>
                      <ConjugueurTool />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/mot/:lemmaId"
                  element={
                    <RequireAuth>
                      <MotTool />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/mot/:lemmaId/imprimer"
                  element={
                    <RequireAuth>
                      <FicheImprimable />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/fiches-imprimables"
                  element={
                    <RequireAuth>
                      <FichesMultiples />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/definition/:categorie/:mot"
                  element={
                    <RequireAuth>
                      <DefinitionTool />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/historique"
                  element={
                    <RequireAuth>
                      <Historique />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/favoris"
                  element={
                    <RequireAuth>
                      <Favoris />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/mots-semaine"
                  element={
                    <RequireAuth>
                      <MotsSemaine />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/quiz"
                  element={
                    <RequireAuth>
                      <QuizTool />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/enseignant"
                  element={
                    <RequireAuth teacherOnly>
                      <Admin />
                    </RequireAuth>
                  }
                />
              </Routes>
            </Suspense>
          </div>
        </ZoneConfortLecture>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
