# Crossval

Crossval is a small pricing-document workspace. It helps a user create a draft, edit pricing lines, apply one discount and one tax rate per line, review exact totals, finalize the document, print it, export HTML, and reuse either a draft or a finalized document as a template.

## Product tour

- Sign in with email/password or Google.
- Open **Documents** to search and filter drafts and finalized documents.
- Open a document to edit its metadata and spreadsheet-like line grid.
- Use `None`, `%`, or `Fixed` for a line discount. Tax is a percentage.
- Press Enter to save and move through cells. Shift+Enter adds a line below. Escape restores the last saved cell value.
- Finalize only after the required fields are complete. A finalized document is read-only until you explicitly change it back to a draft.
- Draft actions include **Use as template** and **Delete document**. Finalized actions also include **Print / PDF**, **Export HTML**, **Change to draft**, and **Delete document**.
- Use **Reports** for inclusive issue-date summaries; finalized documents are included by default, with an **Include drafts** toggle for working documents.

The interface is intentionally light-only and uses a quiet ledger style: neutral workspace background, white work surfaces, thin borders, compact tables, and green only for important actions and finalized states.

## Screenshots

The local browser QA pass covers the Documents grid, editable line workspace, finalized read-only view, print view, and Reports table. The visual system is encoded in `app/globals.css` so a deployment screenshot can be added here without changing the product surface.

## Stack and architecture

Next.js App Router, strict TypeScript, Tailwind CSS, Supabase Auth/Postgres/RLS, `@supabase/ssr`, Zod, Decimal.js, Lucide, and Vitest.

The request path is:

```text
verified Supabase user
        -> strict request schema
        -> document service with ownership/lifecycle checks
        -> one pure Decimal.js calculator
        -> atomic snapshot RPC
        -> RLS-protected PostgreSQL rows
```

Server Components protect initial pages and load owner-scoped data. Route Handlers protect REST mutations. Browser components manage forms, filters, autosave, keyboard focus, menus, and print. The admin Supabase client is server-only and is used only after the session/user and document owner have been verified. The database RPC stores a complete server-calculated snapshot; it does not implement pricing formulas.

Important source areas:

```text
app/                         App Router pages and REST route handlers
components/                  Shell, auth, documents, editor, reports, outputs
lib/domain/calculations.ts   Decimal-safe authoritative calculation contract
lib/domain/schemas.ts        Strict raw-input validation
lib/services/                Ownership, lifecycle, reporting, output services
utils/supabase/              Browser, cookie, middleware, server-only admin clients
supabase/migrations/         Tables, constraints, triggers, RLS, snapshot RPC
```

## Local setup

Prerequisites: Node.js 20+, npm, a Supabase project, and the Supabase CLI.

```bash
npm install
cp .env.example .env.local
# Fill the values in .env.local. Never commit .env.local.
npm run dev
```

For this workspace, the target project is `zqyelslybeynzefdkctf`. Link and apply migrations with:

```bash
source .env.local
npx supabase link --project-ref zqyelslybeynzefdkctf --yes
npx supabase db push --yes
```

Configure Supabase Auth:

1. Enable Email provider and choose whether email confirmation is required.
2. Enable Google provider and add Google client credentials.
3. Add `http://localhost:3000/auth/callback` and the deployed `https://your-domain/auth/callback` to the provider redirect allow-list.
4. Set `NEXT_PUBLIC_SITE_URL` to the deployed origin in production.

## Environment

| Variable | Used by | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser/server | Public project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser/server | Safe with correct RLS |
| `SUPABASE_SECRET_KEY` | server only | Privileged key; never expose or commit |
| `SUPABASE_ACCESS_TOKEN` | local CLI only | Temporary CLI token; not application auth |
| `NEXT_PUBLIC_SITE_URL` | OAuth/deployment | Public application origin |
| `DEMO_EMAIL` | demo seed | Not rendered in the UI |
| `DEMO_PASSWORD` | demo seed | Share separately with the evaluator |

The demo account is created idempotently with:

```bash
source .env.local
npm run demo:seed
```

The sign-in page does not display a demo button or credentials. A normal email/password sign-in works for the configured demo account.

## Calculation policy

All raw decimal values remain strings at HTTP/form boundaries. Decimal.js uses `ROUND_HALF_UP` and 40 digits of precision. Money is rounded to two places at each line step:

```text
subtotal       = round2(quantity × unit price)
discount       = round2(subtotal × percentage / 100), or fixed amount, or 0
discounted     = round2(subtotal - discount)
tax            = round2(discounted × tax percentage / 100)
line total     = round2(discounted + tax)
```

Document totals are sums of the already rounded line values. A fixed discount may equal the rounded subtotal but may not exceed it. Quantity is at least 1. Prices and discounts are non-negative. Percentages are between 0 and 100 inclusive. Exponent notation, non-finite values, malformed decimal strings, and excess precision are rejected.

The assignment sample gives:

