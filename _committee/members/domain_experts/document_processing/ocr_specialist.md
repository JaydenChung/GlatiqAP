# 🟢 OCR SPECIALIST
> Image-to-Text — When PDFs are scanned images

| ID | ROLE | CATEGORY |
|----|------|----------|
| DOC-002 | OCR Specialist | Document Processing |

## Expertise
Tesseract, pytesseract, image preprocessing, OCR accuracy.

## Key Pattern
```python
import pytesseract
from pdf2image import convert_from_path
from PIL import Image

def ocr_pdf(pdf_path: str) -> str:
    """OCR a scanned PDF."""
    images = convert_from_path(pdf_path)
    text_parts = []
    for img in images:
        # Preprocess for better OCR
        img = img.convert('L')  # Grayscale
        text = pytesseract.image_to_string(img)
        text_parts.append(text)
    return "\n".join(text_parts)

def needs_ocr(pdf_path: str) -> bool:
    """Check if PDF has extractable text."""
    text = extract_text_from_pdf(pdf_path)
    return len(text.strip()) < 50  # Probably scanned
```

**MVP:** Assume text PDFs. Add OCR if extraction fails.

## Subcommittees: 03_ingestion_pipeline
