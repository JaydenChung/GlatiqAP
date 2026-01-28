"""
Approval Agent
==============
Risk-based triage of invoices for approval routing.

Five-flow decision logic:
1. CRITICAL errors detected → AUTO-REJECT (regardless of amount)
2. Validation FAILED + Amount < $10,000 → AUTO-REJECT
3. Validation FAILED + Amount ≥ $10,000 → ROUTE TO HUMAN (needs review)
4. Amount ≥ $10,000 AND validation PASSED → ROUTE TO HUMAN (VP/manager reviews)
5. Amount < $10,000 AND validation PASSED → AUTO-APPROVE

CRITICAL errors (suspended vendor, massive variance) bypass human review entirely.
These are hard blocks, not edge cases for human judgment.

Session: 2026-01-26_FORGE (original)
Updated: 2026-01-27_WORKFLOW (smart triage)
Updated: 2026-01-27 (high-value invoices always route to human, even if validation fails)
Updated: 2026-01-28_TRIAGE (CRITICAL error detection for immediate rejection)
"""

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.schemas.models import WorkflowState, ApprovalDecision, APPROVAL_THRESHOLDS


# =============================================================================
# CRITICAL ERROR DETECTION (Session 2026-01-28_TRIAGE)
# =============================================================================

# Thresholds for CRITICAL errors that trigger immediate rejection
CRITICAL_VARIANCE_THRESHOLD = -100  # Requesting 100+ more than available stock


def detect_critical_flags(validation_result: dict, invoice_data: dict) -> list[str]:
    """
    Detect CRITICAL flags that require immediate rejection.
    
    These are NOT edge cases for human judgment — they are hard blocks.
    CRITICAL errors bypass human review entirely, regardless of dollar amount.
    
    CRITICAL conditions:
    1. SUSPENDED vendor — vendor is explicitly blocked in our system
    2. MASSIVE variance — requesting 100+ more items than available stock
    
    Args:
        validation_result: The validation agent's output
        invoice_data: The invoice data (may contain vendor_status from enrichment)
        
    Returns:
        List of CRITICAL flag descriptions (empty if none found)
    """
    critical_flags = []
    
    # =================================================================
    # 1. SUSPENDED VENDOR — Hard block, no exceptions
    # =================================================================
    vendor_status = invoice_data.get("vendor_status")
    vendor_name = invoice_data.get("vendor", "UNKNOWN")
    
    if vendor_status == "suspended":
        critical_flags.append(
            f"SUSPENDED VENDOR: '{vendor_name}' is suspended in vendor master — cannot process"
        )
    
    # Also check validation errors for suspended vendor message
    # (in case vendor_status wasn't set but error was added)
    validation_errors = validation_result.get("errors", [])
    for error in validation_errors:
        if "SUSPENDED" in error.upper():
            # Avoid duplicates
            if not any("SUSPENDED VENDOR" in f for f in critical_flags):
                critical_flags.append(f"SUSPENDED VENDOR: {error}")
    
    # =================================================================
    # 2. MASSIVE INVENTORY VARIANCE — Requesting far more than available
    # =================================================================
    inventory_check = validation_result.get("inventory_check", {})
    
    for item_name, check in inventory_check.items():
        variance = check.get("variance", 0)
        requested = check.get("requested", 0)
        in_stock = check.get("in_stock", 0)
        
        # CRITICAL: Variance is -100 or worse (requesting 100+ more than stock)
        if variance <= CRITICAL_VARIANCE_THRESHOLD:
            critical_flags.append(
                f"MASSIVE VARIANCE: '{item_name}' requested {requested} but only {in_stock} in stock "
                f"(shortage of {abs(variance)} units)"
            )
    
    return critical_flags


# =============================================================================
# AGENT FUNCTION
# =============================================================================

