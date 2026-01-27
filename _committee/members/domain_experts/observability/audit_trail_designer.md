# 🟢 AUDIT TRAIL DESIGNER
> Compliance Logging — Who did what when

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-007 | Audit Trail Designer | Observability |

## Expertise
Audit events, immutable logs, compliance requirements, retention.

## Key Pattern
```python
def audit_log(event_type: str, invoice_id: str, details: dict):
    """Append-only audit trail."""
    event = {
        "timestamp": datetime.utcnow().isoformat(),
        "event": event_type,
        "invoice_id": invoice_id,
        "run_id": get_run_id(),
        "details": details
    }
    with open("audit.jsonl", "a") as f:
        f.write(json.dumps(event) + "\n")

# Usage
audit_log("approval_decision", inv_id, {"decision": "approved", "amount": 5000})
```

**Audit requirements:** Immutable, timestamped, complete, queryable.

## Subcommittees: 08_observability_logging
