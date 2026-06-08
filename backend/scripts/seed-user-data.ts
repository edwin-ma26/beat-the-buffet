/**
 * Seed fake friends, sessions, and activity for the john cena test user.
 * Run: npx tsx scripts/seed-user-data.ts
 */
import * as admin from 'firebase-admin'
import { Timestamp, FieldValue } from 'firebase-admin/firestore'
import * as path from 'path'

const serviceAccount = require(path.resolve(__dirname, '../beat-the-buffet-firebase-adminsdk-fbsvc-9b961a984c.json'))

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
})

const db = admin.firestore()

// "john cena" Apple Sign-In account
const TARGET_UID = '2MOKvf3WvQgQY9ZmRCWrDDpRa7s2'

function normalizedBuffetID(name: string): string {
  const lower = name.toLowerCase().trim()
  const clean = lower.split('').filter(c => /[a-z0-9 ]/.test(c)).join('')
  return clean.replace(/ /g, '_').slice(0, 60).replace(/^_+|_+$/g, '')
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

const FAKE_FRIENDS = [
  { displayName: 'Jake Martinez', sessionCount: 12, totalCalories: 18400, totalCost: 156.5 },
  { displayName: 'Priya Sharma',  sessionCount: 8,  totalCalories: 11200, totalCost: 98.0  },
  { displayName: 'Tyler Brooks',  sessionCount: 5,  totalCalories: 9800,  totalCost: 62.0  },
  { displayName: 'Emily Chen',    sessionCount: 20, totalCalories: 29000, totalCost: 230.0 },
]

const FAKE_SESSIONS = [
  { buffetName: 'Golden Corral',          daysAgo: 2,  totalCalories: 2100, totalCost: 18.50, plateCount: 3, rating: 4 },
  { buffetName: 'Hibachi Japanese Buffet', daysAgo: 5,  totalCalories: 1850, totalCost: 22.00, plateCount: 2, rating: 5 },
  { buffetName: 'China King Buffet',       daysAgo: 10, totalCalories: 2400, totalCost: 15.00, plateCount: 4, rating: 3 },
  { buffetName: 'Indian Garden Buffet',    daysAgo: 14, totalCalories: 1700, totalCost: 17.00, plateCount: 2, rating: 4 },
  { buffetName: 'Hometown Buffet',         daysAgo: 21, totalCalories: 2250, totalCost: 16.50, plateCount: 3, rating: 3 },
]

const MY_SESSIONS = [
  { buffetName: 'Golden Corral',          daysAgo: 1,  totalCalories: 2300, totalCost: 18.50, plateCount: 4, rating: 5 },
  { buffetName: 'Hibachi Japanese Buffet', daysAgo: 7,  totalCalories: 1950, totalCost: 22.00, plateCount: 3, rating: 4 },
  { buffetName: 'China King Buffet',       daysAgo: 12, totalCalories: 2100, totalCost: 15.00, plateCount: 3, rating: 4 },
]

async function main() {
  console.log(`Using target user UID: ${TARGET_UID}`)

  // Ensure target user profile doc exists
  const targetRef = db.collection('users').doc(TARGET_UID)
  const targetDoc = await targetRef.get()
  if (!targetDoc.exists) {
    await targetRef.set({
      displayName: 'john cena',
      sessionCount: 0,
      totalCalories: 0,
      totalCost: 0,
      createdAt: FieldValue.serverTimestamp(),
    })
    console.log('Created target user profile')
  } else {
    console.log('Target user profile already exists:', targetDoc.data())
  }

  // Seed sessions for the target user
  console.log('\nSeeding sessions for target user...')
  let myTotalCalories = 0
  let myTotalCost = 0
  for (const s of MY_SESSIONS) {
    const sessionRef = db.collection('users').doc(TARGET_UID).collection('sessions').doc()
    const date = daysAgo(s.daysAgo)
    await sessionRef.set({
      buffetName: s.buffetName,
      date: Timestamp.fromDate(date),
      totalCalories: s.totalCalories,
      totalCost: s.totalCost,
      plateCount: s.plateCount,
      likedBy: [],
    })
    myTotalCalories += s.totalCalories
    myTotalCost += s.totalCost

    const buffetDocID = normalizedBuffetID(s.buffetName)
    await db.collection('buffets').doc(buffetDocID).set({
      name: s.buffetName,
      visitCount: FieldValue.increment(1),
      totalCalories: FieldValue.increment(s.totalCalories),
      totalCost: FieldValue.increment(s.totalCost),
      ratingSum: FieldValue.increment(s.rating),
      ratingCount: FieldValue.increment(1),
      lastUpdated: FieldValue.serverTimestamp(),
    }, { merge: true })

    console.log(`  + Session at ${s.buffetName} (${s.daysAgo}d ago)`)
  }

  await targetRef.set({
    sessionCount: FieldValue.increment(MY_SESSIONS.length),
    totalCalories: FieldValue.increment(myTotalCalories),
    totalCost: FieldValue.increment(myTotalCost),
    lastVisit: Timestamp.fromDate(daysAgo(MY_SESSIONS[0].daysAgo)),
  }, { merge: true })

  // Create fake friend users and mutual friendships
  console.log('\nCreating fake friends...')
  const now = FieldValue.serverTimestamp()

  for (const friend of FAKE_FRIENDS) {
    const friendUID = `seed_${friend.displayName.toLowerCase().replace(/ /g, '_')}`
    const friendRef = db.collection('users').doc(friendUID)

    await friendRef.set({
      displayName: friend.displayName,
      sessionCount: friend.sessionCount,
      totalCalories: friend.totalCalories,
      totalCost: friend.totalCost,
      lastVisit: Timestamp.fromDate(daysAgo(Math.floor(Math.random() * 10) + 1)),
      createdAt: now,
      isSeeded: true,
    }, { merge: true })

    // Add sessions for this friend
    const numSessions = Math.min(3, FAKE_SESSIONS.length)
    for (let i = 0; i < numSessions; i++) {
      const s = FAKE_SESSIONS[i]
      const sessionRef = friendRef.collection('sessions').doc()
      const offsetDays = s.daysAgo + Math.floor(Math.random() * 5)
      const calVariation = Math.floor((Math.random() - 0.5) * 400)
      const costVariation = parseFloat(((Math.random() - 0.5) * 4).toFixed(2))
      const sessionCals = s.totalCalories + calVariation
      const sessionCost = parseFloat((s.totalCost + costVariation).toFixed(2))
      await sessionRef.set({
        buffetName: s.buffetName,
        date: Timestamp.fromDate(daysAgo(offsetDays)),
        totalCalories: sessionCals,
        totalCost: sessionCost,
        plateCount: s.plateCount,
        likedBy: [],
      })

      const buffetDocID = normalizedBuffetID(s.buffetName)
      await db.collection('buffets').doc(buffetDocID).set({
        name: s.buffetName,
        visitCount: FieldValue.increment(1),
        totalCalories: FieldValue.increment(sessionCals),
        totalCost: FieldValue.increment(sessionCost),
        ratingSum: FieldValue.increment(s.rating),
        ratingCount: FieldValue.increment(1),
        lastUpdated: FieldValue.serverTimestamp(),
      }, { merge: true })
    }

    // Mutual friendship
    await db.collection('users').doc(TARGET_UID).collection('friends').doc(friendUID).set({ since: now }, { merge: true })
    await friendRef.collection('friends').doc(TARGET_UID).set({ since: now }, { merge: true })

    console.log(`  + Friend: ${friend.displayName} (${friendUID})`)
  }

  // Cross-likes on target user's most recent sessions
  console.log('\nAdding likes...')
  const mySessionsSnap = await db.collection('users').doc(TARGET_UID)
    .collection('sessions').orderBy('date', 'desc').limit(2).get()
  const liker0 = `seed_${FAKE_FRIENDS[0].displayName.toLowerCase().replace(/ /g, '_')}`
  const liker1 = `seed_${FAKE_FRIENDS[1].displayName.toLowerCase().replace(/ /g, '_')}`
  for (const doc of mySessionsSnap.docs) {
    await doc.ref.update({ likedBy: [liker0, liker1] })
    console.log(`  + Liked session ${doc.id}`)
  }

  console.log('\nDone!')
  console.log(`  - ${MY_SESSIONS.length} sessions for john cena`)
  console.log(`  - ${FAKE_FRIENDS.length} friends: ${FAKE_FRIENDS.map(f => f.displayName).join(', ')}`)
  console.log('  - Likes on 2 most recent sessions')
  process.exit(0)
}

main().catch(e => { console.error(e); process.exit(1) })
