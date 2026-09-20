/**
 * Neon connection. HTTP mode: each query is a stateless fetch, which is the
 * recommended shape for one-shot queries in serverless functions — nothing
 * to pool, nothing to close.
 */

import { neon } from '@neondatabase/serverless';

const url = process.env.DATABASE_URL;

export const sql = url ? neon(url) : null;

export function dbUnavailable(): Response {
  return new Response(JSON.stringify({ error: 'Server database is not configured' }), {
    status: 503,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}
