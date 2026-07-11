import { FastifyInstance } from 'fastify'
import sql from '../db'

export async function searchRoutes(fastify: FastifyInstance) {
  // GET /search-buffets?lat=X&lng=Y&q=TEXT&radius=40000
  // Returns buffets near the given coords ranked by text match + distance.
  fastify.get<{
    Querystring: { lat: string; lng: string; q?: string; radius?: string }
  }>('/search-buffets', async (request, reply) => {
    const { lat, lng, q = '', radius = '40000' } = request.query

    if (!lat || !lng) {
      return reply.status(400).send({ error: 'lat and lng are required' })
    }

    const latN = parseFloat(lat)
    const lngN = parseFloat(lng)
    const radiusN = parseInt(radius, 10)
    const query = q.trim()

    let results

    if (query.length === 0) {
      // No text query — return nearest buffets sorted by distance
      results = await sql`
        SELECT
          id, place_id, name, address, latitude, longitude,
          rating, review_count, price_level, verified,
          visit_count, total_calories, total_cost, rating_sum, rating_count,
          ST_Distance(location, ST_MakePoint(${lngN}, ${latN})::geography) AS distance_m
        FROM buffets
        WHERE ST_DWithin(
          location,
          ST_MakePoint(${lngN}, ${latN})::geography,
          ${radiusN}
        )
        ORDER BY distance_m ASC
        LIMIT 50
      `
    } else {
      // Text query — rank by trigram similarity + distance
      results = await sql`
        SELECT
          id, place_id, name, address, latitude, longitude,
          rating, review_count, price_level, verified,
          visit_count, total_calories, total_cost, rating_sum, rating_count,
          ST_Distance(location, ST_MakePoint(${lngN}, ${latN})::geography) AS distance_m,
          similarity(name, ${query}) AS sim
        FROM buffets
        WHERE ST_DWithin(
          location,
          ST_MakePoint(${lngN}, ${latN})::geography,
          ${radiusN}
        )
        AND (
          name ILIKE ${query + '%'}
          OR name ILIKE ${'% ' + query + '%'}
          OR similarity(name, ${query}) > 0.15
        )
        ORDER BY
          similarity(name, ${query}) DESC,
          distance_m ASC
        LIMIT 20
      `
    }

    return reply.send({ results })
  })
}
