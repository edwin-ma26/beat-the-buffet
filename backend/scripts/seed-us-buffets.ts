import 'dotenv/config'
import sql from '../src/db'
import { classifyByNameAndTypes, classifyByReviews } from '../src/classifier'

const API_KEY = process.env.GOOGLE_PLACES_API_KEY
if (!API_KEY) throw new Error('GOOGLE_PLACES_API_KEY is not set')

// Major US metro search centers. Large metros have multiple points to cover suburbs.
const CITIES = [
  // Northeast
  { name: 'New York City', lat: 40.7128, lng: -74.0060 },
  { name: 'NYC - Queens', lat: 40.7282, lng: -73.7949 },
  { name: 'NYC - Brooklyn', lat: 40.6782, lng: -73.9442 },
  { name: 'NYC - Bronx', lat: 40.8448, lng: -73.8648 },
  { name: 'Philadelphia', lat: 39.9526, lng: -75.1652 },
  { name: 'Boston', lat: 42.3601, lng: -71.0589 },
  { name: 'Pittsburgh', lat: 40.4406, lng: -79.9959 },
  { name: 'Baltimore', lat: 39.2904, lng: -76.6122 },
  { name: 'Washington DC', lat: 38.9072, lng: -77.0369 },
  { name: 'DC - Northern Virginia', lat: 38.8816, lng: -77.1711 },
  // Southeast
  { name: 'Atlanta', lat: 33.7490, lng: -84.3880 },
  { name: 'Miami', lat: 25.7617, lng: -80.1918 },
  { name: 'Miami - Fort Lauderdale', lat: 26.1224, lng: -80.1373 },
  { name: 'Orlando', lat: 28.5383, lng: -81.3792 },
  { name: 'Tampa', lat: 27.9506, lng: -82.4572 },
  { name: 'Charlotte', lat: 35.2271, lng: -80.8431 },
  { name: 'Nashville', lat: 36.1627, lng: -86.7816 },
  { name: 'Raleigh', lat: 35.7796, lng: -78.6382 },
  { name: 'Jacksonville', lat: 30.3322, lng: -81.6557 },
  { name: 'Richmond', lat: 37.5407, lng: -77.4360 },
  // Midwest
  { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
  { name: 'Chicago - Suburbs', lat: 41.9742, lng: -87.9073 },
  { name: 'Chicago - South', lat: 41.6764, lng: -87.6531 },
  { name: 'Detroit', lat: 42.3314, lng: -83.0458 },
  { name: 'Minneapolis', lat: 44.9778, lng: -93.2650 },
  { name: 'Cleveland', lat: 41.4993, lng: -81.6944 },
  { name: 'Columbus', lat: 39.9612, lng: -82.9988 },
  { name: 'Indianapolis', lat: 39.7684, lng: -86.1581 },
  { name: 'Kansas City', lat: 39.0997, lng: -94.5786 },
  { name: 'St. Louis', lat: 38.6270, lng: -90.1994 },
  { name: 'Cincinnati', lat: 39.1031, lng: -84.5120 },
  { name: 'Milwaukee', lat: 43.0389, lng: -87.9065 },
  { name: 'Omaha', lat: 41.2565, lng: -95.9345 },
  // South / Texas
  { name: 'Houston', lat: 29.7604, lng: -95.3698 },
  { name: 'Houston - Suburbs', lat: 29.6911, lng: -95.6140 },
  { name: 'Dallas', lat: 32.7767, lng: -96.7970 },
  { name: 'Dallas - Fort Worth', lat: 32.7555, lng: -97.3308 },
  { name: 'Dallas - Plano', lat: 33.0198, lng: -96.6989 },
  { name: 'San Antonio', lat: 29.4241, lng: -98.4936 },
  { name: 'Austin', lat: 30.2672, lng: -97.7431 },
  { name: 'El Paso', lat: 31.7619, lng: -106.4850 },
  { name: 'Oklahoma City', lat: 35.4676, lng: -97.5164 },
  { name: 'New Orleans', lat: 29.9511, lng: -90.0715 },
  { name: 'Memphis', lat: 35.1495, lng: -90.0490 },
  { name: 'Louisville', lat: 38.2527, lng: -85.7585 },
  // Mountain / Southwest
  { name: 'Phoenix', lat: 33.4484, lng: -112.0740 },
  { name: 'Phoenix - Scottsdale', lat: 33.4942, lng: -111.9261 },
  { name: 'Phoenix - Mesa', lat: 33.4152, lng: -111.8315 },
  { name: 'Denver', lat: 39.7392, lng: -104.9903 },
  { name: 'Denver - Aurora', lat: 39.7294, lng: -104.8319 },
  { name: 'Salt Lake City', lat: 40.7608, lng: -111.8910 },
  { name: 'Albuquerque', lat: 35.0853, lng: -106.6056 },
  { name: 'Tucson', lat: 32.2226, lng: -110.9747 },
  { name: 'Las Vegas', lat: 36.1699, lng: -115.1398 },
  { name: 'Las Vegas - Henderson', lat: 36.0395, lng: -114.9817 },
  // West Coast
  { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
  { name: 'LA - San Gabriel Valley', lat: 34.0968, lng: -118.0478 },
  { name: 'LA - South Bay', lat: 33.8303, lng: -118.3406 },
  { name: 'LA - San Fernando Valley', lat: 34.1975, lng: -118.4009 },
  { name: 'LA - Orange County', lat: 33.7175, lng: -117.8311 },
  { name: 'San Diego', lat: 32.7157, lng: -117.1611 },
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194 },
  { name: 'SF - East Bay', lat: 37.8044, lng: -122.2712 },
  { name: 'SF - South Bay / San Jose', lat: 37.3382, lng: -121.8863 },
  { name: 'SF - Peninsula', lat: 37.5485, lng: -122.0597 },
  { name: 'Sacramento', lat: 38.5816, lng: -121.4944 },
  { name: 'Portland', lat: 45.5051, lng: -122.6750 },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321 },
  { name: 'Seattle - Bellevue', lat: 47.6101, lng: -122.2015 },
  // Pacific / Other
  { name: 'Honolulu', lat: 21.3069, lng: -157.8583 },
  { name: 'Anchorage', lat: 61.2181, lng: -149.9003 },
  // Northeast — Asian buffet corridors
  { name: 'NYC - Flushing', lat: 40.7676, lng: -73.8330 },
  { name: 'NYC - Sunset Park', lat: 40.6501, lng: -74.0038 },
  { name: 'NJ - Edison', lat: 40.5187, lng: -74.4121 },
  { name: 'NJ - Jersey City', lat: 40.7178, lng: -74.0431 },
  { name: 'NJ - Parsippany', lat: 40.8576, lng: -74.4265 },
  { name: 'MD - Rockville', lat: 39.0840, lng: -77.1528 },
  { name: 'VA - Annandale', lat: 38.8307, lng: -77.1961 },
  { name: 'MA - Quincy', lat: 42.2529, lng: -71.0023 },
  // Midwest — buffet-dense suburbs
  { name: 'IL - Skokie', lat: 42.0334, lng: -87.7334 },
  { name: 'MI - Troy', lat: 42.6064, lng: -83.1498 },
  { name: 'MI - Sterling Heights', lat: 42.5803, lng: -83.0302 },
  { name: 'OH - Dublin', lat: 40.0992, lng: -83.1141 },
  { name: 'MN - Brooklyn Park', lat: 45.0941, lng: -93.3732 },
  // South / Texas
  { name: 'TX - Sugar Land', lat: 29.6197, lng: -95.6349 },
  { name: 'TX - Plano', lat: 33.0198, lng: -96.6989 },
  { name: 'TX - Richardson', lat: 32.9483, lng: -96.7299 },
  { name: 'GA - Duluth', lat: 34.0032, lng: -84.1449 },
  { name: 'GA - Norcross', lat: 33.9412, lng: -84.2135 },
  // West — dense AYCE corridors
  { name: 'CA - Irvine', lat: 33.6846, lng: -117.8265 },
  { name: 'CA - Rowland Heights', lat: 33.9759, lng: -117.9054 },
  { name: 'CA - Walnut', lat: 34.0220, lng: -117.8659 },
  { name: 'CA - Sunnyvale', lat: 37.3688, lng: -122.0363 },
  { name: 'CA - Milpitas', lat: 37.4323, lng: -121.8996 },
  { name: 'CA - Fremont', lat: 37.5485, lng: -121.9886 },
  { name: 'CA - Cupertino', lat: 37.3230, lng: -122.0322 },
  { name: 'CA - Alhambra', lat: 34.0953, lng: -118.1270 },
  { name: 'WA - Bellevue', lat: 47.6101, lng: -122.2015 },
  { name: 'WA - Federal Way', lat: 47.3223, lng: -122.3126 },
  // Mid-size cities often overlooked
  { name: 'Fresno', lat: 36.7378, lng: -119.7871 },
  { name: 'Bakersfield', lat: 35.3733, lng: -119.0187 },
  { name: 'Stockton', lat: 37.9577, lng: -121.2908 },
  { name: 'Spokane', lat: 47.6587, lng: -117.4260 },
  { name: 'Boise', lat: 43.6150, lng: -116.2023 },
  { name: 'Tulsa', lat: 36.1540, lng: -95.9928 },
  { name: 'Wichita', lat: 37.6872, lng: -97.3301 },
  { name: 'Little Rock', lat: 34.7465, lng: -92.2896 },
  { name: 'Baton Rouge', lat: 30.4515, lng: -91.1871 },
  { name: 'Birmingham', lat: 33.5186, lng: -86.8104 },
  { name: 'Columbia SC', lat: 34.0007, lng: -81.0348 },
  { name: 'Greensboro', lat: 36.0726, lng: -79.7920 },
  { name: 'Knoxville', lat: 35.9606, lng: -83.9207 },
  { name: 'Des Moines', lat: 41.5868, lng: -93.6250 },
  { name: 'Madison', lat: 43.0731, lng: -89.4012 },
  { name: 'Grand Rapids', lat: 42.9634, lng: -85.6681 },
  { name: 'Akron', lat: 41.0814, lng: -81.5190 },
  { name: 'Toledo', lat: 41.6639, lng: -83.5552 },
  { name: 'Allentown', lat: 40.6023, lng: -75.4714 },
  { name: 'Hartford', lat: 41.7637, lng: -72.6851 },
  { name: 'Providence', lat: 41.8240, lng: -71.4128 },
  { name: 'Buffalo', lat: 42.8864, lng: -78.8784 },
  { name: 'Rochester NY', lat: 43.1566, lng: -77.6088 },
  { name: 'Albany', lat: 42.6526, lng: -73.7562 },
]

