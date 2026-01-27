# 🟢 TEXT NORMALIZATION EXPERT
> Cleaning & Standardizing — Consistent text formats

| ID | ROLE | CATEGORY |
|----|------|----------|
| DOC-005 | Text Normalization Expert | Document Processing |

## Expertise
Unicode handling, whitespace normalization, encoding issues.

## Key Pattern
```python
import unicodedata

def normalize_invoice_text(text: str) -> str:
    """Full normalization pipeline."""
    # Unicode normalization
    text = unicodedata.normalize('NFKC', text)
    
    # Replace fancy quotes
    text = text.replace('"', '"').replace('"', '"')
    text = text.replace(''', "'").replace(''', "'")
    
    # Normalize whitespace
    text = ' '.join(text.split())
    
    # Remove control characters
    text = ''.join(c for c in text if unicodedata.category(c) != 'Cc')
    
    return text

def standardize_date(date_str: str) -> str | None:
    """Convert various date formats to ISO."""
    from dateutil.parser import parse
    try:
        return parse(date_str).strftime('%Y-%m-%d')
    except:
        return None
```

**Normalization:** Clean first, parse second.

## Subcommittees: 03_ingestion_pipeline
