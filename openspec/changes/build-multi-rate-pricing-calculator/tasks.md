## 1. Foundation and Safety

- [x] 1.1 Reinspect the repository, assignment PDF, all OpenSpec artifacts, and current tool versions before editing; record any discovered conflict in the change artifacts instead of silently diverging.
- [x] 1.2 Scaffold the latest stable Next.js App Router application in the repository with strict TypeScript, Tailwind CSS, ESLint, and the `src`/route organization from `design.md`, preserving the existing `openspec`, `.agents`, and assignment PDF files.
- [ ] 1.3 Install only the selected runtime and test dependencies (`@supabase/supabase-js`, `@supabase/ssr`, `zod`, `decimal.js`, `react-hook-form`, Lucide, minimal accessible primitives, Vitest, and targeted Testing Library packages) and add `lint`, `typecheck`, `test`, and `build` scripts.
- [x] 1.4 Add `.gitignore`, `.env.example`, and split server/public environment validation; include only variable names/placeholders and ensure the Supabase secret cannot enter a client module or committed file.
- [ ] 1.5 Rotate the secret key disclosed in the request before using a privileged server client, place the rotated value only in ignored local/deployment environment settings, and verify a production client bundle search contains neither the variable name's value nor any secret-key prefix.
- [x] 1.6 Add global CSS design tokens and foundational typography, spacing, radii, borders, elevation, focus-visible, reduced-motion, table, and numeric-input rules matching the Quiet Ledger design direction.
- [ ] 1.7 Build small locally styled UI primitives for button, field, status, skeleton, banner, tooltip, menu, dialog, and toast behavior with semantic markup and accessible names/focus handling.
- [x] 1.8 Run lint, typecheck, and production build on the foundation and fix every failure before continuing.

## 2. Supabase Schema, Integrity, and RLS

- [x] 2.1 Create the first migration with UUID support, `document_status` and `discount_type` enums, `documents`, and `line_items` using the exact numeric precision, defaults, foreign keys, and server-managed columns in `design.md`.
- [x] 2.2 Add check constraints for coarse numeric ranges, discount-mode compatibility, finalized timestamp consistency, positive positions, and non-negative computed totals.
- [x] 2.3 Add partial uniqueness for one assignment sample per user, unique line positions per document, and the owner/date/status/update and ordered-line indexes specified in the design.
- [x] 2.4 Add timestamp maintenance and database lifecycle triggers that keep finalized metadata/lines read-only, permit explicit finalized-to-draft reversal, allow owner-scoped document deletion, and reject all finalized-parent line mutations with a stable database error.
- [x] 2.5 Enable and force RLS; create document and nested line-item select/insert/update/delete policies using `auth.uid()`, parent ownership, and draft-only mutation predicates.
- [x] 2.6 Add an atomic snapshot persistence function that locks by document, checks explicit owner/status/expected version, validates line-parent membership, applies the complete calculated snapshot, normalizes totals/version, and returns committed rows without implementing pricing formulas.
- [x] 2.7 Revoke snapshot-function execution from `public`, `anon`, and `authenticated`, grant only `service_role`, and verify ordinary authenticated table access remains RLS constrained.
- [x] 2.8 Apply migrations to local Supabase; verify schema constraints, finalized triggers, version conflict, wrong-parent line protection, cascade behavior, and two-user RLS isolation with repeatable SQL or integration checks.

## 3. Supabase Clients and Authentication