def approval_agent(state: WorkflowState) -> dict:
    """
    Risk-based triage of invoices with CRITICAL error detection.
    
    Five-flow logic:
    1. CRITICAL errors → AUTO-REJECT (regardless of amount)
    2. Validation FAILED + LOW value → AUTO-REJECT
    3. Validation FAILED + HIGH value → ROUTE TO HUMAN
    4. Validation PASSED + HIGH value → ROUTE TO HUMAN
    5. Validation PASSED + LOW value → AUTO-APPROVE
    
    Args:
        state: WorkflowState containing invoice_data and validation_result
        
    Returns:
        Dict with approval_decision (including route)
    """
    print()
    print("=" * 60)
    print("🤔 APPROVAL AGENT (Risk-Based Triage)")
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
    # STEP 0: CHECK FOR CRITICAL ERRORS (Session 2026-01-28_TRIAGE)
    # CRITICAL errors = immediate rejection, no human review needed
    # =================================================================
    
    critical_flags = detect_critical_flags(validation_result, invoice_data)
    
    if critical_flags:
        print("   🚨 CRITICAL FLAGS DETECTED:")
        for flag in critical_flags:
            print(f"      ❌ {flag}")
        print()
    
    # =================================================================
    # FIVE-FLOW DECISION LOGIC
    # Flow 1 (NEW): CRITICAL errors → immediate rejection
    # =================================================================
    
    reasoning_chain = []
    red_flags = []
    
    # Flow 1 (NEW): CRITICAL errors → AUTO-REJECT regardless of amount
    if critical_flags:
        approved = False
        reason = f"CRITICAL errors detected: {'; '.join(critical_flags)}"
        requires_review = False
        route = "auto_reject"
        red_flags = critical_flags + validation_errors
        reasoning_chain = [
            f"🚨 CRITICAL FLAGS: {len(critical_flags)} critical error(s) detected",
            *[f"   • {flag}" for flag in critical_flags],
            f"Amount: ${amount:,.2f} (IGNORED — critical errors override)",
            "Result: AUTO-REJECT (critical errors bypass human review)"
        ]
        print("   📋 Decision Flow:")
        print(f"      → CRITICAL ERRORS: {len(critical_flags)} found")
        print(f"      → Amount: ${amount:,.2f} (does not matter)")
        print(f"      → Result: AUTO-REJECT (immediate)")
    
    # Flow 2: Validation failed + LOW value → AUTO-REJECT
    elif not validation_passed and amount < threshold:
        approved = False
        reason = f"Validation failed with {len(validation_errors)} error(s). Low-value invoice auto-rejected."
        requires_review = False
        route = "auto_reject"
        red_flags = validation_errors.copy()
        reasoning_chain = [
            f"Validation: FAILED ✗ ({len(validation_errors)} errors)",
            f"Amount: ${amount:,.2f} < ${threshold:,} threshold",
            "Result: AUTO-REJECT (validation failed on low-value invoice)"
        ]
        print("   📋 Decision Flow:")
        print(f"      → Validation: FAILED ✗")
        print(f"      → Amount: ${amount:,.2f} < ${threshold:,}")
        print(f"      → Result: AUTO-REJECT")
    
    # Flow 3: Validation failed + HIGH value → ROUTE TO HUMAN
    elif not validation_passed and amount >= threshold:
        approved = False  # Recommend rejection, but human decides
        reason = f"Validation failed but invoice ${amount:,.2f} >= ${threshold:,} requires human review."
        requires_review = True
        route = "route_to_human"
        red_flags = validation_errors.copy()
        reasoning_chain = [
            f"Validation: FAILED ✗ ({len(validation_errors)} errors)",
            f"Amount: ${amount:,.2f} >= ${threshold:,} threshold (HIGH VALUE)",
            "Result: ROUTE TO HUMAN (high-value invoice needs human judgment)"
        ]
        print("   📋 Decision Flow:")
        print(f"      → Validation: FAILED ✗")
        print(f"      → Amount: ${amount:,.2f} >= ${threshold:,} (HIGH VALUE)")
        print(f"      → Result: ROUTE TO HUMAN for review")
    
    # Flow 4: Validation passed + HIGH value → ROUTE TO HUMAN
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
    
    # Flow 5: Validation passed + LOW value → AUTO-APPROVE
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
    approval_decision["red_flags"] = red_flags
    approval_decision["critical_flags"] = critical_flags  # NEW: Explicit critical errors
    approval_decision["validation_errors"] = validation_errors  # Include for transparency
    
    # Risk score: Critical flags = 1.0 (max), otherwise based on validation errors
    if critical_flags:
        approval_decision["risk_score"] = 1.0  # Maximum risk
    else:
        approval_decision["risk_score"] = min(len(validation_errors) * 0.3, 0.9)  # Cap at 0.9 for non-critical
    
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
    
    # Test Case 3: Small invoice with failed validation (should AUTO-REJECT)
    print("\n" + "─" * 60)
    print("TEST 3: Small Failed Validation → AUTO-REJECT")
    print("─" * 60)
    
    state3: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Any Vendor",
            "amount": 500.0,  # Small amount + failed = auto-reject
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
    
    # Test Case 4: Large invoice with failed validation (should ROUTE TO HUMAN)
    print("\n" + "─" * 60)
    print("TEST 4: Large Failed Validation (minor) → ROUTE TO HUMAN")
    print("─" * 60)
    
    state4: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Gadgets Co.",
            "amount": 15000.0,  # Large amount + failed = human review
            "items": [
                {"name": "GadgetX", "quantity": 20, "unit_price": 750.0},
            ],
            "due_date": "2026-01-30",
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": False,
            "errors": [
                "INVENTORY: GadgetX — requested 20 but only 5 in stock",
            ],
            "warnings": ["AMOUNT: High-value invoice ($15,000.00)"],
            "inventory_check": {
                "GadgetX": {
                    "requested": 20,
                    "in_stock": 5,
                    "available": False,
                    "variance": -15,  # Only -15, not CRITICAL
                }
            },
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result4 = approval_agent(state4)
    
    # Test Case 5 (NEW): CRITICAL errors → AUTO-REJECT regardless of amount
    print("\n" + "─" * 60)
    print("TEST 5: CRITICAL Errors (Suspended Vendor + Massive Variance) → AUTO-REJECT")
    print("─" * 60)
    
    state5: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Fraudster Inc.",
            "vendor_status": "suspended",  # CRITICAL: Suspended vendor
            "amount": 50000.0,  # High value - doesn't matter, CRITICAL overrides
            "items": [
                {"name": "FakeItem", "quantity": 150, "unit_price": 333.33},
            ],
            "due_date": "2026-01-30",
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": False,
            "errors": [
                "VENDOR: Fraudster Inc. is SUSPENDED in vendor master — do not process",
                "INVENTORY: FakeItem — requested 150 but only 0 in stock",
            ],
            "warnings": [],
            "inventory_check": {
                "FakeItem": {
                    "requested": 150,
                    "in_stock": 0,
                    "available": False,
                    "variance": -150,  # CRITICAL: Massive variance (-150)
                }
            },
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result5 = approval_agent(state5)
    
    # Test Case 6: Large variance but valid vendor → AUTO-REJECT (CRITICAL variance)
    print("\n" + "─" * 60)
    print("TEST 6: CRITICAL Variance Only (100+ shortage) → AUTO-REJECT")
    print("─" * 60)
    
    state6: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Normal Vendor LLC",
            "amount": 25000.0,  # High value - doesn't matter
            "items": [
                {"name": "BulkItem", "quantity": 200, "unit_price": 125.0},
            ],
            "due_date": "2026-02-15",
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": False,
            "errors": [
                "INVENTORY: BulkItem — requested 200 but only 50 in stock",
            ],
            "warnings": [],
            "inventory_check": {
                "BulkItem": {
                    "requested": 200,
                    "in_stock": 50,
                    "available": False,
                    "variance": -150,  # CRITICAL: Massive variance
                }
            },
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result6 = approval_agent(state6)
    
    print("\n" + "═" * 60)
    print("RESULTS SUMMARY:")
    print(f"  Test 1 ($5K valid):             route={result1['approval_decision']['route']}")
    print(f"  Test 2 ($15K valid):            route={result2['approval_decision']['route']}")
    print(f"  Test 3 ($500 failed):           route={result3['approval_decision']['route']}")
    print(f"  Test 4 ($15K failed, minor):    route={result4['approval_decision']['route']}")
    print(f"  Test 5 ($50K CRITICAL):         route={result5['approval_decision']['route']} ← NEW")
    print(f"  Test 6 ($25K massive variance): route={result6['approval_decision']['route']} ← NEW")
    print("═" * 60)
    print()
    print("Expected:")
    print("  Test 1: auto_approve   (small + valid)")
    print("  Test 2: route_to_human (large + valid)")
    print("  Test 3: auto_reject    (small + failed)")
    print("  Test 4: route_to_human (large + failed, minor variance → human reviews)")
    print("  Test 5: auto_reject    (CRITICAL: suspended vendor + massive variance)")
    print("  Test 6: auto_reject    (CRITICAL: variance -150, bypasses human review)")
    print("═" * 60)
