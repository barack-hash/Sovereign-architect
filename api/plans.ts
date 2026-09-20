/**
 * GET /api/plans — list the signed-in user's plans (metadata only, no jsonb
 * payload, so the list stays cheap however large the plans get).
 */

import { requireUser } from './_lib/auth';
import { sql, dbUnavailable } from './_lib/db';
import { json, methodNotAllowed } from './_lib/http';

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();

  const rows = await sql`
    select id, name, schema_version, created_at, updated_at
    from plans
    where owner_id = ${auth.userId}
    order by updated_at desc
  `;

  return json({
    plans: rows.map((row) => ({
      id: row.id as string,
      name: row.name as string,
      schemaVersion: row.schema_version as number,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    })),
  });
}

export function POST(): Response {
  // Creation goes through PUT /api/plan?id=<client id> so that offline-created
  // plans sync with the same idempotent call as edits.
  return methodNotAllowed(['GET']);
}
