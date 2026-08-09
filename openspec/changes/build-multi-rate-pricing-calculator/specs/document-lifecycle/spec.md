## Purpose

Defines creation, editing, ordering, finalization, deletion, and template-copy behavior while keeping persisted totals and lifecycle state coherent.

## ADDED Requirements

### Requirement: Draft creation and editing

Creating a document SHALL produce an owned draft titled "Untitled document", dated today, with a single valid empty line item positioned first, then return its identifier so the client can navigate directly to the editor. Draft metadata and raw line-item fields SHALL be editable through validated server mutations.

#### Scenario: New document is created

- **WHEN** an authenticated user requests a new document without optional metadata
- **THEN** the system creates the default draft and one line with blank description, quantity 1, unit price 0, no discount, and no tax

#### Scenario: Discount type changes

- **WHEN** a draft line changes among none, percentage, and fixed discount
- **THEN** the incompatible discount value is cleared to zero and the line and document totals are recalculated

### Requirement: Ordered line-item management

Draft owners SHALL be able to add, edit, and remove line items locally. Positions SHALL remain deterministic and contiguous after insertion or deletion, and the complete line-item collection SHALL be persisted atomically at the explicit Save or Publish checkpoint.

#### Scenario: Line is inserted below another line

- **WHEN** an owner adds a line after a specified current line
- **THEN** the new line occupies the next position and later lines shift down without duplicate positions

#### Scenario: Line is removed before Save

- **WHEN** an owner removes a line from a draft
- **THEN** the line disappears locally, remaining lines are resequenced, totals are recalculated, and focus moves to a sensible neighboring line without a network request

#### Scenario: Removed line is saved

- **WHEN** an owner saves or publishes after removing a line
- **THEN** the server persists the submitted complete snapshot, omits that line, and recalculates totals atomically

### Requirement: Finalization validation and transition

Only an owned draft with non-blank title, non-blank customer, at least one line, non-blank line descriptions, and valid numerical line inputs SHALL be finalized. A successful transition SHALL set status to `finalized`, set `finalized_at` once, recompute all totals, and preserve the complete pricing snapshot.

#### Scenario: Valid draft is finalized

- **WHEN** the owner confirms finalization for a fully valid draft
- **THEN** the system atomically records the finalized state and returns the read-only document

#### Scenario: Incomplete draft is finalized

- **WHEN** title, customer, line description, or another required value is invalid
- **THEN** finalization is rejected with HTTP 422 and specific field or line-item errors while the document remains a draft

### Requirement: Finalized document lifecycle

Finalized document metadata and line items MUST remain read-only while finalized through every application and REST mutation path. An owner MAY explicitly change a finalized document back to `draft`; that transition SHALL clear `finalized_at`, increment `version`, preserve the pricing snapshot, and return the editable document. An owner MAY explicitly delete a finalized document, including its line items, after confirmation. Output and duplication operations SHALL remain available while the document is finalized.

#### Scenario: Stale client patches finalized document

- **WHEN** a client attempts a metadata or line-item mutation after another request finalized the document
- **THEN** the API returns the finalized conflict, the source remains unchanged, and the client can refetch into read-only state

#### Scenario: Finalized document returns to draft

- **WHEN** an owner explicitly changes a finalized document back to draft
- **THEN** the system clears `finalized_at`, increments the version, preserves all document and line values, and returns an editable draft

#### Scenario: Finalized document is deleted

- **WHEN** an owner confirms deletion of a finalized document
- **THEN** the document and its line items are removed and the user returns to the document list

### Requirement: Draft deletion

An owner SHALL be able to delete a draft document, including its line items, after explicit confirmation in the user interface. The operation MUST NOT delete any other user's data.

#### Scenario: Draft deletion succeeds

- **WHEN** an owner confirms deletion of a draft
- **THEN** the document and its line items are removed and the user returns to the document list

### Requirement: Use as template

An owner SHALL be able to duplicate either a draft or finalized document into a new draft without changing the source. The copy SHALL use title `Copy of {source title}`, retain customer and all line-item raw pricing configuration, use today's issue date, set `finalized_at` to null, recalculate all authoritative outputs, and receive new document and line-item identifiers.

#### Scenario: Finalized document is duplicated

- **WHEN** an owner uses a finalized document as a template
- **THEN** a separately owned editable draft is created and the finalized source remains byte-for-byte unchanged

### Requirement: Coherent mutation results

Every successful line-item mutation SHALL persist raw inputs, authoritative line outputs, and authoritative document totals as one coherent outcome or restore the previous coherent state. Concurrent or rapidly sequenced edits MUST NOT allow an older response to overwrite a newer displayed value.

#### Scenario: Two edits overlap

- **WHEN** two mutations for the same document complete out of order
- **THEN** persisted totals correspond to the final persisted line values and the client ignores stale reconciliation responses
