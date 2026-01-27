# 🗺️ IMPLEMENTATION ROADMAP

> 10-Hour Build Plan for Multi-Agent Invoice Processing System
> Approved: 2026-01-26 | Session: BLUEPRINT

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                        10-HOUR IMPLEMENTATION TIMELINE                               │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                     │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░  PHASE 1: Foundation (2h)        │
│  ░░░░░░░░████████████████████░░░░░░░░░░░░░░░░░░░░  PHASE 2: Core Agents (4h)       │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░░░░░░░░░  PHASE 3: Enhancement (2h)       │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░████████░░░░  PHASE 4: Demo Prep (2h)         │
│                                                                                     │
│  Hour: 1   2   3   4   5   6   7   8   9   10                                       │
│        └───┴───┴───┴───┴───┴───┴───┴───┴───┘                                        │
│                     ▲           ▲       ▲                                            │
│              CHECKPOINT 1  CHECKPOINT 2  CHECKPOINT 3                               │
│              (Grok works)  (E2E works)   (Demo ready)                               │
│                                                                                     │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Foundation (Hours 1-2)

### Hour 1: Project Setup + Grok Connection

**Goal:** Verify Grok API works before building anything else.

```bash
# Project structure to create
invoice-processor/
├── src/
│   ├── __init__.py
│   ├── agents/
│   │   ├── __init__.py
│   │   ├── ingestion.py
│   │   ├── validation.py
│   │   ├── approval.py
│   │   └── payment.py
│   ├── tools/
│   │   ├── __init__.py
│   │   └── database.py
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── models.py
│   ├── workflow.py
│   └── client.py
├── data/
│   ├── invoices/
│   │   ├── invoice1.txt
│   │   ├── invoice2.txt
│   │   └── invoice3.txt
│   └── inventory.db
├── tests/
├── .env
├── requirements.txt
├── main.py
└── README.md
```

**Tasks:**
- [ ] Create directory structure
- [ ] Create `requirements.txt`:
  ```
  openai>=1.0.0
  langgraph>=0.0.1
  python-dotenv>=1.0.0
  ```
- [ ] Create `.env` with `XAI_API_KEY=your-key-here`
- [ ] Create `src/client.py`:
  ```python
  from openai import OpenAI
  import os
  from dotenv import load_dotenv
  
  load_dotenv()
  
  client = OpenAI(
      api_key=os.environ["XAI_API_KEY"],
      base_url="https://api.x.ai/v1"
  )
  
  MODEL = "grok-beta"
  
  def test_connection():
      response = client.chat.completions.create(
          model=MODEL,
          messages=[{"role": "user", "content": "Say 'Grok is ready' and nothing else."}]
      )
      print(response.choices[0].message.content)
      return True
  
  if __name__ == "__main__":
      test_connection()
  ```
- [ ] Run test: `python src/client.py`

**🚨 CHECKPOINT 1:** Grok must respond. If not, debug before proceeding.

---

### Hour 2: State Schema + LangGraph Skeleton

**Goal:** Empty workflow compiles and runs.

**Tasks:**
- [ ] Create `src/schemas/models.py`:
  ```python
  from typing import TypedDict, Optional, List, Literal
  
  class InvoiceItem(TypedDict):
      name: str
      quantity: int
      unit_price: float
  
  class InvoiceData(TypedDict):
      vendor: str
      amount: float
      items: List[InvoiceItem]
      due_date: Optional[str]
      raw_text: str
  
  class ValidationResult(TypedDict):
      is_valid: bool
      errors: List[str]
      warnings: List[str]
      inventory_check: dict
  
  class ApprovalDecision(TypedDict):
      approved: bool
      reason: str
      requires_review: bool
      risk_score: float
  
  class PaymentResult(TypedDict):
      success: bool
      transaction_id: Optional[str]
      error: Optional[str]
  
  class WorkflowState(TypedDict):
      raw_invoice: str
      invoice_data: Optional[InvoiceData]
      validation_result: Optional[ValidationResult]
      approval_decision: Optional[ApprovalDecision]
      payment_result: Optional[PaymentResult]
      current_agent: str
      status: Literal["processing", "completed", "failed", "rejected"]
      error: Optional[str]
  ```

