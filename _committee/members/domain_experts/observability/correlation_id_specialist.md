# 🟢 CORRELATION ID SPECIALIST
> Request Tracing — Following requests through systems

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-002 | Correlation ID Specialist | Observability |

## Expertise
Request IDs, trace propagation, parent-child relationships.

## Key Pattern
```python
import uuid
from contextvars import ContextVar

run_id: ContextVar[str] = ContextVar('run_id')

def start_run():
    run_id.set(str(uuid.uuid4())[:8])

def get_run_id():
    return run_id.get("unknown")

# Every log includes: {"run_id": "abc123", ...}
```

**Principle:** One ID per invoice, visible everywhere.

## Subcommittees: 08_observability_logging
