# Phase 2: Real API Integration Plan

> **Goal:** Wire frontend to real Python backend with actual Grok API calls  
> **Estimated Time:** 2-3 hours

---

## Overview

Replace the simulated `ProcessingView` with real API calls to a FastAPI server that wraps the LangGraph workflow.

```
┌─────────────────┐     HTTP/WebSocket     ┌─────────────────┐     Grok API     ┌─────────────┐
│    Frontend     │ ◄──────────────────────► │  FastAPI Server │ ◄──────────────► │  xAI Grok   │
│  (React/Vite)   │                         │   (Python)      │                  │             │
│  localhost:3000 │                         │  localhost:8000 │                  │ api.x.ai/v1 │
└─────────────────┘                         └─────────────────┘                  └─────────────┘
```

---

## Tasks

### 1. Create FastAPI Server
**File:** `api/server.py`

```python
from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
import asyncio

app = FastAPI(title="Invoice Processor API")

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/api/process")
async def process_invoice(request: ProcessRequest):
    """Start processing an invoice."""
    pass

@app.websocket("/ws/process")
async def process_websocket(websocket: WebSocket):
    """Stream processing updates in real-time."""
    pass
```

### 2. Create Streaming Workflow Wrapper
**File:** `api/streaming_workflow.py`

Wrap the existing workflow to yield events as each agent completes:

```python
async def process_invoice_streaming(raw_invoice: str):
    """
    Generator that yields events as processing progresses.
    
    Yields:
        {"event": "stage_start", "stage": "ingestion"}
        {"event": "grok_call", "stage": "ingestion", "model": "grok-4-1-fast-reasoning"}
        {"event": "stage_complete", "stage": "ingestion", "data": {...}}
        ...
    """
    pass
```

### 3. Update Requirements
**File:** `requirements.txt`

Add:
```
fastapi>=0.100.0
uvicorn>=0.23.0
websockets>=11.0
```

### 4. Update Frontend ProcessingView
**File:** `frontend/src/components/ProcessingView.jsx`

Replace mock functions with WebSocket connection:

```javascript
useEffect(() => {
  const ws = new WebSocket('ws://localhost:8000/ws/process');
  
  ws.onopen = () => {
    ws.send(JSON.stringify({ raw_invoice: invoice.rawText }));
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    handleEvent(data);
  };
  
  return () => ws.close();
}, [invoice]);
```

### 5. Add Run Script
**File:** `run_api.py`

```python
import uvicorn
if __name__ == "__main__":
    uvicorn.run("api.server:app", host="0.0.0.0", port=8000, reload=True)
```

---

## API Events Schema

```typescript
// Events sent over WebSocket
type ProcessEvent = 
  | { event: "stage_start"; stage: string; }
  | { event: "grok_call"; stage: string; model: string; mode: string; }
  | { event: "grok_response"; stage: string; data: object; }
  | { event: "self_correction"; stage: string; attempt: number; }
  | { event: "stage_complete"; stage: string; data: object; status: "complete" | "failed" | "warning"; }
  | { event: "state_update"; state: WorkflowState; }
  | { event: "log"; type: string; message: string; }
  | { event: "complete"; result: ProcessResult; }
  | { event: "error"; message: string; }
```

---

## File Structure After Phase 2

```
invoice-processor/
├── api/
│   ├── __init__.py
│   ├── server.py           # FastAPI app
│   ├── streaming_workflow.py  # Async workflow wrapper
│   └── schemas.py          # Pydantic models for API
├── src/
│   ├── workflow.py         # Existing LangGraph workflow
│   ├── agents/             # Existing agents
│   └── ...
├── frontend/
│   └── src/
│       └── components/
│           └── ProcessingView.jsx  # Updated with WebSocket
├── run_api.py              # Start FastAPI server
└── requirements.txt        # Updated with FastAPI deps
```

---

## Running Phase 2

```bash
# Terminal 1: Start FastAPI backend
cd invoice-processor
source venv/bin/activate
python run_api.py
# → http://localhost:8000

# Terminal 2: Start frontend
cd invoice-processor/frontend
npm run dev
# → http://localhost:3000
```

---

## Fallback Strategy

If WebSocket is complex, use polling:

```javascript
// Start processing
const { id } = await fetch('/api/process', { 
  method: 'POST', 
  body: JSON.stringify({ raw_invoice }) 
}).then(r => r.json());

// Poll for updates
const poll = setInterval(async () => {
  const status = await fetch(`/api/process/${id}/status`).then(r => r.json());
  updateUI(status);
  if (status.status === 'completed' || status.status === 'failed') {
    clearInterval(poll);
  }
}, 500);
```

---

## Testing Checklist

- [ ] FastAPI server starts without errors
- [ ] CORS allows frontend requests
- [ ] WebSocket connection established
- [ ] Ingestion agent events stream correctly
- [ ] Self-correction shows for Invoice 2
- [ ] Validation results stream correctly
- [ ] Approval reasoning chain streams
- [ ] Payment result streams
- [ ] Final result displayed in frontend
- [ ] Invoice added to inbox after processing
- [ ] All 3 test invoices work correctly

---

## Notes

- Keep the mock data functions as fallback
- Add error handling for API failures
- Consider adding a "retry" button if API fails
- Log all Grok API calls for debugging
- Monitor API costs during testing

---

*Start Phase 2 by creating `api/server.py`*

