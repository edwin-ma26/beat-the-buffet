import * as admin from 'firebase-admin'
import * as serviceAccount from '../beat-the-buffet-firebase-adminsdk-fbsvc-9b961a984c.json'

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY ?? ''

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
})

const db = admin.firestore()

async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_API_KEY}`
  const res = await fetch(url)
  const data = await res.json() as any
  if (data.status !== 'OK' || !data.results?.length) return null

  // Prefer a street_address result, fall back to first result
  const result = data.results.find((r: any) => r.types.includes('street_address')) ?? data.results[0]
  return result.formatted_address ?? null
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const snap = await db.collection('buffets').get()
  const missing = snap.docs.filter(doc => !doc.data().address)

  console.log(`Total buffets: ${snap.size}, missing address: ${missing.length}`)
  if (missing.length === 0) {
    console.log('Nothing to backfill.')
    return
  }

  let updated = 0
  let failed = 0

  for (const doc of missing) {
    const { latitude, longitude, name } = doc.data()
    if (!latitude || !longitude) { failed++; continue }

    const address = await reverseGeocode(latitude, longitude)
    if (address) {
      await db.collection('buffets').doc(doc.id).update({ address })
      console.log(`✓ ${name} → ${address}`)
      updated++
    } else {
      console.log(`✗ ${name} — geocoding failed`)
      failed++
    }

    // Stay under Google's 50 req/s limit
    await sleep(100)
  }

  console.log(`\nDone. Updated: ${updated}, failed: ${failed}`)
}

main().catch(console.error)
