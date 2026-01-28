# DECISIONS — 2026-01-28_VENDOR

## Decision 1: Vendor Compliance Section Data Source

**Status:** APPROVED & IMPLEMENTED  
**Vote:** Unanimous consensus  
**Sponsor:** FIN-005 (Compliance Advisor)  

### Decision
The Vendor Compliance section in the invoice detail view will display data **exclusively** from the vendor master database, not from AI extraction.

### Rationale
1. **Compliance Best Practice**: Payment-sensitive vendor information (remit-to address, contact details) must come from a verified, authoritative source — not from the invoice itself.
2. **Fraud Prevention**: Using vendor master data prevents payment fraud attacks where an attacker modifies invoice payment details.
3. **Audit Trail Clarity**: Clear separation between "what the invoice claimed" (Header Details) and "what we validated against" (Vendor Compliance).

### Implementation
| File | Change |
|------|--------|
| `src/agents/validation.py` | Added `vendor_profile` to validation result |
| `api/streaming_workflow.py` | Pass `vendor_profile` in workflow response |
| `frontend/src/pages/InboxPage.jsx` | Store `vendorProfile` in invoice state |
| `frontend/src/pages/DetailPage.jsx` | Vendor Compliance tab reads from `vendorProfile` |

### UI Changes
- Removed "AI Extracted Fields" badge from Vendor Compliance section
- Added "Vendor on Record: VND-XXX" badge when vendor is matched
- Added "Vendor Not in System" warning when no match found
- Fields show blank (null) when vendor not found (per Human Director guidance)
- Existing vendor risk alerts (suspended, high risk, incomplete compliance) remain unchanged

### Data Source by Tab
| Tab | Source |
|-----|--------|
| Header Details (Bill From) | AI Extracted |
| Vendor Compliance | **Vendor Master** |
| Line Items | AI Extracted |
| Documents | N/A |