```text
Widget A       2 × $100, 10% discount, 5% tax  -> $189.00
Widget B       1 × $50, no discount, 5% tax    -> $52.50
Service fee    1 × $200, $20 fixed, no tax      -> $180.00
Document subtotal $450.00, discount $40.00, tax $11.50, total $421.50
```

The browser may preview with the same pure module, but the server validates raw inputs, recalculates every line, recalculates the document, and persists only its result. Browser totals are never trusted.

## Lifecycle and API

Draft metadata and lines can be edited, added, reordered by insertion, or removed. Finalized metadata and lines are read-only, but an owner can explicitly change the document back to a draft or delete it. Database triggers and the service layer protect finalized line and metadata mutations. `Use as template` creates new IDs, copies raw pricing settings, sets today's issue date, resets status to draft, and does not modify the source.

Every JSON error uses:

```json
{"error":{"code":"VALIDATION_ERROR","message":"Please correct the highlighted fields.","fields":{"lineItems.0.quantity":["Quantity must be at least 1."]}}}
```

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET/POST | `/api/documents` | List or create drafts |
| GET/PATCH/DELETE | `/api/documents/:id` | Read/edit/delete a document |
| POST | `/api/documents/:id/finalize` | Finalize once |
| POST | `/api/documents/:id/revert` | Change a finalized document back to draft |
| POST | `/api/documents/:id/duplicate` | Create a template copy |
| GET/POST | `/api/documents/:id/line-items` | Read/add lines |
| PATCH/DELETE | `/api/documents/:id/line-items/:lineItemId` | Edit/remove a line |
| GET | `/api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | Inclusive report |
| GET | `/api/documents/:id/export/html` | Standalone escaped HTML |

Print uses the browser's Print / Save as PDF flow rather than a server PDF renderer. HTML export embeds its own CSS and escapes all user text.

## Security notes

- Identity comes from verified Supabase Auth, never from a request body.
- Protected pages and APIs require a session; missing and unowned IDs resolve to the same not-found behavior.
- RLS is enabled and forced on both tables. Policies scope rows to `auth.uid()` and draft-only mutations.
- Finalized triggers protect read-only metadata/line state and permit only the explicit status reversal or owner-scoped deletion paths.
- The privileged snapshot RPC is revoked from `public`, `anon`, and `authenticated`; only `service_role` can execute it.
- User-controlled search is passed through Supabase query builders, not interpolated SQL. Output HTML escapes `&`, `<`, `>`, quotes, and apostrophes.
- No user tokens, secret keys, full document exports, or privileged key values are logged or sent to clients.
- `SUPABASE_SECRET_KEY`, `SUPABASE_ACCESS_TOKEN`, and demo passwords belong only in ignored environment configuration. Rotate temporary credentials before a real deployment.

## Verification

```bash
npm run lint
npm run typecheck
npm test
npm run security:audit
npm audit --omit=dev --audit-level=high
npm run build
```

With the local server and Supabase environment loaded, `npm run smoke:api` signs in as the private demo account and checks ownership, CRUD, totals, exports, reports, cleanup, finalized read-only mutations, and finalized-to-draft/deletion lifecycle without printing credentials.

The unit suite covers the assignment sample, half-up rounding, fixed-discount rejection, percentage-before-tax behavior, line-level rounding, boundary discounts, invalid numeric combinations, output formatting, and HTML escaping. `npm run security:audit` performs an AST-based source scan for dangerous code patterns and secret-like values. After configuring Supabase, also verify the migration, two-user RLS isolation, finalized triggers, OAuth, and the demo account with the browser flow.

## Assumptions and trade-offs

- USD is the single display currency; currency selection and locale-aware tax rules are outside the brief.
- A browser print flow is required instead of exact server-generated PDF bytes, so output can vary slightly by browser/OS.
- Documents are intentionally single-user; teams, sharing, audit history, payments, invoice numbering, and co-editing are not part of this take-home app.
- The initial document list is unpaginated because the brief targets take-home scale; the query boundary can later add cursor pagination.
- The migration uses a server-calculated materialized snapshot RPC to keep line totals and document totals atomic without duplicating formulas in SQL.
- Google provider credentials and the final deployment domain are external configuration steps and are not inventable in source code.

## Deployment

Deployed URL: not deployed in this workspace because deployment authority and a production domain were not provided.

Deploy to Vercel after applying migrations. Set the public variables and rotated `SUPABASE_SECRET_KEY` in the Vercel environment, configure Supabase redirect URLs, run the build, then smoke-test sign-in, sample data, editing, finalization, duplication, reports, print, and HTML export. Do not put the temporary CLI token in Vercel runtime environment unless a deployment operation explicitly needs it.

Rollback posture: keep the previous Vercel deployment available, revert the application deployment first, and only apply backwards-compatible database migrations. Never roll back by deleting tables or dropping columns that an older application still needs; use a follow-up migration to remove deprecated fields after the old deployment is no longer serving traffic.
