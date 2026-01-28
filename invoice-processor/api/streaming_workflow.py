"""
Streaming Workflow Wrapper
==========================
Async wrapper around the LangGraph workflow that yields events for WebSocket streaming.

STAGED WORKFLOW (Session 2026-01-27_WORKFLOW):
- process_invoice_streaming: STAGE 1 only (Ingestion + Validation) → INBOX
- process_approval_streaming: STAGE 2 (Approval triage) 
- process_payment_streaming: STAGE 3 (Payment execution)

Each stage streams events independently, matching the human-in-the-loop workflow.

Created: Session 2026-01-26_CONNECT
Updated: Session 2026-01-27_WORKFLOW (staged streaming)
"""

import time
import json
import asyncio
from typing import AsyncGenerator, Any, Dict
import uuid

# Initialize path setup
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

import src  # noqa: F401 - triggers path setup

from src.schemas.models import WorkflowState, InvoiceStatus, AuditEvent
from src.agents.ingestion import ingestion_agent
from src.agents.validation import validation_agent
from src.agents.approval import approval_agent
from src.agents.payment import payment_agent
from src.tools.database import init_database
from src.client import get_last_usage, get_total_usage, reset_usage_tracking
from datetime import datetime


def create_audit_event(
    event_type: str,
    actor: str,
    title: str,
    description: str,
    details: dict = None,
    ai_summary: str = None
) -> AuditEvent:
    """Create a structured audit event."""
    return {
        "event_type": event_type,
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "actor": actor,
        "title": title,
        "description": description,
        "details": details,
        "ai_summary": ai_summary,
    }


# =============================================================================
# EVENT HELPERS
# =============================================================================

def make_event(event_type: str, **kwargs) -> dict:
    """Create a timestamped event dict."""
    return {
        "event": event_type,
        "timestamp": time.time(),
        **kwargs
    }


def log_event(level: str, message: str, stage: str = None) -> dict:
    """Create a log event."""
    return make_event("log", level=level, message=message, stage=stage)


def token_event(stage: str) -> dict:
    """Create a token usage event from the last Grok call."""
    usage = get_last_usage()
    total = get_total_usage()
    return make_event(
        "token_usage",
        stage=stage,
        usage=usage,
        total=total
    )


# =============================================================================
# INVOICE STORE REFERENCE
# We import the store from server to maintain consistency
# =============================================================================

# This will be set by the server module
_invoice_store: Dict[str, Any] = None

def set_invoice_store(store: Dict[str, Any]):
    """Set the invoice store reference from server module."""
    global _invoice_store
    _invoice_store = store


def get_invoice_store() -> Dict[str, Any]:
    """Get the invoice store, creating if needed."""
    global _invoice_store
    if _invoice_store is None:
        _invoice_store = {}
    return _invoice_store


# =============================================================================
# STREAMING WORKFLOW - STAGE 1 (Ingestion + Validation)
# =============================================================================

