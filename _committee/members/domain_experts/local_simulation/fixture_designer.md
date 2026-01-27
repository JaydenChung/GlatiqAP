# 🟢 FIXTURE DESIGNER
> Test Data Patterns — Realistic test inputs

| ID | ROLE | CATEGORY |
|----|------|----------|
| SIM-002 | Fixture Designer | Local Simulation |

## Expertise
Test fixtures, data generation, edge case fixtures, fixture management.

## Key Pattern
```python
FIXTURES = {
    "clean_invoice": {
        "vendor_name": "Widgets Inc",
        "amount": 5000.00,
        "items": [{"name": "WidgetA", "quantity": 10}],
        "due_date": "2026-02-01"
    },
    "messy_invoice": {
        "vendor_name": "Gadgets Co.",
        "amount": 15000,  # Needs approval
        "items": [{"name": "GadgetX", "quantity": 20}],  # Exceeds stock
    },
    "fraud_invoice": {
        "vendor_name": "Fraudster",
        "amount": 100000,
        "items": [{"name": "FakeItem", "quantity": 100}],
    }
}
```

**Fixture types:** Happy path, edge cases, error cases, boundary values.

## Subcommittees: 18_local_simulation
