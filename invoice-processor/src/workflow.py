"""
Invoice Processing Workflow
===========================
LangGraph StateGraph orchestrating the multi-agent invoice processing pipeline.

STAGED WORKFLOW (Session 2026-01-27_WORKFLOW):
    
    STAGE 1: Upload → Ingestion → Validation → INBOX
    STAGE 2: Route to Approval → Approval Agent triage → PENDING_APPROVAL or AUTO_APPROVED  
    STAGE 3: Execute Payment → Payment Agent → PAID

Each stage is triggered separately, matching real AP workflow:
- Stage 1: Automatic on upload
- Stage 2: Triggered when user routes invoice to approval
- Stage 3: Triggered when user executes payment (after human approval)

Legacy single-pipeline flow is preserved for backward compatibility.

Updated: Session 2026-01-27_WORKFLOW
"""

from langgraph.graph import StateGraph, END
from typing import Literal, Optional
from datetime import datetime

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.schemas.models import (
    WorkflowState, 
    InvoiceStatus,
    ApprovalAnalysis,
    ApprovalDecision,
    APPROVAL_THRESHOLDS,
)

# Import REAL agents (Phase 2)
from src.agents.ingestion import ingestion_agent
from src.agents.validation import validation_agent
from src.agents.approval import approval_agent
from src.agents.payment import payment_agent


# =============================================================================
# ROUTING FUNCTIONS (for conditional edges)
# =============================================================================

def route_after_validation(state: WorkflowState) -> Literal["approval", "rejected"]:
    """Route based on validation result."""
    validation = state.get("validation_result")
    if validation and validation.get("is_valid"):
        return "approval"
    return "rejected"


def route_after_approval(state: WorkflowState) -> Literal["payment", "rejected"]:
    """Route based on approval decision."""
    approval = state.get("approval_decision")
    if approval and approval.get("approved"):
        return "payment"
    return "rejected"


def handle_rejection(state: WorkflowState) -> dict:
    """Handle rejected invoices (validation or approval failure)."""
    print()
    print("=" * 60)
    print("❌ INVOICE REJECTED")
    print("=" * 60)
    
    # Determine rejection reason
    validation = state.get("validation_result", {})
    approval = state.get("approval_decision", {})
    
    if not validation.get("is_valid", True):
        reason = f"Validation failed: {validation.get('errors', ['Unknown'])}"
    elif not approval.get("approved", True):
        reason = f"Approval denied: {approval.get('reason', 'Unknown')}"
    else:
        reason = "Unknown rejection reason"
    
    print(f"   Reason: {reason}")
    print()
    
    return {"status": "rejected"}


# =============================================================================
# WORKFLOW GRAPH
# =============================================================================

def create_workflow() -> StateGraph:
    """
    Create and compile the invoice processing workflow.
    
    Returns a compiled LangGraph that can be invoked with initial state.
    """
    # Initialize the state graph with our state schema
    workflow = StateGraph(WorkflowState)
    
    # Add all agent nodes
    workflow.add_node("ingestion", ingestion_agent)
    workflow.add_node("validation", validation_agent)
    workflow.add_node("approval", approval_agent)
    workflow.add_node("payment", payment_agent)
    workflow.add_node("rejected", handle_rejection)
    
    # Set the entry point
    workflow.set_entry_point("ingestion")
    
    # Add edges
    # Ingestion always goes to validation
    workflow.add_edge("ingestion", "validation")
    
    # Validation conditionally routes
    workflow.add_conditional_edges(
        "validation",
        route_after_validation,
        {
            "approval": "approval",
            "rejected": "rejected",
        }
    )
    
    # Approval conditionally routes
    workflow.add_conditional_edges(
        "approval",
        route_after_approval,
        {
            "payment": "payment",
            "rejected": "rejected",
        }
    )
    
    # Terminal nodes
    workflow.add_edge("payment", END)
    workflow.add_edge("rejected", END)
    
    # Compile and return
    return workflow.compile()


# =============================================================================
# MAIN ENTRY POINT (Legacy - runs full pipeline)
# =============================================================================

def process_invoice(raw_invoice: str) -> WorkflowState:
    """
    Process a single invoice through the FULL workflow.
    
    LEGACY: This runs all 4 agents in sequence. For staged processing,
    use the individual stage functions below.
    
    Args:
        raw_invoice: Raw invoice text to process
        
    Returns:
        Final workflow state with all agent outputs
    """
    # Create initial state
    initial_state: WorkflowState = {
        "raw_invoice": raw_invoice,
        "invoice_data": None,
        "validation_result": None,
        "approval_analysis": None,
        "approval_decision": None,
        "payment_result": None,
        "invoice_status": InvoiceStatus.UPLOADED.value,
        "current_agent": "ingestion",
        "status": "processing",
        "error": None,
        "approved_by": None,
        "approved_at": None,
        "rejected_by": None,
        "rejected_at": None,
        "rejection_reason": None,
    }
    
    # Create and run workflow
    app = create_workflow()
    final_state = app.invoke(initial_state)
    
    return final_state


# =============================================================================
# STAGED WORKFLOW FUNCTIONS (Session 2026-01-27_WORKFLOW)
# =============================================================================