const RADIUS = 25000 // 25km per search center
const DELAY_MS = 250 // between city batches to avoid rate limits
const DETAIL_DELAY_MS = 150 // between Places Details calls

const seenPlaceIds = new Set<string>()
let totalInserted = 0
let totalRejected = 0
let totalUncertain = 0
let totalUncertainPassed = 0

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchPlacesPage(url: string): Promise<{ results: any[]; nextToken?: string }> {
  const res = await fetch(url)
  const data = await res.json() as any
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.warn(`  Places API status: ${data.status}`)
    return { results: [] }
  }
  return { results: data.results ?? [], nextToken: data.next_page_token }
}

async function fetchAllPages(initialUrl: string): Promise<any[]> {
  const all: any[] = []
  let { results, nextToken } = await fetchPlacesPage(initialUrl)
  all.push(...results)

  // Google allows up to 3 pages (60 results total) via next_page_token
  while (nextToken) {
    await sleep(2000) // Google requires ~2s before next_page_token is valid
    const pageUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextToken}&key=${API_KEY}`
    const page = await fetchPlacesPage(pageUrl)
    all.push(...page.results)
    nextToken = page.nextToken
  }

  return all
}

async function fetchPlaceDetails(placeId: string): Promise<{ reviews: any[]; editorialSummary?: string }> {
  const url = `https://maps.googleapis.com/maps/api/place/details/json` +
    `?place_id=${placeId}&fields=reviews,editorial_summary&key=${API_KEY}`
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

  await sql`
    INSERT INTO buffets (place_id, name, address, latitude, longitude, rating, review_count, price_level, last_updated)
    SELECT * FROM UNNEST(
      ${sql.array(places.map(p => p.place_id))}::text[],
      ${sql.array(places.map(p => p.name))}::text[],
      ${sql.array(places.map(p => p.vicinity ?? null))}::text[],
      ${sql.array(places.map(p => p.geometry.location.lat))}::float8[],
      ${sql.array(places.map(p => p.geometry.location.lng))}::float8[],
      ${sql.array(places.map(p => p.rating ?? null))}::real[],
      ${sql.array(places.map(p => p.user_ratings_total ?? null))}::int[],
      ${sql.array(places.map(p => p.price_level ?? null))}::int[],
      ${sql.array(places.map(() => new Date().toISOString()))}::timestamptz[]
    ) AS t(place_id, name, address, latitude, longitude, rating, review_count, price_level, last_updated)
    ON CONFLICT (place_id) DO UPDATE SET
      name         = EXCLUDED.name,
      address      = EXCLUDED.address,
      rating       = EXCLUDED.rating,
      review_count = EXCLUDED.review_count,
      price_level  = EXCLUDED.price_level,
      last_updated = EXCLUDED.last_updated
  `
  totalInserted += places.length
}

