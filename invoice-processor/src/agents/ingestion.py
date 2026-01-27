"""
Ingestion Agent
===============
Parse raw invoice text (or PDF) into structured InvoiceData using Grok JSON mode.

This agent:
1. Takes raw invoice text OR a PDF file path
2. If PDF: extracts text using pdfplumber
3. Uses Grok with JSON mode to extract structured data
4. **Self-corrects** if extraction produces low-confidence results (Phase 3)
5. Returns InvoiceData TypedDict for downstream agents

Session: 2026-01-27_INGEST (PDF Support added)
Session: 2026-01-26_PHOENIX (Self-Correction added)
Original: 2026-01-26_FORGE
Builder: PRAG-001 (The Implementer)
Prompts: LLM-002 (Prompt Engineer) — Senior-level pattern
Self-Correction: CORR-001 (Feedback Loop Designer)
PDF Integration: DOC-001 (PDF Extraction Expert)
"""

import json
from pathlib import Path
from typing import List, Optional

# Initialize path setup via package init
import src  # noqa: F401 - triggers path setup in __init__.py

from src.client import call_grok
from src.schemas.models import WorkflowState, InvoiceData, InvoiceItem, ContactInfo
from src.tools.pdf_extractor import extract_pdf, PDFExtractionResult
from src.utils import clean_json_response, safe_get


# =============================================================================
# PDF DETECTION & EXTRACTION (Session 2026-01-27_INGEST)
# =============================================================================

def _is_pdf_input(input_data: str) -> bool:
    """
    Determine if input is a PDF file path.
    
    Simple heuristic: check if it ends with .pdf or if the path exists as a PDF.
    We intentionally do NOT auto-detect arbitrary file paths for security.
    """
    input_clean = input_data.strip()
    
    # Check for .pdf extension (case insensitive)
    if input_clean.lower().endswith('.pdf'):
        return True
    
    # Additional check: if the path exists and is a file
    try:
        path = Path(input_clean)
        if path.exists() and path.is_file() and path.suffix.lower() == '.pdf':
            return True
    except (OSError, ValueError):
        pass
    
    return False


def _extract_from_pdf_if_needed(input_data: str) -> tuple[str, Optional[str], Optional[dict]]:
    """
    Extract text from PDF if input is a PDF path, otherwise return raw text.
    
    Returns:
        Tuple of (text_content, error_message, pdf_metadata)
        - text_content: The text to process (extracted from PDF or original)
        - error_message: Error if PDF extraction failed (None if success)
        - pdf_metadata: Dict with source_path, page_count, etc. (None if not PDF)
    """
    if not _is_pdf_input(input_data):
        # Not a PDF - return the raw text as-is
        return input_data, None, None
    
    # It's a PDF - extract text
    pdf_path = input_data.strip()
    print(f"   📄 Detected PDF input: {pdf_path}")
    print("   📄 Extracting text from PDF...")
    
    result = extract_pdf(pdf_path)
    
    pdf_metadata = {
        "source_type": "pdf",
        "source_path": result.source_path,
        "page_count": result.page_count,
        "is_scanned": result.is_likely_scanned,
        "warnings": result.warnings,
    }
    
    if not result.success:
        return "", result.error, pdf_metadata
    
    print(f"   ✅ PDF extracted: {len(result.text)} chars from {result.page_count} page(s)")
    if result.warnings:
        print(f"   ⚠️  Warnings: {', '.join(result.warnings)}")
    
    return result.text, None, pdf_metadata


# =============================================================================
# PROMPTS (Senior-Level Prompt Engineering)
# =============================================================================

