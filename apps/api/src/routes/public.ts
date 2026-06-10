import { FastifyInstance, FastifyRequest } from 'fastify'
import prisma from '../utils/prisma'

export async function publicRoutes(app: FastifyInstance) {
  // GET /api/public/articles?languageGroup=fr|other&page=1
  app.get('/articles', async (req: FastifyRequest<{ Querystring: { languageGroup?: string; page?: string } }>) => {
    const { languageGroup, page: pageStr } = req.query
    const page = Math.max(1, parseInt(pageStr || '1', 10))
    const pageSize = 50

    let where: any = {}
    if (languageGroup === 'fr') {
      where.language = 'fr'
    } else if (languageGroup === 'other') {
      where.NOT = { language: 'fr' }
    }

    const [articles, total] = await Promise.all([
      prisma.publishedArticle.findMany({
        where,
        orderBy: { publishedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, slug: true, title: true, summary: true,
          language: true, publishedAt: true
        }
      }),
      prisma.publishedArticle.count({ where })
    ])

    return {
      articles,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize)
      }
    }
  })

  // GET /api/public/articles/:slug
  app.get('/articles/:slug', async (req: FastifyRequest<{ Params: { slug: string } }>, reply: any) => {
    const article = await prisma.publishedArticle.findUnique({
      where: { slug: req.params.slug }
    })
    if (!article) return reply.status(404).send({ error: 'Article introuvable' })
    return article
  })
}
