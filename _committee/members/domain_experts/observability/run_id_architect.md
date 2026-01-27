# 🟢 RUN ID ARCHITECT
> Execution Tracking — Unique identifiers for runs

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-006 | Run ID Architect | Observability |

## Expertise
ID generation, ID formats, ID propagation, ID storage.

## Key Pattern
```python
from datetime import datetime
import uuid

def generate_run_id() -> str:
    """Generate human-friendly, sortable, unique run ID."""
    timestamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    unique = uuid.uuid4().hex[:6]
    return f"run-{timestamp}-{unique}"
    # Example: run-20260126-143052-a1b2c3
```

**ID Properties:** Unique, sortable, greppable, short enough to type.

## Subcommittees: 08_observability_logging
