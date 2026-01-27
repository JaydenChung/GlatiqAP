# 📋 SESSION MANIFEST

## Session: 2026-01-27_INGEST

**Status:** 🟢 OPEN  
**Started:** 2026-01-27T14:00:00Z  
**Chair:** CHAIR-001 Archon Prime

---

## Goal

Integrate PDF parsing capabilities into the Ingestion Agent. Move from processing raw text strings to extracting text from actual PDF invoice files using libraries like PyMuPDF or pdfplumber.

---

## Context

### Prior Session
- **2026-01-27_WORKFLOW** — Staged workflow implemented with Inbox → Approvals → Pay
- Next steps included "Add PDF parsing to ingestion agent"

### Current State
- Ingestion Agent extracts 15+ fields (invoice_number, dates, amounts, parties, line items, etc.)
- Self-correction loop already implemented (retry with enhanced hints)
- Observability: Users can see where AI got information from
- Input: Raw text strings
- Output: InvoiceData TypedDict

### Target State
- Input: PDF file path (or binary)
- Extract text from PDF using parsing library
- Handle unstructured/messy PDFs gracefully
- Feed extracted text to existing LLM extraction pipeline
- Maintain provenance tracking for PDF source locations

---

## Participants

### Active
| ID | Name | Role |
|----|------|------|
| CHAIR-001 | Archon Prime | Session Chair |
| DOC-001 | PDF Extraction Expert | Primary Expert |
| DOC-003 | Unstructured Wrangler | Messy Data Handling |
| DOC-004 | Parsing Resilience Expert | Failure Recovery |
| DOC-005 | Text Normalization Expert | Text Cleaning |
| PRAG-001 | The Implementer | Practical Building |
| PRAG-003 | MVP Advocate | Scope Control |
| SKEP-001 | Cassandra | Disaster Prediction |
| SKEP-004 | Complexity Critic | Over-Engineering Check |
| SKEP-005 | Edge Case Hunter | Corner Cases |

### On Call
| ID | Name | If Needed For |
|----|------|---------------|
| ERR-005 | Fallback Engineer | If PDF parsing fails |
| LLM-002 | Prompt Engineer | If prompts need adjustment |
| OBS-001 | Structured Logging Expert | If logging changes needed |

---

## Key Questions

1. **PyMuPDF vs pdfplumber** — Which library? Or both?
2. **Scanned PDFs (images)** — Do we need OCR? For MVP?
3. **Error handling** — What happens when PDF parsing fails?
4. **Page boundaries** — Multi-page invoices?
5. **Layout preservation** — Tables, columns, structured regions?
6. **File handling** — Paths vs binary vs upload?

---

*Session manifest created by CLERK-001*

