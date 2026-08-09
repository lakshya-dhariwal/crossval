## Purpose

Defines secure, professional document output through a dedicated print view and a self-contained downloadable HTML file without introducing a server PDF renderer.

## ADDED Requirements

### Requirement: Dedicated printable document
An owner SHALL be able to open `/documents/:id/print` as a chrome-free A4-oriented representation containing title, customer, issue date, status, complete line-item pricing details, and totals. It SHALL include a screen-only Print button that invokes the browser print dialog and SHALL provide monochrome-safe print styles, sensible page breaks, and no navigation or buttons in printed output.

#### Scenario: Owner prints a finalized document
- **WHEN** an owner opens the print route and invokes Print
- **THEN** the browser can print or Save as PDF a clean document whose values match persisted authoritative totals

#### Scenario: Non-owner opens print route
- **WHEN** an authenticated user requests another user's print URL
- **THEN** the system renders not found and exposes no document content

### Requirement: Standalone HTML export
The HTML export endpoint SHALL return a complete UTF-8 HTML document with embedded minimal CSS and no dependency on authenticated application assets. The download action SHALL use a filesystem-safe slug derived from the title followed by `.html`, and all user content SHALL be HTML-escaped.

#### Scenario: HTML is downloaded
- **WHEN** an owner chooses Export HTML
- **THEN** a standalone file downloads, opens independently, and presents the same details and authoritative totals as the application

#### Scenario: Export content contains markup characters
- **WHEN** title, customer, or description contains HTML-significant characters
- **THEN** they render as text and cannot inject markup or script into the exported document

### Requirement: Outputs remain non-mutating
Print and HTML export SHALL be available for both draft and finalized documents and SHALL never change source metadata, status, line items, or timestamps.

#### Scenario: Draft is exported
- **WHEN** an owner prints or exports a draft
- **THEN** the output visibly identifies it as Draft and the stored source remains unchanged
