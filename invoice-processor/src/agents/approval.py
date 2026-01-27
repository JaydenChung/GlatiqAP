"""
Approval Agent
==============
Intelligent triage of invoices for approval routing.

This agent performs SMART TRIAGE (Session 2026-01-27_WORKFLOW):
1. <$10K AND no flags → AUTO-APPROVE (skip human, go to payment)
2. ≥$10K OR flags → ROUTE TO HUMAN (VP/manager reviews)
3. Major red flags → AUTO-REJECT (fraud/invalid)

The agent:
1. Takes invoice data and validation results
2. Uses Grok to perform chain-of-thought risk analysis
3. Decides routing (auto-approve, route-to-human, auto-reject)
4. Provides analysis to help human reviewer (if routed)

Session: 2026-01-26_FORGE (original)
Updated: 2026-01-27_WORKFLOW (smart triage)
"""

import json
from typing import Optional, List

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.client import call_grok
from src.schemas.models import WorkflowState, ApprovalDecision, APPROVAL_THRESHOLDS
from src.utils import clean_json_response


# =============================================================================
# PROMPTS (Updated for Smart Triage)
# =============================================================================

SYSTEM_PROMPT = """You are an invoice approval TRIAGE system for an enterprise accounts payable workflow.

Your task: Analyze invoices and decide the ROUTING — whether the invoice can be auto-approved, needs human review, or should be auto-rejected.

## BUSINESS RULES (CRITICAL)
- Invoices UNDER $10,000 with NO red flags → CAN be auto-approved
- Invoices AT OR ABOVE $10,000 → MUST go to human approver
- Invoices with ANY red flags → MUST go to human approver (or auto-reject if severe)
- Invoices with MAJOR red flags (fraud indicators) → Auto-reject

## Output Schema
Return a JSON object with exactly these fields:
- "approved": boolean — Your recommendation (true=approve, false=reject). For route_to_human, use your best judgment.
- "reason": string — Clear explanation for human reviewer or audit trail.
- "requires_review": boolean — TRUE if amount >= $10,000 OR any flags exist.
- "risk_score": float — 0.0 (safe) to 1.0 (risky). Use increments of 0.1.
- "reasoning_chain": array of strings — Your step-by-step analysis.
- "route": string — One of: "auto_approve", "route_to_human", "auto_reject"
- "red_flags": array of strings — List of concerns identified (empty if none)

## Decision Framework

### Step 1: Validation Gate
- If validation FAILED → route: "auto_reject", risk_score: 0.9+
- If validation PASSED → Continue

### Step 2: Vendor Assessment
- Known vendor patterns (Inc., Corp., LLC with name) → Low risk (+0.0)
- Generic/suspicious names → Medium risk (+0.2)
- "Fraudster", obvious fake → High risk (+0.4), add to red_flags

### Step 3: Amount Routing (KEY RULE)
- Under $10,000 AND risk_score < 0.3 → route: "auto_approve"
- At or above $10,000 → route: "route_to_human", requires_review: true
- Over $50,000 → Definitely route_to_human, note executive approval needed

### Step 4: Red Flag Scan
- Items requesting 0-stock items → MAJOR RED FLAG, route: "auto_reject"
- Missing/invalid due date → Minor flag (+0.1)
- Unreasonable quantities → Flag (+0.1)
- Any red flags on <$10K invoice → route: "route_to_human"

### Step 5: Final Routing Decision
- risk_score < 0.3 AND amount < $10,000 AND no red_flags → "auto_approve"
- risk_score >= 0.8 OR validation failed → "auto_reject"  
- Otherwise → "route_to_human"

## Risk Score Calibration
- 0.0-0.2: Safe, can auto-approve if under $10K
- 0.3-0.5: Some concerns, needs human review
- 0.6-0.7: Significant concerns, human required
- 0.8-1.0: Major issues, auto-reject"""


