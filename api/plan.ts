/**
 * /api/plan?id=<planId>
 *   GET    — fetch one plan, including its jsonb payload
 *   PUT    — idempotent upsert (creation and edit are the same call, which is
 *            what lets the offline queue replay safely; last write wins)
 *   DELETE — remove the plan and, via cascade, its snapshots
 *
 * Ownership is enforced by the composite key (owner_id, id): every statement
 * is scoped to the verified Clerk user id, so one user's request can never
 * read or touch another user's row.
 */

import { requireUser } from './_lib/auth';
import { sql, dbUnavailable } from './_lib/db';
import { isValidId, json, looksLikePlan, methodNotAllowed, readJsonBody } from './_lib/http';

function planIdFrom(request: Request): string | Response {
  const id = new URL(request.url).searchParams.get('id');
  if (!isValidId(id)) return json({ error: 'Missing or malformed plan id' }, 400);
  return id;
}

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();
  const id = planIdFrom(request);
  if (id instanceof Response) return id;

  const rows = await sql`
    select id, name, schema_version, data, created_at, updated_at
    from plans
    where owner_id = ${auth.userId} and id = ${id}
  `;
  const row = rows[0];
  if (!row) return json({ error: 'Plan not found' }, 404);

  return json({
    plan: {
      id: row.id as string,
      name: row.name as string,
      schemaVersion: row.schema_version as number,
      data: row.data,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    },
  });
}

export async function PUT(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();
  const id = planIdFrom(request);
  if (id instanceof Response) return id;

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;

  const { data } = (body ?? {}) as { data?: unknown };
  if (!looksLikePlan(data)) {
    return json({ error: 'Body must be { data: <Plan> }' }, 400);
  }
  const name = String(data.name).slice(0, 200);
  const schemaVersion = data.version as number;

  const rows = await sql`
    insert into plans (owner_id, id, name, schema_version, data)
    values (${auth.userId}, ${id}, ${name}, ${schemaVersion}, ${JSON.stringify(data)}::jsonb)
    on conflict (owner_id, id) do update
      set name = excluded.name,
          schema_version = excluded.schema_version,
          data = excluded.data,
          updated_at = now()
    returning updated_at
  `;

  return json({ ok: true, updatedAt: (rows[0]!.updated_at as Date).toISOString() });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();
  const id = planIdFrom(request);
  if (id instanceof Response) return id;

  await sql`delete from plans where owner_id = ${auth.userId} and id = ${id}`;
  return json({ ok: true });
}

export function POST(): Response {
  return methodNotAllowed(['GET', 'PUT', 'DELETE']);
}
