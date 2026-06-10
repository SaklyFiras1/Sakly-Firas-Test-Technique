import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  getIntake, patchIntake, regenerateTitle,
  regenerateBody, regenerateSummary, publishIntake
} from '../api/client'

interface Intake {
  id: string
  status: string
  sourceFilename: string
  sourceMimeType: string
  sourceSha256: string
  generatedTitle: string | null
  generatedSummary: string | null
  generatedBodyHtml: string | null
  detectedLanguage: string | null
  editedTitle: string | null
  editedSummary: string | null
  editedBodyHtml: string | null
  editedLanguage: string | null
  parseWarnings: string[]
  parserVersion: string | null
  createdAt: string
  updatedAt: string
  publishedArticleId: string | null
}

type Toast = { msg: string; type: 'success' | 'error' } | null

export default function IntakeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [intake, setIntake] = useState<Intake | null>(null)
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState<Toast>(null)
  const [preview, setPreview] = useState(false)

  // Editable fields
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [language, setLanguage] = useState('')

  // Loading states per button
  const [regen, setRegen] = useState({ title: false, body: false, summary: false, publish: false, save: false })

  const load = useCallback(async () => {
    if (!id) return
    try {
      const data: Intake = await getIntake(id)
      setIntake(data)
      setTitle(data.editedTitle ?? data.generatedTitle ?? '')
      setSummary(data.editedSummary ?? data.generatedSummary ?? '')
      setBodyHtml(data.editedBodyHtml ?? data.generatedBodyHtml ?? '')
      setLanguage(data.editedLanguage ?? data.detectedLanguage ?? 'other')
    } catch {
      showToast('Erreur de chargement', 'error')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  // Poll while parsing
  useEffect(() => {
    if (!intake) return
    if (intake.status === 'PARSING' || intake.status === 'UPLOADED') {
      const iv = setInterval(load, 2000)
      return () => clearInterval(iv)
    }
  }, [intake?.status, load])

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3500)
  }

  const save = async () => {
    if (!id) return
    setRegen(r => ({ ...r, save: true }))
    try {
      await patchIntake(id, { title, summary, bodyHtml, language })
      await load()
      showToast('Modifications sauvegardées', 'success')
    } catch (e) {
      showToast(String(e), 'error')
    } finally {
      setRegen(r => ({ ...r, save: false }))
    }
  }

  const doRegenTitle = async () => {
    if (!id) return
    setRegen(r => ({ ...r, title: true }))
    try {
      const { title: t } = await regenerateTitle(id)
      setTitle(t)
      showToast('Titre régénéré', 'success')
    } catch (e) { showToast(String(e), 'error') }
    finally { setRegen(r => ({ ...r, title: false })); load() }
  }

  const doRegenBody = async () => {
    if (!id) return
    setRegen(r => ({ ...r, body: true }))
    try {
      const { bodyHtml: h } = await regenerateBody(id)
      setBodyHtml(h)
      showToast('Corps HTML régénéré', 'success')
    } catch (e) { showToast(String(e), 'error') }
    finally { setRegen(r => ({ ...r, body: false })); load() }
  }

  const doRegenSummary = async () => {
    if (!id) return
    setRegen(r => ({ ...r, summary: true }))
    try {
      const { summary: s } = await regenerateSummary(id)
      setSummary(s)
      showToast('Résumé régénéré', 'success')
    } catch (e) { showToast(String(e), 'error') }
    finally { setRegen(r => ({ ...r, summary: false })); load() }
  }

  /**
   * FIX: publish flow
   * 1. Save current edits first (PATCH), so the API has the latest values
   * 2. Then call publish
   * 3. Single load() at the end
   * No double-save, no nested save() calls with their own load()
   */
  const doPublish = async () => {
    if (!id) return
    if (!window.confirm('Publier cet article ? Cette action est irréversible.')) return
    setRegen(r => ({ ...r, publish: true }))
    try {
      // Save current field state before publishing
      await patchIntake(id, { title, summary, bodyHtml, language })
      await publishIntake(id)
      await load()
      showToast('Article publié !', 'success')
    } catch (e) {
      showToast('Erreur de publication : ' + String(e), 'error')
    } finally {
      setRegen(r => ({ ...r, publish: false }))
    }
  }

  if (loading) return <div style={{ padding: 40, color: 'var(--muted)' }}><span className="spinner" /> Chargement…</div>
  if (!intake) return <div style={{ padding: 40, color: 'var(--danger)' }}>Document introuvable.</div>

  const published = intake.status === 'PUBLISHED'
  // FIX: parsing flag used to disable all action buttons
  const parsing = intake.status === 'PARSING' || intake.status === 'UPLOADED'
  const failed = intake.status === 'FAILED'

  return (
    <div style={{ padding: 40, maxWidth: 1100 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
        <div>
          <button className="btn-secondary" onClick={() => navigate('/')} style={{ marginBottom: 12, fontSize: 12 }}>
            ← Retour
          </button>
          <h1 style={{ fontSize: 20, fontWeight: 600 }}>{intake.sourceFilename}</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
            <span className={`badge badge-${intake.status.toLowerCase()}`}>{intake.status}</span>
            <span style={{ color: 'var(--muted)', fontSize: 12 }}>
              {intake.sourceMimeType} · Parser v{intake.parserVersion ?? '—'}
            </span>
          </div>
        </div>
        {!published && !parsing && !failed && (
          <button className="btn-success" onClick={doPublish} disabled={regen.publish}
            style={{ padding: '10px 24px', fontSize: 14 }}>
            {regen.publish ? <><span className="spinner" style={{ marginRight: 8 }} />Publication…</> : '🚀 Publier'}
          </button>
        )}
        {published && (
          <div style={{ color: 'var(--success)', fontWeight: 500, fontSize: 13 }}>✓ Publié</div>
        )}
      </div>

      {/* Parsing state */}
      {parsing && (
        <div className="card" style={{ marginBottom: 24, color: 'var(--warning)', display: 'flex', gap: 12, alignItems: 'center' }}>
          <span className="spinner" />
          Parsing en cours… Cette page se met à jour automatiquement.
        </div>
      )}

      {/* Failed state */}
      {failed && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: '#2a1010', borderRadius: 8, border: '1px solid #5a1010' }}>
          <div style={{ fontWeight: 500, marginBottom: 6, color: 'var(--danger)', fontSize: 13 }}>✗ Le parsing a échoué</div>
          <div style={{ color: '#f87171', fontSize: 12 }}>Utilisez "Regénérer depuis le PDF" pour réessayer.</div>
        </div>
      )}

      {/* Warnings */}
      {intake.parseWarnings.length > 0 && (
        <div style={{ marginBottom: 24, padding: '12px 16px', background: '#2a1e00', borderRadius: 8, border: '1px solid #5a3e00' }}>
          <div style={{ fontWeight: 500, marginBottom: 6, color: 'var(--warning)', fontSize: 13 }}>⚠ Avertissements de parsing</div>
          {intake.parseWarnings.map((w, i) => (
            <div key={i} style={{ color: '#fcd34d', fontSize: 12 }}>• {w}</div>
          ))}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Left: Fields */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Language */}
          <div className="card">
            <label>Langue</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <select value={language} onChange={e => setLanguage(e.target.value)} disabled={published || parsing}>
                <option value="fr">Français (fr)</option>
                <option value="en">Anglais (en)</option>
                <option value="de">Allemand (de)</option>
                <option value="es">Espagnol (es)</option>
                <option value="it">Italien (it)</option>
                <option value="other">Autre</option>
              </select>
            </div>
            {intake.detectedLanguage && (
              <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 6 }}>
                Détecté automatiquement: {intake.detectedLanguage}
              </div>
            )}
          </div>

          {/* Title */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Titre</label>
              {/* FIX: disabled during parsing */}
              <button className="btn-secondary" onClick={doRegenTitle}
                disabled={published || parsing || regen.title}
                style={{ fontSize: 11, padding: '4px 10px' }}>
                {regen.title ? <span className="spinner" /> : '↻ Générer le titre'}
              </button>
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)}
              disabled={published || parsing}
              placeholder="Titre de l'article" />
            {intake.generatedTitle && title !== intake.generatedTitle && (
              <div style={{ color: 'var(--muted)', fontSize: 11, marginTop: 6 }}>
                Généré: {intake.generatedTitle}
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Résumé</label>
              {/* FIX: disabled during parsing */}
              <button className="btn-secondary" onClick={doRegenSummary}
                disabled={published || parsing || regen.summary}
                style={{ fontSize: 11, padding: '4px 10px' }}>
                {regen.summary ? <span className="spinner" /> : '↻ Regénérer le résumé'}
              </button>
            </div>
            <textarea value={summary} onChange={e => setSummary(e.target.value)}
              disabled={published || parsing}
              rows={4} placeholder="Résumé de l'article" style={{ fontFamily: 'var(--font)' }} />
          </div>

          {/* Save */}
          {!published && !parsing && (
            <button className="btn-secondary" onClick={save} disabled={regen.save} style={{ padding: '10px' }}>
              {regen.save ? <><span className="spinner" style={{ marginRight: 8 }} />Sauvegarde…</> : '💾 Sauvegarder les modifications'}
            </button>
          )}
        </div>

        {/* Right: HTML Editor + Preview */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ flex: 1 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label style={{ margin: 0 }}>Corps HTML</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {/* FIX: disabled during parsing */}
                <button className="btn-secondary" onClick={doRegenBody}
                  disabled={published || parsing || regen.body}
                  style={{ fontSize: 11, padding: '4px 10px' }}>
                  {regen.body ? <span className="spinner" /> : '↻ Regénérer depuis le PDF'}
                </button>
                <button className="btn-secondary" onClick={() => setPreview(p => !p)}
                  style={{ fontSize: 11, padding: '4px 10px' }}>
                  {preview ? '✎ Éditer' : '👁 Prévisualiser'}
                </button>
              </div>
            </div>

            {preview ? (
              <div style={{
                background: '#fff', color: '#111', padding: 20, borderRadius: 8,
                minHeight: 400, overflow: 'auto', fontSize: 14, lineHeight: 1.8
              }}
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            ) : (
              <textarea
                value={bodyHtml}
                onChange={e => setBodyHtml(e.target.value)}
                disabled={published || parsing}
                rows={20}
                placeholder="HTML généré par le parser…"
                style={{ fontFamily: 'var(--mono)', fontSize: 12 }}
              />
            )}
          </div>
        </div>
      </div>

      {/* Published info */}
      {published && intake.publishedArticleId && (
        <div style={{ marginTop: 24, padding: '16px', background: '#102810', border: '1px solid #1a4a1a', borderRadius: 8 }}>
          <div style={{ color: 'var(--success)', fontWeight: 500, marginBottom: 4 }}>✓ Article publié</div>
          <div style={{ color: 'var(--muted)', fontSize: 12 }}>
            L'article est visible sur le site public. Le contenu ne peut plus être modifié.
          </div>
        </div>
      )}

      {toast && <div className={`toast ${toast.type}`}>{toast.msg}</div>}
    </div>
  )
}
