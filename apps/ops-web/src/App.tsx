import { Routes, Route, Link, useLocation } from 'react-router-dom'
import IntakeList from './pages/IntakeList'
import IntakeDetail from './pages/IntakeDetail'
import Upload from './pages/Upload'

export default function App() {
  const loc = useLocation()
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <nav style={{
        width: 220, background: 'var(--surface)', borderRight: '1px solid var(--border)',
        padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0
      }}>
        <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 24, padding: '0 8px' }}>
          <span style={{ color: 'var(--accent)' }}>◈</span> DocPublish
        </div>
        <NavLink to="/" active={loc.pathname === '/'}>Documents</NavLink>
        <NavLink to="/upload" active={loc.pathname === '/upload'}>Uploader</NavLink>
        <div style={{ marginTop: 'auto', padding: '8px', fontSize: 11, color: 'var(--muted)' }}>
          Backoffice-Sakly-Firas-2026
        </div>
      </nav>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        <Routes>
          <Route path="/" element={<IntakeList />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/intake/:id" element={<IntakeDetail />} />
        </Routes>
      </main>
    </div>
  )
}

function NavLink({ to, active, children }: { to: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link to={to} style={{
      padding: '8px 12px', borderRadius: 6,
      background: active ? 'var(--surface2)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--muted)',
      fontSize: 13, fontWeight: active ? 500 : 400,
      display: 'block', transition: 'all 0.15s'
    }}>
      {children}
    </Link>
  )
}
