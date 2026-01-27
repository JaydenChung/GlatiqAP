# 🏗️ ARCHITECTURE SPECIFICATION

> Multi-Agent Invoice Processing System
> Approved: 2026-01-26 | Session: BLUEPRINT

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           INVOICE PROCESSING PIPELINE                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│                              ┌─────────────┐                                        │
│                              │   START     │                                        │
│                              └──────┬──────┘                                        │
│                                     │                                               │
│                                     ▼                                               │
│                         ┌───────────────────────┐                                   │
│                         │   INGESTION AGENT     │                                   │
│                         │   ─────────────────   │                                   │
│                         │   • Parse invoice     │                                   │
│                         │   • Extract fields    │                                   │
│                         │   • Normalize data    │                                   │
│                         │   [Uses: Grok JSON]   │                                   │
│                         └───────────┬───────────┘                                   │
│                                     │                                               │
│                                     ▼                                               │
│                         ┌───────────────────────┐                                   │
│                         │  VALIDATION AGENT     │                                   │
│                         │  ────────────────     │                                   │
│                         │  • Query inventory    │                                   │
│                         │  • Check amounts      │                                   │
│                         │  • Flag anomalies     │                                   │
│                         │  [Uses: SQLite+Grok]  │                                   │
│                         └───────────┬───────────┘                                   │
│                                     │                                               │
│                          ┌──────────┴──────────┐                                    │
│                          │                     │                                    │
│                     [INVALID]              [VALID]                                  │
│                          │                     │                                    │
│                          ▼                     ▼                                    │
│                    ┌──────────┐    ┌───────────────────────┐                        │
│                    │   END    │    │   APPROVAL AGENT      │                        │
│                    │ REJECTED │    │   ───────────────     │                        │
│                    └──────────┘    │   • Reason about $    │                        │
│                                    │   • Check fraud       │                        │
│                                    │   • Explain decision  │                        │
│                                    │   [Uses: Grok Chain]  │                        │
│                                    └───────────┬───────────┘                        │
│                                                │                                    │
│                                     ┌──────────┴──────────┐                         │
│                                     │                     │                         │
│                                [REJECTED]            [APPROVED]                     │
│                                     │                     │                         │
│                                     ▼                     ▼                         │
│                               ┌──────────┐    ┌───────────────────────┐             │
│                               │   END    │    │   PAYMENT AGENT       │             │
│                               │ REJECTED │    │   ──────────────      │             │
│                               └──────────┘    │   • Execute payment   │             │
│                                               │   • Confirm success   │             │
│                                               │   [Uses: Mock API]    │             │
│                                               └───────────┬───────────┘             │
│                                                           │                         │
│                                                           ▼                         │
│                                                     ┌──────────┐                    │
│                                                     │   END    │                    │
│                                                     │ COMPLETE │                    │
│                                                     └──────────┘                    │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Agent Specifications

### Agent 1: INGESTION AGENT

| Attribute | Value |
|-----------|-------|
| **Purpose** | Parse raw invoice text into structured data |
| **Input** | `raw_invoice: str` |
| **Output** | `invoice_data: InvoiceData` |
| **LLM Usage** | Grok with JSON mode |
| **Tools** | None |

**Grok Prompt Strategy:**
- System prompt defines exact JSON schema
- Request JSON-only output
- Handle messy/abbreviated input

**Error Handling:**
- Retry on JSON parse failure (max 3)
- Fallback to partial extraction

---

### Agent 2: VALIDATION AGENT

| Attribute | Value |
|-----------|-------|
| **Purpose** | Validate invoice against inventory database |
| **Input** | `invoice_data: InvoiceData` |
| **Output** | `validation_result: ValidationResult` |
| **LLM Usage** | Grok for analysis (after DB query) |
| **Tools** | SQLite query (direct, not tool calling) |

**Validation Rules:**
1. All items must exist in inventory
2. Requested quantities must be available
3. Amount should match item totals
4. Due date should be future

**Decision:** Direct SQLite query (not Grok tool calling) for v1.

---

### Agent 3: APPROVAL AGENT

