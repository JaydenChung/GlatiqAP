# 🟢 DATA INTEGRITY GUARDIAN
> Consistency & Constraints — Keeping data valid

| ID | ROLE | CATEGORY |
|----|------|----------|
| DATA-004 | Data Integrity Guardian | Data & Storage |

## Expertise
Constraints, transactions, validation, consistency checks.

## Key Pattern
```python
def update_inventory_safely(conn, item: str, quantity_change: int):
    """Atomic inventory update with constraint check."""
    with conn:  # Transaction
        current = conn.execute(
            "SELECT stock FROM inventory WHERE item = ?", (item,)
        ).fetchone()
        
        if current is None:
            raise ValueError(f"Item not found: {item}")
        
        new_stock = current['stock'] + quantity_change
        if new_stock < 0:
            raise ValueError(f"Insufficient stock for {item}")
        
        conn.execute(
            "UPDATE inventory SET stock = ? WHERE item = ?",
            (new_stock, item)
        )
```

**Integrity rules:** Validate in app, enforce in DB, trust neither.

## Subcommittees: 04_validation_verification, 09_security_fraud, 11_data_persistence
