import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { uploadFile } from '../api/client'

export default function Upload() {
  const [dragging, setDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const handleFile = (f: File) => {
    const allowed = ['application/pdf', 'text/html', 'text/plain']
    if (!allowed.includes(f.type)) {
      setError('Format non supporté. Utilisez PDF, HTML ou TXT.')
      return
    }
    setFile(f)
    setError('')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }

  const submit = async () => {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const intake = await uploadFile(file)
      navigate(`/intake/${intake.id}`)
    } catch (err) {
      setError(String(err))
      setLoading(false)
    }
  }

  return (
    <div style={{ padding: 40, maxWidth: 600 }}>
      <h1 style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Uploader un document</h1>
      <p style={{ color: 'var(--muted)', marginBottom: 32 }}>
        PDF, HTML ou TXT — max 50 MB. Le parsing démarre automatiquement.
      </p>

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border: `2px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 12,
          padding: '48px 24px',
          textAlign: 'center',
          cursor: 'pointer',
          transition: 'all 0.2s',
          background: dragging ? 'rgba(99,102,241,0.05)' : 'transparent',
          marginBottom: 24
        }}
      >
        <input ref={inputRef} type="file" accept=".pdf,.html,.txt" style={{ display: 'none' }}
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
        <div style={{ fontSize: 40, marginBottom: 12 }}>📄</div>
        {file ? (
          <div>
            <div style={{ fontWeight: 500 }}>{file.name}</div>
            <div style={{ color: 'var(--muted)', fontSize: 12, marginTop: 4 }}>
              {(file.size / 1024).toFixed(0)} KB
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontWeight: 500, marginBottom: 4 }}>Glissez un fichier ici</div>
            <div style={{ color: 'var(--muted)', fontSize: 12 }}>ou cliquez pour parcourir</div>
          </div>
        )}
      </div>

      {error && (
        <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 16, padding: '10px 14px', background: '#2a1010', borderRadius: 6 }}>
          {error}
        </div>
      )}

      <button className="btn-primary" onClick={submit} disabled={!file || loading}
        style={{ width: '100%', padding: '11px', fontSize: 14 }}>
        {loading ? <><span className="spinner" style={{ marginRight: 8 }} />Envoi en cours…</> : 'Envoyer et parser'}
      </button>
    </div>
  )
}