SYSTEM_PROMPT = """You are an invoice data extraction system for an enterprise accounts payable workflow.

Your task: Extract ALL structured data from raw invoice text that an AP clerk would manually key, handling messy real-world inputs gracefully.

## Output Schema
Return a JSON object with these fields (use defaults for missing data, NEVER omit fields):

### Header Details
- "invoice_number": string — Invoice ID/number. Use "UNKNOWN" if not found.
- "invoice_date": string|null — Invoice creation date (YYYY-MM-DD), or null if unparseable.
- "due_date": string|null — Payment due date (YYYY-MM-DD), or null if unparseable.

### Amounts
- "amount": number — Invoice TOTAL. Use 0.0 if not parseable.
- "subtotal": number — Subtotal before tax. Use 0.0 or calculate from total - tax if not explicit.
- "tax": number — Tax amount. Use 0.0 if not found.
- "currency": string — Currency code (USD, EUR, CAD, GBP, etc.). Default "USD" if not specified.

### Payment Info
- "payment_terms": string|null — Terms like "Net 30", "Net 60", "Due on Receipt". null if not found.
- "po_number": string|null — Purchase Order reference. null if not found.

### Bill From (Vendor)
- "vendor": string — Vendor company name (for legacy compatibility). Use "UNKNOWN" if not determinable.
- "bill_from": object — Vendor contact block:
  - "name": string — Company name
  - "address": string|null — Full mailing address
  - "email": string|null — Contact email
  - "phone": string|null — Contact phone

### Bill To (Customer/Buyer)
- "bill_to": object — Customer contact block:
  - "name": string|null — Company/person name
  - "address": string|null — Billing address  
  - "entity": string|null — Business entity name

### Line Items
- "items": array — Line items, each with:
  - "sku": string|null — Item SKU/code
  - "description": string — Item description (required)
  - "quantity": integer — Quantity (default 1)
  - "unit_price": number — Unit price/rate (default 0.0)
  - "amount": number — Line total (qty * unit_price, or explicit value)

### Extraction Metadata
- "confidence": integer — Your confidence in extraction accuracy (0-100)
- "flags": array — List of issues detected: "missing_vendor", "missing_amount", "unparseable_date", "missing_line_items", "possible_fraud", "unusually_high_amount", etc.

## Extraction Rules

### Vendor/Names
- Normalize abbreviations: Vndr→Vendor, Corp→Corporation (but preserve original if clear)
- Look for: "From:", "Vendor:", "Bill From:", "Supplier:", company letterhead

### Amounts
- Strip currency symbols ($, €, £, ¥)
- Parse comma/period separators ("5,000.00" → 5000.0, European "5.000,00" → 5000.0)
- Look for: "Total:", "Amount Due:", "Grand Total:", "Balance:", "Invoice Total:"
- Tax: Look for "Tax:", "VAT:", "GST:", "Sales Tax:"

### Dates
- Convert ALL dates to YYYY-MM-DD format
- Parse: "Jan 15, 2026", "1/15/26", "15-Jan-2026", "2026-01-15"
- Relative dates ("yesterday", "ASAP", "immediately") → null (flag as "unparseable_date")

### Items
- Parse various formats:
  - "ItemA:10" → sku: null, description: "ItemA", quantity: 10
  - "ItemA x 10 @ $5.00" → quantity: 10, unit_price: 5.0
  - "10 units ItemA" → quantity: 10, description: "ItemA"
  - Tabular: "Widget A | 10 | $50.00 | $500.00"
- If only total is given with no breakdown, create single item with total as amount

### Contact Info
- Address: Combine street, city, state, zip into single string
- Phone: Preserve formatting or normalize to (XXX) XXX-XXXX
- Email: Look for @domain patterns

## Edge Case Handling
- Missing fields: Use defaults — NEVER omit a field from output
- Partial data: Extract what you can, flag what's missing
- Ambiguous data: Make reasonable inference, lower confidence score
- Garbage input: Return all defaults, set confidence to 0, flag as "unparseable"
- Potential fraud indicators: Unusually high amounts, suspicious vendor names, future dates → flag them

## Quality Standards
- Be PRECISE: Extract exactly what's written
- Be COMPLETE: Always return ALL fields in the schema
- Be HONEST: Set confidence appropriately, flag issues
- Same input should always produce same output"""


