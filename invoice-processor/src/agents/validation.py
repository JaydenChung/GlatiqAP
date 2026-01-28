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
from src.tools.database import validate_inventory, lookup_vendor_by_name, get_all_inventory, check_stock
from src.utils import clean_json_response


# =============================================================================
# VENDOR ENRICHMENT LOGIC (Session 2026-01-27_PERSIST)
# =============================================================================

def enrich_invoice_from_vendor(invoice_data: dict, vendor_profile: dict) -> dict:
    """
    Enrich invoice data with missing fields from vendor master profile.
    
    This fills in gaps that the ingestion agent couldn't extract from the PDF,
    using our stored vendor information.
    
    Args:
        invoice_data: The extracted invoice data (may have missing fields)
        vendor_profile: The vendor profile from our database
        
    Returns:
        Dict of enrichments made: {field: {original, enriched, source}}
    """
    enrichments = {}
    
    # Get or create bill_from structure
    bill_from = invoice_data.get("bill_from") or {}
    if isinstance(bill_from, str):
        # If bill_from is just a string, convert to dict
        bill_from = {"name": bill_from}
    
    # Fields to potentially enrich from vendor profile
    field_mappings = [
        # (invoice_field, vendor_field, bill_from_field)
        ("phone", "phone", "phone"),
        ("email", "email", "email"),
        ("address", "address", "address"),
        ("city", "city", None),
        ("state", "state", None),
        ("zip_code", "zip_code", None),
    ]
    
    for invoice_field, vendor_field, bill_from_field in field_mappings:
        vendor_value = vendor_profile.get(vendor_field)
        
        if not vendor_value:
            continue  # Vendor doesn't have this field either
        
        # Check if invoice is missing this field
        invoice_value = invoice_data.get(invoice_field)
        bill_from_value = bill_from.get(bill_from_field) if bill_from_field else None
        
        # If both invoice root and bill_from are missing this value, enrich it
        if not invoice_value and not bill_from_value:
            # Add to bill_from if applicable
            if bill_from_field:
                bill_from[bill_from_field] = vendor_value
            
            enrichments[invoice_field] = {
                "original": None,
                "enriched": vendor_value,
                "source": f"Vendor Master ({vendor_profile.get('vendor_id')})",
            }
    
    # Also enrich payment_terms if missing and vendor has it
    if not invoice_data.get("payment_terms") and vendor_profile.get("payment_terms"):
        enrichments["payment_terms_from_vendor"] = {
            "original": invoice_data.get("payment_terms"),
            "enriched": vendor_profile.get("payment_terms"),
            "source": f"Vendor Master ({vendor_profile.get('vendor_id')})",
        }
        # Note: We don't override payment_terms here as the date-based calculation is more accurate
        # But we note it for reference
    
    # Update bill_from in invoice_data if we made changes
    if bill_from and any(k in enrichments for k in ["phone", "email", "address"]):
        invoice_data["bill_from"] = bill_from
    
    return enrichments


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
# INVENTORY MATCHING PROMPT (Grok-Powered Fuzzy Matching)
# =============================================================================

INVENTORY_MATCHING_PROMPT = """You are an inventory matching system. Your task is to match invoice line items to inventory items in our database.

## Instructions
For each invoice item, find the BEST matching inventory item. Handle:
- Typos and spelling variations (e.g., "Widgit" → "Widget")
- Model numbers in parentheses (e.g., "Gadget X (Model G-X20)" → "GadgetX")
- Case differences (e.g., "widgeta" → "WidgetA")
- Spacing differences (e.g., "Widget A" → "WidgetA")
- Abbreviations (e.g., "Wgt-A" → "WidgetA")

## Output Schema
Return a JSON object with:
- "matches": array of match objects, one per invoice item
  - "invoice_item": string — the original item name from the invoice
  - "matched_inventory": string or null — the matched inventory item name, or null if no match
  - "confidence": number 0-1 — how confident you are in the match (1.0 = exact, 0.8+ = high, 0.5-0.8 = medium, <0.5 = low)
  - "match_reason": string — brief explanation of why this match was made (or why no match)

## Rules
- Only match to items that actually exist in the inventory list
- If no reasonable match exists, set matched_inventory to null
- Be generous with matching — handle messy real-world inputs
- Confidence should reflect how certain the match is

## Example

INVOICE ITEMS:
- "Gadget X (Model G-X20)"
- "Widget Type A, Premium"
- "FakeProduct123"

AVAILABLE INVENTORY:
- WidgetA (15 in stock)
- WidgetB (10 in stock)
- GadgetX (5 in stock)

OUTPUT:
{
  "matches": [
    {"invoice_item": "Gadget X (Model G-X20)", "matched_inventory": "GadgetX", "confidence": 0.95, "match_reason": "Core name 'Gadget X' matches 'GadgetX' after removing model number and normalizing"},
    {"invoice_item": "Widget Type A, Premium", "matched_inventory": "WidgetA", "confidence": 0.85, "match_reason": "Core name 'Widget...A' matches 'WidgetA' after removing descriptor"},
    {"invoice_item": "FakeProduct123", "matched_inventory": null, "confidence": 0, "match_reason": "No similar item found in inventory"}
  ]
}"""


