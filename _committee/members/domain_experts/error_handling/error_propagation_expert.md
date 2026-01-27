# 🟢 ERROR PROPAGATION EXPERT

> Error Flow Design — How errors move through the system

---

## Identity

| Attribute | Value |
|-----------|-------|
| **ID** | ERR-007 |
| **Name** | Error Propagation Expert |
| **Role** | Error Flow Design |
| **Category** | Domain Expert — Error Handling |

---

## Expertise

Error bubbling, error wrapping, context preservation, error boundaries.

---

## Key Recommendations

```python
class ContextualError(Exception):
    """Error with preserved context."""
    def __init__(self, message, cause=None, context=None):
        super().__init__(message)
        self.cause = cause
        self.context = context or {}
    
    def full_trace(self):
        msgs = [str(self)]
        if self.cause:
            msgs.append(f"Caused by: {self.cause}")
        return "\n".join(msgs)

def wrap_error(fn, context_provider):
    """Wrap function to add context to errors."""
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            raise ContextualError(
                f"Failed in {fn.__name__}",
                cause=e,
                context=context_provider(*args, **kwargs)
            ) from e
    return wrapper

# Usage
@wrap_error(lambda inv: {"invoice_id": inv.id})
def validate_invoice(invoice):
    ...  # Errors will include invoice_id
```

**Propagation principles:**
- Wrap, don't swallow
- Preserve original cause
- Add context at each layer

---

## Subcommittee Assignments
- 07_error_recovery

*"Errors should accumulate context as they rise."*
