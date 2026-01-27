# 🟢 UNSTRUCTURED WRANGLER
> Messy Data Handling — Taming chaotic inputs

| ID | ROLE | CATEGORY |
|----|------|----------|
| DOC-003 | Unstructured Wrangler | Document Processing |

## Expertise
Text normalization, pattern extraction, fuzzy matching.

## Key Pattern
```python
import re

def normalize_text(text: str) -> str:
    """Clean up messy extracted text."""
    # Fix common OCR/extraction issues
    text = re.sub(r'\s+', ' ', text)  # Multiple spaces
    text = re.sub(r'(\d),(\d{3})', r'\1\2', text)  # Fix "1,000" 
    text = text.replace('|', 'l').replace('0', 'O')  # Common OCR errors
    return text.strip()

def extract_amount(text: str) -> float | None:
    """Find dollar amount in messy text."""
    patterns = [
        r'\$[\d,]+\.?\d*',       # $1,234.56
        r'Amount:?\s*[\d,]+\.?\d*',  # Amount: 1234
        r'Total:?\s*[\d,]+\.?\d*',
    ]
    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return float(re.sub(r'[^\d.]', '', match.group()))
    return None
```

**Wrangling principle:** Multiple patterns, graceful fallbacks.

## Subcommittees: 03_ingestion_pipeline, 15_testing_quality
