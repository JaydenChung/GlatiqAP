"""
Invoice Processing API Server
=============================
FastAPI server exposing the LangGraph workflow via WebSocket.

Endpoints:
- GET  /                              → Health check
- GET  /api/invoices                  → List test invoices
- POST /api/invoices/upload-pdf       → Upload PDF invoice (NEW)
- GET  /api/uploads                   → List uploaded PDFs (NEW)
- WS   /ws/process                    → WebSocket for real-time processing
- POST /api/invoices/{id}/route       → Route invoice to approval (Stage 2)
- POST /api/invoices/{id}/approve     → Human approves invoice
- POST /api/invoices/{id}/reject      → Human rejects invoice
- POST /api/invoices/{id}/pay         → Execute payment (Stage 3)

Created: Session 2026-01-26_CONNECT
Updated: Session 2026-01-27_WORKFLOW (staged workflow endpoints)
Updated: Session 2026-01-27_INGEST (PDF upload support)
"""

import json
import asyncio
import uuid
import tempfile
import shutil
from pathlib import Path as FilePath
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any
import time
from datetime import datetime

# Initialize path for imports
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from api.streaming_workflow import (
    process_invoice_streaming, 
    process_approval_streaming,
    process_payment_streaming,
    set_invoice_store,
    get_invoice_store,
)
from src.workflow import (
    run_ingestion_workflow,
    run_approval_workflow,
    human_approve,
    human_reject,
    run_payment_workflow,
)
from src.schemas.models import InvoiceStatus, APPROVAL_THRESHOLDS
from src.tools.database import (
    init_database,
    get_all_vendors,
    get_vendor_by_id,
    lookup_vendor_by_name,
    get_vendor_stats,
)


# =============================================================================
# APP SETUP
# =============================================================================

app = FastAPI(
    title="Invoice Processing API",
    description="Multi-agent invoice processing system powered by xAI Grok",
    version="1.0.0",
)

# CORS for frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:5173",  # Vite default
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ProcessRequest(BaseModel):
    """Request to process an invoice via WebSocket."""
    raw_invoice: str
    invoice_id: Optional[str] = None


class RouteToApprovalRequest(BaseModel):
    """Request to route an invoice to approval."""
    pass  # Invoice ID comes from path


class ApproveRequest(BaseModel):
    """Request for human approval."""
    approver: str  # Email or name of approver
    notes: Optional[str] = None


class RejectRequest(BaseModel):
    """Request for human rejection."""
    rejector: str  # Email or name of rejector
    reason: str  # Required reason for rejection


class ExecutePaymentRequest(BaseModel):
    """Request to execute payment."""
    pass  # Invoice ID comes from path


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    version: str
    timestamp: float


class TestInvoice(BaseModel):
    """Test invoice data."""
    id: str
    name: str
    rawText: str
    expectedOutcome: str


# =============================================================================
# IN-MEMORY INVOICE STORE (for demo purposes)
# In production, this would be a database
# =============================================================================

invoice_store: Dict[str, Dict[str, Any]] = {}


# =============================================================================
# TEST DATA
# =============================================================================

TEST_INVOICES = [
    {
        "id": "test-1",
        "name": "Invoice 1 - Clean (Happy Path)",
        "rawText": """Vendor: Widgets Inc.
Amount: 5000
Items: WidgetA:10, WidgetB:5
Due: 2026-02-01""",
        "expectedOutcome": "approved",
        "icon": "📄",
        "amount": 5000,
    },
    {
        "id": "test-2", 
        "name": "Invoice 2 - Messy Format (Stock Issue)",
        "rawText": """Vndr: Gadgets Co.
Amt: 15000
Itms: GadgetX:20
Due: 2026-01-30""",
        "expectedOutcome": "rejected",
        "icon": "📋",
        "amount": 15000,
    },
    {
        "id": "test-3",
        "name": "Invoice 3 - Fraud Indicators",
        "rawText": """Vendor: Fraudster LLC
Amount: 100000
Items: FakeItem:100
Due: yesterday""",
        "expectedOutcome": "rejected",
        "icon": "⚠️",
        "amount": 100000,
    },
]


