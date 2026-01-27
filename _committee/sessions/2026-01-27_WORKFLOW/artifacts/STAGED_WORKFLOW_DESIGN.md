# 🔧 STAGED WORKFLOW DESIGN

## Overview

This document defines the new staged workflow architecture based on Committee Decision 001.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INVOICE LIFECYCLE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐                                                            │
│  │   UPLOAD    │  User uploads invoice (PDF/text)                           │
│  └──────┬──────┘                                                            │
│         │                                                                   │
│         ▼                                                                   │
│  ╔═══════════════════════════════════════════════════╗                     │
│  ║           WORKFLOW 1: INGESTION                   ║                     │
│  ║  ┌────────────┐       ┌──────────────┐            ║                     │
│  ║  │ Ingestion  │ ────▶ │  Validation  │            ║                     │
│  ║  │   Agent    │       │    Agent     │            ║                     │
│  ║  └────────────┘       └──────────────┘            ║                     │
│  ╚═══════════════════════════════════════════════════╝                     │
│         │                                                                   │
│         ├─────────────────────────────┐                                    │
│         ▼                             ▼                                    │
│  ┌─────────────┐              ┌─────────────┐                              │
│  │   INBOX     │              │  REJECTED   │ (validation failed)          │
│  │   (Tab 1)   │              └─────────────┘                              │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│         │ ◄── USER ACTION: "Route to Approval"                             │
│         ▼                                                                   │
│  ╔═══════════════════════════════════════════════════╗                     │
│  ║           WORKFLOW 2: APPROVAL                    ║                     │
│  ║  ┌────────────┐                                   ║                     │
│  ║  │  Approval  │  Analyzes risk, generates         ║                     │
│  ║  │   Agent    │  recommendation for human         ║                     │
│  ║  └────────────┘                                   ║                     │
│  ╚═══════════════════════════════════════════════════╝                     │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐                                                           │
│  │  APPROVALS  │  VP reviews AI analysis                                   │
│  │   (Tab 2)   │                                                           │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│         │ ◄── USER ACTION: "Approve" or "Reject"                           │
│         │                                                                   │
│         ├─────────────────────────────┐                                    │
│         ▼                             ▼                                    │
│  ┌─────────────┐              ┌─────────────┐                              │
│  │  APPROVED   │              │  REJECTED   │                              │
│  └──────┬──────┘              └─────────────┘                              │
│         │                                                                   │
│         │ ◄── USER ACTION: "Schedule Payment"                              │
│         ▼                                                                   │
│  ┌─────────────┐                                                           │
│  │    PAY      │  Ready for payment                                        │
│  │   (Tab 3)   │                                                           │
│  └──────┬──────┘                                                           │
│         │                                                                   │
│         │ ◄── USER ACTION: "Execute Payment"                               │
│         ▼                                                                   │
│  ╔═══════════════════════════════════════════════════╗                     │
│  ║           WORKFLOW 3: PAYMENT                     ║                     │
│  ║  ┌────────────┐                                   ║                     │
│  ║  │  Payment   │  Calls payment API                ║                     │
│  ║  │   Agent    │                                   ║                     │
│  ║  └────────────┘                                   ║                     │
│  ╚═══════════════════════════════════════════════════╝                     │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────┐                                                           │
│  │    PAID     │  Transaction complete                                     │
│  └─────────────┘                                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Invoice Status Values

```python
from enum import Enum

class InvoiceStatus(str, Enum):
    # Initial states
    UPLOADED = "uploaded"
    INGESTING = "ingesting"
    VALIDATING = "validating"
    
    # After Workflow 1
    INBOX = "inbox"                    # Valid, ready for routing
    VALIDATION_FAILED = "validation_failed"  # Invalid, needs manual review
    
    # After routing
    PENDING_APPROVAL = "pending_approval"  # In approver's queue
    
    # After approval decision
    APPROVED = "approved"              # Approved, ready for payment
    REJECTED = "rejected"              # Rejected by approver
    
    # Payment states
    READY_TO_PAY = "ready_to_pay"      # Scheduled for payment
    PAYING = "paying"                  # Payment in progress
    PAID = "paid"                      # Payment complete
    PAYMENT_FAILED = "payment_failed"  # Payment failed
```

---

## API Endpoints

### Upload & Ingestion (Workflow 1)

```
POST /api/invoices/upload
Content-Type: multipart/form-data or application/json

Request (text):
{
  "raw_text": "Vendor: Widgets Inc. Amount: 5000..."
}

Request (file):
FormData with "file" field

Response:
{
  "invoice_id": "inv_abc123",
  "status": "inbox",  // or "validation_failed"
  "invoice_data": {
    "vendor": "Widgets Inc.",
    "amount": 5000.00,
    "items": [...],
    "due_date": "2026-02-01"
  },
  "validation_result": {
    "is_valid": true,
    "errors": [],
    "warnings": []
  },
  "workflow_state": { ... }  // LangGraph state for display
}
```

### Route to Approval (Workflow 2)

```
POST /api/invoices/{invoice_id}/route-to-approval

Response:
{
  "invoice_id": "inv_abc123",
  "status": "pending_approval",
  "ai_analysis": {
    "risk_score": 0.2,
    "recommendation": "approve",
    "reasoning": "Trusted vendor with good payment history...",
    "red_flags": [],
    "factors": {
      "vendor_trust": "high",
      "amount_reasonability": "normal",
      "inventory_availability": "sufficient"
    }
  },
  "workflow_state": { ... }
}
```