- [ ] Create `src/workflow.py` skeleton:
  ```python
  from langgraph.graph import StateGraph, END
  from schemas.models import WorkflowState
  
  def ingestion_agent(state: WorkflowState) -> WorkflowState:
      print("📥 Ingestion Agent: Processing...")
      return {**state, "current_agent": "validation"}
  
  def validation_agent(state: WorkflowState) -> WorkflowState:
      print("✅ Validation Agent: Checking...")
      return {**state, "current_agent": "approval"}
  
  def approval_agent(state: WorkflowState) -> WorkflowState:
      print("🤔 Approval Agent: Deciding...")
      return {**state, "current_agent": "payment"}
  
  def payment_agent(state: WorkflowState) -> WorkflowState:
      print("💰 Payment Agent: Processing...")
      return {**state, "status": "completed"}
  
  def create_workflow():
      workflow = StateGraph(WorkflowState)
      
      workflow.add_node("ingestion", ingestion_agent)
      workflow.add_node("validation", validation_agent)
      workflow.add_node("approval", approval_agent)
      workflow.add_node("payment", payment_agent)
      
      workflow.set_entry_point("ingestion")
      workflow.add_edge("ingestion", "validation")
      workflow.add_edge("validation", "approval")
      workflow.add_edge("approval", "payment")
      workflow.add_edge("payment", END)
      
      return workflow.compile()
  
  if __name__ == "__main__":
      app = create_workflow()
      result = app.invoke({
          "raw_invoice": "Test invoice",
          "current_agent": "ingestion",
          "status": "processing"
      })
      print(f"Final status: {result['status']}")
  ```

- [ ] Set up SQLite with test data:
  ```python
  # src/tools/database.py
  import sqlite3
  
  def init_database():
      conn = sqlite3.connect("data/inventory.db")
      cursor = conn.cursor()
      cursor.execute("""
          CREATE TABLE IF NOT EXISTS inventory (
              item TEXT PRIMARY KEY,
              stock INTEGER
          )
      """)
      cursor.executemany(
          "INSERT OR REPLACE INTO inventory VALUES (?, ?)",
          [
              ("WidgetA", 15),
              ("WidgetB", 10),
              ("GadgetX", 5),
              ("FakeItem", 0),
          ]
      )
      conn.commit()
      conn.close()
  
  if __name__ == "__main__":
      init_database()
      print("Database initialized!")
  ```

- [ ] Create test invoice files in `data/invoices/`

**Deliverable:** `python src/workflow.py` prints all 4 agent messages.

---

## Phase 2: Core Agents (Hours 3-6)

### Hour 3: Ingestion Agent

**Goal:** Parse raw invoice text into structured data using Grok.

**Tasks:**
- [ ] Create `src/agents/ingestion.py`:
  ```python
  import json
  from client import client, MODEL
  from schemas.models import WorkflowState, InvoiceData
  
  INGESTION_PROMPT = """You are an invoice parsing agent. Extract structured data from invoices.

  Output ONLY valid JSON with this exact schema:
  {
    "vendor": "string - company name",
    "amount": number - total amount,
    "items": [{"name": "string", "quantity": number, "unit_price": number}],
    "due_date": "YYYY-MM-DD or null if not found",
    "raw_text": "original text preserved"
  }

  Rules:
  - If a field is unclear, make your best inference
  - Normalize vendor names (remove Inc., LLC, etc.)
  - Dates should be ISO format
  - If amount missing, sum item prices
  """
  
  def ingestion_agent(state: WorkflowState) -> WorkflowState:
      print("📥 INGESTION AGENT: Parsing invoice...")
      
      response = client.chat.completions.create(
          model=MODEL,
          messages=[
              {"role": "system", "content": INGESTION_PROMPT},
              {"role": "user", "content": f"Parse this invoice:\n\n{state['raw_invoice']}"}
          ],
          response_format={"type": "json_object"}
      )
      
      invoice_data = json.loads(response.choices[0].message.content)
      invoice_data["raw_text"] = state["raw_invoice"]
      
      print(f"   Extracted: {invoice_data['vendor']} - ${invoice_data['amount']}")
      
      return {**state, "invoice_data": invoice_data, "current_agent": "validation"}
  ```

