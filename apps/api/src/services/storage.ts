import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads')

if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

export function computeSha256(filePath: string): string {
  const data = fs.readFileSync(filePath)
  return crypto.createHash('sha256').update(data).digest('hex')
}

export function saveFile(buffer: Buffer, filename: string): { storageKey: string; filePath: string } {
  const ext = path.extname(filename)
  const storageKey = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`
  const filePath = path.join(UPLOADS_DIR, storageKey)
  fs.writeFileSync(filePath, buffer)
  return { storageKey, filePath }
}

export function getFilePath(storageKey: string): string {
  return path.join(UPLOADS_DIR, storageKey)
}

export function fileExists(storageKey: string): boolean {
  return fs.existsSync(getFilePath(storageKey))
}