def run_ingestion_workflow(raw_invoice: str) -> WorkflowState:
    """
    STAGE 1: Ingestion + Validation
    
    Runs on invoice upload. Extracts data and validates against inventory.
    Invoice lands in INBOX (or VALIDATION_FAILED).
    
    Args:
        raw_invoice: Raw invoice text to process
        
    Returns:
        WorkflowState with invoice_data, validation_result, and invoice_status
    """
    # Create initial state
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
    }
    
    # Run ingestion agent
    ingestion_result = ingestion_agent(state)
    state.update(ingestion_result)
    
    if not state.get("invoice_data"):
        state["invoice_status"] = InvoiceStatus.VALIDATION_FAILED.value
        state["status"] = "failed"
        state["error"] = "Ingestion failed - could not extract invoice data"
        return state
    
    # Run validation agent
    state["invoice_status"] = InvoiceStatus.VALIDATING.value
    state["current_agent"] = "validation"
    
    validation_result = validation_agent(state)
    state.update(validation_result)
    
    # Determine final status
    validation = state.get("validation_result", {})
    if validation.get("is_valid"):
        state["invoice_status"] = InvoiceStatus.INBOX.value
        state["current_agent"] = "awaiting_routing"
    else:
        # Even if validation fails, put in inbox for human review
        # Human can decide to route or reject
        state["invoice_status"] = InvoiceStatus.INBOX.value
        state["current_agent"] = "awaiting_routing"
    
    state["status"] = "processing"  # Still processing, awaiting next stage
    
    return state


def run_approval_workflow(state: WorkflowState) -> WorkflowState:
    """
    STAGE 2: Approval Triage
    
    Called when user routes invoice to approval. The Approval Agent:
    - Auto-approves if <$10K AND no red flags
    - Routes to human approval queue if ≥$10K OR has flags
    - Auto-rejects if major red flags (fraud indicators)
    
    Args:
        state: WorkflowState from Stage 1 (must have invoice_data and validation_result)
        
    Returns:
        Updated WorkflowState with approval_analysis and new invoice_status
    """
    if not state.get("invoice_data"):
        state["error"] = "Cannot run approval - no invoice data"
        state["invoice_status"] = InvoiceStatus.VALIDATION_FAILED.value
        return state
    
    state["current_agent"] = "approval"
    
    # Run approval agent (which now does smart triage)
    approval_result = approval_agent(state)
    state.update(approval_result)
    
    # Get the approval analysis
    approval_decision = state.get("approval_decision", {})
    amount = state.get("invoice_data", {}).get("amount", 0)
    validation = state.get("validation_result", {})
    
    # Smart triage logic based on Human Director's requirements:
    # - <$10K AND no flags AND valid → Auto-approve
    # - ≥$10K OR flags → Route to human
    # - Major red flags (fraud) → Auto-reject
    
    risk_score = approval_decision.get("risk_score", 0.5)
    is_valid = validation.get("is_valid", False)
    
    # Check for auto-reject conditions (major red flags)
    if risk_score >= 0.8 or not is_valid:
        state["invoice_status"] = InvoiceStatus.AUTO_REJECTED.value
        state["rejected_by"] = "agent"
        state["rejected_at"] = datetime.utcnow().isoformat()
        state["rejection_reason"] = approval_decision.get("reason", "High risk or validation failure")
        state["status"] = "rejected"
        
    # Check for auto-approve conditions
    elif amount < APPROVAL_THRESHOLDS["auto_approve_max"] and risk_score < 0.3 and is_valid:
        state["invoice_status"] = InvoiceStatus.AUTO_APPROVED.value
        state["approved_by"] = "agent"
        state["approved_at"] = datetime.utcnow().isoformat()
        # Create final approval decision for auto-approved
        state["approval_decision"] = {
            **approval_decision,
            "approved": True,
            "decided_by": "agent",
            "decided_at": datetime.utcnow().isoformat(),
        }
        
    # Route to human approval
    else:
        state["invoice_status"] = InvoiceStatus.PENDING_APPROVAL.value
        # approval_decision contains agent's recommendation, human will make final call
    
    state["current_agent"] = "awaiting_decision"
    
    return state


def human_approve(state: WorkflowState, approver: str, notes: Optional[str] = None) -> WorkflowState:
    """
    Record human approval decision.
    
    Called when a human approver clicks "Approve" in the UI.
    
    Args:
        state: WorkflowState with invoice in PENDING_APPROVAL
        approver: Identifier of human approver (email, name, etc.)
        notes: Optional approval notes
        
    Returns:
        Updated WorkflowState with APPROVED status
    """
    if state.get("invoice_status") != InvoiceStatus.PENDING_APPROVAL.value:
        state["error"] = f"Cannot approve - invoice status is {state.get('invoice_status')}"
        return state
    
    state["invoice_status"] = InvoiceStatus.APPROVED.value
    state["approved_by"] = f"human:{approver}"
    state["approved_at"] = datetime.utcnow().isoformat()
    
    # Update approval decision to reflect human decision
    existing_analysis = state.get("approval_decision", {})
    state["approval_decision"] = {
        **existing_analysis,
        "approved": True,
        "reason": notes or existing_analysis.get("reason", "Approved by human reviewer"),
        "decided_by": f"human:{approver}",
        "decided_at": datetime.utcnow().isoformat(),
    }
    
    state["current_agent"] = "awaiting_payment"
    
    return state


