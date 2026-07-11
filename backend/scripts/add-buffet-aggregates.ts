// One-time migration: community aggregate columns on buffets.
// These are derived counters (write-through from session saves); Firestore
// remains the source of record for individual sessions/reviews.
// Run: npx tsx scripts/add-buffet-aggregates.ts
import 'dotenv/config'
import sql from '../src/db'

async function main() {
  await sql`
    ALTER TABLE buffets
      ADD COLUMN IF NOT EXISTS visit_count    integer          NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_calories bigint           NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS total_cost     double precision NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rating_sum     integer          NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS rating_count   integer          NOT NULL DEFAULT 0
  `
  console.log('✅ Aggregate columns added.')
  await sql.end()
}

main().catch(err => { console.error(err); process.exit(1) })