- [ ] Test with all 3 invoices
- [ ] Handle JSON parsing errors

**Deliverable:** Raw text → InvoiceData dict

---

### Hour 4: Validation Agent

**Goal:** Query SQLite and validate invoice data.

**Tasks:**
- [ ] Create `src/agents/validation.py`:
  ```python
  import json
  import sqlite3
  from client import client, MODEL
  from schemas.models import WorkflowState, ValidationResult
  
  def check_inventory(items: list) -> dict:
      conn = sqlite3.connect("data/inventory.db")
      cursor = conn.cursor()
      results = {}
      for item in items:
          cursor.execute("SELECT stock FROM inventory WHERE item = ?", (item["name"],))
          row = cursor.fetchone()
          results[item["name"]] = {
              "requested": item["quantity"],
              "in_stock": row[0] if row else 0,
              "available": row[0] >= item["quantity"] if row else False
          }
      conn.close()
      return results
  
  VALIDATION_PROMPT = """Analyze this invoice validation data and determine if it's valid.

  Output JSON:
  {
    "is_valid": boolean,
    "errors": ["list of critical errors"],
    "warnings": ["list of warnings"]
  }

  Validation rules:
  - All items must be in stock (error if not)
  - Amount should match sum of items (warning if mismatch)
  - Due date should be in the future (warning if past)
  """
  
  def validation_agent(state: WorkflowState) -> WorkflowState:
      print("✅ VALIDATION AGENT: Checking inventory...")
      
      invoice = state["invoice_data"]
      inventory_check = check_inventory(invoice["items"])
      
      print(f"   Inventory check: {inventory_check}")
      
      response = client.chat.completions.create(
          model=MODEL,
          messages=[
              {"role": "system", "content": VALIDATION_PROMPT},
              {"role": "user", "content": f"Invoice: {json.dumps(invoice)}\nInventory: {json.dumps(inventory_check)}"}
          ],
          response_format={"type": "json_object"}
      )
      
      result = json.loads(response.choices[0].message.content)
      result["inventory_check"] = inventory_check
      
      print(f"   Valid: {result['is_valid']}")
      
      return {**state, "validation_result": result, "current_agent": "approval"}
  ```

- [ ] Test validation pass/fail scenarios

**Deliverable:** InvoiceData → ValidationResult

---

### Hour 5: Approval Agent

**Goal:** Grok reasons about approval with visible chain-of-thought.

**Tasks:**
- [ ] Create `src/agents/approval.py`:
  ```python
  import json
  from client import client, MODEL
  from schemas.models import WorkflowState, ApprovalDecision
  
  APPROVAL_PROMPT = """You are an invoice approval agent. Analyze and decide whether to approve.

  THINK STEP BY STEP and explain your reasoning:
  1. Did validation pass?
  2. Is the amount reasonable? (flag if > $10,000)
  3. Is the vendor known/trusted?
  4. Are there any fraud indicators?

  FRAUD INDICATORS (auto-reject):
  - Vendor name contains "Fraudster" or suspicious terms
  - Items with 0 stock requested
  - Due date in the past
  - Amount > $50,000

  Output JSON:
  {
    "approved": boolean,
    "reason": "DETAILED explanation of your reasoning process",
    "requires_review": boolean,
    "risk_score": 0.0 to 1.0
  }
  """
  
  def approval_agent(state: WorkflowState) -> WorkflowState:
      print("🤔 APPROVAL AGENT: Analyzing...")
      
      response = client.chat.completions.create(
          model=MODEL,
          messages=[
              {"role": "system", "content": APPROVAL_PROMPT},
              {"role": "user", "content": f"""
  Invoice: {json.dumps(state['invoice_data'])}
  Validation Result: {json.dumps(state['validation_result'])}

  Should this invoice be approved for payment?
  """}
          ],
          response_format={"type": "json_object"}
      )
      
      decision = json.loads(response.choices[0].message.content)
      
      print(f"   Decision: {'✅ APPROVED' if decision['approved'] else '❌ REJECTED'}")
      print(f"   Reason: {decision['reason']}")
      
      return {**state, "approval_decision": decision, "current_agent": "payment"}
  ```

