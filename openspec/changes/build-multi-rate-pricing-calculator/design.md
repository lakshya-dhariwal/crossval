## Context

See `proposal.md` for motivation and the seven capability specs for observable behavior. The repository is greenfield: it contains the four-page assignment PDF and OpenSpec configuration but no package manifest or code to preserve. The target is a take-home-quality SaaS that can be deployed to Vercel against the supplied Supabase project.

The design must resolve four coupled correctness surfaces before UI work begins:

```text
verified Supabase session
          |
          v
strict request schema -> lifecycle/ownership service -> pure decimal calculator
          |                         |                         |
          |                         v                         |
          +-----------------> atomic persistence <------------+
                                    |
                                    v
                        RLS-protected PostgreSQL rows
```

The public Supabase URL and publishable key are browser-safe. The supplied secret key is privileged, has already been disclosed in conversation, and must be rotated before deployment. It must appear only in ignored server environment configuration after rotation; it must never use a `NEXT_PUBLIC_` name, be committed, logged, included in an API response, or bundled into client code.

## Goals / Non-Goals

**Goals:**

- Make domain rules easy to locate: one pure TypeScript calculator, one mutation service boundary, one error vocabulary, and one lifecycle policy.
- Keep the database internally coherent after every externally successful mutation and secure under both route-level authorization and RLS.
- Give the editor reliable native-input keyboard behavior, immediate previews, and race-safe server reconciliation.
- Produce a distinctive but restrained product surface with a documented hierarchy and component character, not a generic component-library demo.
- Make setup, migration, testing, email authentication, deployment, and manual QA reproducible by another engineer.

**Non-Goals:**

- Multiple currencies, locale-aware tax compliance, invoice numbering, payments, email delivery, audit history, real-time co-editing, offline editing, or organization/team sharing.
- Exact server-generated PDF binaries; an in-place browser PDF download generated from the standalone HTML output is the required PDF workflow.
- Table virtualization or phone-first editing. The app remains usable at laptop widths and offers controlled horizontal scrolling only inside the line-item grid when genuinely necessary.
- Direct public use of privileged database mutation functions. The documented REST API is the supported mutation surface.
- Installing a broad UI kit. Use small accessible primitives only for dialog/menu/tooltip behavior that is costly to implement correctly.

## Decisions

### 1. Application shape and dependency boundaries

Use the latest stable Next.js App Router with strict TypeScript and Tailwind CSS. Keep Server Components as the default for route protection, initial page data, and static layout. Use Client Components only for authentication form interaction, filters, local editor state, menus/dialogs, route/request progress, report controls, and in-place downloading.

Recommended dependencies:

- `@supabase/supabase-js` and `@supabase/ssr` for auth/session-aware data access.
- `zod` for strict shared request and environment validation.
- `decimal.js` for authoritative and preview calculations using explicit `ROUND_HALF_UP`.
- `react-hook-form` for the auth form and metadata fields only where it reduces state boilerplate; the grid should use controlled native inputs and a focused reducer rather than one giant form.
- `lucide-react` for a consistent small icon vocabulary.
- Radix primitives (individual packages) for accessible Dialog, DropdownMenu, and Tooltip, styled locally so the result does not look like stock shadcn.
- `vitest` and Testing Library for pure domain and targeted component behavior. TanStack Table is optional for read-only tables; native tables are sufficient at this size.

Avoid a client state framework. The editor needs a local reducer/state machine, mutation coordinator, and fetch wrapper, not global application state.

Suggested source layout:

```text
app/
  (auth)/auth/page.tsx
  auth/callback/route.ts
  (app)/layout.tsx
  (app)/documents/page.tsx
  (app)/documents/[id]/page.tsx
  (app)/documents/[id]/print/page.tsx
  (app)/reports/page.tsx
  api/documents/.../route.ts
  api/reports/summary/route.ts
components/
  app-shell/  auth/  documents/  editor/  reports/  ui/
lib/
  api/{client,errors,responses}.ts
  auth/{get-user,require-user}.ts
  domain/{calculations,calculations.test,document,errors,schemas,types}.ts
  services/{documents,line-items,reports,outputs,sample-document}.ts
  format/{currency,date,filename}.ts
utils/supabase/{client,server,middleware,admin}.ts
supabase/migrations/
```

