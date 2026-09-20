/**
 * GET /api/snapshots?planId=<planId> — list a plan's snapshots, full payloads
 * included: the UI restores a snapshot synchronously from what it already has,
 * matching the old localStorage behavior.
 */

import { requireUser } from './_lib/auth';
import { sql, dbUnavailable } from './_lib/db';
import { isValidId, json, methodNotAllowed } from './_lib/http';

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();

  const planId = new URL(request.url).searchParams.get('planId');
  if (!isValidId(planId)) return json({ error: 'Missing or malformed planId' }, 400);

  const rows = await sql`
    select id, plan_id, name, data, created_at
    from plan_snapshots
    where owner_id = ${auth.userId} and plan_id = ${planId}
    order by created_at desc
  `;

  return json({
    snapshots: rows.map((row) => ({
      id: row.id as string,
      planId: row.plan_id as string,
      name: row.name as string,
      data: row.data,
      createdAt: (row.created_at as Date).toISOString(),
    })),
  });
}

export function POST(): Response {
  return methodNotAllowed(['GET']);
}
