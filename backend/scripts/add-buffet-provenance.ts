// One-time migration: add provenance columns to buffets.
// Existing rows all came from Google Places seeding → source='google', verified=true.
// Run: npx tsx scripts/add-buffet-provenance.ts
import 'dotenv/config'
import sql from '../src/db'

async function main() {
  await sql`
    ALTER TABLE buffets
      ADD COLUMN IF NOT EXISTS source   text    NOT NULL DEFAULT 'google',
      ADD COLUMN IF NOT EXISTS verified boolean NOT NULL DEFAULT true
  `
  const [{ count }] = await sql<{ count: string }[]>`SELECT COUNT(*) FROM buffets`
  console.log(`✅ Columns added. ${count} existing rows marked source='google', verified=true.`)
  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