FEW_SHOT_EXAMPLE = """## Examples

### Example 1: Complete Invoice
INPUT:
INVOICE #INV-2026-0042
Date: January 15, 2026

Bill From:
Acme Corp
123 Industrial Way, Austin, TX 78701
billing@acme.com | (512) 555-1234

Bill To:
TechCorp Inc
100 Tech Plaza, San Francisco, CA 94105

Items:
Bolt-A7    50 @ $2.00    $100.00
Nut-B3     100 @ $0.50   $50.00

Subtotal: $150.00
Tax (8%): $12.00
Total Due: $162.00

Terms: Net 30
Due Date: Feb 15, 2026
PO#: PO-2026-1001

OUTPUT:
{"invoice_number": "INV-2026-0042", "invoice_date": "2026-01-15", "due_date": "2026-02-15", "amount": 162.0, "subtotal": 150.0, "tax": 12.0, "currency": "USD", "payment_terms": "Net 30", "po_number": "PO-2026-1001", "vendor": "Acme Corp", "bill_from": {"name": "Acme Corp", "address": "123 Industrial Way, Austin, TX 78701", "email": "billing@acme.com", "phone": "(512) 555-1234"}, "bill_to": {"name": "TechCorp Inc", "address": "100 Tech Plaza, San Francisco, CA 94105", "entity": null}, "items": [{"sku": "Bolt-A7", "description": "Bolt-A7", "quantity": 50, "unit_price": 2.0, "amount": 100.0}, {"sku": "Nut-B3", "description": "Nut-B3", "quantity": 100, "unit_price": 0.5, "amount": 50.0}], "confidence": 98, "flags": []}

### Example 2: Messy Invoice with Abbreviations
INPUT:
Vndr: Gadgets Co.
Amt: $15,000
Itms: GadgetX:20
Due: 2026-01-30

OUTPUT:
{"invoice_number": "UNKNOWN", "invoice_date": null, "due_date": "2026-01-30", "amount": 15000.0, "subtotal": 15000.0, "tax": 0.0, "currency": "USD", "payment_terms": null, "po_number": null, "vendor": "Gadgets Co.", "bill_from": {"name": "Gadgets Co.", "address": null, "email": null, "phone": null}, "bill_to": {"name": null, "address": null, "entity": null}, "items": [{"sku": null, "description": "GadgetX", "quantity": 20, "unit_price": 750.0, "amount": 15000.0}], "confidence": 65, "flags": ["missing_invoice_number", "missing_invoice_date", "missing_bill_to"]}

### Example 3: Problematic Invoice (Potential Fraud Indicators)
INPUT:
Vendor: Fraudster LLC
Amount: 100000
Items: FakeItem:100
Due: yesterday

OUTPUT:
{"invoice_number": "UNKNOWN", "invoice_date": null, "due_date": null, "amount": 100000.0, "subtotal": 100000.0, "tax": 0.0, "currency": "USD", "payment_terms": null, "po_number": null, "vendor": "Fraudster LLC", "bill_from": {"name": "Fraudster LLC", "address": null, "email": null, "phone": null}, "bill_to": {"name": null, "address": null, "entity": null}, "items": [{"sku": null, "description": "FakeItem", "quantity": 100, "unit_price": 1000.0, "amount": 100000.0}], "confidence": 40, "flags": ["missing_invoice_number", "unusually_high_amount", "unparseable_date", "suspicious_vendor_name", "missing_bill_to"]}"""


# =============================================================================
# SELF-CORRECTION PROMPTS (Phase 3 Enhancement)
# =============================================================================