# =============================================================================
# INVENTORY MATCHING FUNCTION
# =============================================================================

def match_invoice_items_to_inventory(invoice_items: list[dict]) -> dict:
    """
    Use Grok to fuzzy-match invoice items to inventory items.
    
    This handles typos, model numbers, case differences, etc.
    
    Args:
        invoice_items: List of invoice line items with 'name' and 'quantity'
        
    Returns:
        Dict with:
        - matches: list of match results
        - matched_inventory_check: dict mapping matched names to stock info
    """
    # Get all inventory items from database
    all_inventory = get_all_inventory()
    
    if not all_inventory:
        return {
            "matches": [],
            "matched_inventory_check": {},
            "error": "No inventory items in database"
        }
    
    # Build inventory list for prompt
    inventory_list = "\n".join([
        f"- {item['item']} ({item['stock']} in stock)"
        for item in all_inventory
    ])
    
    # Build invoice items list for prompt
    invoice_items_list = "\n".join([
        f"- \"{item.get('name', 'UNKNOWN')}\""
        for item in invoice_items
    ])
    
    # Build the prompt
    messages = [
        {
            "role": "system",
            "content": INVENTORY_MATCHING_PROMPT
        },
        {
            "role": "user",
            "content": f"""Match these invoice items to inventory:

INVOICE ITEMS:
{invoice_items_list}

AVAILABLE INVENTORY:
{inventory_list}

Return the matches as JSON."""
        }
    ]
    
    try:
        response = call_grok(
            messages=messages,
            json_mode=True,
            max_tokens=500
        )
        
        cleaned_response = clean_json_response(response)
        result = json.loads(cleaned_response)
        matches = result.get("matches", [])
        
    except Exception as e:
        print(f"   ⚠️ Grok matching failed, using exact matching fallback: {e}")
        # Fallback to exact matching
        matches = []
        for item in invoice_items:
            item_name = item.get("name", "")
            exact_match = check_stock(item_name)
            if exact_match:
                matches.append({
                    "invoice_item": item_name,
                    "matched_inventory": item_name,
                    "confidence": 1.0,
                    "match_reason": "Exact match"
                })
            else:
                matches.append({
                    "invoice_item": item_name,
                    "matched_inventory": None,
                    "confidence": 0,
                    "match_reason": "No match found (exact matching only)"
                })
    
    # Now do stock checks using matched names
    matched_inventory_check = {}
    for i, match in enumerate(matches):
        invoice_item = match.get("invoice_item", "")
        matched_name = match.get("matched_inventory")
        quantity = invoice_items[i].get("quantity", 0) if i < len(invoice_items) else 0
        
        if matched_name:
            stock_info = check_stock(matched_name)
            if stock_info:
                in_stock = stock_info["stock"]
                available = in_stock >= quantity
                matched_inventory_check[invoice_item] = {
                    "invoice_item": invoice_item,
                    "matched_to": matched_name,
                    "confidence": match.get("confidence", 0),
                    "match_reason": match.get("match_reason", ""),
                    "requested": quantity,
                    "in_stock": in_stock,
                    "available": available,
                    "variance": in_stock - quantity,  # Negative = shortage
                }
            else:
                # Matched name not found in DB (shouldn't happen but be safe)
                matched_inventory_check[invoice_item] = {
                    "invoice_item": invoice_item,
                    "matched_to": matched_name,
                    "confidence": match.get("confidence", 0),
                    "match_reason": match.get("match_reason", ""),
                    "requested": quantity,
                    "in_stock": 0,
                    "available": False,
                    "variance": -quantity,
                }
        else:
            # No match found
            matched_inventory_check[invoice_item] = {
                "invoice_item": invoice_item,
                "matched_to": None,
                "confidence": 0,
                "match_reason": match.get("match_reason", "No match found"),
                "requested": quantity,
                "in_stock": 0,
                "available": False,
                "variance": -quantity,
            }
    
    return {
        "matches": matches,
        "matched_inventory_check": matched_inventory_check,
    }


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
        status = "✓ AVAILABLE" if check.get("available") else "✗ INSUFFICIENT"
        matched_to = check.get("matched_to")
        
        if matched_to and matched_to != item_name:
            # Show the fuzzy match
            lines.append(
                f"- {item_name} (matched to '{matched_to}'): "
                f"requested={check.get('requested', 0)}, "
                f"in_stock={check.get('in_stock', 0)}, status={status}"
            )
        elif matched_to:
            # Exact match
            lines.append(
                f"- {item_name}: requested={check.get('requested', 0)}, "
                f"in_stock={check.get('in_stock', 0)}, status={status}"
            )
        else:
            # No match found
            lines.append(
                f"- {item_name}: NO MATCH IN INVENTORY (requested={check.get('requested', 0)})"
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
    enrichments = {}  # Track vendor enrichments
    
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
    # STEP 0A: VENDOR ENRICHMENT FROM DATABASE
    # =========================================================================
    print("   🏢 Looking up vendor in database...")
    
    vendor_profile = lookup_vendor_by_name(vendor)
    
    if vendor_profile:
        print(f"      ✅ Found vendor: {vendor_profile['name']} ({vendor_profile['vendor_id']})")
        
        # Check vendor status
        if vendor_profile.get("status") == "suspended":
            print(f"      ⚠️  WARNING: Vendor is SUSPENDED!")
        
        # Enrich invoice with missing fields from vendor profile
        enrichments = enrich_invoice_from_vendor(corrected_invoice_data, vendor_profile)
        
        if enrichments:
            print(f"      📝 Enriched {len(enrichments)} field(s) from vendor profile:")
            for field, enrich_data in enrichments.items():
                print(f"         • {field}: {enrich_data['enriched']} (from {enrich_data['source']})")
            
            # Add enrichments to corrections for tracking
            for field, enrich_data in enrichments.items():
                corrections[field] = {
                    "original": enrich_data["original"],
                    "corrected": enrich_data["enriched"],
                    "reason": f"Enriched from {enrich_data['source']}",
                    "enrichment_type": "vendor_master",
                }
        else:
            print("      ✓ No missing fields to enrich")
        
        # Store vendor_id for reference
        corrected_invoice_data["matched_vendor_id"] = vendor_profile["vendor_id"]
        corrected_invoice_data["vendor_status"] = vendor_profile.get("status")
        corrected_invoice_data["vendor_risk_level"] = vendor_profile.get("risk_level")
    else:
        print(f"      ❌ Vendor not found in database: '{vendor}'")
        print("         Invoice will proceed but vendor cannot be enriched")
    
    print()
    
    # =========================================================================
    # STEP 0B: SMART FIELD CORRECTIONS
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
    
    # Step 1: GROK-POWERED INVENTORY MATCHING (handles typos, variations)
    print("   🔍 Matching invoice items to inventory (Grok-powered)...")
    
    matching_result = match_invoice_items_to_inventory(items)
    inventory_check = matching_result.get("matched_inventory_check", {})
    matches = matching_result.get("matches", [])
    
    # Display matching results
    all_available = True
    for item_name, check in inventory_check.items():
        matched_to = check.get("matched_to")
        confidence = check.get("confidence", 0)
        
        if matched_to:
            status = "✅" if check["available"] else "❌"
            match_indicator = f" → matched to '{matched_to}' ({confidence*100:.0f}%)" if matched_to != item_name else ""
            print(f"      {status} {item_name}{match_indicator}: need {check['requested']}, have {check['in_stock']}")
            if not check["available"]:
                all_available = False
        else:
            print(f"      ❌ {item_name}: NO MATCH FOUND in inventory")
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
    
    # Add vendor-related warnings if applicable
    if vendor_profile:
        if vendor_profile.get("status") == "suspended":
            errors.append(f"VENDOR: {vendor} is SUSPENDED in vendor master — do not process")
            is_valid = False
        if vendor_profile.get("risk_level") == "high":
            warnings.append(f"VENDOR: {vendor} is flagged as HIGH RISK")
        if vendor_profile.get("compliance_status") != "complete":
            warnings.append(f"VENDOR: {vendor} has incomplete compliance documentation")
    
    # Build detailed line items for frontend display
    line_items_validated = []
    for item in items:
        item_name = item.get("name", "UNKNOWN")
        check = inventory_check.get(item_name, {})
        
        line_item_detail = {
            "name": item_name,
            "quantity_requested": item.get("quantity", 0),
            "unit_price": item.get("unit_price", 0),
            "amount": item.get("amount", 0),
            # Matching info
            "matched_to": check.get("matched_to"),
            "match_confidence": check.get("confidence", 0),
            "match_reason": check.get("match_reason", ""),
            # Stock info
            "in_stock": check.get("in_stock", 0),
            "available": check.get("available", False),
            "variance": check.get("variance", 0),  # Negative = shortage
            # Flags for UI
            "has_stock_issue": not check.get("available", False),
            "is_fuzzy_match": check.get("matched_to") and check.get("matched_to") != item_name,
            "no_match_found": check.get("matched_to") is None,
        }
        line_items_validated.append(line_item_detail)
    
    validation_result: ValidationResult = {
        "is_valid": is_valid,
        "errors": errors,
        "warnings": warnings,
        "inventory_check": inventory_check,
        "line_items_validated": line_items_validated,  # NEW: Detailed per-item info for frontend
        "corrections": corrections,  # Includes both corrections and enrichments
        "matched_vendor": vendor_profile.get("vendor_id") if vendor_profile else None,
        "enrichments": enrichments,  # Separate tracking of enrichments
        # Full vendor profile from vendor master (Session 2026-01-28_VENDOR)
        # Used to populate Vendor Compliance section from authoritative source
        "vendor_profile": vendor_profile,
    }
    
    return {
        "validation_result": validation_result,
        "invoice_data": corrected_invoice_data,  # Return corrected/enriched invoice data
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
