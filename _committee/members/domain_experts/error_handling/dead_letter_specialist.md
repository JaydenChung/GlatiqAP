# 🟢 DEAD LETTER SPECIALIST

> Unprocessable Handling — When nothing works

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-008 |
| **Name** | Dead Letter Specialist |
| **Role** | Unprocessable Handling |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Dead letter queues, poison message handling, manual review workflows.

---

## Key Recommendations

```python
class DeadLetterQueue:
    """Storage for unprocessable invoices."""
    
    def __init__(self, db_path="dead_letters.db"):
        self.db = sqlite3.connect(db_path)
        self._init_schema()
    
    def enqueue(self, invoice_id, data, error, attempts):
        self.db.execute("""
            INSERT INTO dead_letters 
            (invoice_id, data, error, attempts, created_at, status)
            VALUES (?, ?, ?, ?, ?, 'pending')
        """, (invoice_id, json.dumps(data), str(error), attempts, datetime.now()))
        self.db.commit()
    
    def get_pending(self, limit=10):
        return self.db.execute("""
            SELECT * FROM dead_letters 
            WHERE status = 'pending' 
            ORDER BY created_at 
            LIMIT ?
        """, (limit,)).fetchall()
    
    def resolve(self, invoice_id, resolution):
        self.db.execute("""
            UPDATE dead_letters 
            SET status = 'resolved', resolution = ?
            WHERE invoice_id = ?
        """, (resolution, invoice_id))

# Usage in pipeline
def process_invoice(invoice):
    try:
        return full_pipeline(invoice)
    except MaxRetriesExceeded as e:
        dead_letters.enqueue(invoice.id, invoice.dict(), e, e.attempts)
        return ProcessingResult(status="dead_lettered")
```

**Dead letter purpose:** No invoice is ever truly lost.

---

## Subcommittee Assignments
- 07_error_recovery
- 15_testing_quality

*"Dead letters are problems deferred, not solved."*
