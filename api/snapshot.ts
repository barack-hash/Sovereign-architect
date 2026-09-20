/**
 * /api/snapshot?id=<snapshotId>
 *   PUT    — idempotent upsert of one snapshot (body: { planId, name, data,
 *            createdAt }), replay-safe for the offline queue
 *   DELETE — remove one snapshot
 */

import { requireUser } from './_lib/auth';
import { sql, dbUnavailable } from './_lib/db';
import { isValidId, json, looksLikePlan, methodNotAllowed, readJsonBody } from './_lib/http';

function snapshotIdFrom(request: Request): string | Response {
  const id = new URL(request.url).searchParams.get('id');
  if (!isValidId(id)) return json({ error: 'Missing or malformed snapshot id' }, 400);
  return id;
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();
  const id = snapshotIdFrom(request);
  if (id instanceof Response) return id;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const { planId, name, data, createdAt } = (body ?? {}) as {
    planId?: unknown;
    name?: unknown;
    data?: unknown;
    createdAt?: unknown;
  };
  if (!isValidId(planId) || typeof name !== 'string' || !looksLikePlan(data)) {
    return json({ error: 'Body must be { planId, name, data: <Plan>, createdAt? }' }, 400);
  }
  const created =
    typeof createdAt === 'number' && Number.isFinite(createdAt) ? new Date(createdAt) : new Date();

  try {
    await sql`
      insert into plan_snapshots (owner_id, id, plan_id, name, data, created_at)
      values (${auth.userId}, ${id}, ${planId}, ${name.slice(0, 200)},
              ${JSON.stringify(data)}::jsonb, ${created.toISOString()})
      on conflict (owner_id, id) do update
        set name = excluded.name,
            data = excluded.data
    `;
  } catch {
    // The composite FK failed: the parent plan is not (or not yet) synced.
    // The client treats this as retryable, so the queue reorders around it.
    return json({ error: 'Parent plan does not exist on the server yet' }, 409);
  }

  return json({ ok: true });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();
  const id = snapshotIdFrom(request);
  if (id instanceof Response) return id;

  await sql`delete from plan_snapshots where owner_id = ${auth.userId} and id = ${id}`;
  return json({ ok: true });
}

export function GET(): Response {
  return methodNotAllowed(['PUT', 'DELETE']);
}
