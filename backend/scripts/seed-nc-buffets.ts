/**
 * Seed all buffets in North Carolina.
 * Run: npx tsx scripts/seed-nc-buffets.ts
 */
import 'dotenv/config'
import sql from '../src/db'
import { classifyByNameAndTypes, classifyByReviews } from '../src/classifier'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set')

const RADIUS = 15000 // 15km — tighter grid for complete state coverage
const PAGE_DELAY_MS   = 2200
const DETAIL_DELAY_MS = 200
const SEARCH_DELAY_MS = 300

// Dense coverage of NC — Triangle gets many sub-points, rest of state covered too
const LOCATIONS = [
  // ── Research Triangle (high buffet density) ──
  { name: 'Raleigh Downtown',       lat: 35.7796, lng: -78.6382 },
  { name: 'Raleigh North',          lat: 35.8601, lng: -78.6382 },
  { name: 'Raleigh NW / Brier Creek',lat: 35.8501, lng: -78.7501 },
  { name: 'Raleigh South',          lat: 35.7101, lng: -78.6382 },
  { name: 'Raleigh East',           lat: 35.7796, lng: -78.5501 },
  { name: 'Cary',                   lat: 35.7915, lng: -78.7811 },
  { name: 'Morrisville',            lat: 35.8237, lng: -78.8253 },
  { name: 'Apex',                   lat: 35.7321, lng: -78.8503 },
  { name: 'Holly Springs',          lat: 35.6521, lng: -78.8342 },
  { name: 'Durham Downtown',        lat: 35.9940, lng: -78.8986 },
  { name: 'Durham South / RTP',     lat: 35.9101, lng: -78.8986 },
  { name: 'Durham North',           lat: 36.0501, lng: -78.8986 },
  { name: 'Chapel Hill',            lat: 35.9132, lng: -79.0558 },
  { name: 'Carrboro',               lat: 35.9101, lng: -79.0801 },
  { name: 'Hillsborough',           lat: 36.0751, lng: -79.1001 },
  { name: 'Wake Forest',            lat: 35.9779, lng: -78.5097 },
  { name: 'Garner',                 lat: 35.7068, lng: -78.6138 },
  { name: 'Clayton',                lat: 35.6501, lng: -78.4551 },
  { name: 'Fuquay-Varina',          lat: 35.5843, lng: -78.8001 },

  // ── Charlotte Metro ──
  { name: 'Charlotte Uptown',       lat: 35.2271, lng: -80.8431 },
  { name: 'Charlotte South',        lat: 35.1501, lng: -80.8431 },
  { name: 'Charlotte East',         lat: 35.2271, lng: -80.7501 },
  { name: 'Charlotte North / UCity',lat: 35.3101, lng: -80.7501 },
  { name: 'Charlotte NW / Steele Creek', lat: 35.2271, lng: -80.9501 },
  { name: 'Matthews',               lat: 35.1168, lng: -80.7204 },
  { name: 'Concord',                lat: 35.4088, lng: -80.5795 },
  { name: 'Kannapolis',             lat: 35.4868, lng: -80.6212 },
  { name: 'Gastonia',               lat: 35.2621, lng: -81.1873 },
  { name: 'Huntersville',           lat: 35.4101, lng: -80.8431 },
  { name: 'Mooresville',            lat: 35.5746, lng: -80.8098 },
  { name: 'Rock Hill SC (border)',  lat: 34.9249, lng: -81.0251 },

  // ── Triad (Greensboro / Winston-Salem / High Point) ──
  { name: 'Greensboro',             lat: 36.0726, lng: -79.7920 },
  { name: 'Greensboro East',        lat: 36.0726, lng: -79.7001 },
  { name: 'Winston-Salem',          lat: 36.0999, lng: -80.2442 },
  { name: 'Winston-Salem East',     lat: 36.0999, lng: -80.1501 },
  { name: 'High Point',             lat: 35.9557, lng: -80.0053 },
  { name: 'Burlington',             lat: 36.0957, lng: -79.4378 },
  { name: 'Asheboro',               lat: 35.7079, lng: -79.8142 },
  { name: 'Kernersville',           lat: 36.1201, lng: -80.0751 },

  // ── Fayetteville / Fort Bragg ──
  { name: 'Fayetteville',           lat: 35.0527, lng: -78.8784 },
  { name: 'Fayetteville North',     lat: 35.1301, lng: -78.8784 },
  { name: 'Hope Mills',             lat: 34.9701, lng: -78.9401 },
  { name: 'Spring Lake',            lat: 35.1851, lng: -78.9751 },

  // ── Eastern NC ──
  { name: 'Rocky Mount',            lat: 35.9382, lng: -77.7905 },
  { name: 'Greenville NC',          lat: 35.6127, lng: -77.3664 },
  { name: 'Wilson',                 lat: 35.7213, lng: -77.9152 },
  { name: 'Goldsboro',              lat: 35.3851, lng: -77.9924 },
  { name: 'Jacksonville NC',        lat: 34.7540, lng: -77.4302 },
  { name: 'New Bern',               lat: 35.1085, lng: -77.0441 },
  { name: 'Kinston',                lat: 35.2627, lng: -77.5816 },
  { name: 'Wilmington',             lat: 34.2257, lng: -77.9447 },
  { name: 'Wilmington North',       lat: 34.3001, lng: -77.9447 },
  { name: 'Elizabeth City',         lat: 36.2946, lng: -76.2511 },
  { name: 'Henderson',              lat: 36.3296, lng: -78.3997 },
  { name: 'Dunn',                   lat: 35.3068, lng: -78.6087 },
  { name: 'Lumberton',              lat: 34.6182, lng: -79.0086 },

  // ── Western / Foothills / Mountains ──
  { name: 'Asheville',              lat: 35.5951, lng: -82.5515 },
  { name: 'Asheville East',         lat: 35.5951, lng: -82.4501 },
  { name: 'Hickory',                lat: 35.7329, lng: -81.3412 },
  { name: 'Statesville',            lat: 35.7826, lng: -80.8873 },
  { name: 'Salisbury',              lat: 35.6710, lng: -80.4742 },
  { name: 'Boone',                  lat: 36.2168, lng: -81.6746 },
  { name: 'Morganton',              lat: 35.7451, lng: -81.6854 },
  { name: 'Sanford',                lat: 35.4799, lng: -79.1803 },
  { name: 'Pinehurst / Southern Pines', lat: 35.1954, lng: -79.4678 },
  { name: 'Hendersonville',         lat: 35.3182, lng: -82.4618 },
  { name: 'Waynesville',            lat: 35.4885, lng: -82.9879 },
  { name: 'Shelby',                 lat: 35.2921, lng: -81.5357 },
  { name: 'Monroe',                 lat: 34.9854, lng: -80.5495 },
  { name: 'Albemarle',              lat: 35.3501, lng: -80.2001 },
  { name: 'Lexington NC',           lat: 35.8237, lng: -80.2534 },
  { name: 'Thomasville',            lat: 35.8826, lng: -80.0823 },
]