# =============================================================================
# HTTP ENDPOINTS
# =============================================================================

@app.get("/", response_model=HealthResponse)
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": "1.0.0",
        "timestamp": time.time(),
    }


@app.get("/api/invoices")
async def list_test_invoices():
    """List available test invoices."""
    return {"invoices": TEST_INVOICES}


@app.get("/api/invoices/{invoice_id}")
async def get_test_invoice(invoice_id: str):
    """Get a specific test invoice."""
    # First check the store for processed invoices
    if invoice_id in invoice_store:
        return invoice_store[invoice_id]
    # Then check test invoices
    for invoice in TEST_INVOICES:
        if invoice["id"] == invoice_id:
            return invoice
    raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")


# =============================================================================
# PDF UPLOAD ENDPOINT (Session 2026-01-27_INGEST)
# =============================================================================

# Directory for storing uploaded PDFs
UPLOAD_DIR = FilePath(__file__).parent.parent / "data" / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@app.post("/api/invoices/upload-pdf")
async def upload_pdf_invoice(file: UploadFile = File(...)):
    """
    Upload a PDF invoice for processing.
    
    The PDF will be saved temporarily and processed through the
    ingestion pipeline to extract invoice data.
    
    Returns:
        - invoice_id: Generated ID for the invoice
        - filename: Original filename
        - file_path: Path where PDF is stored (for processing)
        
    Session: 2026-01-27_INGEST (Galatiq Committee)
    """
    # Validate file type
    if not file.filename:
        raise HTTPException(status_code=400, detail="No filename provided")
    
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=400, 
            detail=f"File must be a PDF. Received: {file.filename}"
        )
    
    # Validate file size (10MB max)
    MAX_SIZE = 10 * 1024 * 1024  # 10MB
    contents = await file.read()
    
    if len(contents) > MAX_SIZE:
        raise HTTPException(
            status_code=400,
            detail=f"File too large: {len(contents) / (1024*1024):.1f}MB (max 10MB)"
        )
    
    # Generate unique ID and save file
    invoice_id = f"pdf-{uuid.uuid4().hex[:8]}"
    safe_filename = f"{invoice_id}_{file.filename.replace(' ', '_')}"
    file_path = UPLOAD_DIR / safe_filename
    
    # Write file
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Store metadata
    invoice_store[invoice_id] = {
        "id": invoice_id,
        "name": f"PDF: {file.filename}",
        "source_type": "pdf",
        "source_path": str(file_path),
        "original_filename": file.filename,
        "file_size": len(contents),
        "status": "uploaded",
        "uploaded_at": datetime.utcnow().isoformat(),
        "workflow_state": None,
        "invoice_data": None,
    }
    
    return {
        "invoice_id": invoice_id,
        "filename": file.filename,
        "file_path": str(file_path),
        "file_size": len(contents),
        "status": "uploaded",
        "message": "PDF uploaded successfully. Use WebSocket /ws/process to process it.",
        "next_step": f"Connect to WebSocket and send: {{\"raw_invoice\": \"{file_path}\", \"invoice_id\": \"{invoice_id}\"}}",
    }


@app.get("/api/uploads")
async def list_uploaded_files():
    """List all uploaded PDF files."""
    uploads = []
    for invoice_id, data in invoice_store.items():
        if data.get("source_type") == "pdf":
            uploads.append({
                "invoice_id": invoice_id,
                "filename": data.get("original_filename"),
                "file_size": data.get("file_size"),
                "status": data.get("status"),
                "uploaded_at": data.get("uploaded_at"),
            })
    return {"uploads": uploads}


