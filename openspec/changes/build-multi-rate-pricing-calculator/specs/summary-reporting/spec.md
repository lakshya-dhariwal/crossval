## Purpose

Defines a date-range report whose metrics are derived from persisted authoritative document totals and reconcile exactly with its visible document rows.

## ADDED Requirements

### Requirement: Inclusive issue-date range
The Reports screen and API SHALL filter owned documents by issue date inclusively from `from` through `to`. The default SHALL be the most recent 30-day period ending today, interpreted as date-only values rather than browser timezone timestamps.

#### Scenario: Boundary documents exist
- **WHEN** documents have issue dates equal to `from` or `to`
- **THEN** both boundary documents are included

#### Scenario: Range is invalid
- **WHEN** either date is malformed or `from` is later than `to`
- **THEN** the report shows a field-level error and does not display stale results as current

### Requirement: Reconciled report output
The report SHALL show document count, sum of grand totals, sum of total tax, and sum of total discount, plus rows containing issue date, title, customer, status, total discount, tax, and grand total. By default, only finalized documents SHALL be considered. An explicit `includeDrafts` option SHALL include both statuses. Metrics SHALL equal exact decimal sums of the persisted authoritative totals on the returned rows.

#### Scenario: Report defaults to finalized documents
- **WHEN** owned draft and finalized documents fall in range
- **THEN** only finalized documents are included and their totals contribute to the metrics

#### Scenario: Report includes drafts on request
- **WHEN** the owner enables `includeDrafts`
- **THEN** both statuses are included, clearly labeled, and their totals contribute to the metrics

#### Scenario: Report has no matches
- **WHEN** no owned documents fall in range
- **THEN** all metrics display zero values and an intentional empty state replaces the table body

### Requirement: Report interaction states
Changing a valid date SHALL refresh the report without a full-page reload. The screen SHALL provide stable loading skeletons, retain controls during loading, and show a recoverable banner for API or network failure.

#### Scenario: Refresh fails
- **WHEN** the summary request fails
- **THEN** the date controls remain usable and the user receives a retry-capable error state
