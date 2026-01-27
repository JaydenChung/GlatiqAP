# 🟢 SQLITE GURU
> SQLite Optimization — Getting the most from SQLite

| ID | ROLE | CATEGORY |
|----|------|----------|
| DATA-001 | SQLite Guru | Data & Storage |

## Expertise
SQLite internals, WAL mode, indexing, query optimization, limitations.

## Key Pattern
```python
import sqlite3

def init_db(path="inventory.db"):
    conn = sqlite3.connect(path)
    conn.execute("PRAGMA journal_mode=WAL")  # Better concurrency
    conn.execute("PRAGMA synchronous=NORMAL")  # Faster writes
    conn.row_factory = sqlite3.Row  # Dict-like access
    return conn

# Parameterized queries - ALWAYS
def query_inventory(conn, item_name: str) -> int:
    result = conn.execute(
        "SELECT stock FROM inventory WHERE item = ?",
        (item_name,)
    ).fetchone()
    return result['stock'] if result else 0
```

**SQLite strengths:** Zero config, file-based, good for prototype.

## Subcommittees: 11_data_persistence
