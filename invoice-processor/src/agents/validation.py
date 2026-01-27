"""
Validation Agent
================
Validate invoice against inventory database and business rules using Grok reasoning.

This agent:
1. Takes InvoiceData from ingestion
2. Checks inventory database for stock availability
3. Uses Grok to reason about validation concerns
4. **CORRECTS/INFERS** fields that were poorly extracted (e.g., payment terms)
5. Returns ValidationResult with pass/fail, corrections, and detailed reasons

Session: 2026-01-26_FORGE
Updated: 2026-01-27 (Smart field correction for payment_terms)
Builder: PRAG-001 (The Implementer)
Prompts: LLM-002 (Prompt Engineer) — Senior-level pattern
"""

import json
import re
from datetime import datetime, timedelta
from typing import Optional, Dict, Any, Tuple

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.client import call_grok
from src.schemas.models import WorkflowState, ValidationResult
from src.tools.database import validate_inventory
from src.utils import clean_json_response


# =============================================================================
# SMART FIELD CORRECTION LOGIC
# =============================================================================

# Common boilerplate phrases that are NOT valid payment terms
BOILERPLATE_PATTERNS = [
    r"payment is due",
    r"please remit",
    r"due by the due date",
    r"listed above",
    r"late payments",
    r"subject to",
    r"thank you for your business",
    r"payable upon receipt",
    r"terms and conditions",
]

# Valid payment term patterns
VALID_PAYMENT_TERMS = [
    r"^net\s*\d+$",           # Net 30, Net 15, etc.
    r"^\d+/\d+\s*net\s*\d+$", # 2/10 Net 30
    r"^due on receipt$",
    r"^cod$",                  # Cash on delivery
    r"^cia$",                  # Cash in advance
    r"^prepaid$",
]


def is_boilerplate_payment_terms(payment_terms: str) -> bool:
    """
    Check if extracted payment_terms is boilerplate text rather than an actual term.
    
    Returns True if the text looks like generic invoice language rather than
    a real payment term like "Net 30" or "2/10 Net 30".
    """
    if not payment_terms:
        return True
    
    text = payment_terms.lower().strip()
    
    # Check if it matches a valid payment term pattern
    for pattern in VALID_PAYMENT_TERMS:
        if re.match(pattern, text, re.IGNORECASE):
            return False  # It's a valid term, not boilerplate
    
    # Check if it contains boilerplate phrases
    for pattern in BOILERPLATE_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE):
            return True  # It's boilerplate
    
    # If it's too long (>30 chars), it's probably a sentence, not a term
    if len(text) > 30:
        return True
    
    return False


def calculate_payment_terms_from_dates(invoice_date: str, due_date: str) -> Tuple[Optional[str], int]:
    """
    Calculate payment terms from invoice_date and due_date.
    
    Returns:
        Tuple of (payment_term_string, days_difference)
        e.g., ("Net 30", 30) or ("Net 15", 17)
    """
    if not invoice_date or not due_date:
        return None, 0
    
    try:
        # Parse dates - handle various formats
        for fmt in ["%Y-%m-%d", "%B %d, %Y", "%m/%d/%Y", "%d/%m/%Y"]:
            try:
                inv_date = datetime.strptime(invoice_date, fmt)
                break
            except ValueError:
                continue
        else:
            return None, 0
        
        for fmt in ["%Y-%m-%d", "%B %d, %Y", "%m/%d/%Y", "%d/%m/%Y"]:
            try:
                d_date = datetime.strptime(due_date, fmt)
                break
            except ValueError:
                continue
        else:
            return None, 0
        
        # Calculate difference in days
        days_diff = (d_date - inv_date).days
        
        if days_diff <= 0:
            return None, days_diff
        
        # Map to standard payment terms
        if days_diff <= 7:
            return "Net 7", days_diff
        elif days_diff <= 12:
            return "Net 10", days_diff
        elif days_diff <= 20:
            return "Net 15", days_diff
        elif days_diff <= 35:
            return "Net 30", days_diff
        elif days_diff <= 50:
            return "Net 45", days_diff
        elif days_diff <= 70:
            return "Net 60", days_diff
        elif days_diff <= 100:
            return "Net 90", days_diff
        else:
            return f"Net {days_diff}", days_diff
            
    except Exception:
        return None, 0


