import { config } from 'dotenv'
config() // loads .env locally; no-op in production

import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import { scanRoutes } from './routes/scan'
import { placesRoutes } from './routes/places'
import { searchRoutes } from './routes/search'

const PORT = Number(process.env.PORT ?? 4000)

async function start() {
  const fastify = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 }) // 10MB

  await fastify.register(cors, { origin: true })
  await fastify.register(rateLimit, {
    max: 120,
    timeWindow: '1 minute',
    // Per authenticated user when available, else per IP
    keyGenerator: req => (req as any).uid ?? req.ip,
  })

  fastify.get('/health', async () => ({ status: 'ok' }))
  await fastify.register(scanRoutes)
  await fastify.register(placesRoutes)
  await fastify.register(searchRoutes)

  await fastify.listen({ port: PORT, host: '0.0.0.0' })
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