// Keyword variations that catch buffets not named "buffet"
const NEARBY_KEYWORDS = ['buffet', 'all you can eat', 'chinese buffet', 'indian buffet', 'korean bbq']
const TEXT_QUERIES    = ['all you can eat restaurant', 'AYCE buffet', 'hot pot buffet', 'unlimited food restaurant']

async function seedCity(city: { name: string; lat: number; lng: number }) {
  console.log(`\n📍 ${city.name}`)

  const loc = `${city.lat},${city.lng}`

  // Nearby searches for each keyword (all 3 pages each)
  const nearbyPromises = NEARBY_KEYWORDS.map(kw =>
    fetchAllPages(
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${loc}&radius=${RADIUS}&keyword=${encodeURIComponent(kw)}&type=restaurant&key=${API_KEY}`
    )
  )

  // Text searches (all 3 pages each)
  const textPromises = TEXT_QUERIES.map(q =>
    fetchAllPages(
      `https://maps.googleapis.com/maps/api/place/textsearch/json` +
      `?query=${encodeURIComponent(q)}&location=${loc}&radius=${RADIUS}&key=${API_KEY}`
    )
  )

  const allResults = await Promise.all([...nearbyPromises, ...textPromises])
  const nearbyResults = allResults.flat()
  const textResults: any[] = []

  // Merge and deduplicate by place_id
  const merged = new Map<string, any>()
  for (const p of [...nearbyResults, ...textResults]) {
    if (p.place_id) merged.set(p.place_id, p)
  }

  const toPass: any[] = []
  const toCheckDetails: any[] = []

  for (const place of merged.values()) {
    if (seenPlaceIds.has(place.place_id)) continue
    seenPlaceIds.add(place.place_id)

    const result = classifyByNameAndTypes(place.name, place.types ?? [])
    if (result === 'pass') {
      toPass.push(place)
    } else if (result === 'reject') {
      totalRejected++
    } else {
      toCheckDetails.push(place)
      totalUncertain++
    }
  }

  // Stage 2: check reviews for uncertain places
  const uncertainPassed: any[] = []
  for (const place of toCheckDetails) {
    await sleep(DETAIL_DELAY_MS)
    const details = await fetchPlaceDetails(place.place_id)
    if (classifyByReviews(details.reviews, details.editorialSummary)) {
      uncertainPassed.push(place)
      totalUncertainPassed++
    } else {
      totalRejected++
    }
  }

  const allPassing = [...toPass, ...uncertainPassed]
  console.log(`  ✅ ${toPass.length} pass | 🔍 ${toCheckDetails.length} checked reviews → ${uncertainPassed.length} pass | ❌ ${totalRejected} total rejected`)

  await upsertBuffets(allPassing)
}

async function main() {
  console.log('🍽️  Beat the Buffet — US Seed Script')
  console.log(`   Seeding ${CITIES.length} city centers...\n`)

  for (const city of CITIES) {
    try {
      await seedCity(city)
    } catch (err) {
      console.error(`  ⚠️  Error seeding ${city.name}:`, err)
    }
    await sleep(DELAY_MS)
  }

  console.log('\n✅ Done!')
  console.log(`   Total inserted/updated: ${totalInserted}`)
  console.log(`   Total rejected:         ${totalRejected}`)
  console.log(`   Uncertain → passed:     ${totalUncertainPassed}`)
  console.log(`   Unique place IDs seen:  ${seenPlaceIds.size}`)

  await sql.end()
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
