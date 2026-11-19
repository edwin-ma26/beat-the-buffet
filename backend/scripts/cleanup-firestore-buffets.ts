/**
 * Remove duplicate buffet docs created with wrong hyphen-based IDs.
 * Run: npx tsx scripts/cleanup-firestore-buffets.ts
 */
import admin from 'firebase-admin'
import { readFileSync } from 'fs'
import { join } from 'path'

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, '..', 'beat-the-buffet-firebase-adminsdk-fbsvc-9b961a984c.json'), 'utf8')
)

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) })
const db = admin.firestore()

async function main() {
  const snap = await db.collection('buffets').get()
  console.log(`Total buffet docs: ${snap.size}`)

  // Hyphen-based IDs are from the first bad migration run — underscore-based are correct
  const toDelete = snap.docs.filter(d => d.id.includes('-'))
  console.log(`Docs with hyphens (to delete): ${toDelete.length}`)

  const BATCH_SIZE = 400
  let deleted = 0
  for (let i = 0; i < toDelete.length; i += BATCH_SIZE) {
    const batch = db.batch()
    for (const doc of toDelete.slice(i, i + BATCH_SIZE)) {
      batch.delete(doc.ref)
      deleted++
    }
    await batch.commit()
    process.stdout.write(`\r  Deleted ${deleted}/${toDelete.length}…`)
  }

  console.log(`\n✅ Done! Removed ${deleted} duplicate docs.`)
}

main().catch(err => { console.error(err); process.exit(1) })
