import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import sql from '../db'
import { requireAuth } from '../auth'

interface PlaceResult {
  name: string
  lat: number
  lng: number
  placeId: string
  address?: string
  rating?: number
  reviewCount?: number
  priceLevel?: number
  verified: boolean
  visitCount: number
  totalCalories: number
  totalCost: number
  ratingSum: number
  ratingCount: number
}

export async function placesRoutes(fastify: FastifyInstance) {
  // GET /nearby-buffets?lat=X&lng=Y&radius=16000
  // Serves buffets from Postgres only. The database is populated by the
  // seed scripts (scripts/seed-us-buffets.ts) — no runtime Places API calls.
  fastify.get<{
    Querystring: { lat: string; lng: string; radius?: string }
  }>('/nearby-buffets', async (request, reply) => {
    const { lat, lng, radius = '16000' } = request.query

    if (!lat || !lng) {
      return reply.status(400).send({ error: 'lat and lng are required' })
    }

    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)
    const radiusN = parseFloat(radius)

    const rows = await sql<{ place_id: string; name: string; latitude: number; longitude: number; address: string | null; rating: number | null; review_count: number | null; price_level: number | null; verified: boolean; visit_count: number; total_calories: string; total_cost: number; rating_sum: number; rating_count: number }[]>`
      SELECT place_id, name, latitude, longitude, address, rating, review_count, price_level, verified,
             visit_count, total_calories, total_cost, rating_sum, rating_count
      FROM buffets
      WHERE ST_DWithin(
        location,
        ST_MakePoint(${lngN}, ${latN})::geography,
        ${radiusN}
      )
      ORDER BY ST_Distance(location, ST_MakePoint(${lngN}, ${latN})::geography) ASC
      LIMIT 100
    `

    const results: PlaceResult[] = rows.map(r => ({
      name: r.name,
      lat: r.latitude,
      lng: r.longitude,
      placeId: r.place_id,
      address: r.address ?? undefined,
      rating: r.rating ?? undefined,
      reviewCount: r.review_count ?? undefined,
      priceLevel: r.price_level ?? undefined,
      verified: r.verified,
      visitCount: r.visit_count,
      totalCalories: Number(r.total_calories),
      totalCost: r.total_cost,
      ratingSum: r.rating_sum,
      ratingCount: r.rating_count,
    }))

    return reply.send({ results })
  })

  // POST /buffets/:placeId/visit — write-through community aggregates.
  // Called by the app after a session is saved; Firestore keeps the
  // individual sessions, Postgres keeps the displayable summary counters.
  fastify.post<{ Params: { placeId: string } }>('/buffets/:placeId/visit', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = z.object({
      calories: z.number().int().min(0).max(20000),
      cost: z.number().min(0).max(1000),
      rating: z.number().int().min(1).max(5).optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: body.error.message } })
    }
    const { calories, cost, rating } = body.data

    const updated = await sql`
      UPDATE buffets SET
        visit_count    = visit_count + 1,
        total_calories = total_calories + ${calories},
        total_cost     = total_cost + ${cost},
        rating_sum     = rating_sum + ${rating ?? 0},
        rating_count   = rating_count + ${rating != null ? 1 : 0}
      WHERE place_id = ${request.params.placeId}
      RETURNING place_id
    `
    if (updated.length === 0) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Unknown buffet.' } })
    }
    return reply.send({ ok: true })
  })

  // POST /buffets — register a user-added buffet (custom typed name).
  // Dedupes against existing rows: a similarly named buffet within 200m is
  // treated as the same place, so typos don't spawn duplicates.
  fastify.post('/buffets', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = z.object({
      name: z.string().trim().min(2).max(120),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      address: z.string().trim().max(300).optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: body.error.message } })
    }
    const { name, lat, lng, address } = body.data

    const [existing] = await sql<{ place_id: string; name: string; verified: boolean }[]>`
      SELECT place_id, name, verified
      FROM buffets
      WHERE ST_DWithin(location, ST_MakePoint(${lng}, ${lat})::geography, 200)
        AND (name ILIKE ${name} OR similarity(name, ${name}) > 0.4)
      ORDER BY similarity(name, ${name}) DESC
      LIMIT 1
    `
    if (existing) {
      return reply.send({ placeId: existing.place_id, name: existing.name, verified: existing.verified, created: false })
    }

    const placeId = `user_${randomUUID()}`
    await sql`
      INSERT INTO buffets (place_id, name, address, latitude, longitude, source, verified, last_updated)
      VALUES (${placeId}, ${name}, ${address ?? null}, ${lat}, ${lng}, 'user', false, NOW())
    `
    return reply.send({ placeId, name, verified: false, created: true })
  })
}
