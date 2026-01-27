# 🟢 PARSING RESILIENCE EXPERT
> Graceful Failure — When parsing goes wrong

| ID | ROLE | CATEGORY |
|----|------|----------|
| DOC-004 | Parsing Resilience Expert | Document Processing |

## Expertise
Partial parsing, error recovery, fallback strategies, confidence scoring.

## Key Pattern
```python
def resilient_extract(pdf_path: str) -> tuple[dict, float]:
    """Extract with confidence score."""
    try:
        text = extract_text_from_pdf(pdf_path)
        confidence = 1.0
    except Exception:
        try:
            text = ocr_pdf(pdf_path)
            confidence = 0.7  # OCR less reliable
        except Exception:
            return {}, 0.0
    
    result = {}
    for field, extractor in EXTRACTORS.items():
        try:
            value = extractor(text)
            if value:
                result[field] = value
        except Exception:
            continue  # Skip failed fields
    
    # Confidence based on completeness
    completeness = len(result) / len(EXTRACTORS)
    return result, confidence * completeness
```

**Resilience:** Partial success > total failure.

## Subcommittees: 03_ingestion_pipeline, 07_error_recovery
