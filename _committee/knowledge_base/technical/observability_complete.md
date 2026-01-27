# Observability Guide

## The Three Pillars

### 1. Logs
What happened, when, in what context.

```python
import structlog
logger = structlog.get_logger()

logger.info("invoice_processing_started",
    invoice_id="INV-001",
    run_id="run-20260126-143052",
    vendor="Widgets Inc"
)
```

### 2. Metrics
Aggregated measurements over time.

```python
# Key metrics to track
- invoices_processed_total (counter)
- processing_duration_seconds (histogram)
- validation_errors_by_type (counter with labels)
- approval_rate (gauge)
- grok_api_latency_seconds (histogram)
```

### 3. Traces
Request flow through the system.

```python
# Simple trace
with tracer.span("process_invoice"):
    with tracer.span("extraction"):
        data = extract(pdf)
    with tracer.span("validation"):
        result = validate(data)
```

## Implementation for MVP

### Minimum Viable Observability

```python
import json
import time
from datetime import datetime
from uuid import uuid4

def log(event: str, **context):
    """Simple JSON logging."""
    entry = {
        "timestamp": datetime.utcnow().isoformat(),
        "event": event,
        "run_id": get_run_id(),
        **context
    }
    print(json.dumps(entry))

# Usage
log("processing_started", invoice_id="INV-001")
log("validation_complete", valid=True, duration_ms=150)
log("processing_complete", status="success")
```

### Run ID Pattern

```python
from contextvars import ContextVar
_run_id: ContextVar[str] = ContextVar('run_id', default='unknown')

def start_run():
    _run_id.set(f"run-{datetime.now().strftime('%Y%m%d-%H%M%S')}-{uuid4().hex[:6]}")

def get_run_id():
    return _run_id.get()
```

## Log Levels

| Level | When to Use |
|-------|-------------|
| DEBUG | Detailed flow, state dumps |
| INFO | Normal operations, milestones |
| WARNING | Unexpected but handled |
| ERROR | Failures requiring attention |

---

*Maintained by Committee knowledge base*