async def process_invoice_streaming(raw_invoice: str, invoice_id: str = None) -> AsyncGenerator[dict, None]:
    """
    STAGE 1: Process invoice through Ingestion + Validation.
    
    STOPS after validation - invoice lands in INBOX.
    Human action required to continue to approval stage.
    
    Args:
        raw_invoice: Raw invoice text to process
        invoice_id: Optional client-provided ID
        
    Yields:
        Event dicts for WebSocket transmission
    """
    start_time = time.time()
    
    # Generate invoice ID if not provided
    if not invoice_id:
        invoice_id = f"inv_{uuid.uuid4().hex[:8]}"
    
    # Reset token tracking for this workflow run
    reset_usage_tracking()
    
    # Ensure database is ready
    init_database()
    
    # Initialize audit trail with "invoice received" event
    initial_audit_event = create_audit_event(
        event_type="invoice_received",
        actor="system",
        title="Invoice Received",
        description=f"Invoice uploaded for processing.",
        details={
            "input_length": len(raw_invoice),
            "invoice_id": invoice_id,
        },
    )
    
    # Initialize workflow state with new staged fields
    state: WorkflowState = {
        "raw_invoice": raw_invoice,
        "invoice_data": None,
        "validation_result": None,
        "approval_analysis": None,
        "approval_decision": None,
        "payment_result": None,
        "invoice_status": InvoiceStatus.INGESTING.value,
        "current_agent": "ingestion",
        "status": "processing",
        "error": None,
        "approved_by": None,
        "approved_at": None,
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
        "audit_trail": [initial_audit_event],
    }
    
    # Yield initial state
    yield make_event("state_update", state=dict(state))
    
    # =========================================================================
    # STAGE 1: INGESTION
    # =========================================================================
    yield make_event("stage_start", stage="ingestion", description="Extract structured data from invoice")
    yield log_event("system", "═" * 50)
    yield log_event("system", "📥 INGESTION AGENT (Grok-Powered + Self-Correction)")
    yield log_event("system", "═" * 50)
    
    await asyncio.sleep(0.1)  # Small delay for UI responsiveness
    
    yield log_event("info", f"Input: {raw_invoice.strip()[:60]}...")
    yield log_event("info", "Status: Extracting with Grok...")
    
    yield make_event("grok_call", stage="ingestion", model="grok-4-1-fast-reasoning", mode="json", temperature=0)
    
    await asyncio.sleep(0.1)
    
    # Run ingestion agent (this calls Grok)
    try:
        ingestion_result = ingestion_agent(state)
        state.update(ingestion_result)
        
        invoice_data = state.get("invoice_data")
        
        if invoice_data:
            # Yield ALL extracted data (expanded schema)
            extraction_data = {
                # Header Details
                "invoice_number": invoice_data.get("invoice_number", "UNKNOWN"),
                "invoice_date": invoice_data.get("invoice_date"),
                "due_date": invoice_data.get("due_date"),
                
                # Amounts
                "vendor": invoice_data.get("vendor"),
                "amount": invoice_data.get("amount"),
                "subtotal": invoice_data.get("subtotal"),
                "tax": invoice_data.get("tax", 0.0),
                "currency": invoice_data.get("currency", "USD"),
                
                # Payment Info
                "payment_terms": invoice_data.get("payment_terms"),
                "po_number": invoice_data.get("po_number"),
                
                # Parties
                "bill_from": invoice_data.get("bill_from"),
                "bill_to": invoice_data.get("bill_to"),
                
                # Line Items (with all fields)
                "items": [
                    {
                        "sku": i.get("sku"),
                        "name": i.get("name") or i.get("description"),
                        "description": i.get("description") or i.get("name"),
                        "quantity": i.get("quantity", 1),
                        "unit_price": i.get("unit_price", 0.0),
                        "amount": i.get("amount", 0.0),
                    } 
                    for i in invoice_data.get("items", [])
                ],
                
                # Metadata
                "confidence": invoice_data.get("confidence", 50),
                "flags": invoice_data.get("flags", []),
            }
            
            yield make_event("grok_response", stage="ingestion", data=extraction_data)
            yield token_event("ingestion")
            
            yield log_event("json", f"📤 Grok Response (JSON):")
            yield log_event("json", json.dumps(extraction_data, indent=2))
            
            yield log_event("success", f"✅ Invoice #: {invoice_data.get('invoice_number', 'UNKNOWN')}")
            yield log_event("success", f"✅ Vendor: {invoice_data.get('vendor')}")
            yield log_event("success", f"✅ Amount: ${invoice_data.get('amount', 0):,.2f} {invoice_data.get('currency', 'USD')}")
            yield log_event("success", f"✅ Items: {len(invoice_data.get('items', []))} line item(s)")
            yield log_event("success", f"✅ Due Date: {invoice_data.get('due_date') or 'null'}")
            yield log_event("success", f"📊 Confidence: {invoice_data.get('confidence', 50)}%")
            if invoice_data.get("flags"):
                yield log_event("warning", f"⚠️ Flags: {', '.join(invoice_data.get('flags', []))}")
            
            # Add AI Processing audit event
            ai_processing_event = create_audit_event(
                event_type="ai_processing",
                actor="ai:ingestion",
                title="AI Processing Complete",
                description=f"Data extracted with {invoice_data.get('confidence', 50)}% confidence - {len(invoice_data.get('items', []))} line item(s) detected.",
                details={
                    "confidence": invoice_data.get("confidence", 50),
                    "line_item_count": len(invoice_data.get("items", [])),
                    "extraction_method": "Grok AI",
                    "vendor": invoice_data.get("vendor"),
                    "amount": invoice_data.get("amount"),
                    "flags": invoice_data.get("flags", []),
                },
            )
            state["audit_trail"] = state.get("audit_trail", []) + [ai_processing_event]
            
            yield make_event("stage_complete", stage="ingestion", status="complete", 
                           data=extraction_data, next_stage="validation")
        else:
            yield log_event("error", "❌ Extraction failed")
            yield make_event("stage_complete", stage="ingestion", status="failed")
            yield make_event("error", message="Ingestion failed - no data extracted")
            return
            
    except Exception as e:
        yield log_event("error", f"❌ Ingestion error: {str(e)}")
        yield make_event("stage_complete", stage="ingestion", status="failed")
        yield make_event("error", message=str(e), stage="ingestion")
        return
    
    yield make_event("state_update", state=dict(state))
    yield log_event("state", "📊 LangGraph State Update:")
    yield log_event("state", "   invoice_data: ✓ populated")
    yield log_event("state", '   current_agent: "validation"')
    yield log_event("info", "")
    yield log_event("info", "📄 InvoiceData created → Passing to Validation Agent")
    
    await asyncio.sleep(0.2)
    
    # =========================================================================
    # STAGE 2: VALIDATION
    # =========================================================================
    yield make_event("stage_start", stage="validation", description="Check inventory & business rules")
    yield log_event("system", "")
    yield log_event("system", "═" * 50)
    yield log_event("system", "✅ VALIDATION AGENT (DB + Grok Reasoning)")
    yield log_event("system", "═" * 50)
    
    invoice_data = state.get("invoice_data", {})
    yield log_event("info", f"Vendor: {invoice_data.get('vendor')}")
    yield log_event("info", f"Amount: ${invoice_data.get('amount', 0):,.2f}")
    yield log_event("info", f"Items: {len(invoice_data.get('items', []))} line item(s)")
    yield log_event("info", "")
    yield log_event("info", "🔍 Checking inventory database (SQLite)...")
    
    await asyncio.sleep(0.1)
    
    yield make_event("grok_call", stage="validation", model="grok-4-1-fast-reasoning", mode="json", temperature=0)
    
    # Run validation agent
    try:
        validation_result = validation_agent(state)
        state.update(validation_result)
        
        val_data = state.get("validation_result", {})
        inventory_check = val_data.get("inventory_check", {})
        corrections = val_data.get("corrections", {})
        enrichments = val_data.get("enrichments", {})
        matched_vendor = val_data.get("matched_vendor")
        vendor_profile = val_data.get("vendor_profile")  # Full vendor master record
        
        # Log vendor matching
        if matched_vendor:
            yield log_event("success", f"🏢 Vendor matched: {matched_vendor}")
            if enrichments:
                yield log_event("info", f"   📝 Enriched {len(enrichments)} field(s) from vendor profile:")
                for field, enrich in enrichments.items():
                    yield log_event("success", f"      • {field}: {enrich.get('enriched')}")
        else:
            invoice_vendor = state.get("invoice_data", {}).get("vendor", "Unknown")
            yield log_event("warning", f"🏢 Vendor '{invoice_vendor}' not found in database")
        
        yield log_event("info", "")
        
        # Yield inventory check results
        for item_name, check in inventory_check.items():
            if check.get("available"):
                yield log_event("success", f"   ✅ {item_name}: need {check['requested']}, have {check['in_stock']}")
            else:
                yield log_event("error", f"   ❌ {item_name}: need {check['requested']}, have {check['in_stock']}")
        
        await asyncio.sleep(0.1)
        
        yield log_event("grok", "")
        yield log_event("grok", "🤖 Grok Validation Reasoning:")
        yield log_event("grok", "   Model: grok-4-1-fast-reasoning")
        yield log_event("grok", "   Mode: JSON (structured output)")
        
        validation_json = {
            "is_valid": val_data.get("is_valid"),
            "errors": val_data.get("errors", []),
            "warnings": val_data.get("warnings", []),
            "inventory_check": {k: dict(v) for k, v in inventory_check.items()},
            "corrections": corrections,  # Include field corrections
        }
        
        # Log corrections if any
        if corrections:
            yield log_event("info", "")
            yield log_event("info", f"✏️  Smart Corrections ({len(corrections)} field(s)):")
            for field, correction in corrections.items():
                orig = correction.get("original", "null")
                if orig and len(str(orig)) > 40:
                    orig = str(orig)[:40] + "..."
                yield log_event("warning", f"   {field}: \"{orig}\" → \"{correction.get('corrected')}\"")
                yield log_event("info", f"      Reason: {correction.get('reason', 'Unknown')[:60]}...")
        
        yield make_event("grok_response", stage="validation", data=validation_json)
        yield token_event("validation")
        yield log_event("json", "📤 Grok Response (JSON):")
        yield log_event("json", json.dumps(validation_json, indent=2))
        
        yield make_event("state_update", state=dict(state))
        yield log_event("state", "📊 LangGraph State Update:")
        yield log_event("state", "   validation_result: ✓ populated")
        yield log_event("state", '   current_agent: "approval"')
        
        is_valid = val_data.get("is_valid", False)
        
        # Update status for staged workflow
        state["invoice_status"] = InvoiceStatus.INBOX.value
        state["current_agent"] = "awaiting_routing"
        
        # Add validation complete audit event
        validation_event = create_audit_event(
            event_type="validation_complete",
            actor="ai:validation",
            title="Validation Complete" if is_valid else "Validation Issues Detected",
            description=f"Invoice validation {'passed' if is_valid else 'found issues'} - {len(val_data.get('errors', []))} error(s), {len(val_data.get('warnings', []))} warning(s).",
            details={
                "is_valid": is_valid,
                "errors": val_data.get("errors", []),
                "warnings": val_data.get("warnings", []),
                "corrections_made": len(corrections),
                "vendor_matched": matched_vendor,
            },
        )
        state["audit_trail"] = state.get("audit_trail", []) + [validation_event]
        
        if is_valid:
            yield log_event("success", "")
            yield log_event("success", "   ✅ VALIDATION PASSED")
            yield make_event("stage_complete", stage="validation", status="complete", 
                           data=validation_json, next_stage="inbox")
        else:
            yield log_event("error", "")
            yield log_event("error", "   ❌ VALIDATION FAILED")
            for error in val_data.get("errors", []):
                yield log_event("error", f"      • {error}")
            
            if val_data.get("warnings"):
                yield log_event("warning", "   ⚠️  Warnings:")
                for warning in val_data.get("warnings", []):
                    yield log_event("warning", f"      • {warning}")
            
            yield make_event("stage_complete", stage="validation", status="warning", 
                           data=validation_json, next_stage="inbox")
            
    except Exception as e:
        yield log_event("error", f"❌ Validation error: {str(e)}")
        yield make_event("stage_complete", stage="validation", status="failed")
        yield make_event("error", message=str(e), stage="validation")
        return
    
    # =========================================================================
    # STAGE 1 COMPLETE - INVOICE LANDS IN INBOX
    # =========================================================================
    
    yield log_event("system", "")
    yield log_event("system", "═" * 50)
    yield log_event("system", "📥 STAGE 1 COMPLETE — INVOICE IN INBOX")
    yield log_event("system", "═" * 50)
    yield log_event("info", "")
    yield log_event("info", "Invoice processed and ready for routing.")
    yield log_event("info", "User action required: Route to Approval")
    yield log_event("info", "")
    yield log_event("state", "📊 Invoice Status: INBOX")
    yield log_event("state", "   Next action: Route to Approval Queue")
    
    # Mark approval and payment as pending user action
    yield make_event("stage_complete", stage="approval", status="pending", 
                    data={"message": "Awaiting user to route invoice"})
    yield make_event("stage_complete", stage="payment", status="pending",
                    data={"message": "Awaiting approval"})
    
    # Store invoice for later stages
    invoice_store = get_invoice_store()
    
    # Check if this was a PDF upload (by checking if raw_invoice is a path)
    raw_input = state.get("raw_invoice", "")
    is_pdf = raw_input.strip().endswith('.pdf') or '/uploads/' in raw_input
    
    # Get or preserve existing source info from a previous upload
    existing_entry = invoice_store.get(invoice_id, {})
    source_path = existing_entry.get("source_path") or (raw_input if is_pdf else None)
    original_filename = existing_entry.get("original_filename")
    
    # Get vendor profile from validation result for store
    val_result_for_store = state.get("validation_result", {})
    vendor_profile_for_store = val_result_for_store.get("vendor_profile")
    
    invoice_store[invoice_id] = {
        "id": invoice_id,
        "status": InvoiceStatus.INBOX.value,
        "invoice_data": state.get("invoice_data"),  # Corrected data
        "validation_result": state.get("validation_result"),
        "corrections": corrections,  # Track field corrections
        "workflow_state": dict(state),
        "vendor": state.get("invoice_data", {}).get("vendor"),
        "amount": state.get("invoice_data", {}).get("amount"),
        "created_at": time.time(),
        # Preserve source file info for frontend PDF display
        "source_type": "pdf" if is_pdf else "text",
        "source_path": source_path,
        "original_filename": original_filename,
        # Audit trail (Session 2026-01-28_EXPLAIN)
        "audit_trail": state.get("audit_trail", []),
        # Vendor profile from vendor master (Session 2026-01-28_VENDOR)
        "vendor_profile": vendor_profile_for_store,
    }
    
    # Final event - Stage 1 complete, ready for routing
    processing_time = time.time() - start_time
    total_usage = get_total_usage()
    
    # Get corrections from validation result
    val_result = state.get("validation_result", {})
    corrections = val_result.get("corrections", {})
    
    # Get vendor profile from validation result (Session 2026-01-28_VENDOR)
    val_result = state.get("validation_result", {})
    vendor_profile = val_result.get("vendor_profile")
    
    final_result = {
        "status": "inbox",
        "invoice_id": invoice_id,
        "invoice_status": InvoiceStatus.INBOX.value,
        "invoice_data": state.get("invoice_data"),  # This is now the CORRECTED data
        "validation_result": state.get("validation_result"),
        "corrections": corrections,  # Include corrections for UI highlighting
        "workflow_state": dict(state),
        "token_usage": total_usage,
        "next_action": "route_to_approval",
        "message": "Invoice processed. Route to approval to continue.",
        # Include source file info for frontend PDF display
        "source_type": "pdf" if is_pdf else "text",
        "source_path": source_path,
        "original_filename": original_filename,
        # Audit trail (Session 2026-01-28_EXPLAIN)
        "audit_trail": state.get("audit_trail", []),
        # Vendor profile from vendor master (Session 2026-01-28_VENDOR)
        # Used to populate Vendor Compliance section from authoritative source
        "vendor_profile": vendor_profile,
    }
    
    yield make_event("stage1_complete", 
                    result=final_result, 
                    processing_time=processing_time, 
                    token_usage=total_usage,
                    invoice_id=invoice_id)