@app.get("/api/files/{file_name}")
async def serve_uploaded_file(file_name: str):
    """
    Serve an uploaded PDF file for viewing in the frontend.
    
    This endpoint allows the frontend to embed PDFs in an iframe.
    Uses Content-Disposition: inline to display PDF in browser instead of downloading.
    """
    file_path = UPLOAD_DIR / file_name
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail=f"File not found: {file_name}")
    
    if not file_name.lower().endswith('.pdf'):
        raise HTTPException(status_code=400, detail="Only PDF files can be served")
    
    return FileResponse(
        path=str(file_path),
        media_type="application/pdf",
        headers={
            "Content-Disposition": "inline",  # Display in browser, don't download
            "Cache-Control": "public, max-age=3600",  # Cache for 1 hour
        }
    )


# =============================================================================
# VENDOR API ENDPOINTS (Session 2026-01-27_PERSIST)
# =============================================================================

@app.get("/api/vendors")
async def list_vendors():
    """
    List all vendors from the Vendor Master database.
    
    Returns vendor profiles with contact info, payment terms,
    compliance status, and risk levels.
    """
    vendors = get_all_vendors()
    stats = get_vendor_stats()
    
    return {
        "vendors": vendors,
        "stats": stats,
    }


@app.get("/api/vendors/stats")
async def vendor_statistics():
    """Get vendor dashboard statistics."""
    return get_vendor_stats()


@app.get("/api/vendors/{vendor_id}")
async def get_vendor(vendor_id: str):
    """Get a specific vendor by ID."""
    vendor = get_vendor_by_id(vendor_id)
    if not vendor:
        raise HTTPException(status_code=404, detail=f"Vendor {vendor_id} not found")
    return vendor


@app.get("/api/vendors/lookup/{name}")
async def lookup_vendor(name: str):
    """
    Look up a vendor by name or alias.
    
    This is used by the Validation Agent to enrich invoice data
    with vendor contact information.
    """
    vendor = lookup_vendor_by_name(name)
    if not vendor:
        return {
            "found": False,
            "query": name,
            "vendor": None,
            "message": f"No vendor found matching '{name}'",
        }
    
    return {
        "found": True,
        "query": name,
        "vendor": vendor,
        "message": f"Found vendor: {vendor['name']} ({vendor['vendor_id']})",
    }


# =============================================================================
# STAGED WORKFLOW ENDPOINTS (Session 2026-01-27_WORKFLOW)
# =============================================================================

@app.post("/api/invoices/{invoice_id}/route-to-approval")
async def route_to_approval(invoice_id: str):
    """
    STAGE 2: Route invoice to approval.
    
    Triggers the Approval Agent which performs smart triage:
    - <$10K AND no flags → AUTO-APPROVE (goes straight to ready-to-pay)
    - ≥$10K OR flags → ROUTE TO HUMAN (needs VP approval)
    - Major red flags → AUTO-REJECT
    """
    if invoice_id not in invoice_store:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found in store")
    
    stored = invoice_store[invoice_id]
    state = stored.get("workflow_state")
    
    if not state:
        raise HTTPException(status_code=400, detail="Invoice has no workflow state")
    
    current_status = state.get("invoice_status")
    if current_status != InvoiceStatus.INBOX.value:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot route to approval - invoice status is '{current_status}', expected 'inbox'"
        )
    
    # Run approval workflow
    updated_state = run_approval_workflow(state)
    
    # Update store
    invoice_store[invoice_id]["workflow_state"] = updated_state
    invoice_store[invoice_id]["status"] = updated_state.get("invoice_status")
    invoice_store[invoice_id]["approval_decision"] = updated_state.get("approval_decision")
    
    # Determine the routing result
    approval = updated_state.get("approval_decision", {})
    route = approval.get("route", "route_to_human")
    
    return {
        "invoice_id": invoice_id,
        "status": updated_state.get("invoice_status"),
        "route": route,
        "approval_decision": approval,
        "message": {
            "auto_approve": "Invoice auto-approved and ready for payment",
            "route_to_human": "Invoice routed to human approver",
            "auto_reject": "Invoice auto-rejected due to red flags",
        }.get(route, "Approval analysis complete"),
    }


