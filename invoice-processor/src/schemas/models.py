"""
Workflow State Models
=====================
TypedDict definitions for the invoice processing workflow.

These define the shape of data flowing through the LangGraph state machine.
Using TypedDict for lightweight type hints without runtime validation overhead.

Schema Design Decisions (Session 2026-01-26_BLUEPRINT):
- TypedDict over Pydantic for faster development
- Optional fields use Optional[] wrapper
- Status uses Literal[] for type-safe enumeration

Updated: Session 2026-01-27_WORKFLOW
- Added InvoiceStatus for staged processing
- Added ApprovalAnalysis for smart triage
- Approval Agent now routes based on business rules, not just approve/reject
"""

from typing import TypedDict, Optional, List, Literal
from enum import Enum


# =============================================================================
# INVOICE STATUS (Staged Workflow)
# =============================================================================

class InvoiceStatus(str, Enum):
    """
    Invoice status for staged human-in-the-loop workflow.
    
    Workflow stages:
    1. UPLOAD → Ingestion → Validation → INBOX (or VALIDATION_FAILED)
    2. User routes → Approval Agent analyzes → PENDING_APPROVAL (or AUTO_APPROVED)
    3. Human approves → APPROVED (or AUTO_REJECTED by agent)
    4. User triggers payment → PAID
    """
    # Initial states
    UPLOADED = "uploaded"
    INGESTING = "ingesting"
    VALIDATING = "validating"
    
    # After Workflow 1 (Ingestion + Validation)
    INBOX = "inbox"                         # Valid, ready for routing
    VALIDATION_FAILED = "validation_failed" # Failed validation, needs manual review
    
    # After routing to approval (Workflow 2)
    PENDING_APPROVAL = "pending_approval"   # In human approver's queue (≥$10K or flags)
    AUTO_APPROVED = "auto_approved"         # Agent auto-approved (<$10K, no flags)
    AUTO_REJECTED = "auto_rejected"         # Agent auto-rejected (major red flags)
    
    # After human approval decision
    APPROVED = "approved"                   # Human approved, ready for payment
    REJECTED = "rejected"                   # Human rejected
    
    # Payment states
    READY_TO_PAY = "ready_to_pay"          # Scheduled for payment
    PAYING = "paying"                       # Payment in progress
    PAID = "paid"                          # Payment complete
    PAYMENT_FAILED = "payment_failed"      # Payment failed


# =============================================================================
# BUSINESS RULE THRESHOLDS
# =============================================================================

APPROVAL_THRESHOLDS = {
    "auto_approve_max": 10000,    # Below this + no flags = auto-approve
    "vp_review_min": 10000,       # At or above this = needs human review
    "executive_review_min": 50000, # At or above this = executive approval
}


class ContactInfo(TypedDict, total=False):
    """Contact information block for vendor or customer."""
    name: str          # Company/individual name
    address: str       # Full mailing address
    email: str         # Contact email
    phone: str         # Contact phone
    entity: str        # Business entity name (for bill-to)


class InvoiceItem(TypedDict, total=False):
    """
    Individual line item from an invoice.
    
    Fields match what AP clerks manually key:
    - sku/item: Item identifier or SKU
    - description: Full line item description
    - quantity: Number of units
    - unit_price: Price per unit (rate)
    - amount: Line total (qty * rate, or explicit)
    """
    sku: str             # Item SKU/code (e.g., "WIDGET-A")
    name: str            # Legacy: item name (kept for compatibility)
    description: str     # Full item description
    quantity: int        # Quantity ordered
    unit_price: float    # Unit price / rate
    amount: float        # Line total


class InvoiceData(TypedDict, total=False):
    """
    Structured invoice data extracted from raw text.
    
    This represents ALL fields an AP clerk would manually key from an invoice.
    The ingestion agent populates this; validation agent enriches it.
    
    Header Details:
    - invoice_number, invoice_date, due_date
    - amount (total), subtotal, tax, currency
    - payment_terms, po_number
    
    Parties:
    - vendor (legacy name field)
    - bill_from: Vendor contact block
    - bill_to: Customer/buyer contact block
    
    Line Items:
    - items: List of InvoiceItem with sku, description, qty, rate, amount
    
    Metadata:
    - raw_text: Original for debugging
    - confidence: AI extraction confidence (0-100)
    - flags: Issues detected during extraction
    """
    # === Header Details ===
    invoice_number: str      # Invoice # (e.g., "INV-2026-001")
    invoice_date: str        # Invoice date (ISO: YYYY-MM-DD)
    due_date: str            # Payment due date (ISO: YYYY-MM-DD)
    
    # === Amounts ===
    amount: float            # Invoice total
    subtotal: float          # Subtotal before tax
    tax: float               # Tax amount
    currency: str            # Currency code (USD, EUR, CAD, etc.)
    
    # === Payment Info ===
    payment_terms: str       # Terms (Net 30, Net 60, Due on Receipt, etc.)
    po_number: str           # Purchase Order reference (if any)
    
    # === Parties ===
    vendor: str              # Legacy: vendor name (kept for compatibility)
    bill_from: ContactInfo   # Vendor contact details
    bill_to: ContactInfo     # Customer/buyer contact details
    
    # === Line Items ===
    items: List[InvoiceItem]
    
    # === Extraction Metadata ===
    raw_text: str            # Original text preserved for debugging
    confidence: int          # AI extraction confidence (0-100)
    flags: List[str]         # Issues detected: missing_vendor, low_confidence, etc.
    
    # === Source Provenance (Session 2026-01-27_INGEST) ===
    source_type: str         # "text" or "pdf" - how invoice was provided
    source_path: str         # File path if PDF, None if raw text


