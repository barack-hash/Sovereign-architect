/**
 * /api/account
 *   GET    — export everything the server holds about the signed-in user
 *            (their plans and snapshots) as one JSON document
 *   DELETE — permanently remove all of the user's rows and their Clerk
 *            account (body must be { confirm: "DELETE" }; the UI collects
 *            that confirmation from the user explicitly)
 *
 * These exist because this app stores people's income, debt, and personal
 * constraints: export and deletion are obligations, not features.
 */

import { createClerkClient } from '@clerk/backend';
import { requireUser } from './_lib/auth';
import { sql, dbUnavailable } from './_lib/db';
import { json, methodNotAllowed, readJsonBody } from './_lib/http';

export async function GET(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();

  const [plans, snapshots] = await Promise.all([
    sql`select id, name, schema_version, data, created_at, updated_at
        from plans where owner_id = ${auth.userId} order by created_at`,
    sql`select id, plan_id, name, data, created_at
        from plan_snapshots where owner_id = ${auth.userId} order by created_at`,
  ]);

  return json({
    exportedAt: new Date().toISOString(),
    plans: plans.map((row) => ({
      id: row.id,
      name: row.name,
      schemaVersion: row.schema_version,
      data: row.data,
      createdAt: (row.created_at as Date).toISOString(),
      updatedAt: (row.updated_at as Date).toISOString(),
    })),
    snapshots: snapshots.map((row) => ({
      id: row.id,
      planId: row.plan_id,
      name: row.name,
      data: row.data,
      createdAt: (row.created_at as Date).toISOString(),
    })),
  });
}

export async function DELETE(request: Request): Promise<Response> {
  const auth = await requireUser(request);
  if (auth instanceof Response) return auth;
  if (!sql) return dbUnavailable();

  const body = await readJsonBody(request);
  if (body instanceof Response) return body;
  if ((body as { confirm?: unknown } | null)?.confirm !== 'DELETE') {
    return json({ error: 'Deletion requires { confirm: "DELETE" }' }, 400);
  }

  // Snapshots go with plans via the cascade.
  await sql`delete from plans where owner_id = ${auth.userId}`;

  const secretKey = process.env.CLERK_SECRET_KEY;
  if (secretKey) {
    try {
      await createClerkClient({ secretKey }).users.deleteUser(auth.userId);
    } catch {
      // The data is gone either way; report that the account itself remains.
      return json({ ok: true, accountDeleted: false });
    }
  }

  return json({ ok: true, accountDeleted: true });
}

export function POST(): Response {
  return methodNotAllowed(['GET', 'DELETE']);
}