- [x] 3.1 Implement browser, server-cookie, middleware, and server-only admin Supabase helpers using current `@supabase/ssr` patterns and validated environment values.
- [x] 3.2 Implement middleware session-cookie refresh without treating middleware as authorization; exclude static assets while covering protected application routes.
- [x] 3.3 Implement reusable `getUser`/`requireUser` server guards using verified `auth.getUser()`, protected app layout redirects, and HTTP 401 API behavior.
- [x] 3.4 Implement the OAuth callback code exchange with a validated same-origin destination and useful failure redirect.
- [x] 3.5 Build the polished auth page with Google, email/password sign-in and sign-up modes, accessible labels, pending states, inline failures, confirmation messaging, and no value loss.
- [x] 3.6 Implement sign-out in the account area and verify signed-out users cannot render documents, reports, print routes, or protected API data.
- [ ] 3.7 Configure and document Supabase email/password plus Google provider redirect URLs for localhost and deployment; manually verify each authentication path when provider credentials are available.

## 4. Domain Types, Validation, and Decimal Calculations

- [x] 4.1 Define database-to-domain mappers and camelCase API types that preserve all numeric values as decimal strings and never serialize authoritative money through JavaScript `number`.
- [x] 4.2 Implement strict Zod schemas for decimal token syntax, precision, ranges, document metadata, line-item editable input, list filters, IDs/versions, and report date-only ranges with the required field messages.
- [x] 4.3 Implement the pure `calculateLineItem` function with explicit Decimal round-half-up behavior and the exact per-line operation order from `pricing-calculations/spec.md`.
- [x] 4.4 Implement pure `calculateDocument` by summing already rounded line outputs and fixed-two-place serialization.
- [x] 4.5 Reject fixed discounts above rounded subtotal, negative values, invalid percentages, quantity below one, incompatible discount mode/value, malformed tokens, exponent notation, `NaN`, infinity, and excess precision without clamping/coercion.
- [x] 4.6 Add production calculation tests for all three sample lines and exact 450.00/40.00/11.50/421.50 document totals.
- [x] 4.7 Add tests for percentage-before-tax, fixed-before-tax, no discount, no tax, 100% discount, fractional quantity/rate, fixed equal/above subtotal, negative price, quantity below one, tax/discount above 100, half-up rounding, and multi-line per-line rounding.
- [x] 4.8 Add schema tests for empty/malformed/non-finite/exponent inputs, boundary values, extra decimal places, incompatible discount fields, required finalize fields, and invalid report ranges; run the focused test suite.

## 5. API Infrastructure and Atomic Services

- [x] 5.1 Implement the standard error classes, status/code mapping, field-path envelope, success helpers, malformed-JSON handling, request correlation IDs, and sanitized unexpected-error logging.
- [x] 5.2 Implement `getOwnedDocument` and ordered-line loading through the session-scoped RLS client, returning the same 404 for absent and unowned data.
- [x] 5.3 Implement centralized `assertDocumentEditable` and map database finalized/version signals to exact `DOCUMENT_FINALIZED` and `DOCUMENT_VERSION_CONFLICT` HTTP 409 responses.
- [x] 5.4 Implement the server-only snapshot repository that accepts a verified user and calculator-produced snapshot, invokes the restricted RPC with the expected version, and maps committed database rows back to domain/API types.
- [x] 5.5 Implement one mutation pipeline that loads a snapshot, applies a typed operation in memory, normalizes positions, validates raw fields, recalculates lines/document, atomically persists, and returns the full committed detail.
- [ ] 5.6 Add service tests using a persistence seam for forged calculated fields, finalized rejection, wrong ownership, wrong-parent line ID, stale version, ordered insertion/deletion, and coherent committed totals.

## 6. Documents and Line-Item REST API

