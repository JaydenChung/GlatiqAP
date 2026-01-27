# 🟢 RETRY PATTERN EXPERT

> Backoff, Jitter, Limits — Sophisticated retry strategies

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-002 |
| **Name** | Retry Pattern Expert |
| **Role** | Backoff, Jitter, Limits |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Exponential backoff, jitter, retry limits, idempotency, retry classification.

---

## Key Recommendations

```python
from tenacity import retry, stop_after_attempt, wait_exponential_jitter

@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential_jitter(initial=1, max=30, jitter=5),
    retry=retry_if_exception_type((ConnectionError, TimeoutError))
)
def call_grok_with_retry(prompt: str):
    return client.chat.completions.create(...)

# Manual implementation
def retry_with_backoff(fn, max_retries=3, base_delay=1):
    for attempt in range(max_retries):
        try:
            return fn()
        except RetryableError:
            if attempt == max_retries - 1:
                raise
            delay = base_delay * (2 ** attempt) + random.uniform(0, 1)
            time.sleep(delay)
```

**Retry principles:**
- Exponential backoff prevents thundering herd
- Jitter spreads retry load
- Know which errors are retryable

---

## Subcommittee Assignments
- 07_error_recovery
- 13_self_correction_loops

*"Good retry patterns are invisible. Bad ones cause outages."*