RETRY_PROMPT_HINT = """IMPORTANT: Your previous extraction attempt may have missed key information.

Please re-examine the invoice text VERY carefully for ALL fields:

HEADER DETAILS:
- Invoice Number: Look for "#", "Invoice #", "Inv:", "Reference:", or any alphanumeric ID
- Dates: Look for ANY date patterns (MM/DD/YYYY, "Jan 15", etc.) — one for invoice date, one for due date
- Amounts: Look for Total, Amount Due, Grand Total, Balance — this is the most critical field

PARTIES:
- Vendor/Bill From: Company name at top, letterhead, "From:", "Vendor:", "Supplier:"
- Bill To: "To:", "Bill To:", "Ship To:", customer name

CONTACT INFO:
- Addresses: Street, City, State, ZIP combined
- Email: Any @domain pattern
- Phone: Any phone number pattern

LINE ITEMS:
- Look for tabular data, item lists, descriptions with quantities and prices
- Calculate unit_price if only total and quantity given

PAYMENT INFO:
- Terms: "Net 30", "Net 60", "Due on Receipt", "COD"
- PO Number: "PO#", "Purchase Order", "Order #"

Extract SOMETHING for each field if there's any relevant text. Only use defaults if truly absent.
Lower confidence if many fields are missing or ambiguous."""


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def _needs_retry(extracted: dict, raw_text: str) -> bool:
    """
    Determine if extraction result needs a retry attempt.
    
    Triggers retry if:
    - Vendor is "UNKNOWN" but raw text has content
    - Amount is 0.0 but raw text appears to have numbers
    - Both vendor and amount are defaults (strong signal of extraction failure)
    - Confidence is below threshold (indicates extraction struggled)
    - Too many critical fields are missing
    
    Args:
        extracted: Parsed extraction result from Grok
        raw_text: Original invoice text
        
    Returns:
        True if a retry is warranted
    """
    vendor = extracted.get("vendor", "UNKNOWN")
    amount = float(extracted.get("amount", 0.0))
    confidence = int(extracted.get("confidence", 0))
    flags = extracted.get("flags", [])
    
    # Check if raw text has meaningful content
    text_has_content = len(raw_text.strip()) > 20
    text_has_numbers = any(c.isdigit() for c in raw_text)
    
    # Trigger conditions
    vendor_is_default = vendor == "UNKNOWN"
    amount_is_default = amount == 0.0
    
    # Low confidence = retry
    if confidence < 50 and text_has_content:
        return True
    
    # Too many flags = retry
    critical_flags = ["missing_vendor", "missing_amount", "unparseable"]
    critical_count = sum(1 for f in flags if any(c in f for c in critical_flags))
    if critical_count >= 2 and text_has_content:
        return True
    
    # Retry if defaults were used but input suggests real data exists
    if vendor_is_default and amount_is_default and text_has_content:
        return True
    
    if vendor_is_default and text_has_content and len(raw_text) > 30:
        # Only retry for vendor if there's substantial text
        return True
    
    if amount_is_default and text_has_numbers:
        # Only retry for amount if there are numbers in the input
        return True
    
    return False


def _build_retry_messages(invoice_text: str) -> List[dict]:
    """
    Build messages for retry attempt with enhanced extraction hints.
    
    Uses the same system prompt but adds explicit guidance for
    looking harder at ambiguous input.
    """
    return [
        {
            "role": "system",
            "content": SYSTEM_PROMPT + "\n\n" + FEW_SHOT_EXAMPLE
        },
        {
            "role": "user",
            "content": f"{RETRY_PROMPT_HINT}\n\nExtract invoice data from:\n\n{invoice_text.strip()}"
        }
    ]


def build_extraction_messages(invoice_text: str) -> List[dict]:
    """
    Build the messages array with system prompt, few-shot example, and user input.
    
    This structure follows LLM best practices:
    - System message: Role definition, rules, schema (persistent context)
    - User message: The actual data to process (variable input)
    """
    return [
        {
            "role": "system",
            "content": SYSTEM_PROMPT + "\n\n" + FEW_SHOT_EXAMPLE
        },
        {
            "role": "user",
            "content": f"Extract invoice data from the following text:\n\n{invoice_text.strip()}"
        }
    ]


# =============================================================================
# AGENT FUNCTION
# =============================================================================