- [x] 6.1 Implement `GET /api/documents` with owned title/customer search, All/Draft/Finalized filter, item counts, deterministic updated-descending ordering, and strict query parsing.
- [x] 6.2 Implement `POST /api/documents` to create an owned draft with defaults and one valid empty line, calculate its zero totals, and return HTTP 201 full detail.
- [x] 6.3 Implement `GET /api/documents/:id` with ordered lines and owner-safe 404 behavior.
- [x] 6.4 Implement `PATCH /api/documents/:id` with a strict metadata/version allow-list, authoritative response, validation errors, and finalized/version conflict handling.
- [x] 6.5 Implement `DELETE /api/documents/:id` for owned drafts only with HTTP 204; reject finalized documents and never accept cascade targets from the request.
- [x] 6.6 Implement `GET|POST /api/documents/:id/line-items` including insertion after an optional owned current line and HTTP 201 committed detail.
- [x] 6.7 Implement `PATCH|DELETE /api/documents/:id/line-items/:lineItemId` with nested parent membership, strict editable-field allow-list, ordering/totals reconciliation, HTTP 200/204 behavior, and lifecycle conflicts.
- [ ] 6.8 Add route tests for 400 malformed JSON, 401 session absence, 404 missing/unowned/nested mismatch, 409 finalized/version, 422 field validation, calculated-field injection, and sanitized 500 responses.

## 7. Finalization, Duplication, and Starter Data

- [x] 7.1 Implement `finalizeDocument` to validate trimmed title/customer, at least one line, each description and every numeric invariant, recalculate the full snapshot, and atomically set finalized state/time on each finalization transition.
- [ ] 7.2 Implement `POST /api/documents/:id/finalize` with 200 committed detail, 422 indexed field errors, 409 stale/finalized behavior, and tests for valid and invalid transitions; support the separate finalized-to-draft transition.
- [x] 7.3 Implement `duplicateDocument` for either source status with all-new IDs, copied raw pricing configuration/customer, `Copy of` title, local current date, draft lifecycle fields, normalized positions, and recalculated outputs in one transaction.
- [x] 7.4 Implement `POST /api/documents/:id/duplicate`, verify finalized-to-draft behavior, and test that the source snapshot/timestamps are unchanged.
- [x] 7.5 Implement idempotent lazy `ensureSampleDocument` after verified session using `assignment-v1`, the production calculator, and the atomic snapshot path; handle simultaneous uniqueness races.
- [ ] 7.6 Add provisioning tests that assert exactly one sample per user and the exact three line outputs/document totals after repeated calls.

## 8. Protected Shell and Documents List

- [x] 8.1 Build the compact authenticated shell with Crossval identity, Documents/Reports navigation, responsive laptop behavior, active states, account email, and accessible sign-out.
- [x] 8.2 Build the Documents page header, supporting copy, New document action, and URL-backed debounced title/customer search plus All/Draft/Finalized filtering.
- [x] 8.3 Build the semantic white document table with all specified columns, 40-44px rows, quiet statuses, tabular right-aligned totals, formatted dates, row navigation, and stable loading skeletons.
- [x] 8.4 Build status-aware row actions: draft Use as template/Delete document, finalized Print / PDF/Export HTML/Change to draft/Delete document; prevent menu clicks from opening the row and keep menus outside the scroll clip.
- [x] 8.5 Implement create-and-navigate, duplicate-and-navigate, draft deletion confirmation, export failure feedback, and document-level toasts only for meaningful actions.
- [x] 8.6 Implement distinct no-documents, no-filter-results, recoverable error, and loading states without giant cards or full-page spinners.
- [ ] 8.7 Verify the list at normal and small laptop widths, keyboard-only menu use, visible focus, money alignment, search/filter combinations, and absence of page-level horizontal overflow.

## 9. Document Editor Metadata and Read-Only State

- [x] 9.1 Build the protected document route with owner-safe not-found handling, full initial server snapshot, breadcrumb, output menu, status, save indicator, and draft Finalize action.
- [x] 9.2 Build inline title, Customer, and Issue date controls with restrained labels/required indicators, local draft values, Enter/blur/debounced save behavior, and field-associated errors.
- [ ] 9.3 Implement the document save coordinator with server version, monotonic client sequence, queued/pending/saved/error states, safe abort/refetch behavior, and stale-response rejection.
- [x] 9.4 Disable finalization while local validation failures or mutations exist and handle `DOCUMENT_FINALIZED` by showing the server message, refetching, and switching to read-only.
- [x] 9.5 Render finalized metadata as non-input text, replace the CTA with a clear Finalized state, keep line mutation controls hidden, and retain finalized print/export/template/change-to-draft/delete actions.
- [ ] 9.6 Add stable editor loading/not-found/error presentation and tests for metadata sequencing, inline validation, and finalized read-only rendering.

