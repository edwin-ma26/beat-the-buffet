import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { FieldValue, getFirestore } from 'firebase-admin/firestore'
import { getMessaging } from 'firebase-admin/messaging'
import { requireAuth } from '../auth'

// Social push notifications. The sender is the authenticated user; the only
// client-supplied text is an optional buffet name, capped and stripped. The
// sender's display name comes from Firestore, not the request body.
export async function notifyRoutes(fastify: FastifyInstance) {
  fastify.post('/notify', {
    preHandler: requireAuth,
    config: { rateLimit: { max: 30, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const body = z.object({
      toUid:      z.string().min(1).max(128),
      type:       z.enum(['friend_request', 'friend_accept', 'like']),
      buffetName: z.string().max(80).optional(),
    }).safeParse(request.body)

    if (!body.success) {
      return reply.status(400).send({ error: { code: 'VALIDATION_ERROR', message: body.error.message } })
    }

    const { toUid, type, buffetName } = body.data
    const fromUid = request.uid!
    if (toUid === fromUid) return reply.send({ sent: false, reason: 'self' })

    const db = getFirestore()
    const [fromDoc, toDoc] = await Promise.all([
      db.collection('users').doc(fromUid).get(),
      db.collection('users').doc(toUid).get(),
    ])

    const fromName = (fromDoc.get('displayName') as string | undefined) || 'Someone'
    const cleanBuffet = buffetName?.replace(/[\r\n]/g, ' ').trim()

    let title: string
    let bodyText: string
    switch (type) {
      case 'friend_request':
        title = 'New friend request'
        bodyText = `${fromName} wants to be your friend on Beat the Buffet!`
        break
      case 'friend_accept':
        title = 'Friend request accepted'
        bodyText = `${fromName} accepted your friend request. Time to compete!`
        break
      case 'like':
        title = 'Your session got a like'
        bodyText = cleanBuffet
          ? `${fromName} liked your session at ${cleanBuffet}.`
          : `${fromName} liked your buffet session.`
        break
    }

    // Persist to the recipient's in-app inbox regardless of push delivery
    await db.collection('users').doc(toUid).collection('notifications').add({
      type,
      title,
      body: bodyText,
      fromUid,
      fromName,
      read: false,
      createdAt: FieldValue.serverTimestamp(),
    }).catch(err => request.log.error({ err }, 'inbox write failed'))

    const fcmToken = toDoc.get('fcmToken') as string | undefined
    if (!fcmToken) return reply.send({ sent: false, reason: 'no_token' })

    try {
      await getMessaging().send({
        token: fcmToken,
        notification: { title, body: bodyText },
        data: { type, fromUid },
        apns: { payload: { aps: { sound: 'default' } } },
      })
      return reply.send({ sent: true })
    } catch (err: any) {
      // Stale/unregistered token — drop it so we stop trying
      if (err?.code === 'messaging/registration-token-not-registered') {
        await db.collection('users').doc(toUid).update({ fcmToken: null }).catch(() => {})
        return reply.send({ sent: false, reason: 'stale_token' })
      }
      request.log.error({ err }, 'FCM send failed')
      return reply.status(502).send({ error: { code: 'SEND_FAILED' } })
    }
  })
}
