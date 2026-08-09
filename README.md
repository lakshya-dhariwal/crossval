# Crossval

Crossval is a pricing-document calculator for creating drafts, calculating line-item discounts and tax, publishing finalized documents, and reviewing summary reports.

Live application: https://crossval-pricing.vercel.app

## Features

- Email/password sign-up, sign-in, email confirmation, and sign-out.
- Owner-scoped documents protected by Supabase RLS and API ownership checks.
- Draft documents with editable metadata and line items.
- Per-line percentage or fixed discounts and percentage tax.
- Server-authoritative Decimal.js calculations.
- Explicit **Save** for drafts.
- **Publish** saves the current editor state and changes the document status to `finalized` in one atomic operation.
- Finalized documents are read-only. Owners can change them back to `draft`, delete them, print them, export HTML, or use them as templates.
- Summary reports default to finalized documents and support an **Include drafts** option.
- Keyboard-friendly line editing, confirmation modals, accessible validation, toasts, and loading states.

## Technology

Next.js App Router, TypeScript, Supabase Auth/Postgres/RLS, Zod, Decimal.js, Lucide, Sonner, `next-nprogress-bar`, and Vitest.

The main boundaries are:

```text
Route Handler -> request schema -> document/report service
             -> Decimal.js calculation module -> atomic database RPC
             -> owner-scoped PostgreSQL data
```

Important directories:

| Directory              | Responsibility                                                             |
| ---------------------- | -------------------------------------------------------------------------- |
| `app/`                 | Pages, protected routes, and REST handlers                                 |
| `components/`          | Auth, application shell, documents, editor, reports, and UI                |
| `lib/domain/`          | Types, validation, and calculation rules                                   |
| `lib/services/`        | Ownership, lifecycle, reports, and output services                         |
| `supabase/migrations/` | Tables, constraints, triggers, RLS, and snapshot RPCs                      |
| `scripts/`             | Demo seed, security audit, smoke checks, and finalization regression check |

## Local setup

Requirements: Node.js 20+, npm, a Supabase project, and the Supabase CLI.

```bash
npm install
cp .env.example .env.local
# Fill in .env.local.
npm run dev
```

Apply the database migrations:

```bash
source .env.local
npx supabase link --project-ref zqyelslybeynzefdkctf --yes
npx supabase db push --yes
```

In Supabase Auth:

1. Enable the Email provider.
2. Choose whether email confirmation is required.
3. Add `http://localhost:3000/auth/callback` and the production callback URL to the redirect allow-list.
4. Set `NEXT_PUBLIC_SITE_URL` to the application origin in production.

The optional demo seed creates one idempotent sample document for the configured demo account:

```bash
npm run demo:seed
```

## Environment variables

| Variable                               | Use                                                        |
| -------------------------------------- | ---------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | Supabase URL used by browser and server                    |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public Supabase key; safe only with RLS                    |
| `SUPABASE_SECRET_KEY`                  | Server-only privileged key for verified service operations |
| `SUPABASE_ACCESS_TOKEN`                | Local Supabase CLI authentication only                     |
| `NEXT_PUBLIC_SITE_URL`                 | Auth callback and deployment origin                        |
| `DEMO_EMAIL` / `DEMO_PASSWORD`         | Optional demo seed credentials                             |

Never commit `.env.local`, service keys, CLI tokens, or demo passwords.

## Calculation policy

Raw decimal values remain strings at API and form boundaries. Decimal.js uses 40 digits of precision and `ROUND_HALF_UP`. Each line is rounded to two decimal places at every monetary step:

```text
subtotal       = round2(quantity × unit price)
discount       = round2(subtotal × percentage / 100), fixed amount, or 0
discounted     = round2(subtotal - discount)
tax            = round2(discounted × tax percentage / 100)
line total     = round2(discounted + tax)
```

Document totals are sums of the already rounded line values. Quantity must be at least 1. Unit prices, discounts, and tax are non-negative. Percentages are between 0 and 100. A fixed discount may equal the subtotal but may not exceed it. Malformed decimals, exponent notation, non-finite values, and excess precision are rejected.

Assignment sample:

