## Purpose

Defines the authenticated JSON and HTML HTTP contracts used by the application and available to external REST clients, including consistent errors and lifecycle enforcement.

## ADDED Requirements

### Requirement: REST resource surface
The system SHALL expose `GET|POST /api/documents`, `GET|PATCH|DELETE /api/documents/:id`, `POST /api/documents/:id/finalize`, `POST /api/documents/:id/revert`, `POST /api/documents/:id/duplicate`, `GET|POST /api/documents/:id/line-items`, `PATCH|DELETE /api/documents/:id/line-items/:lineItemId`, `GET /api/reports/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&includeDrafts=1`, and `GET /api/documents/:id/export/html`.

#### Scenario: Resource is created
- **WHEN** an authenticated request creates a document or line item successfully
- **THEN** the API returns HTTP 201 with the created resource and current authoritative totals

#### Scenario: Resource is updated
- **WHEN** an authenticated valid patch succeeds
- **THEN** the API returns HTTP 200 with the updated resource and current authoritative totals

#### Scenario: Draft is deleted
- **WHEN** an authenticated owner deletes a draft document or line item
- **THEN** the API returns HTTP 204 with no response body

### Requirement: Typed request boundaries
Mutation bodies and query parameters SHALL be parsed by reusable strict schemas. Unknown authoritative/calculated fields SHALL not be accepted, malformed JSON SHALL produce HTTP 400, and semantically invalid fields or date ranges SHALL produce HTTP 422 with field-level details.

#### Scenario: Validation fails
- **WHEN** a request contains multiple invalid fields
- **THEN** the response lists stable field paths and user-readable messages for each invalid field

#### Scenario: Unknown computed field is supplied
- **WHEN** a client supplies `grand_total` or another server-managed field in a patch
- **THEN** the request is rejected or the field is excluded by a strict allow-list and cannot affect persisted calculations

### Requirement: Stable error envelope
Every JSON error SHALL use `{ "error": { "code": string, "message": string, "fields"?: Record<string, string[]> } }`. The API SHALL use 400 for malformed requests, 401 for missing authentication, 404 for missing or unowned resources, 409 for lifecycle or concurrency conflicts, 422 for validly formed but invalid domain input, and 500 only for sanitized unexpected failures.

#### Scenario: Unexpected database failure
- **WHEN** an internal database operation fails unexpectedly
- **THEN** the client receives a generic error code and message without table names, SQL, keys, stack traces, or internal identifiers

### Requirement: Nested ownership validation
Line-item routes MUST verify that both the parent document and requested line item belong to the authenticated user and that the line item belongs to that parent document.

#### Scenario: Line belongs to a different document
- **WHEN** a user combines an owned document ID with a line-item ID from another document
- **THEN** the API returns HTTP 404 and changes neither document

### Requirement: List and report query behavior
The document list endpoint SHALL support title/customer search and status filtering, return item counts and authoritative totals, and use a deterministic updated-descending order. The report endpoint SHALL validate ISO date-only parameters and return both summary metrics and the exact matching document rows used to derive them.

#### Scenario: Search and filter are combined
- **WHEN** a user supplies search text and status `finalized`
- **THEN** only owned finalized documents whose title or customer contains the search text are returned