def ingestion_agent(state: WorkflowState) -> dict:
    """
    Parse raw invoice text OR PDF into structured InvoiceData.
    
    Uses Grok with JSON mode for reliable structured extraction.
    Implements defensive defaults for all fields.
    
    **PDF Support (Session 2026-01-27_INGEST):**
    If input is a PDF file path, extracts text using pdfplumber first,
    then processes the extracted text through the normal pipeline.
    
    **Self-Correction (Phase 3):**
    If initial extraction produces low-confidence results (UNKNOWN vendor
    or 0.0 amount when input suggests real data), the agent retries once
    with enhanced extraction hints.
    
    Args:
        state: WorkflowState containing raw_invoice (text OR pdf path)
        
    Returns:
        Dict with invoice_data and updated current_agent
    """
    print()
    print("=" * 60)
    print("📥 INGESTION AGENT (Grok-Powered + PDF Support + Self-Correction)")
    print("=" * 60)
    
    raw_input = state["raw_invoice"]
    
    # =========================================================================
    # PDF EXTRACTION (if applicable)
    # =========================================================================
    raw_invoice, pdf_error, pdf_metadata = _extract_from_pdf_if_needed(raw_input)
    
    # Handle PDF extraction failure
    if pdf_error:
        print(f"   ❌ PDF extraction failed: {pdf_error}")
        return {
            "invoice_data": None,
            "current_agent": "validation",
            "status": "failed",
            "error": f"PDF extraction failed: {pdf_error}",
        }
    
    # Log input source
    if pdf_metadata:
        print(f"   📄 Source: PDF ({pdf_metadata['page_count']} pages)")
    else:
        print(f"   📄 Source: Raw text")
    
    print(f"   Input: {raw_invoice.strip()[:60]}...")
    print("   Status: Extracting with Grok...")
    print()
    
    # Build structured messages (system + user separation)
    messages = build_extraction_messages(raw_invoice)
    
    # Track retry state for observability
    retry_attempted = False
    
    try:
        # ATTEMPT 1: Initial extraction
        response = call_grok(
            messages=messages,
            json_mode=True,
            max_tokens=1500  # Increased for larger schema
        )
        
        # Clean and parse the JSON response
        cleaned_response = clean_json_response(response)
        extracted = json.loads(cleaned_response)
        
        # =====================================================================
        # SELF-CORRECTION CHECK (Phase 3)
        # =====================================================================
        if _needs_retry(extracted, raw_invoice):
            print("   ⚠️  Low-confidence extraction detected")
            print("   🔄 SELF-CORRECTION: Retrying with enhanced hints...")
            print()
            retry_attempted = True
            
            # ATTEMPT 2: Retry with explicit hints
            retry_messages = _build_retry_messages(raw_invoice)
            retry_response = call_grok(
                messages=retry_messages,
                json_mode=True,
                max_tokens=1500
            )
            
            retry_cleaned = clean_json_response(retry_response)
            retry_extracted = json.loads(retry_cleaned)
            
            # Compare using confidence and completeness
            original_confidence = int(extracted.get("confidence", 0))
            retry_confidence = int(retry_extracted.get("confidence", 0))
            
            # Score based on: confidence + filled fields
            def _score_extraction(ext):
                score = int(ext.get("confidence", 0))
                if ext.get("vendor", "UNKNOWN") != "UNKNOWN": score += 10
                if float(ext.get("amount", 0.0)) > 0: score += 10
                if ext.get("invoice_number", "UNKNOWN") != "UNKNOWN": score += 5
                if ext.get("invoice_date"): score += 5
                if ext.get("due_date"): score += 5
                if len(ext.get("items", [])) > 0: score += 5
                if ext.get("bill_from", {}).get("name"): score += 5
                return score
            
            original_score = _score_extraction(extracted)
            retry_score = _score_extraction(retry_extracted)
            
            if retry_score > original_score:
                print(f"   ✅ Self-correction improved extraction! ({original_score} → {retry_score})")
                extracted = retry_extracted
            else:
                print(f"   ℹ️  Self-correction did not improve; using original ({original_score} vs {retry_score})")
        
        # =====================================================================
        # EXTRACT ALL FIELDS WITH DEFENSIVE DEFAULTS
        # =====================================================================
        
        # Header Details
        invoice_number = safe_get(extracted, "invoice_number", "UNKNOWN")
        invoice_date = extracted.get("invoice_date")  # Can be None
        due_date = extracted.get("due_date")  # Can be None
        
        # Amounts
        amount = float(safe_get(extracted, "amount", 0.0))
        subtotal = float(safe_get(extracted, "subtotal", amount))  # Default to amount
        tax = float(safe_get(extracted, "tax", 0.0))
        currency = safe_get(extracted, "currency", "USD")
        
        # Payment Info
        payment_terms = extracted.get("payment_terms")  # Can be None
        po_number = extracted.get("po_number")  # Can be None
        
        # Vendor (legacy + structured)
        vendor = safe_get(extracted, "vendor", "UNKNOWN")
        bill_from_raw = safe_get(extracted, "bill_from", {})
        bill_from: ContactInfo = {
            "name": safe_get(bill_from_raw, "name", vendor),
            "address": bill_from_raw.get("address"),
            "email": bill_from_raw.get("email"),
            "phone": bill_from_raw.get("phone"),
        }
        
        # Bill To
        bill_to_raw = safe_get(extracted, "bill_to", {})
        bill_to: ContactInfo = {
            "name": bill_to_raw.get("name"),
            "address": bill_to_raw.get("address"),
            "entity": bill_to_raw.get("entity"),
        }
        
        # Metadata
        confidence = int(safe_get(extracted, "confidence", 50))
        flags = safe_get(extracted, "flags", [])
        
        # Line items
        items_raw = safe_get(extracted, "items", [])
        
        # Print extraction summary
        print(f"   ✅ Invoice #: {invoice_number}")
        print(f"   ✅ Vendor: {vendor}")
        print(f"   ✅ Amount: ${amount:,.2f} {currency}")
        print(f"   ✅ Items: {len(items_raw)} line item(s)")
        print(f"   ✅ Invoice Date: {invoice_date or 'null'}")
        print(f"   ✅ Due Date: {due_date or 'null'}")
        print(f"   ✅ Payment Terms: {payment_terms or 'null'}")
        print(f"   ✅ PO Number: {po_number or 'null'}")
        print(f"   📊 Confidence: {confidence}%")
        if flags:
            print(f"   ⚠️  Flags: {', '.join(flags)}")
        if retry_attempted:
            print(f"   🔄 Self-correction: ATTEMPTED")
        
    except json.JSONDecodeError as e:
        print(f"   ❌ JSON parsing failed: {e}")
        return {
            "invoice_data": None,
            "current_agent": "validation",
            "status": "failed",
            "error": f"Ingestion failed: Invalid JSON response - {e}",
        }
    except Exception as e:
        print(f"   ❌ Extraction failed: {e}")
        return {
            "invoice_data": None,
            "current_agent": "validation",
            "status": "failed",
            "error": f"Ingestion failed: {e}",
        }
    
    # Transform to our TypedDict structure with defensive defaults
    items: List[InvoiceItem] = []
    for item in items_raw:
        items.append({
            "sku": item.get("sku"),
            "name": safe_get(item, "description", safe_get(item, "name", "Unknown")),  # description > name
            "description": safe_get(item, "description", safe_get(item, "name", "Unknown")),
            "quantity": int(safe_get(item, "quantity", 1)),
            "unit_price": float(safe_get(item, "unit_price", 0.0)),
            "amount": float(safe_get(item, "amount", 0.0)),
        })
    
    # Determine source type for provenance
    source_type = pdf_metadata["source_type"] if pdf_metadata else "text"
    source_path = pdf_metadata.get("source_path") if pdf_metadata else None
    
    invoice_data: InvoiceData = {
        # Header Details
        "invoice_number": invoice_number,
        "invoice_date": invoice_date,
        "due_date": due_date,
        
        # Amounts
        "amount": amount,
        "subtotal": subtotal,
        "tax": tax,
        "currency": currency,
        
        # Payment Info
        "payment_terms": payment_terms,
        "po_number": po_number,
        
        # Parties
        "vendor": vendor,
        "bill_from": bill_from,
        "bill_to": bill_to,
        
        # Line Items
        "items": items,
        
        # Metadata (enhanced for PDF provenance)
        "raw_text": raw_invoice,
        "confidence": confidence,
        "flags": flags,
        "source_type": source_type,
        "source_path": source_path,
    }
    
    print()
    print("   📄 InvoiceData created successfully (all fields populated)")
    
    return {
        "invoice_data": invoice_data,
        "current_agent": "validation",
    }


