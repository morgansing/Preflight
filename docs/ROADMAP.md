# Roadmap — known limits, in priority order

Deliberate V0 trade-offs. Each is documented where it lives in the code;
this is the ordered list of what to build next and why it can wait.

1. **Real auth + multi-tenancy.** Everything downstream assumes one
   workspace: `BillingAccount` id "default", localStorage sessions,
   client-trusted free-grant identity. Auth is the unlock for per-user
   Stripe customers, seats, entitlement middleware, and API gating.
   (See docs/PRODUCTION.md §3.)
2. **Per-run store isolation — the concurrency unlock.** DONE-ADJACENT
   PREREQS: runs now resume after restarts and queue behind each other; the
   remaining wall is the shared store forcing one evaluation at a time.
   Concrete plan (one focused session):
   - Add `runId String?` to `Customer`, `Order`, `Refund`, `ShippingEvent`
     (+ composite indexes led by `runId`).
   - Thread `ctx.runId` through `src/server/seed.ts` writes and every
     `src/server/store-tools.ts` query (`where: { runId }`), so each run
     reads only its own store rows.
   - Drop the one-run-at-a-time guard; cap concurrent runs via config;
     delete a run's store rows on completion (or lazily by retention).
   - Risk: the seed/tools surface is the product's core — land it behind
     its own e2e pass (two simultaneous sandbox runs, disjoint results).
3. **Multi-instance event bus.** Live-wall SSE uses an in-process
   emitter with DB catch-up. Fine on one instance; horizontal scaling needs
   Postgres LISTEN/NOTIFY or Supabase Realtime behind the same
   `subscribeRun` interface.
4. **Pagination.** `/api/live/runs` returns the latest 50; result payloads
   are trimmed but unpaginated. Cursor pagination matters once workspaces
   accumulate thousands of runs.
5. **`jsonb` columns.** Transcripts/rubrics/rules are JSON-in-String —
   portable, but unqueryable. After the Postgres move, migrate hot columns
   to `jsonb` where server-side filtering would help (failure clustering,
   rule search).
6. **Seeding refactor.** The store seed logic exists in three shapes
   (demo fixtures, live seed, tests). Unify into one seed module with a
   size parameter; also makes seeding async/idempotent for Postgres.
7. **Free-grant identity hardening.** The email+fingerprint key is
   friction, not security (both are client-supplied). Post-auth, tie grants
   to verified accounts and keep the fingerprint as a secondary signal.
8. **Contrast pass on `--color-mut`.** The dimmest text token sits below
   WCAG AA on some surfaces. Raising it changes the look everywhere, so
   it's a deliberate design decision to make with fresh eyes, not a
   drive-by fix.
9. **LICENSE.** The repo ships without one on purpose — all rights
   reserved by default. Choosing a license (or staying proprietary) is the
   owner's call before the repo is shared beyond the team.
