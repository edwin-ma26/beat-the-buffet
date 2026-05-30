import { FastifyInstance } from 'fastify'
import sql from '../db'
import { classifyByNameAndTypes } from '../classifier'

interface PlaceResult {
  name: string
  lat: number
  lng: number
  placeId: string
  address?: string
  rating?: number
  reviewCount?: number
  priceLevel?: number
}

export async function placesRoutes(fastify: FastifyInstance) {
  // GET /nearby-buffets?lat=X&lng=Y&radius=16000
  // Returns up to 20 buffets from Google Places and upserts them into Postgres.
  fastify.get<{
    Querystring: { lat: string; lng: string; radius?: string }
  }>('/nearby-buffets', async (request, reply) => {
    const { lat, lng, radius = '16000' } = request.query

    if (!lat || !lng) {
      return reply.status(400).send({ error: 'lat and lng are required' })
    }

    const apiKey = process.env.GOOGLE_PLACES_API_KEY
    if (!apiKey) {
      return reply.status(500).send({ error: 'Places API not configured' })
    }

    const url =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${lat},${lng}` +
      `&radius=${radius}` +
      `&keyword=buffet` +
      `&type=restaurant` +
      `&key=${apiKey}`

    const res = await fetch(url)
    const data = await res.json() as any

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      fastify.log.error({ placesStatus: data.status }, 'Google Places error')
      return reply.status(502).send({ error: data.status })
    }

    const places = (data.results ?? []) as any[]
    const results: PlaceResult[] = places
      .filter(p => classifyByNameAndTypes(p.name, p.types ?? []) !== 'reject')
      .map(p => ({
        name: p.name,
        lat: p.geometry.location.lat,
        lng: p.geometry.location.lng,
        placeId: p.place_id,
        address: p.vicinity,
        rating: p.rating,
        reviewCount: p.user_ratings_total,
        priceLevel: p.price_level,
      }))

    // Upsert into Postgres (fire-and-forget — don't block the response)
    if (results.length > 0) {
      sql`
        INSERT INTO buffets (place_id, name, address, latitude, longitude, rating, review_count, price_level, last_updated)
        SELECT * FROM UNNEST(
          ${sql.array(results.map(r => r.placeId))}::text[],
          ${sql.array(results.map(r => r.name))}::text[],
          ${sql.array(results.map(r => r.address ?? null))}::text[],
          ${sql.array(results.map(r => r.lat))}::float8[],
          ${sql.array(results.map(r => r.lng))}::float8[],
          ${sql.array(results.map(r => r.rating ?? null))}::real[],
          ${sql.array(results.map(r => r.reviewCount ?? null))}::int[],
          ${sql.array(results.map(r => r.priceLevel ?? null))}::int[],
          ${sql.array(results.map(() => new Date().toISOString()))}::timestamptz[]
        ) AS t(place_id, name, address, latitude, longitude, rating, review_count, price_level, last_updated)
        ON CONFLICT (place_id) DO UPDATE SET
          name         = EXCLUDED.name,
          address      = EXCLUDED.address,
          rating       = EXCLUDED.rating,
          review_count = EXCLUDED.review_count,
          price_level  = EXCLUDED.price_level,
          last_updated = EXCLUDED.last_updated
      `.catch(err => fastify.log.error(err, 'Postgres upsert failed'))
    }

    return reply.send({ results })
  })
}
