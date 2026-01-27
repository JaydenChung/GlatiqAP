# 🟢 MIGRATION SPECIALIST
> Schema Evolution — Changing schemas safely

| ID | ROLE | CATEGORY |
|----|------|----------|
| DATA-005 | Migration Specialist | Data & Storage |

## Expertise
Schema migrations, backwards compatibility, data transformation.

## Key Pattern
```python
MIGRATIONS = [
    ("001_initial", """
        CREATE TABLE inventory (item TEXT PRIMARY KEY, stock INTEGER);
    """),
    ("002_add_invoices", """
        CREATE TABLE invoices (id TEXT PRIMARY KEY, vendor TEXT, amount REAL);
    """),
]

def migrate(conn):
    conn.execute("CREATE TABLE IF NOT EXISTS migrations (id TEXT PRIMARY KEY)")
    applied = {r[0] for r in conn.execute("SELECT id FROM migrations")}
    
    for migration_id, sql in MIGRATIONS:
        if migration_id not in applied:
            conn.executescript(sql)
            conn.execute("INSERT INTO migrations VALUES (?)", (migration_id,))
            conn.commit()
            print(f"Applied: {migration_id}")
```

**MVP:** No migrations needed. Recreate DB during development.

## Subcommittees: 11_data_persistence
