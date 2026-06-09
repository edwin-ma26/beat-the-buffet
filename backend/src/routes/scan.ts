import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { createClient } from 'wind-ai'

const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
const WIND_APP_ID = '5b61f8d1-6222-4cc2-8c50-8896669e8594'
const WIND_FEATURE_ID = 'btb-scan'
const WIND_MODEL = 'google/gemini-2.5-flash'
const WIND_BASE_URL = 'https://wind-production-3225.up.railway.app'

export async function scanRoutes(fastify: FastifyInstance) {
  fastify.post('/scan', async (request, reply) => {
    const body = z.object({
      imageBase64: z.string().min(1),
      prompt:      z.string().min(1),
      windUserId:  z.string().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: body.error.message } })
    }

    const { imageBase64, prompt, windUserId } = body.data

    // Wind path — bill the user's wallet
    if (windUserId) {
      const WIND_API_KEY = process.env.WIND_API_KEY
      if (!WIND_API_KEY) return reply.status(500).send({ error: { code: 'WIND_NOT_CONFIGURED' } })

      const wind = createClient({ apiKey: WIND_API_KEY, baseUrl: WIND_BASE_URL })
      const windRes = await wind.chat({
        userId:    windUserId,
        featureId: WIND_FEATURE_ID,
        model:     WIND_MODEL,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          ],
        }],
      }) as any

      // Normalize to the same Gemini envelope shape the iOS app already parses
      const text = windRes?.choices?.[0]?.message?.content ?? ''
      return reply.send({
        candidates: [{ content: { parts: [{ text }] } }],
      })
    }

    // Gemini path (free / Plus subscribers)
    const { GEMINI_API_KEY } = process.env
    if (!GEMINI_API_KEY) return reply.status(500).send({ error: { code: 'GEMINI_NOT_CONFIGURED' } })

    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'image/jpeg', data: imageBase64 } },
          ],
        }],
        generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
      }),
    })

    const result = await geminiRes.json()
    if (!geminiRes.ok) return reply.status(geminiRes.status).send(result)
    return reply.send(result)
  })

  // GET /wind/balance?windUserId=xxx — proxy balance check without exposing API key
  fastify.get<{ Querystring: { windUserId: string } }>('/wind/balance', async (request, reply) => {
    const { windUserId } = request.query
    if (!windUserId) return reply.status(400).send({ error: 'windUserId required' })

    const WIND_API_KEY = process.env.WIND_API_KEY
    if (!WIND_API_KEY) return reply.status(500).send({ error: 'Wind not configured' })

    const wind = createClient({ apiKey: WIND_API_KEY, baseUrl: WIND_BASE_URL })
    const balance = await wind.getBalance(WIND_APP_ID, windUserId) as any
    return reply.send(balance)
  })
}