FEW_SHOT_EXAMPLE = """## Examples

### Example 1: Small invoice, no issues → AUTO-APPROVE
INPUT:
Vendor: Acme Corp
Amount: $5,000
Validation: PASSED
Inventory: All items available

OUTPUT:
{
  "approved": true,
  "reason": "Low-risk invoice under $10K threshold from established vendor. Auto-approved per business rules.",
  "requires_review": false,
  "risk_score": 0.1,
  "route": "auto_approve",
  "red_flags": [],
  "reasoning_chain": [
    "Step 1 - Validation Gate: PASSED - proceeding with analysis.",
    "Step 2 - Vendor Assessment: 'Acme Corp' is standard business name. Risk: +0.0",
    "Step 3 - Amount Routing: $5,000 < $10,000 threshold, eligible for auto-approve.",
    "Step 4 - Red Flag Scan: No red flags found.",
    "Step 5 - Final Routing: risk_score 0.1 < 0.3, amount < $10K, no flags → AUTO-APPROVE"
  ]
}

### Example 2: Large invoice → ROUTE TO HUMAN
INPUT:
Vendor: Widgets Inc.
Amount: $15,000
Validation: PASSED
Inventory: All items available

OUTPUT:
{
  "approved": true,
  "reason": "Invoice exceeds $10K threshold and requires human VP approval per business rules. Recommend approval - vendor is trusted.",
  "requires_review": true,
  "risk_score": 0.2,
  "route": "route_to_human",
  "red_flags": [],
  "reasoning_chain": [
    "Step 1 - Validation Gate: PASSED - proceeding with analysis.",
    "Step 2 - Vendor Assessment: 'Widgets Inc.' is established vendor. Risk: +0.0",
    "Step 3 - Amount Routing: $15,000 >= $10,000 threshold, MUST route to human.",
    "Step 4 - Red Flag Scan: No red flags found. Risk: +0.0",
    "Step 5 - Final Routing: Amount triggers human review. Recommend approval → ROUTE TO HUMAN"
  ]
}

### Example 3: Fraud indicators → AUTO-REJECT
INPUT:
Vendor: Fraudster LLC
Amount: $100,000
Validation: FAILED (item not in inventory)
Inventory: FakeItem needs 100, only 0 available

OUTPUT:
{
  "approved": false,
  "reason": "Multiple fraud indicators: suspicious vendor name, validation failed, requesting non-existent inventory.",
  "requires_review": false,
  "risk_score": 0.95,
  "route": "auto_reject",
  "red_flags": ["Suspicious vendor name 'Fraudster'", "Validation failed - item not in stock", "Requesting 100 units of non-existent item"],
  "reasoning_chain": [
    "Step 1 - Validation Gate: FAILED - inventory shortage is critical error.",
    "Step 2 - Vendor Assessment: 'Fraudster LLC' is highly suspicious name. Risk: +0.4",
    "Step 3 - Amount Routing: $100,000 is extremely high, but moot due to rejection.",
    "Step 4 - Red Flag Scan: MAJOR FLAGS - fake vendor, non-existent items, validation failure. Risk: +0.5",
    "Step 5 - Final Routing: risk_score 0.95 >= 0.8, validation failed → AUTO-REJECT"
  ]
}"""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def build_approval_messages(
    vendor: str,
    amount: float,
    due_date: Optional[str],
    items_summary: str,
    validation_passed: bool,
    validation_errors: List[str],
    validation_warnings: List[str],
    inventory_summary: str
) -> list:
    """
    Build the messages array for approval reasoning.
    
    Provides all context needed for informed decision-making.
    """
    user_content = f"""Analyze this invoice for approval:

## INVOICE DATA
- Vendor: {vendor}
- Amount: ${amount:,.2f}
- Due Date: {due_date or "null (missing)"}
- Line Items: {items_summary}

## VALIDATION STATUS
- Result: {"PASSED ✓" if validation_passed else "FAILED ✗"}
- Errors: {validation_errors if validation_errors else "None"}
- Warnings: {validation_warnings if validation_warnings else "None"}

## INVENTORY STATUS
{inventory_summary}

Apply the 5-step decision framework and provide your reasoned approval decision."""

    return [
        {
            "role": "system",
            "content": SYSTEM_PROMPT + "\n\n" + FEW_SHOT_EXAMPLE
        },
        {
            "role": "user",
            "content": user_content
        }
    ]


