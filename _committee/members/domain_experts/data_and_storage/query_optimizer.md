# 🟢 QUERY OPTIMIZER
> Efficient Queries — Fast data access

| ID | ROLE | CATEGORY |
|----|------|----------|
| DATA-003 | Query Optimizer | Data & Storage |

## Expertise
Query planning, indexing strategy, batch queries, N+1 prevention.

## Key Pattern
```python
# BAD: N+1 queries
for item in invoice.items:
    stock = query_inventory(item.name)  # N queries!

# GOOD: Batch query
def check_all_items(items: list[str]) -> dict[str, int]:
    placeholders = ",".join("?" * len(items))
    query = f"SELECT item, stock FROM inventory WHERE item IN ({placeholders})"
    results = conn.execute(query, items).fetchall()
    return {row['item']: row['stock'] for row in results}

stocks = check_all_items([i.name for i in invoice.items])
```

**Optimization principle:** Fewer round-trips, bigger batches.

## Subcommittees: 11_data_persistence
