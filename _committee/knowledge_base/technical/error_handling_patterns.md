# Error Handling Patterns

## Core Philosophy

> "Plan for failure. It's the only thing guaranteed to happen."

## Pattern Hierarchy

### 1. Timeout
Every external call should have a timeout.

```python
TIMEOUTS = {
    "grok_api": 30,
    "pdf_parse": 10,
    "db_query": 5,
}
```

### 2. Retry with Backoff
For transient failures.

```python
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, max=30)
)
def call_with_retry(fn):
    return fn()
```

### 3. Circuit Breaker
Prevent cascade failures.

```python
breaker = CircuitBreaker(
    failure_threshold=5,
    recovery_timeout=60
)
```

### 4. Fallback
Always have a Plan B.

```python
def with_fallback(primary_fn, fallback_fn):
    try:
        return primary_fn()
    except Exception:
        return fallback_fn()
```

### 5. Dead Letter
When nothing works.

```python
def process_or_quarantine(invoice):
    try:
        return full_process(invoice)
    except MaxRetriesExceeded:
        dead_letter_queue.add(invoice)
```

## Exception Hierarchy

```
InvoiceProcessingError (base)
├── ExtractionError
│   ├── PDFParseError
│   └── OCRError
├── ValidationError
│   ├── SchemaError
│   └── InventoryError
├── ApprovalError
└── PaymentError
```

## Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "V002",
    "type": "InventoryError",
    "message": "Item 'WidgetX' has insufficient stock",
    "details": {
      "requested": 20,
      "available": 5
    },
    "recoverable": false,
    "suggestion": "Reduce quantity or contact supplier"
  }
}
```

---

*Maintained by Committee knowledge base*
