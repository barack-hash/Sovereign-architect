/**
 * Clerk session verification for the API functions.
 *
 * The SPA sends its Clerk session token as `Authorization: Bearer <jwt>`;
 * verifyToken checks the signature against the instance's keys, so no
 * network round-trip to Clerk is needed per request. The verified `sub`
 * claim is the only source of the user id — it is never read from the
 * request body or query string.
 */

import { verifyToken } from '@clerk/backend';
import { json } from './http';

export interface AuthedUser {
  userId: string;
}

export async function requireUser(request: Request): Promise<AuthedUser | Response> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    return json({ error: 'Server auth is not configured' }, 503);
  }

  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  if (!token) {
    return json({ error: 'Not signed in' }, 401);
  }

  // Restricts which origins' tokens are accepted (azp claim), guarding
  // against a token minted for another app on the same Clerk instance.
  const authorizedParties = (process.env.CLERK_AUTHORIZED_PARTIES ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  try {
    const payload = await verifyToken(token, {
      secretKey,
      ...(authorizedParties.length > 0 ? { authorizedParties } : {}),
    });
    if (!payload.sub) return json({ error: 'Token has no subject' }, 401);
    return { userId: payload.sub };
  } catch {
    return json({ error: 'Session is invalid or expired' }, 401);
  }
}