## 10. Spreadsheet Line-Item Editor

- [x] 10.1 Build the non-virtualized semantic grid with sticky header, specified editable/calculated columns and widths, muted calculated cells, tabular money, row hover, and a contained overflow strategy.
- [ ] 10.2 Implement stable per-cell server/draft/error state keyed by line ID, exact local Decimal previews, selection of numeric text on appropriate focus, and no cursor/focus loss during reconciliation.
- [x] 10.3 Build compact None/%/Fixed discount editing that clears incompatible values and an integrated percentage tax editor without ugly number spinners.
- [x] 10.4 Save numeric cells on blur/Enter and text cells on debounce/blur using the shared coordinator; show local errors and reconcile the full committed snapshot without total-panel layout shift.
- [x] 10.5 Implement native Tab/Shift+Tab editable-cell traversal, Enter save-and-next, Escape restore, and explicit focus refs in Description/Qty/Unit price/Discount/Tax order.
- [x] 10.6 Implement Shift+Enter flush-and-insert directly below the active row, then focus new Description; implement Add line with the same committed focus behavior.
- [ ] 10.7 Implement row removal with an accessible action, appropriate confirmation only where ambiguity warrants it, and deterministic same-column next/previous/Add focus restoration.
- [x] 10.8 Build the aligned totals panel for subtotal, negative discount, tax, divider, and emphasized grand total, driven by immediate preview then authoritative reconciliation.
- [x] 10.9 Remove all line inputs/add/remove controls for finalized documents while preserving the same readable table geometry.
- [ ] 10.10 Add component tests for Enter, Shift+Enter, Tab order, Escape, discount-mode clearing, deletion focus, stale response suppression, server conflict transition, and finalized keyboard reachability.

## 11. Finalization Experience

- [x] 11.1 Build the accessible finalize dialog with exact immutability/template copy, focus trap/restoration, Cancel and Finalize document actions, and duplicate-submit protection.
- [ ] 11.2 Wire finalization to flush/await pending saves, submit the current version, display indexed validation errors at their fields, and announce meaningful success or failure.
- [x] 11.3 Verify direct metadata and line add/patch/delete requests against a finalized document receive the exact HTTP 409 envelope while explicit reversal and deletion routes remain owner-scoped.

## 12. Summary Reports

- [x] 12.1 Implement the summary service and `GET /api/reports/summary` with inclusive owned issue-date filtering, exact Decimal aggregation from the same returned persisted rows, and strict date-only validation.
- [ ] 12.2 Build the Reports page with default inclusive 30-day range, integrated From/To controls, URL state, no full reload, and field-level invalid-range feedback.
- [x] 12.3 Build four restrained metrics and the matching semantic document table with issue date, title, customer, status, discount, tax, and grand total.
- [ ] 12.4 Add stable loading skeletons, zeroed no-match state, recoverable API-error banner, and tests that metric sums exactly reconcile with boundary-inclusive rows.

## 13. Print and Standalone HTML Output

- [x] 13.1 Create one output view model and formatting layer shared by print and HTML export so both use persisted authoritative values and escaped user content.
- [x] 13.2 Build `/documents/:id/print` as an owner-protected, chrome-free invoice/quote-like page with title/customer/date/status, complete line details, totals, and a screen-only Print button.
- [x] 13.3 Add A4 `@media print` rules for margins, monochrome safety, hidden controls/navigation, crisp tables, and sensible row/totals page breaking; inspect print preview with short and long documents.
- [x] 13.4 Implement `GET /api/documents/:id/export/html` with a complete UTF-8 document, embedded CSS, escaped content, safe filename, attachment headers, owner-safe 404, and no authenticated CSS/assets.
- [ ] 13.5 Wire list/editor output actions and add tests for draft/finalized availability, no source mutation, owner isolation, HTML escaping, content type/disposition, and totals parity.

