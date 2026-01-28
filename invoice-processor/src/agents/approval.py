"""
Approval Agent
==============
Simple rule-based triage of invoices for approval routing.

Three-flow decision logic:
1. Validation FAILED → AUTO-REJECT
2. Amount ≥ $10,000 → ROUTE TO HUMAN (VP/manager reviews)
3. Amount < $10,000 AND validation PASSED → AUTO-APPROVE

Session: 2026-01-26_FORGE (original)
Updated: 2026-01-27_WORKFLOW (smart triage)
Simplified: 2026-01-27 (removed risk scoring, focused on core rules)
"""

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.schemas.models import WorkflowState, ApprovalDecision, APPROVAL_THRESHOLDS


# =============================================================================
# AGENT FUNCTION
# =============================================================================

def approval_agent(state: WorkflowState) -> dict:
    """
    Simple rule-based triage of invoices.
    
    Three-flow logic:
    1. Validation FAILED → AUTO-REJECT
    2. Amount >= $10,000 → ROUTE TO HUMAN
    3. Amount < $10,000 AND validation PASSED → AUTO-APPROVE
    
    Args:
        state: WorkflowState containing invoice_data and validation_result
        
    Returns:
        Dict with approval_decision (including route)
    """
    print()
    print("=" * 60)
    print("🤔 APPROVAL AGENT (Rule-Based Triage)")
    print("=" * 60)
    
    invoice_data = state.get("invoice_data") or {}
    validation_result = state.get("validation_result") or {}
    
    # Extract invoice details with defaults
    vendor = invoice_data.get("vendor", "UNKNOWN")
    amount = invoice_data.get("amount", 0.0)
    
    # Extract validation details
    validation_passed = validation_result.get("is_valid", False)
    validation_errors = validation_result.get("errors", [])
    
    threshold = APPROVAL_THRESHOLDS["auto_approve_max"]
    
    print(f"   Vendor: {vendor}")
    print(f"   Amount: ${amount:,.2f}")
    print(f"   Validation: {'PASSED ✓' if validation_passed else 'FAILED ✗'}")
    print(f"   Threshold: ${threshold:,} (auto-approve max)")
    print()
    
    # =================================================================
    # SIMPLE THREE-FLOW DECISION LOGIC
    # =================================================================
    
    reasoning_chain = []
    
    # Flow 1: Validation failed → AUTO-REJECT
    if not validation_passed:
        approved = False
        reason = f"Validation failed with {len(validation_errors)} error(s). Cannot process."
        requires_review = False
        route = "auto_reject"
        reasoning_chain = [
            f"Validation: FAILED ✗ ({len(validation_errors)} errors)",
            "Result: AUTO-REJECT (validation must pass)"
        ]
        print("   📋 Decision Flow:")
        print(f"      → Validation: FAILED ✗")
        print(f"      → Result: AUTO-REJECT")
    
    # Flow 2: Amount >= threshold → ROUTE TO HUMAN
    elif amount >= threshold:
        approved = True  # Recommend approval
        reason = f"Invoice ${amount:,.2f} >= ${threshold:,} requires human VP approval."
        requires_review = True
        route = "route_to_human"
        reasoning_chain = [
            "Validation: PASSED ✓",
            f"Amount: ${amount:,.2f} >= ${threshold:,} threshold",
            "Result: ROUTE TO HUMAN for approval"
        ]
        print("   📋 Decision Flow:")
        print(f"      → Validation: PASSED ✓")
        print(f"      → Amount: ${amount:,.2f} >= ${threshold:,}")
        print(f"      → Result: ROUTE TO HUMAN")
    
    # Flow 3: Valid + under threshold → AUTO-APPROVE
    else:
        approved = True
        reason = f"Invoice ${amount:,.2f} < ${threshold:,} with passed validation. Auto-approved."
        requires_review = False
        route = "auto_approve"
        reasoning_chain = [
            "Validation: PASSED ✓",
            f"Amount: ${amount:,.2f} < ${threshold:,} threshold",
            "Result: AUTO-APPROVE"
        ]
        print("   📋 Decision Flow:")
        print(f"      → Validation: PASSED ✓")
        print(f"      → Amount: ${amount:,.2f} < ${threshold:,}")
        print(f"      → Result: AUTO-APPROVE")
    
    print()
    
    # Display routing decision
    route_display = {
        "auto_approve": "🟢 AUTO-APPROVE (skip human, go to payment)",
        "route_to_human": "🟡 ROUTE TO HUMAN (needs VP/manager approval)",
        "auto_reject": "🔴 AUTO-REJECT (validation failed)",
    }
    print(f"   📍 Routing: {route_display.get(route, route)}")
    
    if approved:
        print(f"   ✅ Recommendation: APPROVE")
    else:
        print(f"   ❌ Recommendation: REJECT")
    
    display_reason = reason[:100] + "..." if len(reason) > 100 else reason
    print(f"   💬 {display_reason}")
    
    approval_decision: ApprovalDecision = {
        "approved": approved,
        "reason": reason,
        "requires_review": requires_review,
        "decided_by": None,  # Will be set by workflow based on route
        "decided_at": None,
    }
    
    # Store additional data for UI
    approval_decision["route"] = route
    approval_decision["reasoning_chain"] = reasoning_chain
    
    return {
        "approval_decision": approval_decision,
        "current_agent": "payment" if route == "auto_approve" else "awaiting_decision",
    }


# =============================================================================
# STANDALONE TEST
# =============================================================================

if __name__ == "__main__":
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  APPROVAL AGENT - STANDALONE TEST".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    
    # Test Case 1: Small valid invoice (should AUTO-APPROVE)
    print("\n" + "─" * 60)
    print("TEST 1: Small Valid Invoice → AUTO-APPROVE")
    print("─" * 60)
    
    state1: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Widgets Inc.",
            "amount": 5000.0,
            "items": [
                {"name": "WidgetA", "quantity": 10, "unit_price": 100.0},
            ],
            "due_date": "2026-02-01",
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": True,
            "errors": [],
            "warnings": ["Some warning - should not affect routing"],
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result1 = approval_agent(state1)
    
    # Test Case 2: Large valid invoice (should ROUTE TO HUMAN)
    print("\n" + "─" * 60)
    print("TEST 2: Large Valid Invoice → ROUTE TO HUMAN")
    print("─" * 60)
    
    state2: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Big Corp LLC",
            "amount": 15000.0,
            "items": [
                {"name": "ExpensiveItem", "quantity": 10, "unit_price": 1500.0},
            ],
            "due_date": "2026-02-01",
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": True,
            "errors": [],
            "warnings": [],
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result2 = approval_agent(state2)
    
    # Test Case 3: Failed validation (should AUTO-REJECT)
    print("\n" + "─" * 60)
    print("TEST 3: Failed Validation → AUTO-REJECT")
    print("─" * 60)
    
    state3: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Any Vendor",
            "amount": 500.0,  # Even small amount
            "items": [
                {"name": "FakeItem", "quantity": 100, "unit_price": 0.0},
            ],
            "due_date": None,
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": False,
            "errors": [
                "INVENTORY: FakeItem — requested 100 but only 0 in stock",
            ],
            "warnings": [],
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result3 = approval_agent(state3)
    
    print("\n" + "═" * 60)
    print("RESULTS SUMMARY:")
    print(f"  Test 1 ($5K valid):    route={result1['approval_decision']['route']}")
    print(f"  Test 2 ($15K valid):   route={result2['approval_decision']['route']}")
    print(f"  Test 3 (failed valid): route={result3['approval_decision']['route']}")
    print("═" * 60)
