# 🟢 STRUCTURED LOGGING EXPERT
> Log Architecture — JSON logs, not printf

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-001 | Structured Logging Expert | Observability |

## Expertise
JSON logging, log levels, contextual logging, log aggregation.

## Key Pattern
```python
import structlog
logger = structlog.get_logger()

def process_invoice(invoice_id: str):
    log = logger.bind(invoice_id=invoice_id, run_id=generate_run_id())
    log.info("processing_started")
    # ... processing ...
    log.info("processing_complete", duration_ms=elapsed, status="success")
```

**Principles:** Structure over strings. Context over content. Queryable over readable.

## Subcommittees: 08_observability_logging
