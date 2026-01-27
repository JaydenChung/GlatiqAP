# 🟢 PDF EXTRACTION EXPERT
> PDF Parsing — Extracting text from PDFs

| ID | ROLE | CATEGORY |
|----|------|----------|
| DOC-001 | PDF Extraction Expert | Document Processing |

## Expertise
PyMuPDF, pdfplumber, text extraction, layout analysis.

## Key Pattern
```python
import pdfplumber

def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract all text from PDF."""
    text_parts = []
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            text = page.extract_text()
            if text:
                text_parts.append(text)
    return "\n".join(text_parts)

# Alternative with PyMuPDF (fitz)
import fitz

def extract_with_pymupdf(pdf_path: str) -> str:
    doc = fitz.open(pdf_path)
    text = ""
    for page in doc:
        text += page.get_text()
    return text
```

**Choice:** pdfplumber for tables, PyMuPDF for speed.

## Subcommittees: 03_ingestion_pipeline
