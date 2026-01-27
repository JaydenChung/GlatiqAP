# 🟢 TIMEOUT STRATEGIST

> Timeout Configuration — Setting appropriate time limits

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-001 |
| **Name** | Timeout Strategist |
| **Role** | Timeout Configuration |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Timeout patterns, deadline propagation, cascading timeouts, timeout budgeting.

---

## Key Recommendations

```python
TIMEOUTS = {
    "grok_api_call": 30,      # LLM can be slow
    "pdf_extraction": 10,      # Should be fast
    "db_query": 5,             # Very fast
    "payment_api": 15,         # External service
    "total_invoice": 120,      # End-to-end budget
}

async def with_timeout(coro, timeout_key):
    return await asyncio.wait_for(coro, timeout=TIMEOUTS[timeout_key])
```

**Timeout principles:**
- Set explicit timeouts on ALL external calls
- Budget timeouts (child < parent)
- Different timeouts for different operations
- Log when approaching timeout

---

## Subcommittee Assignments
- 07_error_recovery

*"A timeout is a promise to the caller."*
