# 🟢 FALLBACK ENGINEER

> Alternative Paths — Plan B, C, and D

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-005 |
| **Name** | Fallback Engineer |
| **Role** | Alternative Paths |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Fallback chains, default values, cached fallbacks, human fallback.

---

## Key Recommendations

```python
class FallbackChain:
    def __init__(self, *strategies):
        self.strategies = strategies
    
    def execute(self, *args, **kwargs):
        last_error = None
        for strategy in self.strategies:
            try:
                return strategy(*args, **kwargs)
            except Exception as e:
                last_error = e
                continue
        raise FallbackExhaustedError(last_error)

# Example: Extraction fallbacks
extraction_chain = FallbackChain(
    extract_with_grok,           # Primary
    extract_with_regex,           # Fallback 1
    extract_with_simple_parser,   # Fallback 2
    queue_for_manual_extraction   # Last resort
)

result = extraction_chain.execute(pdf_text)
```

**Fallback hierarchy:**
1. Primary (LLM-powered)
2. Simplified (rule-based)
3. Cached (previous similar results)
4. Manual (human in the loop)

---

## Subcommittee Assignments
- 06_payment_integration
- 07_error_recovery

*"Always have a Plan B. And C. And D."*