def validate_and_correct_payment_terms(
    payment_terms: Optional[str],
    invoice_date: Optional[str],
    due_date: Optional[str]
) -> Dict[str, Any]:
    """
    Validate payment_terms and correct if necessary.
    
    Returns a dict with:
    - corrected_value: The corrected payment term (or original if valid)
    - was_corrected: Boolean indicating if correction was made
    - original_value: The original extracted value
    - correction_reason: Explanation of why correction was made
    - calculated_days: Actual days between dates (for reference)
    """
    result = {
        "corrected_value": payment_terms,
        "was_corrected": False,
        "original_value": payment_terms,
        "correction_reason": None,
        "calculated_days": None,
    }
    
    # Check if payment_terms is missing or boilerplate
    needs_correction = False
    reason = None
    
    if not payment_terms:
        needs_correction = True
        reason = "Payment terms was missing"
    elif is_boilerplate_payment_terms(payment_terms):
        needs_correction = True
        reason = f"Extracted text '{payment_terms[:50]}...' appears to be boilerplate, not a payment term"
    
    if needs_correction:
        # Try to calculate from dates
        calculated_term, days = calculate_payment_terms_from_dates(invoice_date, due_date)
        
        if calculated_term:
            result["corrected_value"] = calculated_term
            result["was_corrected"] = True
            result["correction_reason"] = f"{reason}. Inferred '{calculated_term}' from invoice date ({invoice_date}) to due date ({due_date}) = {days} days."
            result["calculated_days"] = days
        else:
            # Couldn't calculate, leave a warning
            result["correction_reason"] = f"{reason}. Could not infer from dates."
    
    return result


# =============================================================================
# PROMPTS (Senior-Level Prompt Engineering)
# =============================================================================

SYSTEM_PROMPT = """You are an invoice validation system for an enterprise accounts payable workflow.

Your task: Analyze invoice data against inventory availability and business rules, then determine if the invoice is valid for approval.

## Output Schema
Return a JSON object with exactly these fields:
- "is_valid": boolean — true if invoice passes ALL validation rules, false otherwise.
- "errors": array of strings — Critical issues that BLOCK approval. Empty array if valid.
- "warnings": array of strings — Non-blocking concerns to note. May be empty.

## Validation Rules (ALL must pass for is_valid=true)
1. INVENTORY: All requested items must be available (in_stock >= requested).
2. DUE DATE: Must be present and valid (not null).
3. AMOUNT: Must be positive (> 0).
4. VENDOR: Must be a non-empty, non-"UNKNOWN" string.

## Error Message Standards
- Be specific: Include item names, quantities, and values in error messages.
- Be actionable: The user should understand exactly what failed and why.
- Format: "[Field]: [specific issue] — [details]"

## Warning Triggers (do not block, but note)
- Amount exceeds $10,000 (high-value invoice)
- Due date is within 3 days (urgent)
- Vendor name contains unusual characters

## Decision Logic
- If ANY validation rule fails → is_valid: false, add to errors
- Warnings do not affect is_valid
- Be conservative: when in doubt, flag as error"""


FEW_SHOT_EXAMPLE = """## Example

INPUT:
Invoice: Acme Corp, $5,000, Items: [Bolt-A7: need 50, have 100], Due: 2026-02-15
All items in stock.

OUTPUT:
{"is_valid": true, "errors": [], "warnings": []}

INPUT:
Invoice: Unknown Vendor, $15,000, Items: [WidgetX: need 20, have 5], Due: null
Insufficient stock for WidgetX.

OUTPUT:
{"is_valid": false, "errors": ["INVENTORY: WidgetX — requested 20 units but only 5 in stock", "DUE_DATE: Missing or invalid due date"], "warnings": ["AMOUNT: Invoice exceeds $10,000 threshold ($15,000)"]}"""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def build_validation_messages(
    vendor: str,
    amount: float,
    due_date: Optional[str],
    items_summary: str,
    inventory_results: str
) -> list:
    """
    Build the messages array for validation reasoning.
    
    Separates system instructions from the specific invoice data.
    """
    user_content = f"""Validate this invoice:

INVOICE DATA:
- Vendor: {vendor}
- Amount: ${amount:,.2f}
- Due Date: {due_date or "null (missing)"}
- Items: {items_summary}

INVENTORY CHECK RESULTS:
{inventory_results}

Analyze against the validation rules and return your assessment."""

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


