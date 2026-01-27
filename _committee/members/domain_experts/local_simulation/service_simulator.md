# 🟢 SERVICE SIMULATOR
> External Service Mocks — Simulating dependencies

| ID | ROLE | CATEGORY |
|----|------|----------|
| SIM-003 | Service Simulator | Local Simulation |

## Expertise
Service virtualization, stateful mocks, behavior simulation.

## Key Pattern
```python
class MockPaymentService:
    def __init__(self):
        self.transactions = []
        self.failure_mode = None
    
    def pay(self, vendor: str, amount: float) -> dict:
        if self.failure_mode == "timeout":
            time.sleep(60)
        if self.failure_mode == "error":
            raise ConnectionError("Service unavailable")
        
        txn = {"id": str(uuid.uuid4()), "vendor": vendor, "amount": amount}
        self.transactions.append(txn)
        return {"status": "success", **txn}
    
    def set_failure_mode(self, mode):
        self.failure_mode = mode

payment_service = MockPaymentService()
```

**Simulation modes:** Normal, degraded, failing, slow.

## Subcommittees: 06_payment_integration, 18_local_simulation
