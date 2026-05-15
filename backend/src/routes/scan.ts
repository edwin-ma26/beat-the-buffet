import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

export async function scanRoutes(fastify: FastifyInstance) {
  // POST /scan — proxy image scan to Gemini, keeping the API key server-side
  fastify.post('/scan', async (request, reply) => {
    const { GEMINI_API_KEY } = process.env

    const body = z.object({
      imageBase64: z.string().min(1),
      prompt:      z.string().min(1),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: body.error.message } })
    }

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: body.data.prompt },
            { inline_data: { mime_type: 'image/jpeg', data: body.data.imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })

    const result = await geminiRes.json()
    if (!geminiRes.ok) return reply.status(geminiRes.status).send(result)
    return reply.send(result)
  })
}