def format_inventory_results(inventory_check: dict) -> str:
    """Format inventory check results for the prompt."""
    if not inventory_check:
        return "No inventory data available."
    
    lines = []
    for item_name, check in inventory_check.items():
        status = "✓ AVAILABLE" if check["available"] else "✗ INSUFFICIENT"
        lines.append(
            f"- {item_name}: requested={check['requested']}, "
            f"in_stock={check['in_stock']}, status={status}"
        )
    return "\n".join(lines)


# =============================================================================
# AGENT FUNCTION
# =============================================================================

def validation_agent(state: WorkflowState) -> dict:
    """
    Validate invoice against inventory and business rules.
    
    Combines deterministic database checks with Grok reasoning
    for comprehensive validation. Also performs SMART CORRECTIONS
    on poorly-extracted fields (e.g., boilerplate payment terms).
    
    Args:
        state: WorkflowState containing invoice_data
        
    Returns:
        Dict with validation_result, corrected invoice_data, and updated current_agent
    """
    print()
    print("=" * 60)
    print("✅ VALIDATION AGENT (Grok-Powered + Smart Corrections)")
    print("=" * 60)
    
    invoice_data = state.get("invoice_data")
    
    # Handle missing invoice data (ingestion failed)
    if not invoice_data:
        print("   ❌ No invoice data to validate")
        return {
            "validation_result": {
                "is_valid": False,
                "errors": ["INGESTION: No invoice data provided — extraction may have failed"],
                "warnings": [],
                "inventory_check": {},
                "corrections": {},
            },
            "current_agent": "approval",
        }
    
    # Make a mutable copy of invoice_data for corrections
    corrected_invoice_data = dict(invoice_data)
    corrections = {}  # Track all corrections made
    
    vendor = invoice_data.get("vendor", "UNKNOWN")
    amount = invoice_data.get("amount", 0.0)
    items = invoice_data.get("items", [])
    due_date = invoice_data.get("due_date")
    invoice_date = invoice_data.get("invoice_date")
    payment_terms = invoice_data.get("payment_terms")
    
    print(f"   Vendor: {vendor}")
    print(f"   Amount: ${amount:,.2f}")
    print(f"   Items: {len(items)} line item(s)")
    print(f"   Invoice Date: {invoice_date or 'null'}")
    print(f"   Due Date: {due_date or 'null'}")
    print(f"   Payment Terms: {payment_terms or 'null'}")
    print()
    
    # =========================================================================
    # STEP 0: SMART FIELD CORRECTIONS
    # =========================================================================
    print("   🔧 Checking for field corrections...")
    
    # Validate and correct payment_terms
    payment_terms_result = validate_and_correct_payment_terms(
        payment_terms=payment_terms,
        invoice_date=invoice_date,
        due_date=due_date
    )
    
    if payment_terms_result["was_corrected"]:
        corrected_invoice_data["payment_terms"] = payment_terms_result["corrected_value"]
        corrections["payment_terms"] = {
            "original": payment_terms_result["original_value"],
            "corrected": payment_terms_result["corrected_value"],
            "reason": payment_terms_result["correction_reason"],
            "calculated_days": payment_terms_result["calculated_days"],
        }
        print(f"      ✏️  payment_terms CORRECTED:")
        print(f"         Original: \"{payment_terms_result['original_value'][:50]}...\"" if payment_terms_result['original_value'] and len(payment_terms_result['original_value']) > 50 else f"         Original: \"{payment_terms_result['original_value']}\"")
        print(f"         Corrected: \"{payment_terms_result['corrected_value']}\"")
        print(f"         Reason: {payment_terms_result['correction_reason'][:80]}...")
    else:
        print(f"      ✓ payment_terms OK: \"{payment_terms}\"")
    
    print()
    
    # Step 1: Check inventory database (deterministic)
    print("   🔍 Checking inventory database...")
    inventory_check = validate_inventory(items)
    
    all_available = True
    for item_name, check in inventory_check.items():
        status = "✅" if check["available"] else "❌"
        print(f"      {status} {item_name}: need {check['requested']}, have {check['in_stock']}")
        if not check["available"]:
            all_available = False
    
    # Step 2: Build context for Grok reasoning
    items_summary = ", ".join([f"{item['name']}:{item['quantity']}" for item in items]) or "None"
    inventory_results_str = format_inventory_results(inventory_check)
    
    print()
    print("   🤖 Grok analyzing validation rules...")
    
    # Step 3: Use Grok for validation reasoning
    messages = build_validation_messages(
        vendor=vendor,
        amount=amount,
        due_date=due_date,
        items_summary=items_summary,
        inventory_results=inventory_results_str
    )
    
    try:
        response = call_grok(
            messages=messages,
            json_mode=True,
            max_tokens=600
        )
        
        cleaned_response = clean_json_response(response)
        validation = json.loads(cleaned_response)
        
        is_valid = validation.get("is_valid", False)
        errors = validation.get("errors", [])
        warnings = validation.get("warnings", [])
        
    except Exception as e:
        print(f"   ⚠️ Grok reasoning failed, using deterministic fallback: {e}")
        # Fallback to rule-based validation
        errors = []
        warnings = []
        
        if not all_available:
            for item_name, check in inventory_check.items():
                if not check["available"]:
                    errors.append(
                        f"INVENTORY: {item_name} — requested {check['requested']} "
                        f"but only {check['in_stock']} in stock"
                    )
        if not due_date:
            errors.append("DUE_DATE: Missing or invalid due date")
        if amount <= 0:
            errors.append(f"AMOUNT: Invalid amount (${amount:.2f})")
        if vendor in ("UNKNOWN", "", None):
            errors.append("VENDOR: Missing or unknown vendor")
        if amount > 10000:
            warnings.append(f"AMOUNT: High-value invoice (${amount:,.2f} exceeds $10,000)")
            
        is_valid = len(errors) == 0
    
    # Display results
    print()
    if is_valid:
        print("   ✅ VALIDATION PASSED")
    else:
        print("   ❌ VALIDATION FAILED")
        for error in errors:
            print(f"      • {error}")
    
    if warnings:
        print("   ⚠️  Warnings:")
        for warning in warnings:
            print(f"      • {warning}")
    
    # Add correction warnings if any were made
    if corrections:
        correction_warning = f"CORRECTIONS: {len(corrections)} field(s) were auto-corrected by validation"
        if correction_warning not in warnings:
            warnings.append(correction_warning)
        print()
        print(f"   ✏️  {len(corrections)} field(s) corrected:")
        for field, correction in corrections.items():
            print(f"      • {field}: \"{correction['original']}\" → \"{correction['corrected']}\"")
    
    validation_result: ValidationResult = {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "inventory_check": inventory_check,
        "corrections": corrections,  # NEW: Track all corrections made
    }
    
    return {
        "validation_result": validation_result,
        "invoice_data": corrected_invoice_data,  # Return corrected invoice data
        "current_agent": "approval",
    }


