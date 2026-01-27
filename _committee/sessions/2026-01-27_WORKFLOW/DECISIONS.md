# 🗳️ SESSION DECISIONS

## Session: 2026-01-27_WORKFLOW

---

## Decisions Log

| # | Decision | Rationale | Vote | Time |
|---|----------|-----------|------|------|
| 001 | Restructure to staged human-in-the-loop workflow | Matches real AP processes per Human Director domain expertise | 6-0 | 12:45 |
| 002 | Use three separate workflow functions (not LangGraph checkpoints) | Simpler, testable, matches UI actions | 6-0 | 12:45 |

---

## Decision 001: Staged Human-in-the-Loop Workflow

**Summary:** Redesign from single automated pipeline to three staged workflows with human actions between stages.

**The New Model:**
```
STAGE 1: UPLOAD (Automatic)
  Invoice uploaded → Ingestion Agent → Validation Agent → Inbox
  
STAGE 2: ROUTE TO APPROVAL (Human-triggered)
  User routes invoice → Approval Agent analyzes → Approvals queue
  
STAGE 3: PAYMENT (Human-triggered after approval)
  User approves → Payment Agent executes → Paid
```

**Key Changes:**
- Approval Agent no longer makes approve/reject decisions
- Approval Agent provides risk analysis, recommendation, reasoning
- Human (VP) makes final approval decision
- Each stage maps to a UI tab (Inbox → Approvals → Pay)

**Accepted Caveat:**
Approval Agent must provide genuine analytical value (vendor history, anomaly detection, contextual reasoning) — not just re-state validation results.

---

## Decision 002: Three Separate Workflow Functions

**Summary:** Implement as three independent functions rather than using LangGraph interrupt/checkpoint features.

**Functions:**
```python
def run_ingestion_workflow(invoice_id, raw_text) -> sets status to "inbox"
def run_approval_workflow(invoice_id) -> sets status to "pending_approval"  
def run_payment_workflow(invoice_id) -> sets status to "paid"
```

**Rationale:**
- Simpler mental model
- Each workflow independently testable
- Faster to implement
- Matches the UI's discrete user actions

---

## Decision 003: Smart Triage with Auto-Approve

**Summary:** Approval Agent performs intelligent routing based on business rules.

**The Business Rules:**
```
IF amount < $10,000 AND no red flags AND validation passed:
    → AUTO-APPROVE (skip human, go straight to payment)
    
IF amount >= $10,000 OR any flags:
    → ROUTE TO HUMAN (VP/manager must approve)
    
IF major red flags (fraud indicators) OR validation failed:
    → AUTO-REJECT
```

**Rationale (per Human Director):**
This is how real AP workflows operate. The agent handles easy cases automatically, only escalating complex decisions to humans. This saves time while maintaining appropriate controls.

---

## Implementation Status

✅ **IMPLEMENTED** — All decisions have been coded:

1. `src/schemas/models.py` — Added InvoiceStatus enum, APPROVAL_THRESHOLDS
2. `src/workflow.py` — Added staged workflow functions
3. `src/agents/approval.py` — Updated with smart triage logic
4. `api/server.py` — Added stage transition endpoints
5. `api/streaming_workflow.py` — Updated for staged execution