**Deliverable:** Approval decision with visible reasoning

---

### Hour 6: Payment Agent + Integration

**Goal:** Complete end-to-end flow with conditional routing.

**Tasks:**
- [ ] Create `src/agents/payment.py`:
  ```python
  import uuid
  from schemas.models import WorkflowState, PaymentResult
  
  def mock_payment_api(vendor: str, amount: float) -> PaymentResult:
      return {
          "success": True,
          "transaction_id": f"TXN-{uuid.uuid4().hex[:8].upper()}",
          "error": None
      }
  
  def payment_agent(state: WorkflowState) -> WorkflowState:
      print("💰 PAYMENT AGENT: Processing payment...")
      
      if not state["approval_decision"]["approved"]:
          print("   Skipped - Invoice was not approved")
          return {**state, "status": "rejected"}
      
      invoice = state["invoice_data"]
      result = mock_payment_api(invoice["vendor"], invoice["amount"])
      
      print(f"   Transaction ID: {result['transaction_id']}")
      
      return {**state, "payment_result": result, "status": "completed"}
  ```

- [ ] Update `workflow.py` with conditional edges:
  ```python
  def route_after_validation(state):
      if state["validation_result"]["is_valid"]:
          return "continue"
      return "reject"
  
  def route_after_approval(state):
      if state["approval_decision"]["approved"]:
          return "approved"
      return "rejected"
  
  # Add conditional edges
  workflow.add_conditional_edges(
      "validation",
      route_after_validation,
      {"continue": "approval", "reject": END}
  )
  workflow.add_conditional_edges(
      "approval",
      route_after_approval,
      {"approved": "payment", "rejected": END}
  )
  ```

- [ ] Test complete flow with Invoice1

**🚨 CHECKPOINT 2:** Happy path (Invoice1) must work end-to-end.

---

## Phase 3: Enhancement (Hours 7-8)

### Hour 7: Self-Correction Loop

**Goal:** Messy invoices get automatically re-parsed.

**Tasks:**
- [ ] Add retry logic to ingestion
- [ ] Feedback loop from validation to ingestion
- [ ] Max 3 retries
- [ ] Test with Invoice2 (messy)

---

### Hour 8: Error Handling + Logging

**Tasks:**
- [ ] Wrap Grok calls in try/except
- [ ] Add colored console output (use `colorama` or ANSI codes)
- [ ] Log timing for each agent
- [ ] Test error scenarios

---

## Phase 4: Demo Prep (Hours 9-10)

### Hour 9: Demo Script + Testing

**Tasks:**
- [ ] Create `main.py` demo script
- [ ] Test Invoice1: Clean → Approved → Paid ✅
- [ ] Test Invoice2: Messy → (Self-correct) → Approved → Paid ✅
- [ ] Test Invoice3: Fraud → Rejected ✅
- [ ] Fix any issues

---

### Hour 10: Polish

**Tasks:**
- [ ] Clean output formatting
- [ ] Add summary at end
- [ ] Create README with run instructions
- [ ] Final dry run

**🚨 CHECKPOINT 3:** Demo ready.

---

## Test Invoices

### Invoice 1: Clean
```
Vendor: Widgets Inc.
Amount: 5000
Items: WidgetA:10, WidgetB:5
Due: 2026-02-01
```

### Invoice 2: Messy
```
Vndr: Gadgets Co.
Amt: 15000
Itms: GadgetX:20
Due: 2026-01-30
```

### Invoice 3: Fraud
```
Vendor: Fraudster LLC
Amount: 100000
Items: FakeItem:100
Due: yesterday
```

---

## Success Criteria

- [ ] All 4 agents execute in sequence
- [ ] LangGraph manages state transitions
- [ ] Grok reasoning is visible in output
- [ ] Invoice1 → Approved → Paid
- [ ] Invoice2 → Self-corrects → Approved → Paid
- [ ] Invoice3 → Fraud detected → Rejected
- [ ] No crashes on edge cases

---

*Roadmap approved by Galatiq Committee Session 2026-01-26_BLUEPRINT*
