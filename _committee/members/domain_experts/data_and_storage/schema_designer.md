# 🟢 SCHEMA DESIGNER
> Data Modeling — Structuring data effectively

| ID | ROLE | CATEGORY |
|----|------|----------|
| DATA-002 | Schema Designer | Data & Storage |

## Expertise
Table design, normalization, relationships, constraints.

## Key Pattern
```sql
-- Invoice processing schema
CREATE TABLE invoices (
    id TEXT PRIMARY KEY,
    vendor_name TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),
    due_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE invoice_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT REFERENCES invoices(id),
    item_name TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK(quantity > 0)
);

CREATE TABLE inventory (
    item TEXT PRIMARY KEY,
    stock INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX idx_invoices_status ON invoices(status);
```

**Schema principles:** Constraints at DB level, normalize appropriately.

## Subcommittees: 11_data_persistence