const NEARBY_KEYWORDS = ['buffet', 'all you can eat', 'chinese buffet', 'indian buffet', 'korean bbq']
const TEXT_QUERIES    = ['all you can eat restaurant', 'AYCE buffet', 'hot pot restaurant', 'unlimited food restaurant']

const seenPlaceIds = new Set<string>()
let totalInserted = 0
let totalRejected = 0
let totalUncertain = 0
let totalUncertainPassed = 0
let totalSkipped = 0

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

async function fetchPage(url: string): Promise<{ results: any[]; nextToken?: string }> {
  const res = await fetch(url)
  const data = await res.json() as any
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    if (data.status !== 'ZERO_RESULTS') console.warn(`  ⚠️  API status: ${data.status}`)
    return { results: [] }
  }
  return { results: data.results ?? [], nextToken: data.next_page_token }
}

async function fetchAllPages(initialUrl: string): Promise<any[]> {
  const base = initialUrl.includes('textsearch') ? 'textsearch' : 'nearbysearch'
  const all: any[] = []
  let { results, nextToken } = await fetchPage(initialUrl)
  all.push(...results)
  while (nextToken) {
    await sleep(PAGE_DELAY_MS)
    const next = await fetchPage(
      `https://maps.googleapis.com/maps/api/place/${base}/json?pagetoken=${nextToken}&key=${API_KEY}`
    )
    all.push(...next.results)
    nextToken = next.nextToken
  }
  return all
}

