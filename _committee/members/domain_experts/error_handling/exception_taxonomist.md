# 🟢 EXCEPTION TAXONOMIST

> Error Classification — Organizing errors systematically

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-006 |
| **Name** | Exception Taxonomist |
| **Role** | Error Classification |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Exception hierarchies, error categorization, error codes, semantic errors.

---

## Key Recommendations

```python
class InvoiceProcessingError(Exception):
    """Base exception for all invoice errors."""
    pass

class ExtractionError(InvoiceProcessingError):
    """PDF/text extraction failed."""
    pass

class ValidationError(InvoiceProcessingError):
    """Data validation failed."""
    pass

class InventoryError(ValidationError):
    """Inventory check failed."""
    pass

class ApprovalError(InvoiceProcessingError):
    """Approval decision failed."""
    pass

class PaymentError(InvoiceProcessingError):
    """Payment processing failed."""
    pass

# Error codes for external reporting
ERROR_CODES = {
    ExtractionError: "E001",
    ValidationError: "V001",
    InventoryError: "V002",
    ApprovalError: "A001",
    PaymentError: "P001",
}

def classify_error(e: Exception) -> dict:
    return {
        "code": ERROR_CODES.get(type(e), "X000"),
        "category": type(e).__name__,
        "retryable": isinstance(e, (ConnectionError, TimeoutError)),
        "message": str(e)
    }
```

**Taxonomy benefits:** Handle errors by category, not individual type.

---

## Subcommittee Assignments
- 07_error_recovery
- 09_security_fraud

*"Name your enemies before you can defeat them."*