# =============================================================================
# STREAMING WORKFLOW - STAGE 2 (Approval)
# =============================================================================

async def process_approval_streaming(invoice_id: str) -> AsyncGenerator[dict, None]:
    """
    STAGE 2: Run approval agent with streaming events.
    
    Called when user routes invoice from Inbox to Approvals.
    """
    start_time = time.time()
    
    invoice_store = get_invoice_store()
    if invoice_id not in invoice_store:
        yield make_event("error", message=f"Invoice {invoice_id} not found")
        return
    
    stored = invoice_store[invoice_id]
    state = stored.get("workflow_state")
    
    if not state:
        yield make_event("error", message="Invoice has no workflow state")
        return
    
    reset_usage_tracking()
    
    yield make_event("stage_start", stage="approval", description="Smart triage analysis")
    yield log_event("system", "═" * 50)
    yield log_event("system", "🤔 APPROVAL AGENT (Smart Triage)")
    yield log_event("system", "═" * 50)
    
    invoice_data = state.get("invoice_data", {})
    val_data = state.get("validation_result", {})
    
    yield log_event("info", f"Vendor: {invoice_data.get('vendor')}")
    yield log_event("info", f"Amount: ${invoice_data.get('amount', 0):,.2f}")
    yield log_event("info", f"Validation: {'PASSED ✓' if val_data.get('is_valid') else 'FAILED ✗'}")
    yield log_event("info", "")
    yield log_event("grok", "🤖 Running smart triage analysis...")
    
    yield make_event("grok_call", stage="approval", model="grok-4-1-fast-reasoning", mode="json", temperature=0)
    
    await asyncio.sleep(0.1)
    
    try:
        approval_result = approval_agent(state)
        state.update(approval_result)
        
        app_data = state.get("approval_decision", {})
        route = app_data.get("route", "route_to_human")
        
        approval_json = {
            "approved": app_data.get("approved"),
            "reason": app_data.get("reason"),
            "requires_review": app_data.get("requires_review"),
            "risk_score": app_data.get("risk_score"),
            "route": route,
            "red_flags": app_data.get("red_flags", []),
            "reasoning_chain": app_data.get("reasoning_chain", []),
            "validation_errors": app_data.get("validation_errors", []),
        }
        
        yield log_event("info", "")
        yield log_event("info", "📋 Reasoning Chain:")
        for step in approval_json.get("reasoning_chain", []):
            await asyncio.sleep(0.1)
            yield log_event("info", f"   → {step}")
        
        # Show validation errors if present (for rejected/human-review invoices)
        if approval_json.get("validation_errors"):
            yield log_event("error", "")
            yield log_event("error", "❌ Validation Errors:")
            for err in approval_json["validation_errors"]:
                yield log_event("error", f"   • {err}")
        
        if approval_json.get("red_flags"):
            yield log_event("warning", "")
            yield log_event("warning", "🚩 Red Flags:")
            for flag in approval_json["red_flags"]:
                yield log_event("warning", f"   • {flag}")
        
        yield make_event("grok_response", stage="approval", data=approval_json)
        yield token_event("approval")
        
        yield log_event("info", "")
        yield log_event("info", f"📊 Risk Score: {app_data.get('risk_score', 0):.2f}")
        
        # Determine new status based on route
        validation_failed = not val_data.get("is_valid")
        
        if route == "auto_approve":
            state["invoice_status"] = InvoiceStatus.AUTO_APPROVED.value
            yield log_event("success", "🟢 AUTO-APPROVED — Skipping human review, ready for payment")
            status_msg = "complete"
            next_stage = "payment"
        elif route == "auto_reject":
            state["invoice_status"] = InvoiceStatus.AUTO_REJECTED.value
            yield log_event("error", "🔴 AUTO-REJECTED — Critical issues detected")
            status_msg = "failed"
            next_stage = "payment_rejection"  # Will trigger Payment Agent to log rejection
        elif route == "route_to_human" and validation_failed:
            # High-value invoice with validation errors → human must decide
            state["invoice_status"] = InvoiceStatus.PENDING_APPROVAL.value
            yield log_event("warning", "🟡 ROUTED TO HUMAN — High-value invoice with validation issues needs review")
            status_msg = "warning"
            next_stage = "human_approval"
        else:
            # Standard high-value invoice (validation passed)
            state["invoice_status"] = InvoiceStatus.PENDING_APPROVAL.value
            yield log_event("warning", "🟡 ROUTED TO HUMAN — High-value invoice needs VP/manager approval")
            status_msg = "warning"
            next_stage = "human_approval"
        
        # Add approval decision audit event
        approval_event = create_audit_event(
            event_type="approval_decision",
            actor="ai:approval",
            title="Approval Decision Made",
            description=f"Invoice {route.replace('_', ' ')} - Risk score: {app_data.get('risk_score', 0):.2f}",
            details={
                "route": route,
                "risk_score": app_data.get("risk_score", 0),
                "recommendation": app_data.get("recommendation"),
                "red_flags": app_data.get("red_flags", []),
                "reasoning": app_data.get("reason"),
            },
            ai_summary=app_data.get("reason"),
        )
        state["audit_trail"] = state.get("audit_trail", []) + [approval_event]
        
        yield make_event("stage_complete", stage="approval", status=status_msg, 
                        data=approval_json, next_stage=next_stage)
        
        # =====================================================================
        # AUTO-REJECTION: Chain Payment Agent to log rejection
        # Session 2026-01-28_EXPLAIN - Payment Agent logs rejections with Grok
        # =====================================================================
        if route == "auto_reject":
            yield log_event("system", "")
            yield log_event("system", "═" * 50)
            yield log_event("system", "💰 PAYMENT AGENT (Rejection Logging)")
            yield log_event("system", "═" * 50)
            
            yield make_event("stage_start", stage="payment", description="Logging rejection with Grok analysis")
            
            invoice_data = state.get("invoice_data", {})
            yield log_event("info", f"Vendor: {invoice_data.get('vendor')}")
            yield log_event("info", f"Amount: ${invoice_data.get('amount', 0):,.2f}")
            yield log_event("info", "Approval Status: REJECTED")
            yield log_event("info", "")
            yield log_event("grok", "🤖 Analyzing rejection with Grok...")
            
            yield make_event("grok_call", stage="payment", model="grok-3-mini", mode="json", temperature=0.1)
            
            await asyncio.sleep(0.2)
            
            # Run Payment Agent to log the rejection
            payment_result = payment_agent(state)
            state.update(payment_result)
            
            pay_data = state.get("payment_result", {})
            
            payment_json = {
                "success": pay_data.get("success"),
                "transaction_id": pay_data.get("transaction_id"),
                "error": pay_data.get("error"),
                "rejection_logged": True,
            }
            
            yield make_event("grok_response", stage="payment", data=payment_json)
            
            # Get the rejection audit event details
            audit_trail = state.get("audit_trail", [])
            rejection_event = next((e for e in reversed(audit_trail) if e.get("event_type") == "payment_rejected"), None)
            
            if rejection_event:
                yield log_event("success", f"📝 Rejection Logged: {rejection_event.get('title', 'Payment Rejected')}")
                yield log_event("info", f"   {rejection_event.get('description', '')}")
                details = rejection_event.get("details", {})
                if details.get("primary_reason"):
                    yield log_event("warning", f"   Primary Reason: {details['primary_reason']}")
                if details.get("contributing_factors"):
                    yield log_event("info", f"   Contributing Factors: {', '.join(details['contributing_factors'])}")
                if details.get("recommendation"):
                    yield log_event("info", f"   Recommendation: {details['recommendation']}")
            else:
                yield log_event("error", f"❌ {pay_data.get('error', 'Invoice not approved')}")
            
            yield make_event("stage_complete", stage="payment", status="failed", data=payment_json)
            
            yield log_event("system", "")
            yield log_event("system", "═" * 50)
            yield log_event("system", "🚫 INVOICE REJECTED — Audit trail recorded")
            yield log_event("system", "═" * 50)
        
        # Update store
        invoice_store[invoice_id]["workflow_state"] = dict(state)
        invoice_store[invoice_id]["status"] = state["invoice_status"]
        invoice_store[invoice_id]["approval_decision"] = app_data
        invoice_store[invoice_id]["audit_trail"] = state.get("audit_trail", [])
        
        processing_time = time.time() - start_time
        total_usage = get_total_usage()
        
        yield make_event("stage2_complete",
                        result={"route": route, "invoice_status": state["invoice_status"], "audit_trail": state.get("audit_trail", [])},
                        processing_time=processing_time,
                        token_usage=total_usage,
                        invoice_id=invoice_id)
        
    except Exception as e:
        yield log_event("error", f"❌ Approval error: {str(e)}")
        yield make_event("error", message=str(e), stage="approval")


