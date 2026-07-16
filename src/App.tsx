import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './routes/Home'
import { AuthProvider } from './lib/auth'
import { RequireAuth } from './components/RequireAuth'

const ClavierTool = lazy(() => import('./tools/clavier/ClavierTool').then((m) => ({ default: m.ClavierTool })))
const ConjugueurTool = lazy(() =>
  import('./tools/conjugueur/ConjugueurTool').then((m) => ({ default: m.ConjugueurTool })),
)
const MotTool = lazy(() => import('./tools/mot/MotTool').then((m) => ({ default: m.MotTool })))
const Admin = lazy(() => import('./routes/Admin').then((m) => ({ default: m.Admin })))

function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <AuthProvider>
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
                path="/enseignante"
                element={
                  <RequireAuth teacherOnly>
                    <Admin />
                  </RequireAuth>
                }
              />
            </Routes>
          </Suspense>
        </div>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
