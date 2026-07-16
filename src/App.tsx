import { Suspense, lazy } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Home } from './routes/Home'

const ClavierTool = lazy(() => import('./tools/clavier/ClavierTool').then((m) => ({ default: m.ClavierTool })))
const ConjugueurTool = lazy(() =>
  import('./tools/conjugueur/ConjugueurTool').then((m) => ({ default: m.ConjugueurTool })),
)
const MotTool = lazy(() => import('./tools/mot/MotTool').then((m) => ({ default: m.MotTool })))

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen">
        <Suspense fallback={<div className="p-10 text-center text-gray-400">Chargement…</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/clavier" element={<ClavierTool />} />
            <Route path="/conjugueur/:verbe" element={<ConjugueurTool />} />
            <Route path="/mot/:lemmaId" element={<MotTool />} />
          </Routes>
        </Suspense>
      </div>
    </BrowserRouter>
  )
}

export default App