# =============================================================================
# STANDALONE TEST
# =============================================================================

if __name__ == "__main__":
    from src.tools.database import init_database
    
    print()
    print("╔" + "═" * 58 + "╗")
    print("║" + "  VALIDATION AGENT - STANDALONE TEST".center(58) + "║")
    print("╚" + "═" * 58 + "╝")
    
    # Ensure database is initialized
    print("\n📦 Initializing database...")
    init_database()
    
    # Test Case 1: Valid invoice (Invoice 1)
    print("\n" + "─" * 60)
    print("TEST 1: Valid Invoice (should PASS)")
    print("─" * 60)
    
    state1: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Widgets Inc.",
            "amount": 5000.0,
            "items": [
                {"name": "WidgetA", "quantity": 10, "unit_price": 0.0},
                {"name": "WidgetB", "quantity": 5, "unit_price": 0.0},
            ],
            "due_date": "2026-02-01",
            "raw_text": "test",
        },
        "validation_result": None,
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "validation",
        "status": "processing",
        "error": None,
    }
    
    result1 = validation_agent(state1)
    
    # Test Case 2: Invalid invoice (insufficient stock)
    print("\n" + "─" * 60)
    print("TEST 2: Insufficient Stock (should FAIL)")
    print("─" * 60)
    
    state2: WorkflowState = {
        "raw_invoice": "test",
        "invoice_data": {
            "vendor": "Gadgets Co.",
            "amount": 15000.0,
            "items": [
                {"name": "GadgetX", "quantity": 20, "unit_price": 0.0},
            ],
            "due_date": "2026-01-30",
            "raw_text": "test",
        },
        "validation_result": None,
        "approval_decision": None,
        "payment_result": None,
        "current_agent": "validation",
        "status": "processing",
        "error": None,
    }
    
    result2 = validation_agent(state2)
    
    print("\n" + "═" * 60)
    print(f"Test 1 (valid): is_valid = {result1['validation_result']['is_valid']}")
    print(f"Test 2 (stock): is_valid = {result2['validation_result']['is_valid']}")
    print("═" * 60)
