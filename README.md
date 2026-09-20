# Sovereign — Deterministic Life Architect

A planning tool for deciding what to do with your life in what order, when a day
only has 24 hours and every choice costs something other than money.

You describe where you are, the things you could do, and what has to happen
before what. It computes when each thing can actually start, which chain of work
is holding your goals back, what every ordering costs you across five kinds of
capital, and how often the plan survives contact with bad luck.

## Running it

```bash
npm install
```

```bash
npm run dev
```

```bash
npm test
```

Without configuration the app runs in **local-only mode**: everything stays in
your browser's local storage, nothing is sent anywhere, and Settings → Export
is the only backup. With Clerk and Neon configured (below), plans live in your
account, sync across devices, and keep working offline through a cached copy
and a replay queue.

## Accounts & backend setup

The backend is a set of Vercel functions in `api/` (Clerk verifies the session
token, Neon stores plans as jsonb — see `db/schema.sql`). To provision:

1. **Neon**: create a project, run `db/schema.sql` against it, copy the
   connection string.
2. **Clerk**: create an application (sign-in options of your choice), copy the
   publishable and secret keys.
3. **Env vars** — locally in `.env.local`, in production on the Vercel project
   (see `.env.example` for all of them):
   - `VITE_CLERK_PUBLISHABLE_KEY` (browser)
   - `CLERK_SECRET_KEY`, `DATABASE_URL`, `CLERK_AUTHORIZED_PARTIES` (server)
   - `VITE_OWNER_USER_ID` (optional; shows the dedication screen to that
     account only)
4. **Local dev with the API**: `vercel dev` (serves the Vite app and the
   functions together). Plain `npm run dev` still works — the app just runs in
   local-only mode, or with a deployed API origin if you proxy `/api`.

Never commit `.env.local`. The database connection string must never be
`VITE_`-prefixed — Vite would ship it to every browser.

## The model

### Five capitals

Money is one of five things a plan spends. The others are tracked as 0–100
indices, and objectives can require minimum levels of each — which is what stops
the optimiser recommending a plan that gets rich by wrecking you.

| Capital | What it measures |
| --- | --- |
| **Financial** | Cash and debt, tracked separately so investment return never compounds on money you don't have |
| **Temporal** | Hours per day. A hard budget — overallocating damages health, which taxes income, which slows the plan |
| **Emotional** | System health. Below the burnout threshold, income takes a penalty |
| **Relational** | The cost of the plan to the people around you |
| **Spiritual** | Alignment with what you actually believe |

### Nodes

- **Genesis** — where you are now: cash, debt, starting index levels, and a
  ledger of the income, expenses, and hours already committed in your life. Time
  lines are categorised (sleep, work, study, family, faith…) so constraints can
  measure them.
- **Task** — a thing you do. Has a **duration**, hours per day while it runs,
  upfront and recurring money in both directions, and separate impacts *while in
  progress* versus *after completion*. Three hard months followed by a permanent
  payoff is a different plan from a flat cost forever, and the model says so.
- **Objective** — a goal. Satisfied when its prerequisites are done, its capital
  target is met, **and** your index minimums still hold.
- **Note** — annotation. Never affects the maths.

Edges are prerequisites: an edge from A to B means B cannot start until A is
finished. Cycles are refused at drag time.

### Critical path

Real CPM. A forward pass computes each node's earliest start and finish; a
backward pass computes the latest each could happen without delaying the plan.

- **Total slack** = late start − early start. How long a task can slip before the
  whole plan slips. Zero slack means it is on the critical path.
- **Link slack** (on canvas edges) = the successor's early start − this task's
  early finish. How much lag that specific dependency has.

Durations are what make this meaningful. A network of zero-duration nodes has no
critical path to find.

### Scenario Lab

The part that answers "which way is best".

Two things are searched: **which** optional tasks to include, and **when** to
start them. Rather than enumerating topological orderings — factorial, and mostly
producing near-identical plans — it runs a resource-constrained serial scheduler
under a set of priority rules (cheapest first, shortest first, highest-earning
first, lowest-strain first, critical-path first…), plus seeded random orderings
to catch what the heuristics miss. Work only starts when the hours fit in the
day, and optionally only when the cash exists.

Every candidate is simulated in full and scored on six axes. Results come back
ranked by your weights, plus the **Pareto front**: the plans nothing else beats
on every axis at once. Anything not on that front is strictly worse than
something else and can be discarded honestly.

Adopting a variant writes its start months back onto the plan.

### Risk

Monte Carlo. N seeded trials perturb investment return, inflation and recurring
costs, and inject random income disruptions, emergency expenses and health
shocks. Reports the percentile distribution, how often you actually hit your
objectives, and which constraint breaks most often.

Seeded means reproducible: the same plan and seed always give the same answer.

## Architecture

```
src/
  engine/     Pure TypeScript. No React, no DOM, no randomness outside rng.ts.
    types.ts        The canonical Plan model — one source of truth
    graph.ts        Cycle detection, topological sort, reachability, validation
    schedule.ts     CPM forward/backward pass, slack, critical path
    simulate.ts     Month-by-month five-capital simulation
    constraints.ts  Every constraint type, evaluated per month
    explore.ts      Permutation search, scoring, Pareto front
    montecarlo.ts   Seeded risk analysis
    migrate.ts      v1 → v2 conversion
  state/      The single Plan store, undo/redo, persistence, derived analysis
  views/      One file per surface
  ui/         Shared primitives and formatters
```

The UI imports only from `src/engine` — never from an engine submodule directly.
That boundary is what keeps the maths testable in isolation and stops
calculation logic drifting back into render code.

`npm test` runs 104 unit tests over the engine, covering CPM slack correctness,
cycle rejection, simulation arithmetic, constraint firing, explorer ranking, and
the v1 migration.

## Upgrading from v1

The first time you open v2, any v1 save is converted automatically and a banner
explains what changed. The old keys are kept under a `v1-backup:` prefix in local
storage rather than deleted.

Some things v1 displayed were not connected to anything, and the migration says
so rather than pretending otherwise:

- The sidebar's cash, debt and income fed nothing — the simulator read the
  Genesis node. Now there is only one of each.
- The burn-rate ledger was editable and unread. Its rows are recovered into the
  Genesis ledger, where they now affect the projection.
- The ten time sliders only fed a display-only health number. They become real
  time-ledger lines that consume hours and can trigger constraints.
- Six of the eight constraints were collected and never enforced. All are now
  evaluated every month.
- Path yields silently added a hard-coded +4.2% or +18.7% to your return. Set a
  real expected return in Settings.
- v1 tasks had no duration, so each becomes a one-month task. **Set real
  durations** — critical-path analysis needs them to measure anything.
