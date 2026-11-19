/**
 * Migrate all buffets from Postgres → Firestore.
 * Run: npx tsx scripts/postgres-to-firestore.ts
 */
import 'dotenv/config'
import sql from '../src/db'
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { join } from 'path'

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'beat-the-buffet-firebase-adminsdk-fbsvc-9b961a984c.json'), 'utf8')
)

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

function normalizedBuffetID(name: string): string {
  const lower = name.toLowerCase().trim()
  const clean = lower.replace(/[^a-z0-9 ]/g, '')
  const result = clean.replace(/ /g, '_')
  return result.slice(0, 60).replace(/^_+|_+$/g, '')
}

async function main() {
  const rows = await sql<{
    place_id: string
    name: string
    address: string | null
    latitude: number
    longitude: number
    rating: number | null
    review_count: number | null
    price_level: number | null
  }[]>`SELECT place_id, name, address, latitude, longitude, rating, review_count, price_level FROM buffets`

  console.log(`Migrating ${rows.length} buffets to Firestore…`)

  const BATCH_SIZE = 400
  let written = 0
  let skipped = 0

  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = db.batch()
    const chunk = rows.slice(i, i + BATCH_SIZE)

    for (const row of chunk) {
      if (!row.name || row.latitude == null || row.longitude == null) { skipped++; continue }
      const docId = normalizedBuffetID(row.name)
      const ref = db.collection('buffets').doc(docId)
      const data: Record<string, any> = {
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        placeId: row.place_id,
        visitCount: 0,
        totalCalories: 0,
        totalCost: 0,
        ratingSum: 0,
        ratingCount: 0,
      }
      if (row.address) data.address = row.address
      if (row.rating != null) data.googleRating = row.rating
      if (row.review_count != null) data.googleReviewCount = row.review_count
      if (row.price_level != null) data.priceLevel = row.price_level

      batch.set(ref, data, { merge: true })
      written++
    }

    await batch.commit()
    process.stdout.write(`\r  ${written} written, ${skipped} skipped…`)
  }

  console.log(`\n✅ Done! ${written} buffets written to Firestore.`)
  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
