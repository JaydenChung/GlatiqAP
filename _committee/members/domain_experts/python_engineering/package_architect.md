# 🟢 PACKAGE ARCHITECT
> Module Organization — Clean imports and dependencies

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-004 | Package Architect | Python Engineering |

## Expertise
Package structure, __init__.py design, circular import prevention.

## Key Pattern
```python
# invoice_processor/__init__.py
from .main import process_invoice
from .models.schemas import InvoiceData, ValidationResult

__all__ = ['process_invoice', 'InvoiceData', 'ValidationResult']

# Avoid circular imports:
# - Import types for type hints only
from typing import TYPE_CHECKING
if TYPE_CHECKING:
    from .agents.validation import ValidationAgent

# - Use late imports inside functions
def get_validator():
    from .agents.validation import ValidationAgent
    return ValidationAgent()
```

**Import rules:** Public API in __init__.py, implementation details private.

## Subcommittees: 17_code_architecture
