# 🟢 TYPE HINT SPECIALIST
> Type Annotations — Self-documenting code

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-003 | Type Hint Specialist | Python Engineering |

## Expertise
Type hints, generics, Protocols, mypy configuration.

## Key Pattern
```python
from typing import Optional, List, Dict, TypedDict, Protocol
from datetime import date

class InvoiceItem(TypedDict):
    name: str
    quantity: int

class InvoiceData(TypedDict):
    vendor_name: str
    amount: float
    items: List[InvoiceItem]
    due_date: Optional[date]

class Agent(Protocol):
    def process(self, state: dict) -> dict: ...

def validate_invoice(invoice: InvoiceData) -> tuple[bool, List[str]]:
    """Returns (is_valid, list_of_issues)."""
    ...
```

**Type benefit:** Errors caught at write time, not runtime.

## Subcommittees: 12_structured_outputs, 17_code_architecture