@app.post("/api/invoices/{invoice_id}/approve")
async def approve_invoice(invoice_id: str, request: ApproveRequest):
    """
    Human approval of an invoice.
    
    Only valid for invoices in PENDING_APPROVAL status.
    """
    if invoice_id not in invoice_store:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    
    stored = invoice_store[invoice_id]
    state = stored.get("workflow_state")
    
    if not state:
        raise HTTPException(status_code=400, detail="Invoice has no workflow state")
    
    current_status = state.get("invoice_status")
    if current_status != InvoiceStatus.PENDING_APPROVAL.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot approve - invoice status is '{current_status}', expected 'pending_approval'"
        )
    
    # Record human approval
    updated_state = human_approve(state, request.approver, request.notes)
    
    # Update store
    invoice_store[invoice_id]["workflow_state"] = updated_state
    invoice_store[invoice_id]["status"] = updated_state.get("invoice_status")
    invoice_store[invoice_id]["approved_by"] = request.approver
    invoice_store[invoice_id]["approved_at"] = datetime.utcnow().isoformat()
    
    return {
        "invoice_id": invoice_id,
        "status": updated_state.get("invoice_status"),
        "approved_by": request.approver,
        "approved_at": updated_state.get("approved_at"),
        "message": "Invoice approved and ready for payment",
    }


@app.post("/api/invoices/{invoice_id}/reject")
async def reject_invoice(invoice_id: str, request: RejectRequest):
    """
    Human rejection of an invoice.
    
    Only valid for invoices in PENDING_APPROVAL status.
    """
    if invoice_id not in invoice_store:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    
    stored = invoice_store[invoice_id]
    state = stored.get("workflow_state")
    
    if not state:
        raise HTTPException(status_code=400, detail="Invoice has no workflow state")
    
    current_status = state.get("invoice_status")
    if current_status != InvoiceStatus.PENDING_APPROVAL.value:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot reject - invoice status is '{current_status}', expected 'pending_approval'"
        )
    
    # Record human rejection
    updated_state = human_reject(state, request.rejector, request.reason)
    
    # Update store
    invoice_store[invoice_id]["workflow_state"] = updated_state
    invoice_store[invoice_id]["status"] = updated_state.get("invoice_status")
    invoice_store[invoice_id]["rejected_by"] = request.rejector
    invoice_store[invoice_id]["rejected_at"] = datetime.utcnow().isoformat()
    invoice_store[invoice_id]["rejection_reason"] = request.reason
    
    return {
        "invoice_id": invoice_id,
        "status": updated_state.get("invoice_status"),
        "rejected_by": request.rejector,
        "rejected_at": updated_state.get("rejected_at"),
        "reason": request.reason,
        "message": "Invoice rejected",
    }


@app.post("/api/invoices/{invoice_id}/execute-payment")
async def execute_payment(invoice_id: str):
    """
    STAGE 3: Execute payment for an approved invoice.
    
    Valid for invoices in APPROVED or AUTO_APPROVED status.
    """
    if invoice_id not in invoice_store:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} not found")
    
    stored = invoice_store[invoice_id]
    state = stored.get("workflow_state")
    
    if not state:
        raise HTTPException(status_code=400, detail="Invoice has no workflow state")
    
    current_status = state.get("invoice_status")
    valid_statuses = [
        InvoiceStatus.APPROVED.value,
        InvoiceStatus.AUTO_APPROVED.value,
        InvoiceStatus.READY_TO_PAY.value,
    ]
    
    if current_status not in valid_statuses:
        raise HTTPException(
            status_code=400,
            detail=f"Cannot execute payment - invoice status is '{current_status}', expected one of {valid_statuses}"
        )
    
    # Run payment workflow
    updated_state = run_payment_workflow(state)
    
    # Update store
    invoice_store[invoice_id]["workflow_state"] = updated_state
    invoice_store[invoice_id]["status"] = updated_state.get("invoice_status")
    invoice_store[invoice_id]["payment_result"] = updated_state.get("payment_result")
    
    payment = updated_state.get("payment_result", {})
    
    if payment.get("success"):
        return {
            "invoice_id": invoice_id,
            "status": updated_state.get("invoice_status"),
            "payment_result": payment,
            "message": f"Payment successful! Transaction ID: {payment.get('transaction_id')}",
        }
    else:
        raise HTTPException(
            status_code=500,
            detail=f"Payment failed: {payment.get('error', 'Unknown error')}"
        )