`utils/supabase/admin.ts` must be server-only and must fail fast if imported into a client bundle. Prefer `server-only` plus no barrel export that can cross the boundary.

Alternative considered: a separate backend service. Rejected because Route Handlers are sufficient, deployment becomes harder, and the assignment forbids unnecessary infrastructure.

### 2. Environment contract and Supabase SSR

Validate environment values once on the correct side of the boundary:

```text
Browser/server: NEXT_PUBLIC_SUPABASE_URL
Browser/server: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
Server only:    SUPABASE_SECRET_KEY
Optional docs:  NEXT_PUBLIC_SITE_URL (deployment callback base)
```

Do not add `SUPABASE_JWKS_URL` unless code actually validates JWTs independently; `supabase.auth.getUser()` is the source of verified identity and already handles verification. Never use `getSession()` alone as authorization proof in a route handler.

Implement browser, server-cookie, and middleware clients following current `@supabase/ssr` cookie APIs. Middleware refreshes auth cookies and limits redirects; every protected layout and Route Handler still verifies the user because middleware is not an authorization boundary. The email-auth callback exchanges the confirmation code for a session and redirects only to a validated same-origin path.

Alternative considered: decoding the JWT locally from the supplied JWKS URL. Rejected because it duplicates supported Supabase auth behavior and adds key-rotation/error complexity without benefit.

### 3. PostgreSQL model

Create enum types `document_status ('draft','finalized')` and `discount_type ('none','percentage','fixed')`.

`documents`:

| Column           | PostgreSQL type   | Rules                                                               |
| ---------------- | ----------------- | ------------------------------------------------------------------- |
| `id`             | `uuid`            | PK, `gen_random_uuid()`                                             |
| `user_id`        | `uuid`            | not null, FK `auth.users(id)` on delete cascade                     |
| `title`          | `text`            | not null, draft may temporarily be blank; trim/required on finalize |
| `customer`       | `text`            | not null default `''`; required on finalize                         |
| `issue_date`     | `date`            | not null                                                            |
| `status`         | `document_status` | not null default `draft`                                            |
| `subtotal`       | `numeric(19,2)`   | not null default 0, non-negative                                    |
| `total_discount` | `numeric(19,2)`   | not null default 0, non-negative                                    |
| `total_tax`      | `numeric(19,2)`   | not null default 0, non-negative                                    |
| `grand_total`    | `numeric(19,2)`   | not null default 0, non-negative                                    |
| `version`        | `bigint`          | not null default 1, increments per mutation                         |
| `sample_key`     | `text`            | nullable; `assignment-v1` only for starter row                      |
| `created_at`     | `timestamptz`     | not null default now                                                |
| `updated_at`     | `timestamptz`     | not null default now                                                |
| `finalized_at`   | `timestamptz`     | nullable; required exactly when finalized                           |

`line_items`:

| Column           | PostgreSQL type | Rules                                                                                            |
| ---------------- | --------------- | ------------------------------------------------------------------------------------------------ |
| `id`             | `uuid`          | PK, `gen_random_uuid()`                                                                          |
| `document_id`    | `uuid`          | not null, FK documents on delete cascade                                                         |
| `position`       | `integer`       | not null, >= 1, unique per document                                                              |
| `description`    | `text`          | not null default `''`; required on finalize                                                      |
| `quantity`       | `numeric(13,4)` | not null, 1..999999999                                                                           |
| `unit_price`     | `numeric(19,4)` | not null, 0..999999999999                                                                        |
| `discount_type`  | `discount_type` | not null default `none`                                                                          |
| `discount_value` | `numeric(19,4)` | not null default 0; semantic precision validated by mode                                         |
| `tax_percent`    | `numeric(7,4)`  | not null default 0, 0..100                                                                       |
| computed columns | `numeric(19,2)` | `subtotal`, `discount_amount`, `discounted_amount`, `tax_amount`, `line_total`, all non-negative |
| timestamps       | `timestamptz`   | created/updated, not null                                                                        |

