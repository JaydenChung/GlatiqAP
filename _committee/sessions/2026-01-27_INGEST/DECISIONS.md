# 📋 DECISIONS LOG

## Session: 2026-01-27_INGEST

---

## DECISION #001: Adopt pdfplumber for PDF Text Extraction

**Timestamp:** 2026-01-27T14:15:00Z  
**Vote:** Approved by Human Director directive  
**Participants:** DOC-001, DOC-003, DOC-004, PRAG-001, PRAG-003, SKEP-001, SKEP-004, SKEP-005

### Question
Which library should be used for PDF text extraction in the Ingestion Agent?

### Options Considered
1. **pdfplumber** — Better table extraction, layout awareness
2. **PyMuPDF (fitz)** — Faster, but less table support
3. **Both** — pdfplumber for text, PyMuPDF for form fields
4. **Neither** — Stay with text-only input

### Decision
**pdfplumber** selected as the MVP solution.

### Rationale
- Invoices contain tables (line items, totals)
- pdfplumber's `extract_tables()` is purpose-built for this
- Provides word bounding boxes for provenance tracking
- Single dependency vs. dual-library complexity
- PyMuPDF form field support deferred to future iteration

### Dissent
- SKEP-004 (Complexity Critic) argued for even simpler approach
- SKEP-005 (Edge Case Hunter) noted fillable form fields won't work

---

## DECISION #002: Adopt MVP Scope (Defer Advanced Features)

**Timestamp:** 2026-01-27T14:20:00Z  
**Vote:** Approved by Human Director directive  
**Participants:** PRAG-003, SKEP-001, SKEP-004, SKEP-005

### Question
What features should be included in the PDF parsing MVP?

### In Scope (MVP)
| Feature | Status |
|---------|--------|
| Text extraction from digital PDFs | ✅ Implemented |
| Multi-page support | ✅ Implemented |
| File size limit (10MB) | ✅ Implemented |
| Scanned PDF detection | ✅ Implemented |
| Clear error messages | ✅ Implemented |
| API endpoint for PDF upload | ✅ Implemented |

### Out of Scope (Deferred)
| Feature | Reason |
|---------|--------|
| OCR for scanned PDFs | Requires external service (Tesseract) |
| Fillable form fields | Requires PyMuPDF, adds complexity |
| Rotation correction | Rare case, complex |
| Table-to-JSON extraction | Grok handles messy text |
| Password-protected PDFs | Manual workaround exists |

### Rationale
MVP should deliver PDF support quickly. Advanced features can be added based on real user feedback.

---

## DECISION #003: Integration Pattern — Preprocessing Layer

**Timestamp:** 2026-01-27T14:25:00Z  
**Vote:** Consensus  
**Participants:** PRAG-001, DOC-001, SKEP-004

### Question
How should PDF extraction integrate with the existing Ingestion Agent?

### Pattern Adopted
**Preprocessing Layer** — PDF extraction happens before Grok extraction.

```
Input (PDF path OR text)
         │
         ▼
    _extract_from_pdf_if_needed()
         │
         ▼
    Raw text (from PDF or original)
         │
         ▼
    Existing Grok extraction pipeline (unchanged)
         │
         ▼
    InvoiceData with source provenance
```

### Rationale
- Backward compatible — text input still works
- Minimal changes to existing agent logic
- Single responsibility — PDF extraction is isolated
- Existing self-correction loop still works

---

*Decisions recorded by CLERK-003 (Scribe Decisions)*