def format_inventory_summary(inventory_check: dict) -> str:
    """Format inventory check for approval context."""
    if not inventory_check:
        return "No inventory data available."
    
    lines = []
    for item_name, check in inventory_check.items():
        status = "✓ Available" if check["available"] else "✗ INSUFFICIENT"
        lines.append(f"- {item_name}: need {check['requested']}, have {check['in_stock']} [{status}]")
    return "\n".join(lines)


# =============================================================================
# AGENT FUNCTION
# =============================================================================

def approval_agent(state: WorkflowState) -> dict:
    """
    Smart triage of invoices using Grok chain-of-thought reasoning.
    
    Implements business rules:
    - <$10K AND no flags → AUTO-APPROVE
    - ≥$10K OR flags → ROUTE TO HUMAN
    - Major red flags → AUTO-REJECT
    
    Args:
        state: WorkflowState containing invoice_data and validation_result
        
    Returns:
        Dict with approval_decision (including route recommendation)
    """
    print()
    print("=" * 60)
    print("🤔 APPROVAL AGENT (Smart Triage)")
    print("=" * 60)
    
    invoice_data = state.get("invoice_data") or {}
    validation_result = state.get("validation_result") or {}
    
    # Extract invoice details with defaults
    vendor = invoice_data.get("vendor", "UNKNOWN")
    amount = invoice_data.get("amount", 0.0)
    items = invoice_data.get("items", [])
    due_date = invoice_data.get("due_date")
    
    # Extract validation details
    validation_passed = validation_result.get("is_valid", False)
    validation_errors = validation_result.get("errors", [])
    validation_warnings = validation_result.get("warnings", [])
    inventory_check = validation_result.get("inventory_check", {})
    
    print(f"   Vendor: {vendor}")
    print(f"   Amount: ${amount:,.2f}")
    print(f"   Validation: {'PASSED ✓' if validation_passed else 'FAILED ✗'}")
    print(f"   Threshold: ${APPROVAL_THRESHOLDS['auto_approve_max']:,} (auto-approve max)")
    print()
    print("   🧠 Analyzing for smart triage...")
    print()
    
    # Build context for Grok reasoning
    items_summary = ", ".join([f"{item['name']}:{item['quantity']}" for item in items]) or "None"
    inventory_summary = format_inventory_summary(inventory_check)
    
    messages = build_approval_messages(
        vendor=vendor,
        amount=amount,
        due_date=due_date,
        items_summary=items_summary,
        validation_passed=validation_passed,
        validation_errors=validation_errors,
        validation_warnings=validation_warnings,
        inventory_summary=inventory_summary
    )
    
    try:
        response = call_grok(
            messages=messages,
            json_mode=True,
            max_tokens=1200  # More tokens for detailed reasoning chain
        )
        
        cleaned_response = clean_json_response(response)
        approval = json.loads(cleaned_response)
        
        approved = approval.get("approved", False)
        reason = approval.get("reason", "No reason provided")
        requires_review = approval.get("requires_review", False)
        risk_score = float(approval.get("risk_score", 0.5))
        reasoning_chain = approval.get("reasoning_chain", [])
        route = approval.get("route", "route_to_human")
        red_flags = approval.get("red_flags", [])
        
        # Display the reasoning chain (key for demo!)
        print("   📋 Reasoning Chain:")
        for step in reasoning_chain:
            display_step = step[:80] + "..." if len(step) > 80 else step
            print(f"      → {display_step}")
        print()
        
        if red_flags:
            print("   🚩 Red Flags:")
            for flag in red_flags:
                print(f"      • {flag}")
            print()
        
    except Exception as e:
        print(f"   ⚠️ Grok reasoning failed, using rule-based fallback: {e}")
        
        # Deterministic fallback logic matching business rules
        red_flags = []
        
        if not validation_passed:
            approved = False
            reason = f"Rejected: Validation failed with {len(validation_errors)} error(s)."
            risk_score = 0.9
            requires_review = False
            route = "auto_reject"
            red_flags = validation_errors
            
        elif amount >= APPROVAL_THRESHOLDS["auto_approve_max"]:
            # Above threshold - must go to human
            approved = True  # Recommendation
            reason = f"Amount ${amount:,.2f} requires human approval (≥${APPROVAL_THRESHOLDS['auto_approve_max']:,})."
            risk_score = 0.3
            requires_review = True
            route = "route_to_human"
            
        else:
            # Below threshold and valid - auto-approve
            approved = True
            reason = f"Auto-approved: ${amount:,.2f} is under ${APPROVAL_THRESHOLDS['auto_approve_max']:,} with no red flags."
            risk_score = 0.1
            requires_review = False
            route = "auto_approve"
        
        reasoning_chain = ["Fallback logic applied due to Grok unavailability"]
    
    # Display routing decision
    print(f"   📊 Risk Score: {risk_score:.1f}")
    print()
    
    route_display = {
        "auto_approve": "🟢 AUTO-APPROVE (skip human, go to payment)",
        "route_to_human": "🟡 ROUTE TO HUMAN (needs VP/manager approval)",
        "auto_reject": "🔴 AUTO-REJECT (major red flags)",
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
        "risk_score": risk_score,
        "decided_by": None,  # Will be set by workflow based on route
        "decided_at": None,
    }
    
    # Store additional analysis data in approval_decision for UI
    approval_decision["route"] = route
    approval_decision["red_flags"] = red_flags
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
    
    # Test Case 1: Valid invoice (should approve)
    print("\n" + "─" * 60)
    print("TEST 1: Valid Invoice (should APPROVE)")
    print("─" * 60)
    
    state1: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Widgets Inc.",
            "amount": 5000.0,
            "items": [
                {"name": "WidgetA", "quantity": 10, "unit_price": 100.0},
                {"name": "WidgetB", "quantity": 5, "unit_price": 150.0},
            ],
            "due_date": "2026-02-01",
            "raw_text": "test",
        },
        "validation_result": {
            "is_valid": True,
            "errors": [],
            "warnings": [],
            "inventory_check": {
                "WidgetA": {"requested": 10, "in_stock": 15, "available": True},
                "WidgetB": {"requested": 5, "in_stock": 10, "available": True},
            },
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result1 = approval_agent(state1)
    
    # Test Case 2: Fraud invoice (should reject)
    print("\n" + "─" * 60)
    print("TEST 2: Fraudulent Invoice (should REJECT)")
    print("─" * 60)
    
    state2: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Fraudster LLC",
            "amount": 100000.0,
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
                "DUE_DATE: Missing or invalid due date"
            ],
            "warnings": ["AMOUNT: High-value invoice ($100,000)"],
            "inventory_check": {
                "FakeItem": {"requested": 100, "in_stock": 0, "available": False},
            },
        },
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "approval",
        "status": "processing",
        "error": None,
    }
    
    result2 = approval_agent(state2)
    
    print("\n" + "═" * 60)
    print(f"Test 1 (valid): approved={result1['approval_decision']['approved']}, "
          f"risk={result1['approval_decision']['risk_score']:.1f}")
    print(f"Test 2 (fraud): approved={result2['approval_decision']['approved']}, "
          f"risk={result2['approval_decision']['risk_score']:.1f}")
    print("═" * 60)