async function fetchDetails(placeId: string): Promise<{ reviews: any[]; editorialSummary?: string }> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,editorial_summary&key=${API_KEY}`
  const res = await fetch(url)
  const data = await res.json() as any
  if (data.status !== 'OK') return { reviews: [] }
  return {
    reviews: data.result?.reviews ?? [],
    editorialSummary: data.result?.editorial_summary?.overview,
  }
}

async function upsertBuffets(places: any[]) {
  if (places.length === 0) return
  const CHUNK = 20
  const now = new Date().toISOString()
  for (let i = 0; i < places.length; i += CHUNK) {
    const chunk = places.slice(i, i + CHUNK)
    const values = chunk.map(p => [
      p.place_id, p.name, p.vicinity ?? null,
      p.geometry.location.lat, p.geometry.location.lng,
      p.rating ?? null, p.user_ratings_total ?? null,
      p.price_level ?? null, now,
    ])
    await sql`
      INSERT INTO buffets (place_id, name, address, latitude, longitude, rating, review_count, price_level, last_updated)
      VALUES ${sql(values)}
      ON CONFLICT (place_id) DO UPDATE SET
        name         = EXCLUDED.name,
        address      = EXCLUDED.address,
        rating       = EXCLUDED.rating,
        review_count = EXCLUDED.review_count,
        price_level  = EXCLUDED.price_level,
        last_updated = EXCLUDED.last_updated
    `
  }
  totalInserted += places.length
}

async function seedLocation(loc: { name: string; lat: number; lng: number }, existingPlaceIds: Set<string>) {
  process.stdout.write(`📍 ${loc.name} ... `)
  const coord = `${loc.lat},${loc.lng}`

  const searches = [
    ...NEARBY_KEYWORDS.map(kw =>
      fetchAllPages(
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
        `?location=${coord}&radius=${RADIUS}&keyword=${encodeURIComponent(kw)}&type=restaurant&key=${API_KEY}`
      )
    ),
    ...TEXT_QUERIES.map(q =>
      fetchAllPages(
        `https://maps.googleapis.com/maps/api/place/textsearch/json` +
        `?query=${encodeURIComponent(q)}&location=${coord}&radius=${RADIUS}&key=${API_KEY}`
      )
    ),
  ]

  const allResults = (await Promise.all(searches)).flat()

  // Deduplicate
  const merged = new Map<string, any>()
  for (const p of allResults) if (p.place_id) merged.set(p.place_id, p)

  const toPass: any[] = []
  const toCheck: any[] = []

  for (const place of merged.values()) {
    if (seenPlaceIds.has(place.place_id)) continue
    seenPlaceIds.add(place.place_id)

    if (existingPlaceIds.has(place.place_id)) { totalSkipped++; continue }

    const result = classifyByNameAndTypes(place.name, place.types ?? [])
    if (result === 'pass') toPass.push(place)
    else if (result === 'reject') totalRejected++
    else { toCheck.push(place); totalUncertain++ }
  }

  // Stage 2: check reviews for uncertain
  const uncertainPassed: any[] = []
  for (const place of toCheck) {
    await sleep(DETAIL_DELAY_MS)
    const details = await fetchDetails(place.place_id)
    if (classifyByReviews(details.reviews, details.editorialSummary)) {
      uncertainPassed.push(place)
      totalUncertainPassed++
    } else {
      totalRejected++
    }
  }

  const passing = [...toPass, ...uncertainPassed]
  console.log(`${passing.length} buffets (${toPass.length} direct + ${uncertainPassed.length} via reviews)`)
  await upsertBuffets(passing)
}

async function main() {
  console.log('🍽️  Beat the Buffet — North Carolina Seed')
  console.log(`   ${LOCATIONS.length} search points × ${NEARBY_KEYWORDS.length + TEXT_QUERIES.length} queries each\n`)

  const existing = await sql<{ place_id: string }[]>`SELECT place_id FROM buffets`
  const existingPlaceIds = new Set(existing.map(r => r.place_id))
  console.log(`   ${existingPlaceIds.size} buffets already in DB — skipping those\n`)

  for (const loc of LOCATIONS) {
    try {
      await seedLocation(loc, existingPlaceIds)
    } catch (err) {
      console.error(`  ⚠️  Error at ${loc.name}:`, err)
    }
    await sleep(SEARCH_DELAY_MS)
  }

  console.log('\n✅ Done!')
  console.log(`   Buffets inserted/updated : ${totalInserted}`)
  console.log(`   Unique place IDs seen    : ${seenPlaceIds.size}`)
  console.log(`   Skipped (already in DB)  : ${totalSkipped}`)
  console.log(`   Rejected (not buffets)   : ${totalRejected}`)
  console.log(`   Uncertain → passed       : ${totalUncertainPassed}`)

  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