Add database checks for coarse bounds and compatible discount state (`none` requires value zero; percentage max 100). Application schemas provide precise precision and messages. Add unique `(user_id, sample_key)` where sample key is not null, unique `(document_id, position)`, indexes on `(user_id, updated_at desc)`, `(user_id, issue_date)`, `(user_id, status)`, and `(document_id, position)`.

Database lifecycle triggers must keep finalized metadata and line items read-only, allow only an explicit finalized-to-draft transition that clears `finalized_at`, allow owner-confirmed document deletion, require `finalized_at` on draft-to-finalized transition, and reject all line-item insert/update/delete operations whose parent is finalized. The trigger protects invariants even if a future route forgets the service guard.

### 4. Ownership and RLS model

Enable and force RLS on both tables. Document policies use `auth.uid() = user_id` for select/insert/update/delete; the update policy also requires the existing row to be a draft. Line policies require an `EXISTS` parent document owned by `auth.uid()` and require draft parent status for mutations. Do not grant clients mutation access to server-managed total/timestamp/finalization columns through any application payload.

The API uses a session-scoped Supabase client for verified identity and RLS-filtered ownership reads. Missing and unowned IDs intentionally collapse to the same not-found result. No body or query may carry an authoritative `user_id`.

### 5. Pure calculation and validation pipeline

Represent raw decimals as strings at HTTP/form boundaries. Zod validates syntax, scale, and range without JavaScript number coercion. Convert to `Decimal` only inside `lib/domain/calculations.ts`. Configure or call rounding explicitly rather than relying on global defaults.

```text
raw editable input
  -> strict Zod/domain validation
  -> calculateLineItem(raw)
  -> calculated line snapshot
  -> calculateDocument(calculated lines)
  -> authoritative document snapshot
```

The exact formulas and `ROUND_HALF_UP` rules are normative in `pricing-calculations/spec.md`. `calculateLineItem` returns a discriminated success/error result or throws only a known domain error. `calculateDocument` accepts calculated lines, never raw browser totals. Currency serialization uses fixed two-place strings; API JSON does not serialize `Decimal` objects or rely on JSON numbers for authoritative amounts.

Alternative considered: integer cents. Rejected because fractional quantity and four-place unit rates make intermediate percent calculations clearer and safer with arbitrary-precision decimals.

### 6. Atomic snapshot persistence

The TypeScript calculator remains the sole application formula implementation. A server-only persistence function applies an already validated and calculated snapshot atomically:

1. Verify the user with the session-scoped client and read the owned document through RLS.
2. Assert editable status through the centralized service.
3. Load all line raw values and document version.
4. Apply the requested metadata or line operation in memory, normalize positions, validate, and recalculate every affected line and document totals.
5. Call one privileged PostgreSQL RPC with the authenticated `user_id`, expected document version, and complete materialized snapshot.
6. The RPC locks the document, explicitly rechecks owner/status/version, upserts/deletes only lines under that document, updates document totals and version, and returns the committed snapshot. It does not implement pricing formulas.
7. Map version mismatch to HTTP 409 `DOCUMENT_VERSION_CONFLICT`; the client refetches and may replay only an edit that is still safe.

Revoke RPC execution from `anon` and `authenticated`; grant only `service_role`. Create the calling admin client only after session verification, never from client components. The RPC's explicit owner equality and database lifecycle triggers remain mandatory because service role bypasses RLS. Ordinary reads and any session-scoped table operations remain RLS constrained. Add SQL tests or migration assertions for unauthorized IDs, wrong-parent line IDs, version conflicts, and finalized triggers.

