import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(__dirname, '../.env') })

import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { scanRoutes } from './routes/scan'

const PORT = Number(process.env.PORT ?? 4000)
const JWT_SECRET = process.env.JWT_SECRET ?? ''

async function start() {
  const fastify = Fastify({ logger: true, bodyLimit: 10 * 1024 * 1024 })

  await fastify.register(cors, { origin: true })
  await fastify.register(jwt, { secret: JWT_SECRET })

  fastify.get('/health', async () => ({ status: 'ok' }))

  await fastify.register(scanRoutes, { prefix: '/' })

  await fastify.listen({ port: PORT, host: '::' })
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
