# 🟢 IMPORT RESOLUTION EXPERT
> Dependency Management — Managing what we depend on

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-005 | Import Resolution Expert | Python Engineering |

## Expertise
Import patterns, dependency injection, lazy loading, path management.

## Key Pattern
```python
# Dependency injection for testability
class InvoiceProcessor:
    def __init__(self, grok_client=None, db=None):
        self.grok = grok_client or get_default_grok_client()
        self.db = db or get_default_db()

# In tests:
processor = InvoiceProcessor(
    grok_client=MockGrokClient(),
    db=MockDatabase()
)

# Lazy loading for optional heavy dependencies
_pdf_parser = None
def get_pdf_parser():
    global _pdf_parser
    if _pdf_parser is None:
        import pdfplumber
        _pdf_parser = pdfplumber
    return _pdf_parser
```

**DI principle:** Depend on abstractions, inject implementations.

## Subcommittees: 17_code_architecture
