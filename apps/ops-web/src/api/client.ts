// In development: Vite proxies /api → http://localhost:4000
// In production (Docker): nginx serves the build, API is separate
const BASE = '/api'

async function apiFetch(url: string, options?: RequestInit) {
  const r = await fetch(url, options)
  if (!r.ok) {
    const body = await r.text()
    throw new Error(body || `HTTP ${r.status}`)
  }
  return r.json()
}

export async function uploadFile(file: File) {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/intake/upload`, { method: 'POST', body: form })
  if (!r.ok) throw new Error(await r.text())
  return r.json()
}

export async function getIntakes() {
  return apiFetch(`${BASE}/intake`)
}

export async function getIntake(id: string) {
  return apiFetch(`${BASE}/intake/${id}`)
}

export async function patchIntake(id: string, body: Record<string, string>) {
  return apiFetch(`${BASE}/intake/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
}

export async function regenerateTitle(id: string) {
  return apiFetch(`${BASE}/intake/${id}/regenerate-title`, { method: 'POST' })
}

export async function regenerateBody(id: string) {
  return apiFetch(`${BASE}/intake/${id}/regenerate-body`, { method: 'POST' })
}

export async function regenerateSummary(id: string) {
  return apiFetch(`${BASE}/intake/${id}/regenerate-summary`, { method: 'POST' })
}

export async function publishIntake(id: string) {
  return apiFetch(`${BASE}/intake/${id}/publish`, { method: 'POST' })
}