# =============================================================================
# STREAMING WORKFLOW - STAGE 3 (Payment)
# =============================================================================

async def process_payment_streaming(
    invoice_id: str,
    approved_by: str = None,
    invoice_status: str = None,
) -> AsyncGenerator[dict, None]:
    """
    STAGE 3: Run payment agent with streaming events.
    
    Called when user executes payment for an approved invoice.
    
    Args:
        invoice_id: ID of the invoice to process payment for
        approved_by: Who approved the invoice (e.g., "human:user@email.com")
        invoice_status: Current invoice status from frontend (e.g., "ready_to_pay")
    """
    start_time = time.time()
    
    invoice_store = get_invoice_store()
    if invoice_id not in invoice_store:
        yield make_event("error", message=f"Invoice {invoice_id} not found")
        return
    
    stored = invoice_store[invoice_id]
    state = stored.get("workflow_state")
    
    if not state:
        yield make_event("error", message="Invoice has no workflow state")
        return
    
    # Ensure we have the latest audit trail from the store
    state["audit_trail"] = stored.get("audit_trail", state.get("audit_trail", []))
    
    # =========================================================================
    # HUMAN APPROVAL: Update state with frontend approval info
    # When human approves on frontend, sync that to backend state
    # =========================================================================
    if approved_by:
        state["approved_by"] = approved_by
        yield log_event("info", f"📝 Approved by: {approved_by}")
        
        # If human approved, update the approval_decision
        if approved_by.startswith("human:"):
            approval_decision = state.get("approval_decision", {})
            approval_decision["approved"] = True
            approval_decision["decided_by"] = approved_by
            state["approval_decision"] = approval_decision
    
    if invoice_status:
        state["invoice_status"] = invoice_status
        yield log_event("info", f"📝 Invoice status: {invoice_status}")
    
    yield make_event("stage_start", stage="payment", description="Execute transaction")
    yield log_event("system", "═" * 50)
    yield log_event("system", "💰 PAYMENT AGENT")
    yield log_event("system", "═" * 50)
    
    invoice_data = state.get("invoice_data", {})
    
    yield log_event("info", f"Vendor: {invoice_data.get('vendor')}")
    yield log_event("info", f"Amount: ${invoice_data.get('amount', 0):,.2f}")
    yield log_event("info", "Approval Status: APPROVED")
    yield log_event("info", "")
    yield log_event("info", "📤 Calling mock payment API...")
    
    state["invoice_status"] = InvoiceStatus.PAYING.value
    
    await asyncio.sleep(0.3)
    
    try:
        payment_result = payment_agent(state)
        state.update(payment_result)
        
        pay_data = state.get("payment_result", {})
        
        payment_json = {
            "success": pay_data.get("success"),
            "transaction_id": pay_data.get("transaction_id"),
            "error": pay_data.get("error")
        }
        
        yield make_event("grok_response", stage="payment", data=payment_json)
        yield log_event("json", json.dumps(payment_json, indent=2))
        
        if pay_data.get("success"):
            state["invoice_status"] = InvoiceStatus.PAID.value
            state["status"] = "completed"
            yield log_event("success", f"✅ Payment successful!")
            yield log_event("success", f"Transaction ID: {pay_data.get('transaction_id')}")
            yield make_event("stage_complete", stage="payment", status="complete", data=payment_json)
        else:
            state["invoice_status"] = InvoiceStatus.PAYMENT_FAILED.value
            state["status"] = "failed"
            yield log_event("error", f"❌ Payment failed: {pay_data.get('error')}")
            yield make_event("stage_complete", stage="payment", status="failed", data=payment_json)
        
        # Update store with audit trail from payment agent
        invoice_store[invoice_id]["workflow_state"] = dict(state)
        invoice_store[invoice_id]["status"] = state["invoice_status"]
        invoice_store[invoice_id]["payment_result"] = pay_data
        invoice_store[invoice_id]["audit_trail"] = state.get("audit_trail", [])
        
        processing_time = time.time() - start_time
        total_usage = get_total_usage()
        
        final_result = {
            "status": state["invoice_status"],
            "invoice_data": state.get("invoice_data"),
            "validation_result": state.get("validation_result"),
            "approval_decision": state.get("approval_decision"),
            "payment_result": pay_data,
            "token_usage": total_usage,
            "audit_trail": state.get("audit_trail", []),
        }
        
        yield make_event("complete", result=final_result, processing_time=processing_time, token_usage=total_usage)
        
    except Exception as e:
        yield log_event("error", f"❌ Payment error: {str(e)}")
        yield make_event("error", message=str(e), stage="payment")

