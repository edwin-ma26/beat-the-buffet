import { FastifyRequest, FastifyReply } from 'fastify'
import { initializeApp, cert, applicationDefault } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

// Credentials: set FIREBASE_SERVICE_ACCOUNT to the service-account JSON string
// (Railway), or GOOGLE_APPLICATION_CREDENTIALS to a file path (local dev).
const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
initializeApp(
  serviceAccount
    ? { credential: cert(JSON.parse(serviceAccount)) }
    : { credential: applicationDefault() }
)

declare module 'fastify' {
  interface FastifyRequest {
    uid?: string
  }
}

/** preHandler that rejects requests without a valid Firebase ID token. */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const header = request.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return reply.status(401).send({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.' } })
  }
  try {
    const decoded = await getAuth().verifyIdToken(header.slice('Bearer '.length))
    request.uid = decoded.uid
  } catch {
    return reply.status(401).send({ error: { code: 'INVALID_TOKEN', message: 'Sign in required.' } })
  }
}
