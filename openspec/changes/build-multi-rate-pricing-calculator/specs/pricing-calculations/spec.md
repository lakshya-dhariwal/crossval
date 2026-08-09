## Purpose

Defines the exact decimal input, validation, calculation, and rounding contract used for authoritative line-item and document monetary values.

## ADDED Requirements

### Requirement: Decimal input contract

The system SHALL accept finite base-10 decimal strings, support quantities from 1 through 999999999 with up to four fractional digits, and support unit prices from 0 through 999999999999 with up to four fractional digits. Discount and tax percentages SHALL be from 0 through 100 inclusive with up to four fractional digits; fixed discounts SHALL be non-negative monetary values with at most two fractional digits. Empty, malformed, `NaN`, and infinite values MUST be rejected rather than silently coerced.

#### Scenario: Decimal rate is valid

- **WHEN** a line uses quantity `1.25` and unit price `10.1250`
- **THEN** the values are accepted and calculated using exact decimal arithmetic

#### Scenario: Invalid numeric token is submitted

- **WHEN** a numeric field contains an empty string, exponent notation, `NaN`, infinity, or more fractional precision than allowed
- **THEN** the mutation fails with a field-specific validation error

### Requirement: Line calculation and rounding policy

The authoritative calculator MUST use exact decimal arithmetic and round using round-half-up. It SHALL calculate each line in this order: `subtotal = round2(quantity × unit_price)`; percentage `discount_amount = round2(subtotal × discount_percent ÷ 100)`, fixed `discount_amount = fixed_discount`, or none `discount_amount = 0.00`; `discounted_amount = round2(subtotal − discount_amount)`; `tax_amount = round2(discounted_amount × tax_percent ÷ 100)`; and `line_total = round2(discounted_amount + tax_amount)`. Every persisted monetary output SHALL have two decimal places.

#### Scenario: Percentage discount is applied before tax

- **WHEN** a line has subtotal 200.00, percentage discount 10, and tax 5
- **THEN** discount is 20.00, discounted amount is 180.00, tax is 9.00, and line total is 189.00

#### Scenario: Fixed discount is applied before tax

- **WHEN** a line has subtotal 200.00, fixed discount 20.00, and tax 5
- **THEN** tax is calculated from 180.00 rather than 200.00

#### Scenario: Half-cent result is rounded

- **WHEN** an intermediate monetary result is exactly halfway between two cents
- **THEN** it rounds away from zero to the next cent under round-half-up

### Requirement: Single discount and numeric validation

A line SHALL use exactly one discount mode: `none`, `percentage`, or `fixed`. Quantity MUST be at least 1, unit price and discount MUST be non-negative, percentages MUST be within 0 through 100 inclusive, and a fixed discount MUST NOT exceed the rounded line subtotal. Invalid values SHALL be rejected and never clamped.

#### Scenario: Fixed discount exceeds subtotal

- **WHEN** a line subtotal is 20.00 and its fixed discount is 20.01
- **THEN** the system rejects the mutation with "Fixed discount cannot exceed the line subtotal."

#### Scenario: Fixed discount equals subtotal

- **WHEN** a line subtotal is 20.00 and its fixed discount is 20.00
- **THEN** discounted amount, tax amount, and line total are all 0.00

#### Scenario: Percentage is outside range

- **WHEN** tax or percentage discount is less than 0 or greater than 100
- **THEN** the system rejects the field with the corresponding between-0-and-100 message

#### Scenario: Quantity is too small

- **WHEN** quantity is less than 1
- **THEN** the system rejects it with "Quantity must be at least 1."

### Requirement: Document aggregation

The authoritative calculator SHALL derive document subtotal, total discount, total tax, and grand total solely by summing the already rounded corresponding line values. Browser-supplied computed values MUST be ignored. Persisted document totals SHALL be recomputed after every successful line-item mutation and before finalization or duplication.

#### Scenario: Several lines have fractional cents

- **WHEN** multiple lines produce values requiring rounding
- **THEN** each line is rounded first and the displayed and persisted document totals equal the sum of those rounded line values

#### Scenario: Assignment sample is calculated

- **WHEN** Widget A, Widget B, and Service fee use the inputs from the assignment
- **THEN** their line totals are 189.00, 52.50, and 180.00 and document totals are 450.00 subtotal, 40.00 discount, 11.50 tax, and 421.50 grand total

### Requirement: Shared calculator with server authority

One reusable pure calculation contract SHALL produce line and document calculations for server mutations and unit tests. The browser MAY use the same contract for immediate previews, but only server-returned results SHALL become persisted or reconciled authoritative values.

#### Scenario: Client submits forged totals

- **WHEN** a mutation includes client-calculated subtotal, discount, tax, or grand-total fields
- **THEN** the server ignores or rejects those fields, recalculates from raw editable inputs, and returns its own results