@app.get("/api/store")
async def get_invoice_store():
    """Debug endpoint: Get all invoices in the store."""
    return {
        "count": len(invoice_store),
        "invoices": list(invoice_store.keys()),
        "details": {k: {"status": v.get("status"), "vendor": v.get("invoice_data", {}).get("vendor")} 
                   for k, v in invoice_store.items()}
    }


# =============================================================================
# WEBSOCKET ENDPOINT
# =============================================================================

@app.websocket("/ws/process")
async def websocket_process(websocket: WebSocket):
    """
    WebSocket endpoint for real-time invoice processing (STAGE 1).
    
    STAGED WORKFLOW: This endpoint only runs Stage 1 (Ingestion + Validation).
    Invoice lands in INBOX after processing.
    
    Protocol:
    1. Client connects
    2. Server sends {"event": "connected"}
    3. Client sends {"raw_invoice": "...", "invoice_id": "..."}
    4. Server streams events through Ingestion + Validation
    5. Server sends {"event": "stage1_complete"} with invoice in INBOX
    6. Connection closes
    
    To continue processing:
    - POST /api/invoices/{id}/route-to-approval (Stage 2)
    - POST /api/invoices/{id}/execute-payment (Stage 3)
    """
    await websocket.accept()
    
    try:
        # Send connection confirmation
        await websocket.send_json({
            "event": "connected",
            "timestamp": time.time(),
            "message": "WebSocket connected. Send invoice to process (Stage 1: Ingestion + Validation).",
        })
        
        # Wait for client to send invoice data
        data = await websocket.receive_json()
        
        raw_invoice = data.get("raw_invoice")
        invoice_id = data.get("invoice_id")
        
        if not raw_invoice:
            await websocket.send_json({
                "event": "error",
                "timestamp": time.time(),
                "message": "Missing raw_invoice in request",
            })
            await websocket.close()
            return
        
        print(f"\n{'='*60}")
        print(f"📨 STAGE 1: Processing invoice via WebSocket")
        print(f"   Invoice ID: {invoice_id or '(auto-generated)'}")
        print(f"{'='*60}")
        
        # Stream Stage 1 events (Ingestion + Validation only)
        async for event in process_invoice_streaming(raw_invoice, invoice_id):
            await websocket.send_json(event)
            await asyncio.sleep(0.01)
        
        print(f"\n✅ Stage 1 complete - Invoice in INBOX")
        print(f"   Next: Route to approval via POST /api/invoices/{{id}}/route-to-approval")
        
    except WebSocketDisconnect:
        print(f"⚠️ WebSocket disconnected")
    except Exception as e:
        print(f"❌ WebSocket error: {e}")
        try:
            await websocket.send_json({
                "event": "error",
                "timestamp": time.time(),
                "message": str(e),
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass


@app.websocket("/ws/approval/{invoice_id}")
async def websocket_approval(websocket: WebSocket, invoice_id: str):
    """
    WebSocket endpoint for Stage 2 (Approval) with streaming.
    
    Alternative to POST /api/invoices/{id}/route-to-approval for real-time updates.
    """
    await websocket.accept()
    
    try:
        await websocket.send_json({
            "event": "connected",
            "timestamp": time.time(),
            "message": f"Running approval analysis for {invoice_id}",
        })
        
        async for event in process_approval_streaming(invoice_id):
            await websocket.send_json(event)
            await asyncio.sleep(0.01)
        
    except WebSocketDisconnect:
        print(f"⚠️ Approval WebSocket disconnected")
    except Exception as e:
        print(f"❌ Approval WebSocket error: {e}")
        try:
            await websocket.send_json({
                "event": "error",
                "timestamp": time.time(),
                "message": str(e),
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass


@app.websocket("/ws/payment/{invoice_id}")
async def websocket_payment(
    websocket: WebSocket, 
    invoice_id: str,
    approved_by: str = None,  # Query param: who approved (e.g., "human:user@email.com")
    invoice_status: str = None,  # Query param: current status (e.g., "ready_to_pay")
):
    """
    WebSocket endpoint for Stage 3 (Payment) with streaming.
    
    Query Parameters:
        approved_by: Who approved the invoice (e.g., "human:user@email.com" for human approval)
        invoice_status: Current invoice status (e.g., "ready_to_pay", "approved")
    
    These parameters allow the frontend to communicate human approval state to the backend.
    """
    await websocket.accept()
    
    try:
        await websocket.send_json({
            "event": "connected",
            "timestamp": time.time(),
            "message": f"Executing payment for {invoice_id}",
        })
        
        async for event in process_payment_streaming(invoice_id, approved_by=approved_by, invoice_status=invoice_status):
            await websocket.send_json(event)
            await asyncio.sleep(0.01)
        
    except WebSocketDisconnect:
        print(f"⚠️ Payment WebSocket disconnected")
    except Exception as e:
        print(f"❌ Payment WebSocket error: {e}")
        try:
            await websocket.send_json({
                "event": "error",
                "timestamp": time.time(),
                "message": str(e),
            })
        except:
            pass
    finally:
        try:
            await websocket.close()
        except:
            pass


# =============================================================================
# ALTERNATIVE: HTTP STREAMING (SSE-like)
# =============================================================================

from fastapi.responses import StreamingResponse

@app.post("/api/process/stream")
async def process_invoice_stream(request: ProcessRequest):
    """
    Alternative endpoint using Server-Sent Events style streaming.
    
    This is a fallback if WebSocket causes issues.
    Returns a streaming response with newline-delimited JSON.
    """
    async def generate():
        async for event in process_invoice_streaming(request.raw_invoice):
            yield json.dumps(event) + "\n"
    
    return StreamingResponse(
        generate(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )


# =============================================================================
# STARTUP
# =============================================================================

@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    # Initialize database with vendors and inventory
    init_database(force_reset=False)  # Don't reset - preserve existing data
    
    # Share invoice store with streaming workflow module
    set_invoice_store(invoice_store)
    
    # Get vendor stats for display
    stats = get_vendor_stats()
    
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  INVOICE PROCESSING API".center(58) + "║")
    print("║" + "  Powered by xAI Grok + LangGraph".center(58) + "║")
    print("║" + "  STAGED WORKFLOW (Session 2026-01-27)".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    print()
    print("Staged Workflow Endpoints:")
    print("  WS   /ws/process                     → Stage 1: Ingestion + Validation")
    print("  POST /api/invoices/{id}/route-to-approval  → Stage 2: Approval Triage")
    print("  POST /api/invoices/{id}/approve      → Human approves")
    print("  POST /api/invoices/{id}/reject       → Human rejects")
    print("  POST /api/invoices/{id}/execute-payment → Stage 3: Payment")
    print()
    print("Vendor Master Endpoints:")
    print("  GET  /api/vendors                    → List all vendors")
    print("  GET  /api/vendors/{id}               → Get vendor by ID")
    print("  GET  /api/vendors/lookup/{name}      → Lookup by name/alias")
    print()
    print(f"Database: {stats['total_vendors']} vendors, {stats['compliant']} compliant")
    print(f"Auto-approve threshold: <${APPROVAL_THRESHOLDS['auto_approve_max']:,}")
    print()


# =============================================================================
# RUN DIRECTLY
# =============================================================================

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

