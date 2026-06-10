import Fastify from 'fastify'
import cors from '@fastify/cors'
import multipart from '@fastify/multipart'
import path from 'path'
import fs from 'fs'
import prisma from './utils/prisma'
import { intakeRoutes } from './routes/intake'
import { publicRoutes } from './routes/public'
import { webhookRoutes } from './routes/webhook'
import { registerBasicAuth } from './middleware/basicAuth'

const app = Fastify({ logger: true })

const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', 'uploads')
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true })

app.register(cors, {
  origin: [
    process.env.OPS_WEB_URL || 'http://localhost:5173',
    process.env.PUBLIC_WEB_URL || 'http://localhost:3000'
  ]
})

app.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 }
})

// Optional Basic Auth for ops routes (intake only)
registerBasicAuth(app)

app.register(intakeRoutes, { prefix: '/api/intake' })
app.register(publicRoutes, { prefix: '/api/public' })
app.register(webhookRoutes, { prefix: '/api/webhook' })

app.get('/health', async () => ({ status: 'ok', version: '1.0.0' }))

/**
 * FIX: On startup, recover any intakes that were left in PARSING state
 * due to a previous server crash or restart. Mark them as FAILED so
 * operators can reprocess them instead of waiting forever.
 */
async function recoverStuckParsing(): Promise<void> {
  try {
    const stuck = await prisma.documentIntake.findMany({
      where: { status: { in: ['PARSING', 'UPLOADED'] } },
      select: { id: true }
    })
    if (stuck.length === 0) return

    await prisma.documentIntake.updateMany({
      where: { id: { in: stuck.map(s => s.id) } },
      data: {
        status: 'FAILED',
        parseWarnings: ['Parsing interrompu suite à un redémarrage du serveur. Relancez le parsing manuellement.']
      }
    })
    console.log(`[startup] Recovered ${stuck.length} stuck intake(s) → FAILED`)
  } catch (err) {
    console.error('[startup] Could not recover stuck intakes:', err)
  }
}

const start = async () => {
  try {
    await recoverStuckParsing()
    await app.listen({ port: Number(process.env.PORT) || 4000, host: '0.0.0.0' })
    console.log('🚀 API running on port', process.env.PORT || 4000)
  } catch (err) {
    app.log.error(err)
    process.exit(1)
  }
}

start()
