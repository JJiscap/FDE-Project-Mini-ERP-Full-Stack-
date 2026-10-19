# Document numbers come from a counter table, not Postgres sequences

Document Numbers (`SO-`, `INV-`, `IN-`, `OUT-`, `ADJ-`) must be sequential per Company and never reused (business rule 4). Postgres sequences skip numbers when a transaction rolls back. A failed Confirm would burn an `INV` number, leaving a gap the accountant can't explain. So we keep one row per (Company, document type) in `doc_counters` and take the next value with `UPDATE … SET last_value = last_value + 1 RETURNING last_value` inside the same transaction as the document.

- The row lock serialises concurrent Users, so two Users can never get the same number.
- A rollback also rolls back the counter, so numbers have no gaps.
- `SO` numbers are assigned when the Draft is created. A Cancelled Draft keeps its number.
