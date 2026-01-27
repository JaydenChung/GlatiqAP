# 🟢 PAYMENT SPECIALIST
> Payment API Patterns — Executing payments safely

| ID | ROLE | CATEGORY |
|----|------|----------|
| FIN-004 | Payment Specialist | Invoice & Finance |

## Expertise
Payment APIs, idempotency, reconciliation, payment failures.

## Key Pattern
```python
import uuid

class PaymentService:
    def __init__(self):
        self.processed = set()  # Idempotency tracking
    
    def pay(self, invoice_id: str, vendor: str, amount: float) -> dict:
        # Idempotency check
        idempotency_key = f"{invoice_id}-{amount}"
        if idempotency_key in self.processed:
            return {"status": "already_processed", "invoice_id": invoice_id}
        
        # Execute payment
        result = self._execute_payment(vendor, amount)
        
        if result["status"] == "success":
            self.processed.add(idempotency_key)
        
        return result
    
    def _execute_payment(self, vendor: str, amount: float) -> dict:
        # Mock implementation
        return {
            "status": "success",
            "transaction_id": str(uuid.uuid4()),
            "vendor": vendor,
            "amount": amount
        }
```

**Payment principle:** Idempotent, logged, reversible.

## Subcommittees: 06_payment_integration
