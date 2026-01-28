"""
Payment Agent
=============
Execute mock payment for approved invoices OR log rejections with Grok analysis.

This agent:
1. Takes approved invoice data → Calls mock payment API → Returns payment result
2. Takes rejected invoice data → Uses Grok to analyze rejection → Logs audit event

Session: 2026-01-26_FORGE (original)
Updated: 2026-01-28_EXPLAIN (Grok rejection logging + audit trail)
Builder: PRAG-001 (The Implementer)
"""

import uuid
import json
from datetime import datetime
from typing import Optional

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.schemas.models import WorkflowState, PaymentResult, AuditEvent
from src.client import call_grok
from src.utils import clean_json_response


# =============================================================================
# MOCK PAYMENT API
# =============================================================================

def mock_payment_api(vendor: str, amount: float) -> dict:
    """
    Simulate a payment API call.
    
    In production, this would call an actual payment gateway.
    For MVP, we simulate success/failure based on simple rules.
    
    Args:
        vendor: Vendor name to pay
        amount: Amount to pay
        
    Returns:
        Dict with payment response
    """
    # Simulate some failure cases for testing
    if "Fraudster" in vendor:
        return {
            "success": False,
            "transaction_id": None,
            "error": "Payment blocked: Vendor on fraud watchlist"
        }
    
    if amount > 50000:
        return {
            "success": False,
            "transaction_id": None,
            "error": "Payment blocked: Amount exceeds single transaction limit"
        }
    
    # Normal successful payment
    transaction_id = f"TXN-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:8].upper()}"
    
    return {
        "success": True,
        "transaction_id": transaction_id,
        "error": None
    }


# =============================================================================
# GROK-POWERED REJECTION ANALYSIS
# =============================================================================

REJECTION_ANALYSIS_PROMPT = """You are an AP (Accounts Payable) system analyzing why an invoice payment was blocked.

Given the following invoice data and approval decision, generate a clear, professional audit log entry explaining why the payment was rejected.

INVOICE DATA:
- Vendor: {vendor}
- Amount: ${amount:,.2f}
- Invoice Number: {invoice_number}
- Due Date: {due_date}

APPROVAL DECISION:
- Approved: {approved}
- Reason: {approval_reason}
- Risk Score: {risk_score}
- Red Flags: {red_flags}

VALIDATION RESULT:
- Valid: {validation_valid}
- Errors: {validation_errors}
- Warnings: {validation_warnings}

Generate a JSON response with:
{{
    "title": "Brief title for the audit log (max 50 chars)",
    "description": "Clear 1-2 sentence explanation of why payment was blocked",
    "details": {{
        "primary_reason": "The main reason payment was blocked",
        "contributing_factors": ["list", "of", "contributing", "factors"],
        "recommendation": "What action should be taken (e.g., review vendor, request approval)"
    }},
    "severity": "critical" | "high" | "medium" | "low"
}}

Be specific and actionable. Reference the actual data provided."""


def analyze_rejection_with_grok(
    invoice_data: dict,
    approval_decision: dict,
    validation_result: dict
) -> dict:
    """
    Use Grok to analyze why a payment was rejected and generate audit log.
    
    Args:
        invoice_data: Extracted invoice data
        approval_decision: The approval agent's decision
        validation_result: The validation agent's result
        
    Returns:
        Dict with title, description, details for audit log
    """
    prompt = REJECTION_ANALYSIS_PROMPT.format(
        vendor=invoice_data.get("vendor", "Unknown"),
        amount=invoice_data.get("amount", 0),
        invoice_number=invoice_data.get("invoice_number", "Unknown"),
        due_date=invoice_data.get("due_date", "Not specified"),
        approved=approval_decision.get("approved", False),
        approval_reason=approval_decision.get("reason", "No reason provided"),
        risk_score=approval_decision.get("risk_score", 0),
        red_flags=", ".join(approval_decision.get("red_flags", [])) or "None",
        validation_valid=validation_result.get("is_valid", False),
        validation_errors=", ".join(validation_result.get("errors", [])) or "None",
        validation_warnings=", ".join(validation_result.get("warnings", [])) or "None",
    )
    
    try:
        response = call_grok(
            system_message="You are an AP audit system. Generate clear, professional audit logs.",
            user_message=prompt,
            model="grok-3-mini",  # Use faster model for audit logs
            temperature=0.1,
            json_mode=True,
        )
        
        cleaned = clean_json_response(response)
        return json.loads(cleaned)
    except Exception as e:
        # Fallback if Grok fails
        print(f"   ⚠️ Grok analysis failed, using fallback: {e}")
        return {
            "title": "Payment Rejected",
            "description": f"Invoice from {invoice_data.get('vendor', 'Unknown')} was not approved for payment. {approval_decision.get('reason', 'See approval decision for details.')}",
            "details": {
                "primary_reason": approval_decision.get("reason", "Invoice not approved"),
                "contributing_factors": approval_decision.get("red_flags", []),
                "recommendation": "Review the approval decision and address any issues before resubmitting."
            },
            "severity": "high" if approval_decision.get("risk_score", 0) > 0.5 else "medium"
        }