### Approve/Reject (Human Decision)

```
POST /api/invoices/{invoice_id}/approve
{
  "approver": "vp@company.com",
  "notes": "Optional approval notes"
}

Response:
{
  "invoice_id": "inv_abc123",
  "status": "approved",
  "approved_by": "vp@company.com",
  "approved_at": "2026-01-27T14:30:00Z"
}
```

```
POST /api/invoices/{invoice_id}/reject
{
  "rejector": "vp@company.com",
  "reason": "Amount exceeds budget allocation"
}

Response:
{
  "invoice_id": "inv_abc123",
  "status": "rejected",
  "rejected_by": "vp@company.com",
  "rejected_at": "2026-01-27T14:30:00Z",
  "rejection_reason": "Amount exceeds budget allocation"
}
```

### Schedule Payment

```
POST /api/invoices/{invoice_id}/schedule-payment

Response:
{
  "invoice_id": "inv_abc123",
  "status": "ready_to_pay"
}
```

### Execute Payment (Workflow 3)

```
POST /api/invoices/{invoice_id}/execute-payment

Response:
{
  "invoice_id": "inv_abc123",
  "status": "paid",
  "payment_result": {
    "success": true,
    "transaction_id": "txn_xyz789",
    "amount": 5000.00,
    "paid_at": "2026-01-27T15:00:00Z"
  },
  "workflow_state": { ... }
}
```

---

## Agent Responsibilities (Revised)

### Ingestion Agent
**Trigger:** Invoice upload
**Input:** Raw invoice text or PDF
**Output:** Structured invoice data
**Does:**
- Parse raw text/PDF
- Extract vendor, amount, items, due date
- Handle messy/ambiguous formats
- Self-correct on parse failures

### Validation Agent  
**Trigger:** After successful ingestion
**Input:** Parsed invoice data
**Output:** Validation result
**Does:**
- Check vendor exists (or flag as new)
- Verify items against inventory
- Check quantity availability
- Flag suspicious amounts
- Identify potential fraud signals

### Approval Agent
**Trigger:** User routes to approval
**Input:** Invoice data + validation result
**Output:** AI analysis for human reviewer
**Does:**
- Calculate risk score
- Generate approval recommendation
- Provide reasoning (pros/cons)
- Identify red flags
- Compare to similar past invoices
- Analyze vendor history
- **Does NOT make final decision**

### Payment Agent
**Trigger:** User executes payment (after human approval)
**Input:** Approved invoice
**Output:** Payment result
**Does:**
- Call payment API
- Handle payment failures with retry
- Record transaction details

---

## Implementation Changes Required

### 1. workflow.py Changes

```python
# BEFORE: Single workflow function
def process_invoice(raw_invoice: str) -> WorkflowState:
    """Runs all 4 agents in sequence"""
    ...

# AFTER: Three workflow functions
def run_ingestion_workflow(raw_invoice: str) -> dict:
    """
    Workflow 1: Ingestion + Validation
    Returns invoice data and validation result
    Sets status to 'inbox' or 'validation_failed'
    """
    ...

def run_approval_workflow(invoice_id: str) -> dict:
    """
    Workflow 2: Approval analysis
    Returns AI analysis for human reviewer
    Sets status to 'pending_approval'
    """
    ...

def run_payment_workflow(invoice_id: str) -> dict:
    """
    Workflow 3: Payment execution
    Returns payment result
    Sets status to 'paid' or 'payment_failed'
    """
    ...
```

### 2. approval_agent.py Changes

```python
# BEFORE: Makes decision
def approval_agent(state):
    # Returns approval_decision with approved: true/false
    
# AFTER: Provides analysis
def approval_agent(state):
    # Returns ai_analysis with:
    # - risk_score
    # - recommendation (suggestion, not decision)
    # - reasoning
    # - red_flags
    # - factors breakdown
```

### 3. schemas/models.py Changes

```python
# Add new fields to WorkflowState
class WorkflowState(TypedDict):
    ...
    # Existing fields
    
    # New fields
    status: str  # InvoiceStatus value
    ai_analysis: Optional[dict]  # Approval agent output
    approved_by: Optional[str]
    approved_at: Optional[str]
    rejected_by: Optional[str]
    rejected_at: Optional[str]
    rejection_reason: Optional[str]
```

### 4. API Changes (server.py / streaming_workflow.py)

Add new endpoints for:
- `POST /invoices/{id}/route-to-approval`
- `POST /invoices/{id}/approve`
- `POST /invoices/{id}/reject`
- `POST /invoices/{id}/schedule-payment`
- `POST /invoices/{id}/execute-payment`

---

## Demo Flow

1. **Upload Invoice 1** (clean) → Watch Ingestion + Validation in real-time → Appears in Inbox
2. **Click "Route to Approval"** → Watch Approval Agent analyze → Appears in Approvals with AI recommendation
3. **Click "Approve"** → Invoice moves to Pay tab
4. **Click "Execute Payment"** → Watch Payment Agent → Invoice marked Paid

Repeat for Invoice 2 (messy) and Invoice 3 (fraud - should be rejected at validation or approval).

This demonstrates:
- Multi-agent coordination
- Human-in-the-loop decisions
- Agent reasoning visible at each stage
- Real AP workflow

