# 🎯 COMMITTEE MISSION

## The Challenge

**Build and ship a working, end-to-end prototype under ambiguity.**

A company spends $2M/year on manual invoice processing with:
- 30% error rate
- 5-day processing delays
- Angry stakeholders
- Manual PDF extraction, validation, approval, and payment

---

## The Solution

Design and implement a **multi-agent system** that automates the invoice processing workflow:

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐     ┌─────────────┐
│  INGESTION  │ ──▶ │  VALIDATION  │ ──▶ │  APPROVAL   │ ──▶ │   PAYMENT   │
│    Agent    │     │    Agent     │     │    Agent    │     │    Agent    │
└─────────────┘     └──────────────┘     └─────────────┘     └─────────────┘
      │                    │                   │                    │
      ▼                    ▼                   ▼                    ▼
   PDF Parse         DB Query +          Grok Reasoning      Mock Payment
   & Extract         Grok Validate       Critique Loop           API
```

---

## Technical Requirements

### Core Engine
- **xAI's Grok** as the reasoning engine (REQUIRED, not interchangeable)
- Multi-agent orchestration (LangGraph, CrewAI, AutoGen, or custom)

### Must-Have Capabilities
- ✅ Tool / function calling
- ✅ Structured outputs (JSON schemas, Pydantic models)
- ✅ Self-correction loops (review, critique, retry on failure)

### Production Qualities
- ✅ Clean, modular Python code (not a single script)
- ✅ Basic error handling (timeouts, retries, graceful failures)
- ✅ Observability (structured logs, run IDs)

### Constraints
- ❌ No internet at runtime (beyond Grok API)
- ❌ No cloud deployment (local only)
- ✅ All external services simulated locally (FastAPI mocks, fixtures)

---

## Available Resources

### Mock Invoice Data
```
Invoice1: "Vendor: Widgets Inc. Amount: 5000. Items: WidgetA:10, WidgetB:5. Due: 2026-02-01" (clean)
Invoice2: "Vndr: Gadgets Co. Amt: 15000. Itms: GadgetX:20. Due: 2026-01-30" (messy, >$10K)
Invoice3: "Vendor: Fraudster. Amount: 100000. Items: FakeItem:100. Due: yesterday" (fraud)
```

### Mock Inventory Database (SQLite)
```sql
CREATE TABLE inventory (item TEXT, stock INTEGER);
INSERT INTO inventory VALUES 
  ('WidgetA', 15), 
  ('WidgetB', 10), 
  ('GadgetX', 5), 
  ('FakeItem', 0);
```

### Mock Payment API
```python
def mock_payment(vendor: str, amount: float) -> dict:
    return {"status": "success", "vendor": vendor, "amount": amount}
```

---

## Success Criteria

1. **Working prototype** that processes all 3 test invoices correctly
2. **Proper rejections** for fraud/invalid invoices
3. **Self-correction** demonstrated on messy input (Invoice2)
4. **Observable execution** with structured logs
5. **Clean code** that could evolve toward production

---

## Committee Mandate

The Committee shall:
1. **Design** the agent architecture and orchestration flow
2. **Critique** all proposals thoroughly (skeptics essential)
3. **Decide** on technical approaches with clear rationale
4. **Document** decisions and artifacts in session folders
5. **Support** implementation with expert guidance

---

*This mission guides all Committee deliberations.*