This is a deliberate trade-off: a privileged RPC is used only as a transaction transport for a server-calculated snapshot. It avoids duplicating calculation formulas in SQL while preventing partial line/totals writes. An alternative SQL calculator RPC would be safer for direct database callers but would violate the single shared calculation-module requirement and duplicate rounding logic.

### 7. Central service and error model

Route handlers remain thin: require user, parse schema, invoke service, map known errors, return typed response. Services expose cohesive operations such as `listDocuments`, `getOwnedDocument`, `createDocument`, `updateDocument`, `deleteDraftDocument`, `addLineItem`, `updateLineItem`, `deleteLineItem`, `finalizeDocument`, `duplicateDocument`, `getSummaryReport`, and `renderDocumentHtml`. Only the service layer calls the snapshot persistence RPC.

Centralize `assertDocumentEditable`. It produces the exact 409 finalized error for metadata edits, document deletion, and every line mutation. Finalize revalidates the whole in-memory snapshot, recalculates totals, then changes status and timestamp within the atomic RPC. Duplicate reads either source status, creates all-new IDs, resets lifecycle fields, changes date/title, recalculates, and writes in one transaction.

Standard JSON error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please correct the highlighted fields.",
    "fields": {
      "lineItems.2.discountValue": [
        "Fixed discount cannot exceed the line subtotal."
      ]
    }
  }
}
```

Log internal causes server-side with a request correlation ID, but sanitize client messages and never log credentials, tokens, secret keys, or full exported document content.

### 8. REST representation

Use camelCase in JSON while preserving snake_case in database rows through explicit mappers. Monetary and high-precision decimal fields are strings. A document detail response contains document metadata, totals, ordered `lineItems`, `itemCount`, and `version`. Mutation responses return the full committed detail snapshot so the editor reconciles from one source.

`GET /api/documents` query: optional `search`, `status=all|draft|finalized`; response `{ data: DocumentSummary[] }`. Keep initial implementation unpaginated for take-home scale but isolate parsing so cursor pagination can be added.

`POST /api/documents` accepts optional `title`, `customer`, `issueDate`; omitting them uses defaults. `PATCH /api/documents/:id` accepts only `title`, `customer`, `issueDate`, and `version`. Line POST accepts optional `afterLineItemId` plus editable defaults. Line PATCH accepts only editable raw fields and `version`. Finalize/duplicate accept `version` where relevant. HTML export returns `text/html; charset=utf-8` with `Content-Disposition: attachment`.

### 9. Sample provisioning

Provision lazily after the first verified session, before rendering the protected shell. `ensureSampleDocument(userId)` attempts insertion keyed by `(user_id, sample_key='assignment-v1')`; a uniqueness conflict means another request won. It builds the three lines through the same TypeScript calculator and atomic snapshot path used by normal documents. This avoids a trigger on `auth.users`, remains testable, and is idempotent across repeated email-authentication requests.

Alternative considered: an `auth.users` trigger containing hard-coded totals. Rejected because it duplicates pricing logic and makes auth creation depend on application-domain SQL.

### 10. UX architecture and visual language

Treat this as a product surface, not a marketing surface. The creative north star is **Quiet Ledger**: paper-like neutral workspace, crisp white working surfaces, narrow green signals, and the density of a carefully tuned spreadsheet. Hierarchy comes from spacing, type weight, rules, and alignment rather than giant cards or saturated backgrounds.

Design tokens in global CSS:

- Background `#EDEEEB`, surface `#FFFFFF`, primary `#027F3E`, accent `#028D62`.
- Add neutral text/border/muted/error tokens derived for WCAG contrast; do not scatter raw colors in components.
- Use a high-quality system sans stack or one deliberately selected variable sans loaded without layout shift. Body 14px, table 13px, metadata labels 12px, page titles 24-28px, document title 30-36px; avoid oversized display type.
- Radius scale 8/10/12px. Tables and inline controls use 8px; menus/dialogs use 10-12px. No pill containers except compact statuses.
- Flat by default. Use one subtle surface shadow only for floating menus/dialogs or when hierarchy requires it.
- Motion is functional and 120-180ms: hover/focus, dialog/menu entrance, and save-state crossfade. Respect reduced motion; no decorative page transitions.

