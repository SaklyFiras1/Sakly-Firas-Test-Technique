import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

/**
 * Optional Basic Auth protection for intake (ops) routes.
 * Enabled only when OPS_AUTH_USER and OPS_AUTH_PASSWORD are set.
 */
export function registerBasicAuth(app: FastifyInstance) {
  const user = process.env.OPS_AUTH_USER
  const pass = process.env.OPS_AUTH_PASSWORD

  if (!user || !pass) {
    app.log.warn('OPS_AUTH_USER / OPS_AUTH_PASSWORD not set — intake routes are unprotected')
    return
  }

  const expected = Buffer.from(`${user}:${pass}`).toString('base64')

  app.addHook('preHandler', async (req: FastifyRequest, reply: FastifyReply) => {
    if (!req.url.startsWith('/api/intake')) return

    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Basic ')) {
      reply.header('WWW-Authenticate', 'Basic realm="DocPublish Admin"')
      return reply.status(401).send({ error: 'Authentication required' })
    }

    const provided = auth.slice(6)
    if (provided !== expected) {
      reply.header('WWW-Authenticate', 'Basic realm="DocPublish Admin"')
      return reply.status(401).send({ error: 'Invalid credentials' })
    }
  })
}
