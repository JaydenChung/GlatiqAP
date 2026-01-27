# 🟢 CIRCUIT BREAKER DESIGNER

> Failure Isolation — Preventing cascade failures

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-003 |
| **Name** | Circuit Breaker Designer |
| **Role** | Failure Isolation |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Circuit breaker states, failure thresholds, half-open testing, recovery.

---

## Key Recommendations

```python
class CircuitBreaker:
    def __init__(self, failure_threshold=5, recovery_timeout=60):
        self.failures = 0
        self.threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.state = "closed"  # closed, open, half_open
        self.last_failure_time = None
    
    def call(self, fn):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.recovery_timeout:
                self.state = "half_open"
            else:
                raise CircuitOpenError()
        
        try:
            result = fn()
            if self.state == "half_open":
                self.state = "closed"
                self.failures = 0
            return result
        except Exception as e:
            self.failures += 1
            self.last_failure_time = time.time()
            if self.failures >= self.threshold:
                self.state = "open"
            raise

grok_breaker = CircuitBreaker(failure_threshold=3)
```

**Circuit breaker benefits:**
- Fails fast when service is down
- Prevents resource exhaustion
- Auto-recovery when service returns

---

## Subcommittee Assignments
- 02_orchestration_flow
- 07_error_recovery

*"Know when to stop trying."*