# =============================================================================
# STANDALONE TEST
# =============================================================================

if __name__ == "__main__":
    import sys
    
    print()
    print("╔" + "═" * 68 + "╗")
    print("║" + "  INGESTION AGENT - FULL EXTRACTION TEST".center(68) + "║")
    print("║" + "  (PDF Support + All Fields + Self-Correction)".center(68) + "║")
    print("╚" + "═" * 68 + "╝")
    
    # Check for PDF test argument
    if len(sys.argv) > 1 and sys.argv[1].endswith('.pdf'):
        print(f"\n🧪 Testing with PDF: {sys.argv[1]}")
        test_state: WorkflowState = {
            "raw_invoice": sys.argv[1],  # PDF path
            "invoice_data": None,
            "validation_result": None,
            "approval_analysis": None,
            "approval_decision": None,
            "payment_result": None,
            "invoice_status": None,
            "current_agent": "ingestion",
            "status": "processing",
            "error": None,
            "approved_by": None,
            "approved_at": None,
            "rejected_by": None,
            "rejected_at": None,
            "rejection_reason": None,
        }
        result = ingestion_agent(test_state)
        data = result.get("invoice_data", {})
        if data:
            print("\n📋 EXTRACTION SUMMARY:")
            print(f"├─ Source: {data.get('source_type', 'N/A')} ({data.get('source_path', 'N/A')})")
            print(f"├─ Invoice #: {data.get('invoice_number', 'N/A')}")
            print(f"├─ Vendor: {data.get('vendor', 'N/A')}")
            print(f"├─ Amount: ${data.get('amount', 0):,.2f}")
            print(f"├─ Items: {len(data.get('items', []))} line item(s)")
            print(f"├─ Confidence: {data.get('confidence', 0)}%")
            print(f"└─ Flags: {data.get('flags', []) or 'None'}")
        else:
            print(f"\n❌ EXTRACTION FAILED: {result.get('error', 'Unknown error')}")
        sys.exit(0)
    
    # Test with Invoice 1: Complete professional invoice
    test_invoice_1 = """
INVOICE #INV-2026-0042
Date: January 26, 2026

Bill From:
Widgets Inc.
500 Widget Way, Austin, TX 78701
ar@widgets.com | (512) 555-9876

Bill To:
TechCorp Inc.
100 Tech Plaza, San Francisco, CA 94105

PO#: PO-2025-0892

Items:
WidgetA    10 @ $300.00   $3,000.00
WidgetB    5 @ $400.00    $2,000.00

Subtotal: $5,000.00
Tax (0%): $0.00
Total Due: $5,000.00

Terms: Net 30
Due Date: February 25, 2026
"""
    
    # Test with Invoice 2: Messy abbreviations (realistic AP nightmare)
    test_invoice_2 = """
Vndr: Gadgets Co.
Amt: $15,000
Itms: GadgetX:20
Due: 2026-01-30
"""
    
    # Test with Invoice 3: Challenging format (may trigger self-correction)
    test_invoice_3 = """
Really messy invoice
Supplier: SuperParts LLC
123 Parts Ave, Seattle WA 98101
Total due: approximately 7500 dollars
Order: 50x BoltX @ $100, 30x NutY @ $83.33
Pay by end of Feb
Net 45 terms
"""
    
    # Test with Invoice 4: Potential fraud indicators
    test_invoice_4 = """
Vendor: Fraudster LLC
Amount: 100000
Items: FakeItem:100
Due: yesterday
"""
    
    def run_test(name: str, invoice_text: str):
        print("\n" + "─" * 68)
        print(f"TEST: {name}")
        print("─" * 68)
        
        state: WorkflowState = {
            "raw_invoice": invoice_text,
            "invoice_data": None,
            "validation_result": None,
            "approval_analysis": None,
            "approval_decision": None,
            "payment_result": None,
            "invoice_status": None,
            "current_agent": "ingestion",
            "status": "processing",
            "error": None,
            "approved_by": None,
            "approved_at": None,
            "rejected_by": None,
            "rejected_at": None,
            "rejection_reason": None,
        }
        
        result = ingestion_agent(state)
        data = result.get("invoice_data", {})
        
        if data:
            print("\n   📋 EXTRACTION SUMMARY:")
            print(f"   ├─ Invoice #: {data.get('invoice_number', 'N/A')}")
            print(f"   ├─ Vendor: {data.get('vendor', 'N/A')}")
            print(f"   ├─ Amount: ${data.get('amount', 0):,.2f} {data.get('currency', 'USD')}")
            print(f"   ├─ Items: {len(data.get('items', []))} line item(s)")
            print(f"   ├─ Confidence: {data.get('confidence', 0)}%")
            print(f"   └─ Flags: {data.get('flags', []) or 'None'}")
        else:
            print("\n   ❌ EXTRACTION FAILED")
        
        return result
    
    run_test("Complete Professional Invoice", test_invoice_1)
    run_test("Messy Abbreviations", test_invoice_2)
    run_test("Challenging Format (Self-Correction)", test_invoice_3)
    run_test("Fraud Indicators", test_invoice_4)
    
    print("\n" + "═" * 68)
    print("✅ Ingestion Agent full extraction tests complete!")
    print("═" * 68)
