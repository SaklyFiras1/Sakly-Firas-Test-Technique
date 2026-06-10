import pdfParse from 'pdf-parse'
import sanitizeHtml from 'sanitize-html'
import fs from 'fs'

export const PARSER_VERSION = '3.1.0'

export interface ParseResult {
  bodyHtml: string
  warnings: string[]
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * A heading is an ALL-CAPS line that:
 * - contains at least 2 words (avoids codes like "BTEC_VDF_001")
 * - has no underscores or slashes (avoids technical identifiers)
 * - OR matches numbered section patterns (1. Title)
 * - OR matches known document section keywords
 */
function isHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length < 4 || t.length > 100) return false
  // Exclude technical codes (underscores, slashes, backslashes)
  if (/[_/\\]/.test(t)) return false
  // ALL CAPS: must contain at least 2 whitespace-separated tokens and at least one accented or regular capital letter
  if (
    t === t.toUpperCase() &&
    t.length < 80 &&
    /[A-ZÀÉÈÊËÎÏÔÙÛÜ]{2,}/.test(t) &&
    t.split(/\s+/).filter(Boolean).length >= 2
  ) return true
  // Numbered section: "1. Title" or "1.2 Title"
  if (/^\d+(\.\d+)?\s+[A-ZÀÉÈÊËÎÏÔÙÛÜ]/.test(t) && t.length < 80) return true
  // Known document section starters
  if (/^(RAPPORT D'|CRITÈRES GROUPE|AUDIT |SOMMAIRE|RÉSUMÉ|CONTACT|INTRODUCTION|CONCLUSION|ANNEXE)/i.test(t) && t.length < 100) return true
  return false
}

function isSubHeading(line: string): boolean {
  const t = line.trim()
  if (!t || t.length < 3 || t.length > 100) return false
  // Avoid treating technical codes as subheadings
  if (/[_/\\]/.test(t)) return false
  if (t.endsWith(':') && t.length < 80 && t.split(/\s+/).length >= 2) return true
  if (/^(Maquette|Référence|Diffusion|Modélisation|Codification|Informations|Note |Etat |Historique|Commentaires|Critères|Avertissements)/i.test(t) && t.length < 60) return true
  return false
}

function isListItem(line: string): { match: boolean; content: string } {
  const t = line.trim()
  const m = t.match(/^[-•*►▪]\s+(.+)/) || t.match(/^(\d+)\.\s+(.+)/)
  if (m) return { match: true, content: m[m.length - 1] }
  return { match: false, content: '' }
}

/**
 * Key-value detection: conservative rules to avoid eating narrative text.
 * - Key: 3–30 chars, at most 4 words, no sentence structure
 * - Value: at most 80 chars (longer = paragraph, not a value)
 */
function isKeyValue(line: string): { match: boolean; key: string; value: string } {
  const t = line.trim()
  const m = t.match(/^([^:]{3,30}?)\s*:\s+(.{1,80})$/)
  if (!m) return { match: false, key: '', value: '' }
  const key = m[1].trim()
  const val = m[2].trim()
  // Key must not look like a sentence (too many words)
  if (key.split(/\s+/).length > 4) return { match: false, key: '', value: '' }
  // Value must not be too long (that's a paragraph)
  if (val.length > 80) return { match: false, key: '', value: '' }
  // Key must not end with http (URL prefix)
  if (key.endsWith('http')) return { match: false, key: '', value: '' }
  return { match: true, key, value: val }
}

function isPercentageLine(line: string): boolean {
  return /^\d+[,.]?\d*\s*%$/.test(line.trim())
}

function isPageMarker(line: string): boolean {
  return /^Page\s*:\s*\d+\s*\/\s*\d+$/i.test(line.trim())
}

function looksLikeMetadata(line: string): boolean {
  const t = line.trim()
  if (/^\d+$/.test(t) && t.length < 5) return true
  if (isPageMarker(t)) return true
  return false
}

function textToHtml(text: string): string {
  const lines = text.split('\n')
  const html: string[] = []
  let inList = false
  let inKvBlock = false
  let kvRows: Array<[string, string]> = []

  const flushList = () => {
    if (inList) { html.push('</ul>'); inList = false }
  }

  /**
   * Key-value pairs are rendered as a <dl> (definition list) — semantic,
   * no invented "Champ / Valeur" header row.
   */
  const flushKv = () => {
    if (inKvBlock && kvRows.length > 0) {
      html.push('<dl>')
      for (const [key, val] of kvRows) {
        html.push(`<dt>${escapeHtml(key)}</dt>`)
        html.push(`<dd>${escapeHtml(val)}</dd>`)
      }
      html.push('</dl>')
      kvRows = []
      inKvBlock = false
    }
  }

  let i = 0
  while (i < lines.length) {
    const trimmed = lines[i].trim()

    if (!trimmed) {
      flushList()
      flushKv()
      i++
      continue
    }

    if (isPageMarker(trimmed) || looksLikeMetadata(trimmed)) { i++; continue }
    // Skip standalone percentage lines (graph labels, etc.)
    if (isPercentageLine(trimmed)) { i++; continue }

    if (isHeading(trimmed)) {
      flushList(); flushKv()
      html.push(`<h2>${escapeHtml(trimmed)}</h2>`)
      i++; continue
    }

    if (isSubHeading(trimmed)) {
      flushList(); flushKv()
      html.push(`<h3>${escapeHtml(trimmed.replace(/:$/, ''))}</h3>`)
      i++; continue
    }

    const listCheck = isListItem(trimmed)
    if (listCheck.match) {
      flushKv()
      if (!inList) { html.push('<ul>'); inList = true }
      html.push(`<li>${escapeHtml(listCheck.content)}</li>`)
      i++; continue
    }

    const kvCheck = isKeyValue(trimmed)
    if (kvCheck.match) {
      flushList()
      inKvBlock = true
      kvRows.push([kvCheck.key, kvCheck.value])
      i++
      // If next line is not also a kv pair, flush immediately
      const nextTrimmed = lines[i]?.trim() || ''
      if (!isKeyValue(nextTrimmed).match) flushKv()
      continue
    }

    // Paragraph: merge continuation lines
    flushList(); flushKv()
    let paragraph = trimmed
    while (i + 1 < lines.length) {
      const nextLine = lines[i + 1].trim()
      if (!nextLine) break
      if (isHeading(nextLine) || isSubHeading(nextLine)) break
      if (isListItem(nextLine).match) break
      if (isKeyValue(nextLine).match) break
      if (isPageMarker(nextLine) || looksLikeMetadata(nextLine)) break
      if (isPercentageLine(nextLine)) break
      paragraph += ' ' + nextLine
      i++
    }
    if (paragraph.length > 2) html.push(`<p>${escapeHtml(paragraph)}</p>`)
    i++
  }

  flushList()
  flushKv()

  return html.join('\n')
}

export async function parsePdfToHtml(filePath: string): Promise<ParseResult> {
  const warnings: string[] = []

  const dataBuffer = fs.readFileSync(filePath)
  let data: pdfParse.Result

  try {
    data = await pdfParse(dataBuffer)
  } catch (err) {
    warnings.push('PDF parse error: ' + String(err))
    return { bodyHtml: '<p>Impossible de lire ce document PDF.</p>', warnings }
  }

  if (!data.text || data.text.trim().length < 10) {
    warnings.push('Le PDF semble ne contenir aucun texte extractible (PDF scanné ?)')
    return {
      bodyHtml: "<p>Ce document ne contient pas de texte extractible. Il pourrait s'agir d'un PDF scanné.</p>",
      warnings
    }
  }

  if (data.numpages > 50) {
    warnings.push(`Document long (${data.numpages} pages) — certaines pages peuvent être tronquées`)
  }

  const rawHtml = textToHtml(data.text)

  const clean = sanitizeHtml(rawHtml, {
    allowedTags: [
      'h1', 'h2', 'h3', 'h4', 'p', 'ul', 'ol', 'li',
      'strong', 'em', 'br',
      'table', 'thead', 'tbody', 'tr', 'th', 'td',
      'blockquote', 'dl', 'dt', 'dd'
    ],
    allowedAttributes: {},
    // No 'data:' scheme — prevents base64 blobs bloating the DB
    allowedSchemes: ['http', 'https']
  })

  return { bodyHtml: clean, warnings }
}

export function extractTitleHeuristic(text: string): string | null {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
  for (const line of lines.slice(0, 10)) {
    if (line.length > 5 && line.length < 120 && !line.endsWith('.')) {
      return line
    }
  }
  return null
}
