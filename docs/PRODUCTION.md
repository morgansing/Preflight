# Taking Preflight to production

Everything below is an *activation checklist*, not a build list — the seams
already exist in the code. Demo mode needs none of it.

## 1. Database: SQLite → Postgres (Supabase)

V0 runs on a local SQLite file via the `better-sqlite3` driver adapter.
The schema is Postgres-portable (autoincrement ids, DateTime, indexed
foreign keys — no SQLite-isms), so the migration is mechanical:

1. **Set the URL** — `DATABASE_URL="postgresql://…"` (Supabase → Project
   Settings → Database → connection string; use the pooled URL for the app).
2. **Swap the driver adapter** in `src/server/db.ts`:

   ```bash
   npm install @prisma/adapter-pg pg
   ```

   ```ts
   // src/server/db.ts
   import { PrismaPg } from "@prisma/adapter-pg";
   const adapter = new PrismaPg({ connectionString: config.databaseUrl });
   ```

   `src/server/config.ts` already refuses to boot when `DATABASE_URL` is a
   Postgres URL but the SQLite adapter is still wired — you'll get a clear
   error, not silent corruption.
3. **Change the datasource provider** in `prisma/schema.prisma` from
   `sqlite` to `postgresql`, then `npx prisma generate`.
4. **Migrations, not `db push`** — the `predev`/`prestart` hooks run
   `prisma db push`, which is right for a local file and wrong for a shared
   database. In production: delete `prestart`, create a baseline with
   `npx prisma migrate dev --name init`, and deploy with
   `npx prisma migrate deploy` in CI.
5. **Two behavioural differences to know about**:
   - `contains` string filters (product search in the store API) are
     case-**sensitive** on Postgres; add `mode: "insensitive"` where the
     current SQLite behaviour is relied on.
   - JSON blobs are stored as `String` columns (portable). They work
     unchanged on Postgres; converting to `jsonb` is a roadmap item, not a
     prerequisite.

## 2. Billing: connecting Stripe

The full subscription + token architecture is live but **dormant** — every
route answers, the ledger meters usage, the UI is wired; nothing charges
until both keys exist. Activation is configuration only:

1. **Set two env vars**:
   ```
   STRIPE_SECRET_KEY="sk_live_…"
   STRIPE_WEBHOOK_SECRET="whsec_…"
   ```
   `billing.enabled` flips to true when *both* are present
   (`src/server/config.ts`); with either missing, checkout/portal return
   409 and the UI stays in labelled preview mode.
2. **Create prices with these lookup keys** (Stripe Dashboard → Products,
   or the CLI). Preflight resolves prices by `lookup_key` at checkout time —
   no price ids in code:

   | lookup_key | what it is |
   |---|---|
   | `preflight_starter_monthly` | Starter subscription, $99/mo |
   | `preflight_team_monthly` | Team subscription, $399/mo |
   | `preflight_scale_monthly` | Scale subscription, $1,499/mo |
   | `preflight_pack_1000` | 1,000-token pack, $60 one-time |
   | `preflight_pack_5000` | 5,000-token pack, $250 one-time |
   | `preflight_pack_25000` | 25,000-token pack, $1,000 one-time |

3. **Register the webhook** → endpoint `https://<host>/api/billing/webhook`,
   events:
   - `checkout.session.completed`
   - `customer.subscription.created`, `customer.subscription.updated`,
     `customer.subscription.deleted`
   - `invoice.paid`, `invoice.payment_failed`

   Events are verified with `constructEvent` and deduped by event id
   (`StripeEvent` table), so Stripe's retries are safe.
4. **Optional: reshape the catalog without code** — set
   `BILLING_CATALOG_JSON` to a full catalog JSON (same shape as
   `DEFAULT_CATALOG` in `src/lib/billing-catalog.ts`; validated on boot).
   Prices, token allowances, plan limits, and pack sizes are all data.
5. **Auto top-up** uses an off-session PaymentIntent against the customer's
   saved default payment method; enable "save payment method" on Checkout in
   the Dashboard so a method is on file.

What is deliberately *not* built until real auth lands: per-user Stripe
customers, seats, entitlement middleware. The single `BillingAccount` row
("default") is the whole workspace.

## 3. Auth (Supabase) — wired end to end, two env vars

Every mutating route (run/plan launch, setup, generate, billing, share
minting, connection tests) passes through `requireUser()`
(`src/server/auth.ts`), and the sign-in / sign-up / SSO pages are wired
to Supabase Auth. Activation:

```
NEXT_PUBLIC_SUPABASE_URL="…"        # Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY="…"   # anon / publishable key
```

With the URL set, mutating routes require
`Authorization: Bearer <supabase access token>`. Tokens verify against
the project's published JWKS (ES256/RS256 signing keys — the default on
new projects), fetched once and cached; legacy projects can set
`SUPABASE_JWT_SECRET` for local HS256 verification instead (both may be
set during a key migration). Without either, the app runs in open
single-workspace mode, exactly as self-hosted today.

The client side is already done: email sign-in/sign-up (including the
email-confirmation path), Google/GitHub OAuth buttons, a session bridge
that mirrors the Supabase session into the workspace store, and access
tokens attached to every mutating fetch. In the Supabase dashboard you
still need to: enable the Google and GitHub providers (Auth →
Providers) and add your domain + `/dashboard` to the redirect allowlist
(Auth → URL Configuration).

Remaining follow-on when multi-user matters:
- Key `BillingAccount` and the `FreeGrant` ledger by `user.id` (the
  verified id is already returned by `requireUser`); the fingerprint
  heuristics become defence-in-depth only.

## 4. LLM provider

```
PREFLIGHT_LLM_KEY="sk-ant-…"     # or ANTHROPIC_API_KEY as fallback
PREFLIGHT_MODEL="claude-opus-4-8"
PREFLIGHT_CONCURRENCY="3"
```

Unset key = sandbox-only live mode (deterministic mock provider, free).
`PREFLIGHT_LLM_KEY="mock"` forces the mock provider explicitly.

## 5. Agent endpoints & network safety

User-supplied agent endpoints are screened (`src/server/net-guard.ts`):
localhost, RFC1918, link-local, and cloud-metadata addresses are refused in
production. Self-hosting behind a VPN where agents *are* on private IPs?
Set `PREFLIGHT_ALLOW_PRIVATE_ENDPOINTS="1"`.

Known limit (documented, accepted): the guard screens hostnames/IPs at
request time; it is not a DNS-rebinding-proof egress proxy. Put real egress
policy at the network layer if you need that guarantee.

## 6. Operational notes

- **Crashed runs**: a run stuck in `running` with no result writes for
  10 minutes is auto-marked `error` ("run abandoned") on the next launch —
  a crashed process never blocks the workspace permanently.
- **SSE**: the live wall's event bus is in-process. One app instance =
  fine. Scaling to multiple instances is a roadmap item (Postgres
  LISTEN/NOTIFY or Supabase Realtime) — until then, run one instance.
- **Store seeding** is synchronous at first run; on Postgres expect the
  first live run to take a few extra seconds.
- **CI**: `.github/workflows/ci.yml` runs lint, typecheck, tests, schema
  push, and build on every push/PR. The customer-facing CI gate (the
  `action.yml` Action + `scripts/preflight-gate.mjs`) is separate and
  already production-shaped.
