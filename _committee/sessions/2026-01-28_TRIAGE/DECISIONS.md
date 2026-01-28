# DECISIONS — 2026-01-28_TRIAGE

## Decision 1: CRITICAL Error Detection

**Status:** ✅ APPROVED AND IMPLEMENTED

**Decision:**
Add CRITICAL error detection to the Approval Agent that triggers immediate auto-rejection regardless of invoice dollar amount.

**CRITICAL Error Patterns (Hard Blocks):**

| Pattern | Detection | Threshold |
|---------|-----------|-----------|
| **SUSPENDED VENDOR** | `vendor_status == "suspended"` or error contains "SUSPENDED" | Any |
| **MASSIVE VARIANCE** | `variance <= -100` | Requesting 100+ more than available |

**Implementation:**
- New function: `detect_critical_flags(validation_result, invoice_data)`
- Returns list of CRITICAL flag descriptions
- Called at start of approval agent decision logic
- CRITICAL flags → immediate `auto_reject`, bypasses all dollar-amount logic

**Five-Flow Decision Logic (Updated):**
1. **CRITICAL errors** → AUTO-REJECT (regardless of amount) ← NEW
2. Validation FAILED + LOW value → AUTO-REJECT
3. Validation FAILED + HIGH value → ROUTE TO HUMAN
4. Validation PASSED + HIGH value → ROUTE TO HUMAN
5. Validation PASSED + LOW value → AUTO-APPROVE

**Rationale:**
- Suspended vendors are explicitly blocked in our system — not an edge case
- 100+ unit variance indicates fraud or major data error — not recoverable by human review
- These are disqualifiers, not judgment calls

**Proposed By:** FIN-002 (Fraud Detection Analyst), ERR-006 (Exception Taxonomist)
**Challenged By:** SKEP-005 (Edge Case Hunter)
**Approved By:** Human Director

---

## Decision 2: Threshold Configuration

**Status:** ✅ APPROVED

**Decision:**
Set CRITICAL variance threshold at `-100` (requesting 100+ more than available stock).

**Rationale:**
- User's test case had 100+ variance
- Conservative threshold — 100 unit shortage is clearly catastrophic
- Minor shortages (e.g., -15) still route to human for judgment

**Configuration:**
```python
CRITICAL_VARIANCE_THRESHOLD = -100  # in approval.py
```

---

*Decisions recorded by CLERK-003 (Scribe Decisions)*