| Line        | Calculation                              | Line total |
| ----------- | ---------------------------------------- | ---------: |
| Widget A    | `2 × $100`, 10% discount, 5% tax         |  `$189.00` |
| Widget B    | `1 × $50`, no discount, 5% tax           |   `$52.50` |
| Service fee | `1 × $200`, `$20` fixed discount, no tax |  `$180.00` |

Expected document totals: subtotal `$450.00`, discount `$40.00`, tax `$11.50`, grand total `$421.50`.

The browser may preview calculations, but the server validates raw inputs, recalculates every line and document total, and persists only server-calculated values.

## Lifecycle and API

Documents have exactly two statuses: `draft` and `finalized`.

- Drafts are editable and support adding, editing, and removing line items.
- Save stores the current draft. Unsaved local changes are not persisted across a refresh.
- Publish sends the current metadata and line-item snapshot, validates it, recalculates totals, saves it, and sets status to `finalized` atomically.
- Finalized documents reject metadata and line-item mutations with HTTP 409 and a clear error.
- Owners may explicitly change a finalized document back to draft or delete it.
- Template duplication creates a new draft with new IDs and does not modify the source.
- Print and HTML export are available for finalized documents.

| Method                   | Endpoint                                             | Purpose                                     |
| ------------------------ | ---------------------------------------------------- | ------------------------------------------- |
| `GET`, `POST`            | `/api/documents`                                     | List or create drafts                       |
| `GET`, `PATCH`, `DELETE` | `/api/documents/:id`                                 | Read, edit, or delete a document            |
| `POST`                   | `/api/documents/:id/finalize`                        | Save and finalize a complete snapshot       |
| `POST`                   | `/api/documents/:id/revert`                          | Change finalized status back to draft       |
| `POST`                   | `/api/documents/:id/duplicate`                       | Create a new draft from a template          |
| `GET`, `POST`            | `/api/documents/:id/line-items`                      | Read or add line items                      |
| `PATCH`, `DELETE`        | `/api/documents/:id/line-items/:lineItemId`          | Edit or remove a line item                  |
| `GET`                    | `/api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD` | Inclusive summary report                    |
| `GET`                    | `/api/documents/:id/export/html`                     | Escaped HTML export for finalized documents |

Validation errors use a stable envelope with field paths such as `lineItems.0.quantity`:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please complete the document before publishing.",
    "fields": {
      "lineItems.0.quantity": ["Quantity must be at least 1."]
    }
  }
}
```

## Security and ownership

- Supabase Auth supplies identity; user IDs are never accepted from request bodies.
- Protected pages and APIs require an authenticated session.
- RLS is enabled and forced for documents and line items.
- Services verify ownership before every mutation.
- Database triggers enforce finalized read-only behavior.
- The snapshot RPC is available only to `service_role` and is called only after ownership checks.
- User text is escaped in HTML output, and user search is passed through query builders.

## Verification

```bash
npm run format
npm run lint
npm run typecheck
npm test
npm run security:audit
npm audit --omit=dev --audit-level=high
npm run check:finalization
npm run build
```

`npm test` covers calculation order, Decimal rounding, fixed-discount boundaries, invalid numeric combinations, output formatting, and HTML escaping. `check:finalization` verifies the production database trigger and atomic save-and-finalize path. `smoke:api` covers authentication, ownership, CRUD, reports, exports, lifecycle transitions, and finalized immutability when the local app and demo environment are available.

## Assumptions and production follow-ups

- USD is the display currency.
- Tax is a simple per-line percentage and is not tax-compliance software.
- Documents are single-user; teams, sharing, audit history, and co-editing are outside this assignment.
- The document list is intentionally unpaginated for take-home scale.
- Before production launch, add automated route/service/component tests, browser visual regression coverage, pagination, audit history, and monitoring around RPC failures.

## Deployment

The live application is available at https://crossval-pricing.vercel.app. Deployment requires the Supabase migrations, production environment variables, email callback allow-list, and a rotated server secret. After deployment, run the browser flow and `smoke:api` against the production URL. Keep the previous Vercel deployment available for rollback and use additive database migrations.
