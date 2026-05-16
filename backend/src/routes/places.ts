import { FastifyInstance } from 'fastify'

interface PlaceResult {
  name: string
  lat: number
  lng: number
  placeId: string
}

export async function placesRoutes(fastify: FastifyInstance) {
  // GET /nearby-buffets?lat=X&lng=Y&radius=16000
  // Returns up to 20 real buffet/AYCE restaurants from Google Places near the given coords.
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

    const results: PlaceResult[] = (data.results ?? []).map((p: any) => ({
      name: p.name,
      lat: p.geometry.location.lat,
      lng: p.geometry.location.lng,
      placeId: p.place_id,
    }))

    return reply.send({ results })
  })
}
