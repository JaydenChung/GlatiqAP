# 🟢 INVOICE DOMAIN EXPERT
> Invoice Formats — Understanding invoice structures

| ID | ROLE | CATEGORY |
|----|------|----------|
| FIN-001 | Invoice Domain Expert | Invoice & Finance |

## Expertise
Invoice fields, format variations, industry standards, common errors.

## Key Knowledge
```python
INVOICE_FIELDS = {
    "required": ["vendor_name", "amount", "items"],
    "optional": ["due_date", "invoice_number", "po_number", "tax"],
    "common_variations": {
        "vendor_name": ["vendor", "supplier", "from", "bill from"],
        "amount": ["total", "amount due", "balance", "grand total"],
        "due_date": ["due", "payment due", "due by", "pay by"],
    }
}

AMOUNT_THRESHOLDS = {
    "auto_approve": 10000,    # Below this, auto-approve if valid
    "requires_review": 50000,  # Above this, human review
    "suspicious": 100000,      # Flag as potentially fraudulent
}
```

**Domain insight:** Invoice "standards" are suggestions at best.

## Subcommittees: 03_ingestion_pipeline, 04_validation_verification