Anti-pattern detector list for review: no gradients, glass, giant rounded cards, dashboard card mosaics, excessive pills, floating detached inputs, muted-on-muted low contrast, generic empty boxes, green page backgrounds, or motion without state meaning.

Page anatomy:

```text
┌──────────────┬──────────────────────────────────────────────────────┐
│ Crossval     │ breadcrumb / title                    primary action │
│ Documents    ├──────────────────────────────────────────────────────┤
│ Reports      │ controls / inline metadata / content                 │
│              │                                                      │
│ account      │ table or editor grid                                 │
└──────────────┴──────────────────────────────────────────────────────┘
```

At narrower laptop widths, collapse sidebar labels behind an explicit menu or reduce sidebar width; never silently remove navigation. The document list prioritizes Title, Status, Total, and Actions if columns need responsive hiding. The editor grid may scroll horizontally within its own white surface with Description and row number visually anchored; the overall page must not overflow.

### 11. Editor state and mutation coordination

Model each editable cell as server value plus optional local draft value and field error. Maintain one document-level explicit save coordinator:

```text
clean -> locally_dirty -> saving -> saved
                       \-> validation_error -> locally_dirty
                       \-> conflict -> refetch -> clean/read_only
```

No field change initiates a request. Metadata and raw line drafts remain local and numerical fields preview through the shared calculator. Save validates the complete changed set, then applies metadata and changed-line requests serially with each latest server version. Successfully committed portions are removed from the dirty set; a failed or partial save retains all remaining local values and reconciles the latest confirmed server snapshot. Publish submits the complete current local snapshot and the expected server version to one backend operation, which validates, recalculates, saves, and finalizes through one atomic persistence call.

Keep DOM inputs mounted and keyed by stable line IDs to preserve cursor and focus. Store refs by `lineId:field`. Define editable traversal order as Description, Qty, Unit price, Discount type/value, Tax for each row. Enter advances without a request; Shift+Enter prevents default, inserts a local blank row below, then focuses Description. The new row is persisted only by Save or Publish. Escape resets only the active cell to its server value. Deletion captures current coordinates and focuses same-column next row, previous row, or Add line in that order.

Use `aria-live="polite"` for explicit save state and document-level errors, `aria-describedby` for field errors, accessible names for icon buttons, and focus management for menus/dialog. Save and Publish expose icons and pending states; Publish saves and finalizes in one user action. Use `next-nprogress-bar` as a slim green top indicator for App Router navigation and client-side `/api/` requests. Prefetch Documents from the auth screen and Reports while the Documents area is active.

### 12. Documents, reports, and output flows

Documents list filters should be URL-backed query state for refresh/share behavior. Use server rendering for initial results and a small client toolbar that updates query parameters. Kebab menu actions must stop row navigation. New document POSTs, then routes directly to the new editor and focuses title or first Description (choose first Description because the title already has a useful default).

Reports use date-only `YYYY-MM-DD` strings and an inclusive Supabase query. Aggregate from the exact returned rows with Decimal on the server, or use a SQL view/RPC that returns both rows and aggregates from one snapshot. Do not calculate summary cards from a separately filtered client list. Default range is today minus 29 days through today (30 inclusive days).

The PDF action stays on the current page. It fetches the protected standalone HTML export, renders that document in an off-screen frame, and saves it through the client PDF library. HTML export uses the same neutral output view model and formatting helpers, then renders through a dedicated escaped string/template function; it must not reuse React app markup or depend on Tailwind CSS.

### 13. Testing and verification strategy

