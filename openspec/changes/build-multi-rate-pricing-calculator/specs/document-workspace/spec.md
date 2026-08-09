## Purpose

Defines the polished, accessible productivity-SaaS experience for authentication, navigation, document discovery, spreadsheet-like editing, autosave, and finalization.

## ADDED Requirements

### Requirement: Visual system and application shell
The light-only interface SHALL use tokenized colors with app background `#EDEEEB`, primary `#027F3E`, accent `#028D62`, and primary surface `#FFFFFF`. It SHALL use thin neutral borders, restrained shadows, 8-12px radii, visible focus states, compact tabular density, and green as an accent. Authenticated screens SHALL use a compact desktop-first sidebar with product identity, Documents, Reports, and an account area, and remain usable at small laptop widths.

#### Scenario: User navigates with keyboard
- **WHEN** keyboard focus moves through sidebar and page actions
- **THEN** every interactive control has a clearly visible `:focus-visible` state and a meaningful accessible name

### Requirement: Polished authentication screen
The auth screen SHALL include product identity, concise heading, Google sign-in, divider, labeled email/password fields, sign-in/sign-up switching, and non-shifting loading and error presentation.

#### Scenario: Authentication is pending
- **WHEN** an auth request is in progress
- **THEN** the relevant submit control is disabled, indicates progress, and does not erase entered values

### Requirement: Airtable-like document list
The Documents screen SHALL provide heading, supporting copy, New document action, title/customer search, All/Draft/Finalized filter, and a white table with Title, Customer, Issue date, Status, Items, Total, Updated, and Actions. Rows SHALL be approximately 40-44px high, money right-aligned with tabular numerals, and status treatments quiet. Clicking a row SHALL open it. Draft actions SHALL contain Use as template and Delete document; finalized actions SHALL additionally contain Print / PDF, Export HTML, Change to draft, and Delete document.

#### Scenario: No documents match
- **WHEN** the user has no documents or filters produce no matches
- **THEN** a tasteful state explains the condition and offers the appropriate create or clear-filter action

#### Scenario: Initial list is loading
- **WHEN** documents are being loaded
- **THEN** stable table-shaped skeletons appear instead of a full-page spinner

### Requirement: Inline metadata editor
The editor SHALL show a Documents/title breadcrumb, large inline title, inline Customer and Issue date controls, quiet Status label, status-aware Actions menu, and Finalize action for drafts. Draft actions SHALL omit print/export; finalized actions SHALL include print/export, Change to draft, Use as template, and Delete document. Text changes SHALL save on short debounce or blur, Enter/blur SHALL save the title, obvious invalid fields SHALL display restrained inline messages, and finalized metadata SHALL render read-only.

#### Scenario: Metadata save succeeds
- **WHEN** a draft metadata edit is valid
- **THEN** the interface moves from "Saving..." to "Saved" and reconciles with the server without a routine success toast

#### Scenario: Metadata save fails validation
- **WHEN** a metadata edit is invalid
- **THEN** the relevant field retains focus/value and displays its associated message

### Requirement: Spreadsheet-like line-item grid
The editor SHALL use a non-virtualized grid with columns for row number, Description, Qty, Unit price, editable Discount, editable Tax, calculated Subtotal, calculated Discount, calculated Tax amount, Line total, and row actions. Calculated cells SHALL use a distinct muted surface; monetary values SHALL be right-aligned and tabular. Drafts SHALL expose Add line and remove actions; finalized documents SHALL expose none.

#### Scenario: Local preview reconciles
- **WHEN** a user changes a valid numerical draft value
- **THEN** calculated cells preview immediately using the shared policy, save on blur or Enter, and reconcile with server-returned values without layout shift

#### Scenario: Discount mode changes
- **WHEN** a user selects None, %, or Fixed
- **THEN** the compact editor displays only the compatible value semantics and clears incompatible state

### Requirement: Spreadsheet keyboard behavior
Within editable grid cells, Enter SHALL save and focus the next logical editable cell; Shift+Enter SHALL insert a line below the active row and focus its Description; Tab and Shift+Tab SHALL traverse editable cells predictably; Escape SHALL restore the last saved value where an edit is uncommitted. New rows SHALL focus Description, and deletion SHALL focus the closest sensible surviving cell.

#### Scenario: Shift+Enter adds a row
- **WHEN** focus is in any editable cell and the user presses Shift+Enter
- **THEN** a line is inserted immediately below and its Description receives focus

#### Scenario: Escape cancels local edit
- **WHEN** a cell has an unsaved local value and the user presses Escape
- **THEN** the last server-confirmed value is restored without a mutation

### Requirement: Autosave sequencing and feedback
Text mutations SHALL use a short debounce while numerical cells save on blur or Enter. The interface SHALL show subtle Saving, Saved, and validation-failure states; prevent finalization while saves are pending; cancel or sequence requests so stale responses cannot overwrite newer state; and reserve toasts for finalization, duplication, deletion, export failure, or network/document-level failures.

#### Scenario: Finalization is attempted during save
- **WHEN** any editor mutation remains pending
- **THEN** the Finalize action stays disabled until the mutation settles

#### Scenario: Server reports finalized conflict
- **WHEN** autosave receives `DOCUMENT_FINALIZED`
- **THEN** the interface shows the server message, refetches, and transitions to the finalized read-only presentation

### Requirement: Finalization confirmation
Choosing Finalize SHALL open an accessible, focus-trapped confirmation dialog explaining that the document becomes read-only while remaining printable and reusable as a template. Cancel SHALL restore trigger focus; confirmation SHALL expose a pending state and prevent duplicate submission.

#### Scenario: User confirms finalization
- **WHEN** the user activates "Finalize document" in the dialog
- **THEN** the system finalizes once, closes the dialog, announces success, and renders the document read-only

### Requirement: Accessible interaction and responsive quality
The application SHALL use semantic tables/forms/dialogs, explicit labels, validation associations, accessible icon-button names and tooltips, focus trapping/restoration, and sufficient contrast. It SHALL avoid full-page spinners for ordinary mutations, avoid horizontal page overflow at normal laptop widths, preserve focus and cursor during autosave, and provide useful not-found behavior for missing or unowned documents.

#### Scenario: Editor is used without a mouse
- **WHEN** a user completes metadata edits, line edits, line insertion/removal, and finalization using only a keyboard
- **THEN** all operations remain reachable, focus remains visible and logical, and status/error changes are announced appropriately
