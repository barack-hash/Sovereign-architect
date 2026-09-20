/**
 * Typed client for the api/ functions. The only place the app talks HTTP.
 *
 * Every call sends the Clerk session token as a bearer header; the server
 * derives the user from it and nothing else. Network failures throw
 * ApiOffline so the sync layer can tell "no connection" from "server said
 * no" — the first is retried, the second is surfaced.
 */

import type { Plan } from '../engine';

export interface PlanMeta {
  id: string;
  name: string;
  schemaVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface RemotePlan extends PlanMeta {
  data: Plan;
}

export interface RemoteSnapshot {
  id: string;
  planId: string;
  name: string;
  data: Plan;
  createdAt: string;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** The request never reached the server (offline, DNS, aborted). Retryable. */
export class ApiOffline extends Error {}

export type GetToken = () => Promise<string | null>;

export function createApiClient(getToken: GetToken) {
  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const token = await getToken().catch(() => null);
    if (!token) throw new ApiOffline('No session token available');

    let response: Response;
    try {
      response = await fetch(path, {
        ...init,
        headers: {
          authorization: `Bearer ${token}`,
          ...(init.body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
      });
    } catch {
      throw new ApiOffline('Network request failed');
    }

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const body = (await response.json()) as { error?: string };
        if (body.error) message = body.error;
      } catch {
        // Non-JSON error body; the status-based message stands.
      }
      throw new ApiError(message, response.status);
    }

    return (await response.json()) as T;
  }

  return {
    listPlans: () => request<{ plans: PlanMeta[] }>('/api/plans').then((r) => r.plans),

    getPlan: (id: string) =>
      request<{ plan: RemotePlan }>(`/api/plan?id=${encodeURIComponent(id)}`).then((r) => r.plan),

    putPlan: (plan: Plan) =>
      request<{ ok: true; updatedAt: string }>(`/api/plan?id=${encodeURIComponent(plan.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ data: plan }),
      }),

    deletePlan: (id: string) =>
      request<{ ok: true }>(`/api/plan?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

    listSnapshots: (planId: string) =>
      request<{ snapshots: RemoteSnapshot[] }>(
        `/api/snapshots?planId=${encodeURIComponent(planId)}`,
      ).then((r) => r.snapshots),

    putSnapshot: (snapshot: { id: string; planId: string; name: string; data: Plan; createdAt: number }) =>
      request<{ ok: true }>(`/api/snapshot?id=${encodeURIComponent(snapshot.id)}`, {
        method: 'PUT',
        body: JSON.stringify({
          planId: snapshot.planId,
          name: snapshot.name,
          data: snapshot.data,
          createdAt: snapshot.createdAt,
        }),
      }),

    deleteSnapshot: (id: string) =>
      request<{ ok: true }>(`/api/snapshot?id=${encodeURIComponent(id)}`, { method: 'DELETE' }),

    exportAccount: () => request<unknown>('/api/account'),

    deleteAccount: () =>
      request<{ ok: true; accountDeleted: boolean }>('/api/account', {
        method: 'DELETE',
        body: JSON.stringify({ confirm: 'DELETE' }),
      }),
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