Vitest calculation tests must call the production calculator for the assignment sample and every case listed in the request: percentage before tax, fixed before tax, none, no tax, 100% discount, decimal quantity/rate, fixed equal/above subtotal, negative price, quantity below one, tax above 100, discount above 100, rounding-sensitive input, and multi-line per-line rounding. Add schema tests for malformed tokens and precision.

Test lifecycle services with a repository/persistence adapter seam: finalized mutations rejected, invalid finalization rejected, finalized duplication produces a recalculated draft and leaves source unchanged, computed client fields ignored, and stale version conflicts. Add route tests for 401/404/409/422 envelopes and wrong-parent line IDs where practical. Add component tests for Shift+Enter insertion, Escape rollback, finalized read-only rendering, and focus restoration. SQL/RLS verification should use two test users against a local Supabase instance or documented manual scripts.

Before handoff run formatting, lint, `tsc --noEmit`, Vitest, and production build. Then perform the supplied manual QA checklist against local Supabase and a production deployment, recording anything blocked by external Supabase configuration rather than claiming it passed.

### 14. README and deployment contract

README sections must match the requested deliverable list and include exact Supabase CLI migration commands, local environment names without real secret values, email confirmation callback configuration, development/test/build commands, Vercel environment setup, endpoint table, worked sample, rounding policy, finalization rules, assumptions/trade-offs, screenshot section, deployed URL placeholder until real deployment, and realistic production improvements.

Do not install `supabase/agent-skills` into the product dependency graph. If an implementation agent chooses to install coding-agent skills, treat them as local tooling and review any generated files before keeping them.

## Risks / Trade-offs

- **[Privileged snapshot RPC can bypass RLS]** -> Verify the session and owned row through RLS before every call, revoke public execution, keep the admin client server-only, recheck owner/status/version inside the function, and enforce lifecycle with database triggers.
- **[Pricing logic and atomic persistence live in different layers]** -> Keep the RPC formula-free and accept only a complete calculated snapshot from the trusted server service; heavily test the calculator and RPC ownership/version behavior.
- **[Supabase `numeric` values arrive as strings]** -> Preserve decimal strings through mappers and formatters; never coerce authoritative money through JavaScript `number`.
- **[Autosave can race across serverless instances]** -> Use document versions, atomic compare-and-swap persistence, client mutation sequences, and conflict refetch.
- **[Lazy sample provisioning adds work to first protected request]** -> Use a unique idempotency key, keep the operation small, and show shell/list skeletons while it completes.
- **[Drafts temporarily permit blank customer and descriptions]** -> Show immediate required indicators and enforce complete server validation on finalization; numeric invalid states are never persisted.
- **[Single currency is implicit]** -> Format as USD and state the assumption in README; add a currency column before production localization.
- **[Browser PDF output varies by platform]** -> Supply carefully tested A4 print CSS and document that exact binary PDF generation is a production enhancement.
- **[The external Impeccable skill is not installed]** -> Encode its current product-register, durable design-context, anti-generic, hardening, and polish principles directly in this OpenSpec design; perform visual QA in the browser during apply.

## Migration Plan

1. Rotate the disclosed Supabase secret key and configure ignored local environment variables.
2. Scaffold the Next.js application and install pinned dependencies.
3. Add migrations in dependency order: extensions/enums/tables, constraints/indexes, timestamp/lifecycle triggers, RLS/grants, then atomic snapshot functions.
4. Apply migrations to a local Supabase environment, run RLS/two-user verification, then apply to the target project.
5. Configure email/password confirmation redirect URLs for localhost and production.
6. Deploy the application with public and rotated server-only environment values, run migrations before switching traffic, then complete the manual QA checklist.

Rollback before real user data is present: remove the application deployment and roll back/drop assignment tables/functions with an explicit down migration. After real data exists: do not destructively roll back; deploy the previous application version, preserve tables, and forward-fix schema changes.

## Open Questions

None that change implementation scope. The public product name defaults to **Crossval**, currency defaults to **USD**, and the README may replace the deployed-URL placeholder only after an actual deployment succeeds.
