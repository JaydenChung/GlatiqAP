# SESSION MANIFEST — 2026-01-28_VENDOR

## Session Information
- **Session ID:** 2026-01-28_VENDOR
- **Status:** OPEN
- **Opened:** 2026-01-28T16:00:00Z
- **Chair:** Archon Prime (CHAIR-001)

## Goal
Design and implement the change to populate the Vendor Compliance section from vendor master database records rather than AI-extracted data.

## Context
The Human Director identified that the Vendor Compliance section currently displays vendor information (name, email, phone, address) from AI extraction. This should be changed to display authoritative vendor master data for compliance and security reasons.

### Scope
| Section | Current Source | Target Source |
|---------|---------------|---------------|
| Header Details (Bill From) | AI Extracted | AI Extracted (no change) |
| Header Details (other fields) | AI Extracted | AI Extracted (no change) |
| Vendor Compliance - Vendor Info | AI Extracted | **VENDOR MASTER** |
| Vendor Compliance - Remit-to | AI Extracted | **VENDOR MASTER** |
| Line Items | AI Extracted | AI Extracted (no change) |

## Activated Members
- **CHAIR-001** Archon Prime — Session orchestration
- **DATA-002** Schema Designer — Vendor data structure
- **FIN-005** Compliance Advisor — Regulatory/compliance perspective
- **SKEP-013** Security Paranoiac — Security implications
- **HUM-001** UX Advocate — User experience of the change
- **PRAG-001** The Implementer — Practical implementation path
- **PY-001** Python Architect — Backend code changes

## Key Questions
1. Should vendor compliance data ONLY show vendor master data, or show both with comparison?
2. What happens when AI-extracted vendor doesn't match any vendor master record?
3. How do we indicate the data source to the user in the UI?

