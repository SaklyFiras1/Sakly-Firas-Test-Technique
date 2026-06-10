import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { getIntakes } from '../api/client'

interface IntakeSummary {
  id: string
  status: string
  sourceFilename: string
  sourceMimeType: string
  generatedTitle: string | null
  editedTitle: string | null
  detectedLanguage: string | null
  editedLanguage: string | null
  createdAt: string
  publishedArticleId: string | null
}

export default function IntakeList() {
  const [intakes, setIntakes] = useState<IntakeSummary[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    try {
      setIntakes(await getIntakes())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    const iv = setInterval(load, 3000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div style={{ padding: 40 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600 }}>Documents</h1>
          <p style={{ color: 'var(--muted)', marginTop: 4 }}>{intakes.length} document{intakes.length !== 1 ? 's' : ''}</p>
        </div>
        <Link to="/upload">
          <button className="btn-primary">+ Uploader</button>
        </Link>
      </div>

      {loading && <div style={{ color: 'var(--muted)' }}><span className="spinner" /> Chargement…</div>}

      {!loading && intakes.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 48 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
          <div style={{ color: 'var(--muted)' }}>Aucun document. Commencez par en uploader un.</div>
          <Link to="/upload"><button className="btn-primary" style={{ marginTop: 16 }}>Uploader</button></Link>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {intakes.map(intake => {
          const title = intake.editedTitle || intake.generatedTitle || intake.sourceFilename
          const lang = intake.editedLanguage || intake.detectedLanguage
          return (
            <Link key={intake.id} to={`/intake/${intake.id}`} style={{ color: 'inherit' }}>
              <div className="card" style={{
                display: 'flex', alignItems: 'center', gap: 16,
                cursor: 'pointer', transition: 'border-color 0.15s'
              }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {title}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>
                    {intake.sourceFilename} · {new Date(intake.createdAt).toLocaleDateString('fr-FR')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  {lang && <span style={{ fontSize: 11, color: 'var(--muted)', background: 'var(--surface2)', padding: '2px 8px', borderRadius: 99 }}>{lang.toUpperCase()}</span>}
                  <StatusBadge status={intake.status} />
                </div>
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status.toLowerCase()}`}>{status}</span>
}
