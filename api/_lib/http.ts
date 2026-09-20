/**
 * Shared plumbing for the API functions.
 *
 * Files under api/_lib are not routes (Vercel skips underscore-prefixed
 * paths); everything here is imported by the route files.
 */

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // Every response is per-user and mutable; nothing here may be cached.
      'cache-control': 'no-store',
    },
  });
}

export function methodNotAllowed(allowed: string[]): Response {
  return new Response(JSON.stringify({ error: 'Method not allowed' }), {
    status: 405,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      allow: allowed.join(', '),
    },
  });
}

/**
 * Client-generated ids ("p_m1x2y3_4", "snap_abc") must stay in a shape that
 * cannot smuggle anything odd into queries or URLs.
 */
const ID_PATTERN = /^[a-zA-Z0-9_-]{1,64}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && ID_PATTERN.test(id);
}

/** A plan or snapshot payload larger than this is a bug or an abuse attempt. */
export const MAX_PAYLOAD_BYTES = 2 * 1024 * 1024;

export async function readJsonBody(request: Request): Promise<unknown | Response> {
  const raw = await request.text();
  if (raw.length > MAX_PAYLOAD_BYTES) {
    return json({ error: 'Payload too large' }, 413);
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return json({ error: 'Body is not valid JSON' }, 400);
  }
}

/**
 * Sanity-checks that a payload is shaped like a Plan before it is stored.
 * This is not full schema validation — the engine revalidates on load — but
 * it keeps garbage and non-objects out of the database.
 */
export function looksLikePlan(data: unknown): data is Record<string, unknown> {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) return false;
  const plan = data as Record<string, unknown>;
  return (
    typeof plan.name === 'string' &&
    typeof plan.version === 'number' &&
    Array.isArray(plan.nodes) &&
    Array.isArray(plan.constraints) &&
    typeof plan.assumptions === 'object' &&
    plan.assumptions !== null
  );
}
