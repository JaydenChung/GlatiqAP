# 🟢 COMPLIANCE ADVISOR
> Regulatory Concerns — Following the rules

| ID | ROLE | CATEGORY |
|----|------|----------|
| FIN-005 | Compliance Advisor | Invoice & Finance |

## Expertise
Audit trails, retention requirements, access controls, regulatory compliance.

## Key Pattern
```python
COMPLIANCE_REQUIREMENTS = {
    "audit_trail": {
        "required_fields": ["timestamp", "action", "actor", "invoice_id", "details"],
        "retention_days": 2555,  # 7 years
    },
    "approval_documentation": {
        "record_reasoning": True,
        "record_decision_factors": True,
        "require_approval_id": True,
    },
    "data_handling": {
        "mask_sensitive": ["bank_account", "tax_id"],
        "encrypt_at_rest": True,
    }
}

def compliant_log(action: str, invoice_id: str, details: dict):
    """Log with compliance requirements."""
    record = {
        "timestamp": datetime.utcnow().isoformat(),
        "action": action,
        "actor": "system",  # or user ID
        "invoice_id": invoice_id,
        "details": mask_sensitive(details),
    }
    append_to_audit_log(record)
```

**Compliance principle:** Log everything, keep forever, mask sensitive.

## Subcommittees: 09_security_fraud
