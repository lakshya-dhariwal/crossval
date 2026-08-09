## Why

The repository currently contains only the take-home brief and an empty OpenSpec configuration. This change defines and delivers a production-quality, deployed-ready multi-rate pricing calculator that demonstrates correct decimal-safe calculations, enforceable document immutability, secure per-user data access, and a polished productivity-SaaS experience.

## What Changes

- Establish a strict Next.js App Router, TypeScript, Tailwind CSS, and Supabase application foundation with a restrained Airtable/Linear-inspired design system.
- Add email/password and Google authentication, protected application routes, server-derived identity, and PostgreSQL row-level security so users can access only their own data.
- Add documents and ordered line items with fixed or percentage discounts, percentage tax, persisted authoritative totals, and one shared decimal-safe calculation policy.
- Add draft editing, autosave, spreadsheet-like keyboard behavior, finalization, API-enforced immutability, deletion, and duplication of either draft or finalized documents into new drafts.
- Add a typed REST API for documents, line items, finalization, duplication, reporting, and standalone HTML export with consistent validation and error envelopes.
- Add an automatically provisioned, idempotent sample document for each new user with the assignment's expected totals.
- Add date-range summary reporting whose aggregates reconcile exactly with the returned documents.
- Add a dedicated printable A4 view, browser Print/Save-as-PDF flow, and downloadable standalone HTML output.
- Add calculation and lifecycle tests, loading/error/accessibility polish, complete setup/deployment documentation, and final lint/typecheck/test/build verification.

## Capabilities

### New Capabilities

- `authentication-and-ownership`: Authentication methods, protected routing, identity derivation, sample provisioning, ownership enforcement, and logout.
- `pricing-calculations`: Input validation, decimal-safe per-line calculations, rounding, authoritative document aggregation, and sample expectations.
- `document-lifecycle`: Document and line-item creation/editing/deletion, finalization immutability, duplication, and lifecycle concurrency rules.
- `rest-api`: Authenticated REST resources, schemas, status codes, field errors, ownership behavior, and mutation response contracts.
- `document-workspace`: Application shell, documents table, editor grid, autosave, keyboard interaction, loading/error states, and accessibility behavior.
- `summary-reporting`: Inclusive issue-date filtering, reconciled aggregates, report table, defaults, and error/empty states.
- `document-outputs`: Owner-only printable route, browser PDF workflow, and downloadable self-contained HTML representation.

### Modified Capabilities

None. The repository has no existing product specifications.

## Impact

- Creates the entire application surface, including App Router pages, route handlers, shared domain/services, UI components, styles, tests, and documentation.
- Adds Supabase PostgreSQL migrations, functions/triggers where needed for atomic mutations and sample provisioning, indexes, constraints, and RLS policies.
- Adds runtime dependencies for Supabase SSR, schema validation, decimal-safe arithmetic, forms, icons, accessible primitives where justified, and Vitest.
- Requires a Supabase project with email/password authentication and Google OAuth configuration plus a deployment target such as Vercel.
- Public Supabase URL and publishable key may be exposed through `NEXT_PUBLIC_*`; the supplied secret key must never be committed, sent to the browser, or required for ordinary application requests.