class InventoryCheck(TypedDict):
    """Result of checking a single item against inventory."""
    requested: int
    in_stock: int
    available: bool


class ValidationResult(TypedDict):
    """Result of invoice validation against business rules and inventory."""
    is_valid: bool
    errors: List[str]  # Critical issues that block approval
    warnings: List[str]  # Non-blocking issues to note
    inventory_check: dict  # item_name -> InventoryCheck


# =============================================================================
# APPROVAL MODELS (Updated for Smart Triage)
# =============================================================================

# Approval routing decision
ApprovalRoute = Literal[
    "auto_approve",      # <$10K, no flags → skip human, go to payment
    "route_to_human",    # ≥$10K OR flags → needs human approval
    "auto_reject",       # Major red flags → reject without human
]


class ApprovalAnalysis(TypedDict):
    """
    Grok's analysis of an invoice for approval routing.
    
    This is NOT a final approval decision - it's intelligent triage:
    - Decides whether human review is needed
    - Provides analysis to help human decide (if routed to human)
    - Auto-approves low-risk invoices based on business rules
    """
    # Routing decision
    route: ApprovalRoute
    
    # Risk assessment
    risk_score: float  # 0.0 (safe) to 1.0 (high risk)
    
    # Analysis for human reviewer (or audit trail)
    recommendation: str  # "approve", "reject", "review"
    reasoning: str  # Detailed explanation
    red_flags: List[str]  # Issues identified
    
    # Factors breakdown
    factors: dict  # vendor_trust, amount_reasonability, etc.
    
    # Chain of thought (for observability)
    reasoning_chain: Optional[List[str]]


class ApprovalDecision(TypedDict):
    """
    Final approval decision (may be from agent OR human).
    
    Kept for backward compatibility and to record final decisions.
    """
    approved: bool
    reason: str  # Detailed explanation of reasoning
    requires_review: bool  # Flag for human-in-the-loop
    risk_score: float  # 0.0 (safe) to 1.0 (high risk)
    
    # New fields for audit trail
    decided_by: Optional[str]  # "agent" or "human:email@example.com"
    decided_at: Optional[str]  # ISO timestamp


class PaymentResult(TypedDict):
    """Result of payment processing."""
    success: bool
    transaction_id: Optional[str]  # e.g., "TXN-ABC123"
    error: Optional[str]  # Error message if failed


# =============================================================================
# AUDIT TRAIL MODELS (Session 2026-01-28_EXPLAIN)
# =============================================================================

# Audit event types for invoice lifecycle tracking
AuditEventType = Literal[
    "invoice_received",      # Invoice uploaded/received
    "ai_processing",         # AI extraction started/completed
    "validation_complete",   # Validation agent finished
    "approval_routed",       # Routed to approval queue
    "approval_decision",     # Approval decision made (human or AI)
    "payment_initiated",     # Payment process started
    "payment_complete",      # Payment successful
    "payment_rejected",      # Payment blocked (invoice not approved)
    "payment_failed",        # Payment API error
]


class AuditEvent(TypedDict):
    """
    Single audit trail event for invoice lifecycle tracking.
    
    Each event captures:
    - What happened (event_type)
    - When it happened (timestamp)
    - Who/what did it (actor)
    - Details about the event (details)
    - Optional AI-generated summary (ai_summary)
    """
    event_type: AuditEventType
    timestamp: str  # ISO 8601 timestamp
    actor: str  # "system", "ai:ingestion", "ai:validation", "ai:approval", "ai:payment", "human:email@example.com"
    title: str  # Human-readable event title
    description: str  # Human-readable event description
    details: Optional[dict]  # Event-specific structured data
    ai_summary: Optional[str]  # Grok-generated summary (for complex events)


# Workflow status enumeration (legacy - kept for compatibility)
WorkflowStatus = Literal[
    "processing",  # Workflow in progress
    "completed",   # Successfully processed and paid
    "failed",      # Error occurred during processing
    "rejected",    # Invoice rejected (validation or approval)
]


class WorkflowState(TypedDict):
    """
    Central state object passed through the LangGraph workflow.
    
    This is the single source of truth for the entire invoice processing
    pipeline. Each agent reads from and writes to this state.
    
    Updated: Session 2026-01-27_WORKFLOW
    - Added invoice_status for staged processing
    - Added approval_analysis for smart triage
    - Added audit trail fields
    
    Updated: Session 2026-01-28_EXPLAIN
    - Added audit_trail list for structured event logging
    """
    # Input
    raw_invoice: str  # The original invoice text
    
    # Agent outputs (populated as workflow progresses)
    invoice_data: Optional[InvoiceData]
    validation_result: Optional[ValidationResult]
    approval_analysis: Optional[ApprovalAnalysis]  # NEW: Agent's analysis
    approval_decision: Optional[ApprovalDecision]  # Final decision (agent or human)
    payment_result: Optional[PaymentResult]
    
    # Staged workflow status
    invoice_status: Optional[str]  # InvoiceStatus value
    
    # Workflow metadata
    current_agent: str  # Which agent is currently processing
    status: WorkflowStatus  # Overall workflow status (legacy)
    error: Optional[str]  # Error message if status == "failed"
    
    # Audit trail (legacy fields)
    approved_by: Optional[str]  # "agent" or human identifier
    approved_at: Optional[str]  # ISO timestamp
    rejected_by: Optional[str]
    rejected_at: Optional[str]
    rejection_reason: Optional[str]
    
    # Structured audit trail (Session 2026-01-28_EXPLAIN)
    audit_trail: Optional[List[AuditEvent]]  # Chronological list of audit events


# Type aliases for cleaner function signatures
State = WorkflowState
