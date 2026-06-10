import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import pdfParse from 'pdf-parse'
import fs from 'fs'
import prisma from '../utils/prisma'
import { parsePdfToHtml, extractTitleHeuristic, PARSER_VERSION } from '../services/parser'
import { generateTitle, generateSummary, detectLanguage } from '../services/ai'
import { saveFile, computeSha256, getFilePath } from '../services/storage'

function slugifyTitle(title: string): string {
  return title
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'document'
}

function sanitizeForDb(s: string): string {
  return s.replace(/\0/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')
}

const ALLOWED_MIME = ['application/pdf', 'text/html', 'text/plain']

async function getTextFromIntake(intakeId: string): Promise<string> {
  const intake = await prisma.documentIntake.findUnique({ where: { id: intakeId } })
  if (!intake) return ''
  const filePath = getFilePath(intake.sourceStorageKey)
  if (!fs.existsSync(filePath)) return ''

  if (intake.sourceMimeType === 'application/pdf') {
    const buf = fs.readFileSync(filePath)
    const data = await pdfParse(buf)
    return sanitizeForDb(data.text || '')
  }
  return sanitizeForDb(fs.readFileSync(filePath, 'utf8'))
}

export async function intakeRoutes(app: FastifyInstance) {

  // POST /api/intake/upload
  app.post('/upload', async (req: FastifyRequest, reply: FastifyReply) => {
    const data = await req.file()
    if (!data) return reply.status(400).send({ error: 'Aucun fichier fourni' })

    const mime = data.mimetype
    if (!ALLOWED_MIME.includes(mime)) {
      return reply.status(400).send({ error: `Type MIME non supporté: ${mime}` })
    }

    const chunks: Buffer[] = []
    for await (const chunk of data.file) chunks.push(chunk)
    const buffer = Buffer.concat(chunks)

    if (buffer.length > 50 * 1024 * 1024) {
      return reply.status(400).send({ error: 'Fichier trop volumineux (max 50 MB)' })
    }

    const { storageKey, filePath } = saveFile(buffer, data.filename)
    const sha256 = computeSha256(filePath)

    const intake = await prisma.documentIntake.create({
      data: {
        status: 'PARSING',
        sourceFilename: data.filename,
        sourceMimeType: mime,
        sourceStorageKey: storageKey,
        sourceSha256: sha256,
        parserVersion: PARSER_VERSION
      }
    })

    setImmediate(async () => {
      try {
        const parseResult = await parsePdfToHtml(filePath)

        let rawText = ''
        if (mime === 'application/pdf') {
          const buf = fs.readFileSync(filePath)
          const pdfData = await pdfParse(buf)
          rawText = pdfData.text || ''
        } else {
          rawText = fs.readFileSync(filePath, 'utf8')
        }

        rawText = sanitizeForDb(rawText)
        const cleanHtml = sanitizeForDb(parseResult.bodyHtml)

        const generatedTitle = await generateTitle(rawText)
        const title: string =
          generatedTitle ??
          extractTitleHeuristic(rawText) ??
          data.filename.replace(/\.[^.]+$/, '')

        const generatedSummary = await generateSummary(rawText)
        const summary: string =
          generatedSummary ??
          (() => {
            const firstP = rawText.trim().split('\n\n')[0]?.trim()
            return firstP ? firstP.slice(0, 300) : 'Résumé non disponible.'
          })()

        const language = await detectLanguage(rawText)

        await prisma.documentIntake.update({
          where: { id: intake.id },
          data: {
            status: 'PARSED',
            generatedBodyHtml: cleanHtml,
            generatedTitle: sanitizeForDb(title),
            generatedSummary: sanitizeForDb(summary),
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

    return reply.status(201).send(intake)
  })

  // GET /api/intake
  app.get('/', async (_req: FastifyRequest, _reply: FastifyReply) => {
    return prisma.documentIntake.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, status: true, sourceFilename: true, sourceMimeType: true,
        detectedLanguage: true, editedLanguage: true,
        generatedTitle: true, editedTitle: true,
        createdAt: true, updatedAt: true, publishedArticleId: true
      }
    })
  })

  // GET /api/intake/:id
  app.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const intake = await prisma.documentIntake.findUnique({ where: { id: req.params.id } })
    if (!intake) return reply.status(404).send({ error: 'Introuvable' })
    return intake
  })

  // PATCH /api/intake/:id — edit title, summary, bodyHtml, language
  app.patch('/:id', async (req: FastifyRequest<{ Params: { id: string }; Body: Record<string, string> }>, reply: FastifyReply) => {
    const intake = await prisma.documentIntake.findUnique({ where: { id: req.params.id } })
    if (!intake) return reply.status(404).send({ error: 'Introuvable' })

    // FIX: published articles are fully immutable
    if (intake.status === 'PUBLISHED') {
      return reply.status(400).send({ error: 'Article déjà publié, modification impossible' })
    }
    // FIX: guard against editing while parsing is still running
    if (intake.status === 'PARSING' || intake.status === 'UPLOADED') {
      return reply.status(400).send({ error: 'Parsing en cours, veuillez patienter avant de modifier' })
    }

    const { title, summary, bodyHtml, language } = req.body

    const updated = await prisma.documentIntake.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { editedTitle: sanitizeForDb(title) }),
        ...(summary !== undefined && { editedSummary: sanitizeForDb(summary) }),
        ...(bodyHtml !== undefined && { editedBodyHtml: sanitizeForDb(bodyHtml) }),
        ...(language !== undefined && { editedLanguage: language }),
        status: 'READY'
      }
    })
    return updated
  })

  // POST /api/intake/:id/regenerate-title
  app.post('/:id/regenerate-title', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const intake = await prisma.documentIntake.findUnique({ where: { id: req.params.id } })
    if (!intake) return reply.status(404).send({ error: 'Introuvable' })
    // FIX: published articles cannot be regenerated
    if (intake.status === 'PUBLISHED') {
      return reply.status(400).send({ error: 'Article publié — régénération impossible' })
    }

    const rawText = await getTextFromIntake(req.params.id)
    const generated = await generateTitle(rawText)
    const title: string = generated ?? extractTitleHeuristic(rawText) ?? intake.sourceFilename.replace(/\.[^.]+$/, '')

    await prisma.documentIntake.update({
      where: { id: req.params.id },
      data: { generatedTitle: sanitizeForDb(title) }
    })

    return { title }
  })

  // POST /api/intake/:id/regenerate-body
  app.post('/:id/regenerate-body', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const intake = await prisma.documentIntake.findUnique({ where: { id: req.params.id } })
    if (!intake) return reply.status(404).send({ error: 'Introuvable' })
    // FIX: published articles cannot be regenerated
    if (intake.status === 'PUBLISHED') {
      return reply.status(400).send({ error: 'Article publié — régénération impossible' })
    }

    const filePath = getFilePath(intake.sourceStorageKey)
    if (!fs.existsSync(filePath)) {
      return reply.status(404).send({ error: 'Fichier source introuvable' })
    }

    const result = await parsePdfToHtml(filePath)
    const cleanHtml = sanitizeForDb(result.bodyHtml)

    await prisma.documentIntake.update({
      where: { id: req.params.id },
      data: { generatedBodyHtml: cleanHtml, parseWarnings: result.warnings }
    })

    return { bodyHtml: cleanHtml, warnings: result.warnings }
  })

  // POST /api/intake/:id/regenerate-summary
  app.post('/:id/regenerate-summary', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const intake = await prisma.documentIntake.findUnique({ where: { id: req.params.id } })
    if (!intake) return reply.status(404).send({ error: 'Introuvable' })
    // FIX: published articles cannot be regenerated
    if (intake.status === 'PUBLISHED') {
      return reply.status(400).send({ error: 'Article publié — régénération impossible' })
    }

    const rawText = await getTextFromIntake(req.params.id)
    const generated = await generateSummary(rawText)
    const firstP = rawText.trim().split('\n\n')[0]?.trim()
    const summary: string = generated ?? (firstP ? firstP.slice(0, 300) : 'Résumé non disponible.')

    await prisma.documentIntake.update({
      where: { id: req.params.id },
      data: { generatedSummary: sanitizeForDb(summary) }
    })

    return { summary }
  })

  // POST /api/intake/:id/publish
  app.post('/:id/publish', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const intake = await prisma.documentIntake.findUnique({ where: { id: req.params.id } })
    if (!intake) return reply.status(404).send({ error: 'Introuvable' })
    if (intake.status === 'PUBLISHED') return reply.status(400).send({ error: 'Déjà publié' })
    if (intake.status === 'PARSING' || intake.status === 'UPLOADED') {
      return reply.status(400).send({ error: 'Impossible de publier : parsing encore en cours' })
    }
    if (intake.status === 'FAILED') {
      return reply.status(400).send({ error: 'Impossible de publier : le parsing a échoué' })
    }

    // Use edited values if available, fall back to generated values
    const title: string | null = intake.editedTitle ?? intake.generatedTitle ?? null
    const summary: string | null = intake.editedSummary ?? intake.generatedSummary ?? null
    const bodyHtml: string | null = intake.editedBodyHtml ?? intake.generatedBodyHtml ?? null
    const language: string = intake.editedLanguage ?? intake.detectedLanguage ?? 'other'

    if (!title || !summary || !bodyHtml) {
      return reply.status(400).send({ error: 'Titre, résumé et corps HTML requis avant publication' })
    }

    // Deduplicate slug
    const baseSlug = slugifyTitle(title)
    let slug = baseSlug
    let suffix = 0
    while (await prisma.publishedArticle.findUnique({ where: { slug } })) {
      suffix++
      slug = `${baseSlug}-${suffix}`
    }

    // FIX: sourceIntakeId removed from PublishedArticle schema
    const article = await prisma.publishedArticle.create({
      data: {
        slug,
        title,
        summary,
        bodyHtml,
        language
      }
    })

    await prisma.documentIntake.update({
      where: { id: intake.id },
      data: { status: 'PUBLISHED', publishedArticleId: article.id }
    })

    return article
  })
}
