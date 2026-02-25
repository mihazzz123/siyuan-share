import { Route, Routes } from 'react-router-dom'
import './App.css'
import Dashboard from './pages/Dashboard'
import Home from './pages/Home'
import NotFound from './pages/NotFound.tsx'
import ShareList from './pages/ShareList'
import ShareView from './pages/ShareView'

function App() {
  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/s/:shareId" element={<ShareView />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/shares" element={<ShareList />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </div>
  )
}

export default App
