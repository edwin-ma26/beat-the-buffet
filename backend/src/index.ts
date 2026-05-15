import { config } from 'dotenv'
import path from 'path'
config({ path: path.resolve(__dirname, '../.env') })

import Fastify from 'fastify'
import cors from '@fastify/cors'
import { scanRoutes } from './routes/scan'

const PORT = Number(process.env.PORT ?? 4000)

async function start() {
  const fastify = Fastify({ logger: true })

  await fastify.register(cors, { origin: true })

  fastify.get('/health', async () => ({ status: 'ok' }))
  await fastify.register(scanRoutes)

  await fastify.listen({ port: PORT, host: '::' })
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
