import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import fs from 'fs'
import { saveFile, computeSha256 } from '../services/storage'
import { parsePdfToHtml, extractTitleHeuristic, PARSER_VERSION } from '../services/parser'
import { generateTitle, generateSummary, detectLanguage } from '../services/ai'
import pdfParse from 'pdf-parse'
import prisma from '../utils/prisma'

/**
 * Webhook endpoint for n8n email integration.
 *
 * n8n workflow:
 *   Email Trigger → Extract Attachment → HTTP Request POST /api/webhook/email-pdf
 *
 * Body (multipart/form-data):
 *   file      — PDF binary
 *   subject   — (optional) email subject used as title hint
 *   sender    — (optional) sender email for logging
 */
export async function webhookRoutes(app: FastifyInstance) {
  // Validate webhook secret if configured
  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    const secret = process.env.WEBHOOK_SECRET
    if (!secret) return // no secret configured → open
    const provided = req.headers['x-webhook-secret']
    if (provided !== secret) {
      return reply.status(401).send({ error: 'Invalid webhook secret' })
    }
  })

  /**
   * POST /api/webhook/email-pdf
   * Accepts a PDF sent from n8n (email attachment).
   */
  app.post('/email-pdf', async (req: FastifyRequest, reply: FastifyReply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'No file provided' })

    if (data.mimetype !== 'application/pdf') {
      return reply.status(400).send({ error: 'Only PDF files are accepted via email webhook' })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length > 50 * 1024 * 1024) {
      return reply.status(400).send({ error: 'File too large (max 50 MB)' })
    }

    const { storageKey, filePath } = saveFile(buffer, data.filename)
    const sha256 = computeSha256(filePath)

    // Read optional metadata from form fields
    const fields = (req as any).body as Record<string, { value: string }> | undefined
    const emailSubject = fields?.subject?.value || ''

    const intake = await prisma.documentIntake.create({
      data: {
        status: 'PARSING',
        sourceFilename: data.filename,
        sourceMimeType: 'application/pdf',
        sourceStorageKey: storageKey,
        sourceSha256: sha256,
        parserVersion: PARSER_VERSION
      }
    })

    setImmediate(async () => {
      try {
        const parseResult = await parsePdfToHtml(filePath)

        const buf = fs.readFileSync(filePath)
        const pdfData = await pdfParse(buf)
        const rawText = pdfData.text || ''

        // Use email subject as title hint if AI not available
        let title = await generateTitle(rawText)
        if (!title) {
          title = emailSubject
            ? emailSubject.replace(/^(fwd?|re):\s*/i, '').trim()
            : extractTitleHeuristic(rawText) || data.filename.replace(/\.[^.]+$/, '')
        }

        let summary = await generateSummary(rawText)
        if (!summary) {
          const firstP = rawText.trim().split('\n\n')[0]?.trim()
          summary = firstP ? firstP.slice(0, 300) : 'Résumé non disponible.'
        }

        const language = await detectLanguage(rawText)

        await prisma.documentIntake.update({
          where: { id: intake.id },
          data: {
            status: 'PARSED',
            generatedBodyHtml: parseResult.bodyHtml,
            generatedTitle: title,
            generatedSummary: summary,
            detectedLanguage: language,
            parseWarnings: parseResult.warnings
          }
        })
      } catch (err) {
        await prisma.documentIntake.update({
          where: { id: intake.id },
          data: { status: 'FAILED', parseWarnings: [String(err)] }
        })
      }
    })

    return reply.status(201).send({
      intakeId: intake.id,
      message: 'PDF received and queued for processing'
    })
  })
}
