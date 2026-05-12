import { FastifyInstance } from 'fastify'
import { z } from 'zod'

const BTB_FEATURE_ID = 'btb-scan'

export async function scanRoutes(fastify: FastifyInstance) {
  // GET /app-info — iOS fetches this to build the Wind Connect URL
  // Returns the app's Wind UUID resolved from the sk_live_ key (never exposed to client)
  fastify.get('/app-info', async (_request, reply) => {
    const { WIND_API_URL, BTB_APP_API_KEY } = process.env
    const res = await fetch(`${WIND_API_URL}/v1/app/info`, {
      headers: { Authorization: `Bearer ${BTB_APP_API_KEY}` },
    })
    if (!res.ok) {
      return reply.status(503).send({ error: { code: 'APP_LOOKUP_FAILED', message: 'Could not resolve app ID' } })
    }
    const { id: appId, name: appName } = await res.json() as { id: string; name: string }
    return reply.send({ appId, appName })
  })

  // GET /balance?userId= — proxy balance check so sk_live_ key stays server-side
  fastify.get('/balance', async (request, reply) => {
    const { WIND_API_URL, BTB_APP_API_KEY } = process.env
    const { userId } = request.query as { userId?: string }
    if (!userId) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: 'userId is required' } })
    }
    const res = await fetch(`${WIND_API_URL}/v1/user/status?userId=${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${BTB_APP_API_KEY}` },
    })
    if (!res.ok) return reply.status(res.status).send(await res.json())
    const data = await res.json() as { wallet?: { balanceCents: number } }
    return reply.send({ balanceCents: data.wallet?.balanceCents ?? 0 })
  })

  // POST /scan — proxy AI scan through Wind gateway
  // iOS sends windUserId (received from Wind Connect callback) + image data
  // sk_live_ key stays server-side; Wind handles billing via featureId pricing rule
  fastify.post('/scan', async (request, reply) => {
    const { WIND_API_URL, BTB_APP_API_KEY } = process.env

    const body = z.object({
      windUserId:  z.string().min(1),
      imageBase64: z.string().min(1),
      prompt:      z.string().min(1),
      model:       z.string().optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: body.error.message } })
    }

    const gatewayRes = await fetch(`${WIND_API_URL}/v1/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${BTB_APP_API_KEY}`,
      },
      body: JSON.stringify({
        windUserId: body.data.windUserId,
        featureId: BTB_FEATURE_ID,
        model:     body.data.model ?? 'gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: body.data.prompt },
            { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${body.data.imageBase64}` } },
          ],
        }],
      }),
    })

    const result = await gatewayRes.json() as any
    fastify.log.info({ windStatus: gatewayRes.status, windResult: result }, 'Wind response')

    if (!gatewayRes.ok) {
      return reply.status(gatewayRes.status).send(result)
    }

    // Normalize OpenAI-style response → Gemini envelope the iOS app expects
    const text: string = result.choices?.[0]?.message?.content
      ?? result.candidates?.[0]?.content?.parts?.[0]?.text
      ?? ''

    return reply.send({
      candidates: [{ content: { parts: [{ text }] } }],
    })
  })
}
