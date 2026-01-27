# Invoice Processing System

> Multi-agent invoice processing using xAI Grok and LangGraph

## Quick Start

### 1. Install Dependencies

```bash
# Backend (Python)
cd invoice-processor
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Frontend (React)
cd frontend
npm install
```

### 2. Configure API Key

Create a `.env` file in the project root:

```bash
# .env
XAI_API_KEY=your-xai-api-key-here
GROK_MODEL=grok-4-1-fast-reasoning
```

Get your API key from [x.ai](https://x.ai)

### 3. Test Connection

```bash
source venv/bin/activate
python src/client.py
```

You should see:
```
✅ Grok responded: Grok is ready for invoice processing
🚀 CHECKPOINT 1 PASSED: Grok connection verified!
```

### 4. Run the Demo

```bash
# Terminal 1: Backend (real Grok API)
cd invoice-processor
source venv/bin/activate
python src/workflow.py

# Terminal 2: Frontend (demo UI)
cd invoice-processor/frontend
npm run dev
# → http://localhost:3000
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        INVOICE PROCESSING PIPELINE                          │
├─────────────┬──────────────┬─────────────┬─────────────┬───────────────────┤
│  INGESTION  │  VALIDATION  │  APPROVAL   │   PAYMENT   │     OUTCOME       │
│    Agent    │    Agent     │    Agent    │    Agent    │                   │
├─────────────┼──────────────┼─────────────┼─────────────┼───────────────────┤
│ Grok JSON   │ DB Query +   │ Chain-of-   │ Mock        │ ✅ Approved/Paid  │
│ extraction  │ Grok reason  │ Thought     │ Payment API │ ❌ Rejected       │
│ + Self-     │ for rules    │ reasoning   │             │ ⚠️ Needs Review   │
│   correct   │              │             │             │                   │
└─────────────┴──────────────┴─────────────┴─────────────┴───────────────────┘
```

**Tech Stack:**
- **LLM:** xAI Grok (`grok-4-1-fast-reasoning`)
- **Orchestration:** LangGraph StateGraph
- **Backend:** Python 3.11+
- **Frontend:** React 19 + Vite + Tailwind CSS
- **Database:** SQLite (local)

## Test Invoices

| Invoice | Vendor | Amount | Expected Outcome |
|---------|--------|--------|------------------|
| 1 | Widgets Inc. | $5,000 | ✅ Approved → Paid |
| 2 | Gadgets Co. | $15,000 | ⚠️ Self-correct → Review (insufficient inventory) |
| 3 | Fraudster LLC | $100,000 | ❌ Rejected (fraud signals) |

## Frontend Demo

The frontend provides an animated demo of the AI pipeline:

1. **Invoice Inbox** — View processed invoices
2. **Upload Modal** — Select test invoices to process
3. **Processing View** — Watch the 4-agent pipeline in real-time
   - Shows Grok API calls and JSON responses
   - LangGraph state visualization
   - Chain-of-thought reasoning
   - Self-correction animation

### Current Status

| Component | Description |
|-----------|-------------|
| Backend | ✅ Real Grok API calls |
| Frontend | ⚠️ Simulated (Phase 1) |
| API Integration | 📋 Planned (Phase 2) |

See [`SESSION_SUMMARY.md`](./SESSION_SUMMARY.md) for details.
See [`PHASE2_PLAN.md`](./PHASE2_PLAN.md) for API integration plan.

## Project Structure

```
invoice-processor/
├── src/
│   ├── client.py          # Grok API client
│   ├── workflow.py        # LangGraph orchestration
│   ├── agents/            # Agent implementations
│   │   ├── ingestion.py   # PDF/text → structured data
│   │   ├── validation.py  # Inventory + rule checking
│   │   ├── approval.py    # Chain-of-thought reasoning
│   │   └── payment.py     # Mock payment execution
│   ├── schemas/           # TypedDict models
│   └── tools/             # Database utilities
├── frontend/
│   └── src/
│       ├── components/    # React components
│       │   ├── UploadModal.jsx
│       │   ├── ProcessingView.jsx
│       │   └── ...
│       └── pages/
│           ├── InboxPage.jsx
│           └── DetailPage.jsx
├── data/
│   ├── invoices/          # Test invoice files
│   └── inventory.db       # SQLite database
├── main.py                # CLI entry point
├── SESSION_SUMMARY.md     # Current session documentation
├── PHASE2_PLAN.md         # API integration roadmap
└── requirements.txt
```

## Key Features

- **Self-Correction:** Ingestion agent retries if extraction confidence is low
- **Chain-of-Thought:** Approval agent shows 5-step reasoning chain
- **Conditional Routing:** LangGraph routes based on validation/approval results
- **Structured Outputs:** Grok JSON mode for reliable extraction
- **Observable:** All decisions logged with rationale

---

*Built with guidance from the Galatiq Committee*