def human_reject(state: WorkflowState, rejector: str, reason: str) -> WorkflowState:
    """
    Record human rejection decision.
    
    Called when a human approver clicks "Reject" in the UI.
    
    Args:
        state: WorkflowState with invoice in PENDING_APPROVAL
        rejector: Identifier of human who rejected
        reason: Reason for rejection
        
    Returns:
        Updated WorkflowState with REJECTED status
    """
    if state.get("invoice_status") != InvoiceStatus.PENDING_APPROVAL.value:
        state["error"] = f"Cannot reject - invoice status is {state.get('invoice_status')}"
        return state
    
    state["invoice_status"] = InvoiceStatus.REJECTED.value
    state["rejected_by"] = f"human:{rejector}"
    state["rejected_at"] = datetime.utcnow().isoformat()
    state["rejection_reason"] = reason
    state["status"] = "rejected"
    
    # Update approval decision
    existing_analysis = state.get("approval_decision", {})
    state["approval_decision"] = {
        **existing_analysis,
        "approved": False,
        "reason": reason,
        "decided_by": f"human:{rejector}",
        "decided_at": datetime.utcnow().isoformat(),
    }
    
    state["current_agent"] = "END"
    
    return state


def run_payment_workflow(state: WorkflowState) -> WorkflowState:
    """
    STAGE 3: Payment Execution
    
    Called when user triggers payment for an approved invoice.
    Invoice must be APPROVED or AUTO_APPROVED.
    
    Args:
        state: WorkflowState with approved invoice
        
    Returns:
        Updated WorkflowState with payment_result and PAID status
    """
    valid_statuses = [InvoiceStatus.APPROVED.value, InvoiceStatus.AUTO_APPROVED.value, 
                     InvoiceStatus.READY_TO_PAY.value]
    
    if state.get("invoice_status") not in valid_statuses:
        state["error"] = f"Cannot process payment - invoice status is {state.get('invoice_status')}"
        return state
    
    state["invoice_status"] = InvoiceStatus.PAYING.value
    state["current_agent"] = "payment"
    
    # Run payment agent
    payment_result = payment_agent(state)
    state.update(payment_result)
    
    # Check result
    payment = state.get("payment_result", {})
    if payment.get("success"):
        state["invoice_status"] = InvoiceStatus.PAID.value
        state["status"] = "completed"
    else:
        state["invoice_status"] = InvoiceStatus.PAYMENT_FAILED.value
        state["status"] = "failed"
        state["error"] = payment.get("error", "Payment failed")
    
    state["current_agent"] = "END"
    
    return state


# When run directly, test with Invoice 1 (clean, happy path)
if __name__ == "__main__":
    # Ensure database is initialized
    from src.tools.database import init_database
    init_database()
    
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  INVOICE PROCESSING - PHASE 2 (GROK-POWERED)".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    
    # Test Invoice 1 - Clean, should succeed
    test_invoice = """
Vendor: Widgets Inc.
Amount: 5000
Items: WidgetA:10, WidgetB:5
Due: 2026-02-01
"""
    
    print(f"\n📄 Test Invoice (Clean - Should Succeed):\n{test_invoice}")
    print("\n" + "─" * 60)
    print("🚀 Starting Grok-powered workflow...")
    print("─" * 60)
    
    # Run workflow
    result = process_invoice(test_invoice)
    
    # Print comprehensive summary
    print()
    print("═" * 60)
    print("📊 WORKFLOW COMPLETE - SUMMARY")
    print("═" * 60)
    print(f"   Final Status: {result.get('status', 'unknown')}")
    
    if result.get("invoice_data"):
        inv = result["invoice_data"]
        print(f"   Vendor: {inv.get('vendor', 'N/A')}")
        print(f"   Amount: ${inv.get('amount', 0):.2f}")
    
    if result.get("validation_result"):
        val = result["validation_result"]
        print(f"   Validation: {'✅ PASSED' if val.get('is_valid') else '❌ FAILED'}")
    
    if result.get("approval_decision"):
        app = result["approval_decision"]
        print(f"   Approval: {'✅ APPROVED' if app.get('approved') else '❌ REJECTED'}")
        print(f"   Risk Score: {app.get('risk_score', 0):.2f}")
    
    if result.get("payment_result"):
        pay = result["payment_result"]
        if pay.get("success"):
            print(f"   Payment: ✅ SUCCESS")
            print(f"   Transaction ID: {pay.get('transaction_id', 'N/A')}")
        else:
            print(f"   Payment: ❌ FAILED - {pay.get('error', 'Unknown')}")
    
    print()
    if result.get("status") == "completed":
        print("🎉 PHASE 2 CHECKPOINT PASSED: End-to-end happy path works!")
    else:
        print(f"⚠️ Workflow ended with status: {result.get('status')}")
    print("═" * 60)
