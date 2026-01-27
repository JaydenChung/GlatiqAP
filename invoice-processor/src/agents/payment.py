"""
Payment Agent
=============
Execute mock payment for approved invoices.

This agent:
1. Takes approved invoice data
2. Calls mock payment API
3. Returns payment result with transaction ID

Session: 2026-01-26_FORGE
Builder: PRAG-001 (The Implementer)
"""

import uuid
from datetime import datetime

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.schemas.models import WorkflowState, PaymentResult


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
# AGENT FUNCTION
# =============================================================================

def payment_agent(state: WorkflowState) -> dict:
    """
    Execute payment for approved invoices.
    
    Args:
        state: WorkflowState containing invoice_data and approval_decision
        
    Returns:
        Dict with payment_result and final status
    """
    print()
    print("=" * 60)
    print("💰 PAYMENT AGENT")
    print("=" * 60)
    
    invoice_data = state.get("invoice_data", {})
    approval_decision = state.get("approval_decision", {})
    
    vendor = invoice_data.get("vendor", "Unknown") if invoice_data else "Unknown"
    amount = invoice_data.get("amount", 0) if invoice_data else 0
    approved = approval_decision.get("approved", False) if approval_decision else False
    
    print(f"   Vendor: {vendor}")
    print(f"   Amount: ${amount:.2f}")
    print(f"   Approval Status: {'APPROVED' if approved else 'NOT APPROVED'}")
    print()
    
    # Safety check: Don't process payment if not approved
    if not approved:
        print("   ❌ Payment blocked: Invoice not approved")
        return {
            "payment_result": {
                "success": False,
                "transaction_id": None,
                "error": "Payment blocked: Invoice was not approved",
            },
            "status": "rejected",
        }
    
    # Execute mock payment
    print("   📤 Calling payment API...")
    payment_response = mock_payment_api(vendor, amount)
    
    if payment_response["success"]:
        print(f"   ✅ Payment successful!")
        print(f"   Transaction ID: {payment_response['transaction_id']}")
        final_status = "completed"
    else:
        print(f"   ❌ Payment failed: {payment_response['error']}")
        final_status = "failed"
    
    payment_result: PaymentResult = {
        "success": payment_response["success"],
        "transaction_id": payment_response["transaction_id"],
        "error": payment_response["error"],
    }
    
    return {
        "payment_result": payment_result,
        "status": final_status,
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
    }
    
    result1 = payment_agent(state1)
    
    # Test Case 2: Not approved
    print("\n" + "─" * 60)
    print("TEST 2: Not Approved (should block)")
    print("─" * 60)
    
    state2: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Gadgets Co.",
            "amount": 15000.0,
            "items": [],
            "due_date": "2026-01-30",
            "raw_text": "test",
        },
        "validation_result": {"is_valid": False, "errors": ["Stock issue"], "warnings": [], "inventory_check": {}},
        "approval_decision": {
            "approved": False,
            "reason": "Validation failed",
            "requires_review": False,
            "risk_score": 0.9,
        },
        "payment_result": None,
        "current_agent": "payment",
        "status": "processing",
        "error": None,
    }
    
    result2 = payment_agent(state2)
    
    # Test Case 3: Fraud vendor
    print("\n" + "─" * 60)
    print("TEST 3: Fraudster Vendor (should block at API level)")
    print("─" * 60)
    
    state3: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Fraudster LLC",
            "amount": 100000.0,
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
    }
    
    result3 = payment_agent(state3)
    
    print("\n" + "═" * 60)
    print(f"Test 1 (normal): success = {result1['payment_result']['success']}")
    print(f"Test 2 (denied): success = {result2['payment_result']['success']}")
    print(f"Test 3 (fraud):  success = {result3['payment_result']['success']}")
    print("═" * 60)