| Attribute | Value |
|-----------|-------|
| **Purpose** | Make approval decision with reasoning |
| **Input** | `invoice_data` + `validation_result` |
| **Output** | `approval_decision: ApprovalDecision` |
| **LLM Usage** | Grok with chain-of-thought |
| **Tools** | None |

**Approval Logic:**
1. Validation must pass
2. Amount threshold checks (>$10K = flag, >$50K = reject)
3. Vendor reputation (unknown = higher risk)
4. Fraud indicator detection

**Fraud Indicators (Auto-Reject):**
- Vendor name contains suspicious terms
- Items not in stock
- Past due dates
- Extremely high amounts

---

### Agent 4: PAYMENT AGENT

| Attribute | Value |
|-----------|-------|
| **Purpose** | Execute payment for approved invoices |
| **Input** | `invoice_data` + `approval_decision` |
| **Output** | `payment_result: PaymentResult` |
| **LLM Usage** | None |
| **Tools** | Mock payment API |

**Behavior:**
- Only executes if `approved == true`
- Returns transaction ID on success
- Always succeeds in demo (mock)

---

## State Schema

```python
class WorkflowState(TypedDict):
    # Input
    raw_invoice: str
    
    # Agent Outputs (accumulated through pipeline)
    invoice_data: Optional[InvoiceData]
    validation_result: Optional[ValidationResult]
    approval_decision: Optional[ApprovalDecision]
    payment_result: Optional[PaymentResult]
    
    # Control Flow
    current_agent: str
    status: Literal["processing", "completed", "failed", "rejected"]
    error: Optional[str]
    
    # Self-Correction (enhancement)
    retry_count: int
    feedback: Optional[str]
```

---

## LangGraph Configuration

```python
from langgraph.graph import StateGraph, END

workflow = StateGraph(WorkflowState)

# Nodes
workflow.add_node("ingestion", ingestion_agent)
workflow.add_node("validation", validation_agent)
workflow.add_node("approval", approval_agent)
workflow.add_node("payment", payment_agent)

# Entry
workflow.set_entry_point("ingestion")

# Edges
workflow.add_edge("ingestion", "validation")

workflow.add_conditional_edges(
    "validation",
    lambda s: "continue" if s["validation_result"]["is_valid"] else "reject",
    {"continue": "approval", "reject": END}
)

workflow.add_conditional_edges(
    "approval",
    lambda s: "approved" if s["approval_decision"]["approved"] else "rejected",
    {"approved": "payment", "rejected": END}
)

workflow.add_edge("payment", END)
```

---

## Technology Stack

| Component | Technology | Version |
|-----------|------------|---------|
| Language | Python | 3.10+ |
| LLM | xAI Grok | grok-beta |
| LLM Client | OpenAI SDK | 1.0+ |
| Orchestration | LangGraph | latest |
| Database | SQLite | built-in |
| Validation | TypedDict | built-in |

---

## Grok API Configuration

```python
from openai import OpenAI

client = OpenAI(
    api_key=os.environ["XAI_API_KEY"],
    base_url="https://api.x.ai/v1"
)

MODEL = "grok-beta"

# JSON mode for structured output
response = client.chat.completions.create(
    model=MODEL,
    messages=[...],
    response_format={"type": "json_object"}
)
```

---

## File Structure

```
invoice-processor/
├── src/
│   ├── __init__.py
│   ├── client.py           # Grok API client
│   ├── workflow.py         # LangGraph workflow
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── ingestion.py    # Agent 1
│   │   ├── validation.py   # Agent 2
│   │   ├── approval.py     # Agent 3
│   │   └── payment.py      # Agent 4
│   ├── tools/
│   │   └── database.py     # SQLite utilities
│   └── schemas/
│       └── models.py       # TypedDict definitions
├── data/
│   ├── invoices/           # Test invoice files
│   └── inventory.db        # SQLite database
├── main.py                 # Demo entry point
├── requirements.txt
├── .env
└── README.md
```

---

*Architecture approved by Galatiq Committee Session 2026-01-26_BLUEPRINT*