def create_audit_event(
    event_type: str,
    actor: str,
    title: str,
    description: str,
    details: Optional[dict] = None,
    ai_summary: Optional[str] = None
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
# AGENT FUNCTION
# =============================================================================

def payment_agent(state: WorkflowState) -> dict:
    """
    Execute payment for approved invoices OR log rejection for unapproved ones.
    
    Approval can come from:
    1. AI auto-approve: approval_decision.approved = True
    2. Human approval: approved_by starts with "human:" OR invoice_status is approved/ready_to_pay
    
    Args:
        state: WorkflowState containing invoice_data and approval_decision
        
    Returns:
        Dict with payment_result, final status, and audit_trail events
    """
    print()
    print("=" * 60)
    print("💰 PAYMENT AGENT")
    print("=" * 60)
    
    invoice_data = state.get("invoice_data", {})
    approval_decision = state.get("approval_decision", {})
    validation_result = state.get("validation_result", {})
    existing_audit_trail = state.get("audit_trail", []) or []
    
    vendor = invoice_data.get("vendor", "Unknown") if invoice_data else "Unknown"
    amount = invoice_data.get("amount", 0) if invoice_data else 0
    invoice_number = invoice_data.get("invoice_number", "Unknown") if invoice_data else "Unknown"
    
    # Check for approval from multiple sources:
    # 1. AI auto-approved
    ai_approved = approval_decision.get("approved", False) if approval_decision else False
    
    # 2. Human approved (approved_by field set)
    approved_by = state.get("approved_by", "")
    human_approved = approved_by.startswith("human:") if approved_by else False
    
    # 3. Invoice status indicates approval
    invoice_status = state.get("invoice_status", "")
    status_approved = invoice_status in ["approved", "ready_to_pay", "auto_approved", "paying"]
    
    # Invoice is considered approved if ANY of these conditions are true
    approved = ai_approved or human_approved or status_approved
    
    # Debug logging
    print(f"   Approval Check:")
    print(f"      AI Approved: {ai_approved}")
    print(f"      Human Approved: {human_approved} (by: {approved_by or 'N/A'})")
    print(f"      Status Approved: {status_approved} (status: {invoice_status})")
    print(f"      → Final: {'APPROVED' if approved else 'NOT APPROVED'}")
    
    print(f"   Vendor: {vendor}")
    print(f"   Amount: ${amount:.2f}")
    print(f"   Approval Status: {'APPROVED' if approved else 'NOT APPROVED'}")
    print()
    
    # Initialize audit trail for this agent
    audit_events = []
    
    # Safety check: Don't process payment if not approved
    if not approved:
        print("   ❌ Payment blocked: Invoice not approved")
        print("   🤖 Analyzing rejection with Grok...")
        
        # Use Grok to analyze the rejection and create meaningful log
        rejection_analysis = analyze_rejection_with_grok(
            invoice_data or {},
            approval_decision or {},
            validation_result or {}
        )
        
        print(f"   📝 Audit Log: {rejection_analysis.get('title', 'Payment Rejected')}")
        
        # Create audit event for the rejection
        rejection_event = create_audit_event(
            event_type="payment_rejected",
            actor="ai:payment",
            title=rejection_analysis.get("title", "Payment Rejected"),
            description=rejection_analysis.get("description", "Invoice was not approved for payment."),
            details={
                **rejection_analysis.get("details", {}),
                "vendor": vendor,
                "amount": amount,
                "invoice_number": invoice_number,
                "approval_reason": approval_decision.get("reason", "Unknown"),
                "risk_score": approval_decision.get("risk_score", 0),
                "severity": rejection_analysis.get("severity", "medium"),
            },
            ai_summary=rejection_analysis.get("description"),
        )
        audit_events.append(rejection_event)
        
        return {
            "payment_result": {
                "success": False,
                "transaction_id": None,
                "error": "Payment blocked: Invoice was not approved",
            },
            "status": "rejected",
            "audit_trail": existing_audit_trail + audit_events,
        }
    
    # Invoice is approved - proceed with payment
    print("   📤 Calling payment API...")
    
    # Determine approval source for audit trail
    if human_approved:
        approval_source = f"Human ({approved_by.replace('human:', '')})"
    elif ai_approved:
        approval_source = "AI Auto-Approved"
    else:
        approval_source = f"Status: {invoice_status}"
    
    # Create audit event for payment initiation
    initiation_event = create_audit_event(
        event_type="payment_initiated",
        actor="ai:payment",
        title="Payment Processing Started",
        description=f"Initiating payment of ${amount:,.2f} to {vendor}. Approved by: {approval_source}",
        details={
            "vendor": vendor,
            "amount": amount,
            "invoice_number": invoice_number,
            "approval_source": approval_source,
        },
    )
    audit_events.append(initiation_event)
    
    # Execute mock payment
    payment_response = mock_payment_api(vendor, amount)
    
    if payment_response["success"]:
        print(f"   ✅ Payment successful!")
        print(f"   Transaction ID: {payment_response['transaction_id']}")
        final_status = "completed"
        
        # Create audit event for successful payment
        success_event = create_audit_event(
            event_type="payment_complete",
            actor="ai:payment",
            title="Payment Completed Successfully",
            description=f"Payment of ${amount:,.2f} to {vendor} completed. Transaction ID: {payment_response['transaction_id']}",
            details={
                "vendor": vendor,
                "amount": amount,
                "invoice_number": invoice_number,
                "transaction_id": payment_response["transaction_id"],
            },
        )
        audit_events.append(success_event)
    else:
        print(f"   ❌ Payment failed: {payment_response['error']}")
        final_status = "failed"
        
        # Create audit event for failed payment (API error, not rejection)
        failure_event = create_audit_event(
            event_type="payment_failed",
            actor="ai:payment",
            title="Payment Failed",
            description=f"Payment to {vendor} failed: {payment_response['error']}",
            details={
                "vendor": vendor,
                "amount": amount,
                "invoice_number": invoice_number,
                "error": payment_response["error"],
            },
        )
        audit_events.append(failure_event)
    
    payment_result: PaymentResult = {
        "success": payment_response["success"],
        "transaction_id": payment_response["transaction_id"],
        "error": payment_response["error"],
    }
    
    return {
        "payment_result": payment_result,
        "status": final_status,
        "audit_trail": existing_audit_trail + audit_events,
    }


# =============================================================================
# STANDALONE TEST
# =============================================================================

if __name__ == "__main__":
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  PAYMENT AGENT - STANDALONE TEST".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    
    # Test Case 1: Approved invoice
    print("\n" + "─" * 60)
    print("TEST 1: Approved Invoice (should succeed)")
    print("─" * 60)
    
    state1: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Widgets Inc.",
            "amount": 5000.0,
            "invoice_number": "INV-2026-001",
            "items": [],
            "due_date": "2026-02-01",
            "raw_text": "test",
        },
        "validation_result": {"is_valid": True, "errors": [], "warnings": [], "inventory_check": {}},
        "approval_decision": {
            "approved": True,
            "reason": "Standard invoice approved",
            "requires_review": False,
            "risk_score": 0.1,
        },
        "payment_result": None,
        "current_agent": "payment",
        "status": "processing",
        "error": None,
        "audit_trail": [],
    }
    
    result1 = payment_agent(state1)
    print(f"\nAudit Trail Events: {len(result1.get('audit_trail', []))}")
    for event in result1.get('audit_trail', []):
        print(f"  - {event['event_type']}: {event['title']}")
    
    # Test Case 2: Not approved (should trigger Grok analysis)
    print("\n" + "─" * 60)
    print("TEST 2: Not Approved (should block and log with Grok)")
    print("─" * 60)
    
    state2: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Gadgets Co.",
            "amount": 15000.0,
            "invoice_number": "INV-2026-002",
            "items": [],
            "due_date": "2026-01-30",
            "raw_text": "test",
        },
        "validation_result": {"is_valid": False, "errors": ["Insufficient stock for WidgetA"], "warnings": [], "inventory_check": {}},
        "approval_decision": {
            "approved": False,
            "reason": "Validation failed: Insufficient stock for ordered items",
            "requires_review": False,
            "risk_score": 0.9,
            "red_flags": ["Stock shortage", "High risk score"],
        },
        "payment_result": None,
        "current_agent": "payment",
        "status": "processing",
        "error": None,
        "audit_trail": [],
    }
    
    result2 = payment_agent(state2)
    print(f"\nAudit Trail Events: {len(result2.get('audit_trail', []))}")
    for event in result2.get('audit_trail', []):
        print(f"  - {event['event_type']}: {event['title']}")
        print(f"    {event['description']}")
    
    # Test Case 3: Fraud vendor (approved but payment blocked)
    print("\n" + "─" * 60)
    print("TEST 3: Fraudster Vendor (should block at API level)")
    print("─" * 60)
    
    state3: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Fraudster LLC",
            "amount": 100000.0,
            "invoice_number": "INV-2026-003",
            "items": [],
            "due_date": None,
            "raw_text": "test",
        },
        "validation_result": {"is_valid": True, "errors": [], "warnings": [], "inventory_check": {}},
        "approval_decision": {
            "approved": True,  # Assume somehow approved
            "reason": "Test",
            "requires_review": False,
            "risk_score": 0.1,
        },
        "payment_result": None,
        "current_agent": "payment",
        "status": "processing",
        "error": None,
        "audit_trail": [],
    }
    
    result3 = payment_agent(state3)
    print(f"\nAudit Trail Events: {len(result3.get('audit_trail', []))}")
    for event in result3.get('audit_trail', []):
        print(f"  - {event['event_type']}: {event['title']}")
    
    print("\n" + "═" * 60)
    print(f"Test 1 (normal): success = {result1['payment_result']['success']}")
    print(f"Test 2 (denied): success = {result2['payment_result']['success']}")
    print(f"Test 3 (fraud):  success = {result3['payment_result']['success']}")
    print("═" * 60)
