## Purpose

Defines how users authenticate, maintain sessions, receive starter data, and remain isolated from every other user's documents at both the application and database boundaries.

## ADDED Requirements

### Requirement: Supported authentication methods
The system SHALL support email-and-password sign-up, email-and-password sign-in, and sign-out. Authentication screens SHALL expose clear pending and failure states without disclosing whether an unrelated account exists. Google or other social-provider controls SHALL NOT be presented.

#### Scenario: Email sign-up succeeds
- **WHEN** a visitor submits a valid email and password in sign-up mode
- **THEN** the system creates or initiates confirmation for the account according to Supabase Auth settings and communicates the resulting state clearly

#### Scenario: Email sign-in fails
- **WHEN** a visitor submits invalid credentials
- **THEN** the system remains on the authentication screen and presents a concise, accessible error

#### Scenario: User signs out
- **WHEN** an authenticated user chooses sign out
- **THEN** the session is cleared and the user returns to the authentication screen

### Requirement: Protected session handling
The system MUST protect all document, report, print, export, and REST API surfaces with an authenticated Supabase session. Server-rendered routes and route handlers SHALL determine identity from the verified session, and session cookies SHALL be refreshed through the supported server-side Supabase flow.

#### Scenario: Unauthenticated page request
- **WHEN** a visitor requests a protected application page without a valid session
- **THEN** the system redirects to the sign-in page without rendering protected data

#### Scenario: Unauthenticated API request
- **WHEN** a client requests a protected REST endpoint without a valid session
- **THEN** the system returns HTTP 401 with the standard error envelope

### Requirement: Defense-in-depth ownership isolation
The system MUST derive `user_id` from the authenticated session and MUST NOT accept it from client request bodies. Application queries SHALL scope access to the current user, and PostgreSQL row-level security SHALL independently prevent selecting or mutating documents and line items owned by another user.

#### Scenario: User guesses another document identifier
- **WHEN** an authenticated user requests a document UUID owned by a different user
- **THEN** the application returns HTTP 404 and reveals no document metadata

#### Scenario: Direct database access uses the publishable key
- **WHEN** an authenticated client queries or mutates tables directly through Supabase
- **THEN** row-level security restricts the operation to rows owned by that authenticated user

### Requirement: Idempotent starter document
Each newly authenticated user SHALL receive exactly one ordinary draft titled "Sample document" for "Acme Corp" containing the three assignment sample line items and the expected authoritative totals. Provisioning SHALL be safe to retry and SHALL not create duplicates.

#### Scenario: First successful account setup
- **WHEN** a user account is initialized for the first time
- **THEN** the sample draft and its three line items exist with subtotal 450.00, discount 40.00, tax 11.50, and grand total 421.50

#### Scenario: Provisioning is retried
- **WHEN** starter-document provisioning runs more than once for the same user
- **THEN** exactly one starter document exists for that user
