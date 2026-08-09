## Purpose

Defines secure, professional document output through an in-place PDF download generated from a self-contained downloadable HTML file.

## ADDED Requirements

### Requirement: In-place PDF download

An owner SHALL be able to choose Save PDF from a finalized document's actions without leaving the current page. The client SHALL fetch the protected standalone HTML output, render its document body off-screen, and download a PDF containing the title, customer, issue date, complete line-item pricing details, and totals. App navigation, controls, browser URL bars, and the finalized badge SHALL not appear in the PDF.

#### Scenario: Owner downloads a finalized document as PDF

- **WHEN** an owner chooses Save PDF from the current page
- **THEN** a clean PDF downloads without route navigation and its values match persisted authoritative totals

#### Scenario: Non-owner requests the PDF source

- **WHEN** an authenticated user requests another user's HTML export source
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

PDF and HTML export SHALL be available for finalized documents and SHALL never change source metadata, status, line items, or timestamps.

#### Scenario: Draft output is rejected

- **WHEN** an owner requests PDF or HTML output for a draft
- **THEN** the request is rejected with a clear finalized-document error and the stored source remains unchanged
