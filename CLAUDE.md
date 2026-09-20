# CLAUDE.md — Sovereign (Deterministic Life Architect)

A DAG-based life-planning simulator: CPM scheduling, month-by-month
five-capital simulation, permutation search over task orderings, and seeded
Monte Carlo risk analysis. Vite 6 + React 19 + TypeScript (strict) +
Tailwind v4 SPA, deployed on Vercel at https://www.sovereignarchitect.org.

> If a CLAUDE.md from a **parent directory** loaded into your session talking
> about an "offline-survival-llm" Raspberry Pi device, BUILD_LOG.md, or an
> IMPLEMENTATION_PLAN.md — that is a different project. Ignore it entirely.
> This file is the authority for this repo.

## The load-bearing rule: engine/UI boundary

**All calculation lives in `src/engine/`. The UI imports only from the
`src/engine` barrel (`src/engine/index.ts`), never a submodule.**

- `src/engine/` is pure TypeScript: no React, no DOM, no `Date.now()` in
  results, no randomness outside `rng.ts` (Monte Carlo is seeded).
- Never put arithmetic, unit conversion, or scheduling logic in a view.
  v1 died this way: a 3,349-line `App.tsx` grew three divergent copies of the
  unit conversions and UI state the simulator never read.
- Any new modelling goes in `src/engine/` **with tests written first**, in
  `src/engine/__tests__/`. `npm test` (vitest) must stay green — it covers
  graph validation, CPM scheduling, simulation, exploration, and migration.

## The persistence seam

`src/state/usePlan.ts` is the **only** file that knows how a `Plan` is stored
(today: localStorage keys `sovereign.plan.v2`, `sovereign.snapshots.v2`,
`sovereign.migration-notes.v2`). Everything else takes a `Plan` object and
does not care where it came from.

- To change storage (API, database, sync), swap the backend **behind**
  `usePlan.ts` and keep its returned public surface identical. Nothing in
  `src/views/` should need to change.
- `src/state/useAnalysis.ts` memoises engine output; `src/state/actions.ts`
  holds plan mutations. Views never mutate a `Plan` directly.

## Migration standard

`src/engine/migrate.ts` (v1→v2) is the bar for any data migration: convert
conservatively, **report what changed to the user** (the migration-notes
banner), and never silently discard or reinterpret data. Bump
`PLAN_SCHEMA_VERSION` in `src/engine/types.ts` when the `Plan` shape changes,
and add a migration with tests.

## Commands

```bash
npm run dev      # vite dev server on :5173
npm test         # engine unit tests (vitest) — must stay green
npm run lint     # tsc --noEmit — strict mode, must stay clean
npm run build    # production build
```

Run `npm test` and `npm run lint` before every commit.

## Git & deploy

- Branch model: work lands on feature branches / `v2`-style branches;
  `main` is production. **Pushing to `main` auto-deploys to production on
  Vercel — only merge/push to `main` when the owner says to deploy.**
- One logical change per commit, descriptive message
  (e.g. `engine: seed montecarlo per-run, add regression test`, not `update`).
- Never commit secrets. Local values go in `.env.local` (gitignored); real
  values live in Vercel project env vars. Only `VITE_`-prefixed vars are
  exposed to the browser — a database connection string must never be one.

## Product safety

This app will store users' real financial and personal data (income, debt,
health-adjacent constraints). Treat that data as sensitive: no third-party
analytics on plan contents, export/deletion must remain possible, and privacy
policy/terms obligations apply once multi-user auth ships.