## 14. Accessibility, Visual Hardening, and Interaction Polish

- [ ] 14.1 Audit every page for semantic landmarks, heading order, labels, error associations, `aria-live` use, icon names, tooltip discoverability, dialog/menu focus behavior, contrast, and visible focus.
- [ ] 14.2 Complete keyboard-only auth, navigation, search/filter, document menu, metadata, full grid editing, row insertion/removal, finalization, duplication, report, print, and sign-out flows.
- [ ] 14.3 Review all loading, empty, validation, network, stale-conflict, not-found, and finalized states for stable layout and useful recovery without routine mutation toasts.
- [x] 14.4 Perform the Quiet Ledger visual pass: remove generic card-grid/pill/gradient/glass patterns, tune page rhythm and compact table density, limit elevation, verify green remains an accent, and keep radius use within 8-12px.
- [ ] 14.5 Test at representative desktop and small-laptop widths; fix overflow, sticky-header layering, menu alignment, date-input integration, focus preservation, and totals layout shift.
- [x] 14.6 Check reduced motion, browser console errors, hydration warnings, auth flicker, and rapid-input request behavior; fix all observed issues.

## 15. Documentation and Deployment Readiness

- [x] 15.1 Write the README product overview, screenshot section, stack, prerequisites, exact local setup, Supabase project/link/migration commands, environment table, and Google OAuth configuration.
- [x] 15.2 Document the exact calculation policy with worked assignment example, decimal precision, round-half-up/per-line rounding, discount-before-tax, fixed-discount rejection, document aggregation, and server authority.
- [x] 15.3 Document draft/finalized read-only behavior, explicit reversal/deletion, API enforcement, template behavior, endpoint/method/status overview, assumptions/trade-offs, and realistic pre-production improvements.
- [x] 15.4 Document development, lint, typecheck, unit/integration tests, build, Vercel deployment/environment/migration sequence, rollback posture, and deployed URL placeholder until a real URL is verified.
- [x] 15.5 Add `.env.example` values only for public placeholders and server variable names; scan tracked files and build output for the disclosed/rotated secret and remove any occurrence before handoff.

## 16. Full Verification and Handoff

- [x] 16.1 Run the formatter/check, lint, strict typecheck, complete Vitest suite, SQL/RLS checks, and production build; fix every warning/error that indicates a real defect and record exact passing commands.
- [ ] 16.2 Manually verify the complete AUTH and cross-account isolation checklist using two accounts, documenting any Google/provider step blocked by unavailable external credentials.
- [ ] 16.3 Manually verify document creation, idempotent sample, metadata autosave, all grid keyboard actions, discounts/taxes/validation, deletion focus, server reconciliation, and exact sample totals.
- [x] 16.4 Manually verify finalization validation/read-only/API conflicts, draft and finalized template copies, print/Save-as-PDF preview, independent HTML download, and source immutability.
- [ ] 16.5 Manually verify report boundaries/count/sums, loading/empty/error states, laptop layouts, keyboard focus, accessibility basics, console cleanliness, and absence of hydration errors.
- [ ] 16.6 Deploy only if credentials and deployment authority are available, apply migrations first, configure OAuth callbacks/environment, smoke-test the live URL, and replace the README placeholder only after verification; otherwise report deployment as an explicit remaining external step.
- [x] 16.7 Reconcile every completed checkbox against actual code/tests rather than intent, leave unfinished items unchecked, and provide the requested architecture, schema, endpoints, calculation policy, tests, assumptions, limitations, and exact Supabase/environment/deployment command summary.
