"""
API Schemas
===========
Pydantic models for API requests/responses and WebSocket events.

These map to the TypedDict definitions in src/schemas/models.py but add
Pydantic validation for the API boundary.

Created: Session 2026-01-26_CONNECT
"""

from pydantic import BaseModel
from typing import Optional, List, Literal, Any


# =============================================================================
# REQUEST MODELS
# =============================================================================

class ProcessInvoiceRequest(BaseModel):
    """Request to process a raw invoice."""
    raw_invoice: str
    invoice_id: Optional[str] = None  # Optional client-provided ID


# =============================================================================
# WEBSOCKET EVENT MODELS
# =============================================================================

EventType = Literal[
    "connected",        # WebSocket connection established
    "stage_start",      # Agent starting
    "grok_call",        # Grok API call initiated
    "grok_response",    # Grok API response received
    "self_correction",  # Self-correction loop triggered
    "stage_complete",   # Agent finished
    "state_update",     # Full workflow state update
    "log",              # General log message
    "complete",         # Workflow finished successfully
    "rejected",         # Invoice rejected
    "error",            # Error occurred
]

StageStatus = Literal["pending", "running", "complete", "failed", "warning", "skipped"]


class WebSocketEvent(BaseModel):
    """Base event sent over WebSocket."""
    event: EventType
    timestamp: float  # Unix timestamp
    data: Optional[dict] = None


class StageStartEvent(BaseModel):
    """Event when an agent starts processing."""
    event: Literal["stage_start"] = "stage_start"
    timestamp: float
    stage: str  # ingestion, validation, approval, payment
    description: str


class GrokCallEvent(BaseModel):
    """Event when Grok API is called."""
    event: Literal["grok_call"] = "grok_call"
    timestamp: float
    stage: str
    model: str
    mode: str  # json, text
    temperature: float


class GrokResponseEvent(BaseModel):
    """Event when Grok API responds."""
    event: Literal["grok_response"] = "grok_response"
    timestamp: float
    stage: str
    data: dict  # The actual response data


class SelfCorrectionEvent(BaseModel):
    """Event when self-correction is triggered."""
    event: Literal["self_correction"] = "self_correction"
    timestamp: float
    stage: str
    attempt: int
    reason: str


class StageCompleteEvent(BaseModel):
    """Event when an agent completes."""
    event: Literal["stage_complete"] = "stage_complete"
    timestamp: float
    stage: str
    status: StageStatus
    data: Optional[dict] = None
    next_stage: Optional[str] = None


class LogEvent(BaseModel):
    """General log message event."""
    event: Literal["log"] = "log"
    timestamp: float
    level: Literal["info", "success", "warning", "error", "system", "grok", "json", "state"]
    message: str
    stage: Optional[str] = None


class StateUpdateEvent(BaseModel):
    """Full workflow state update."""
    event: Literal["state_update"] = "state_update"
    timestamp: float
    state: dict


class CompleteEvent(BaseModel):
    """Workflow completed successfully."""
    event: Literal["complete"] = "complete"
    timestamp: float
    result: dict
    processing_time: float  # Seconds


class RejectedEvent(BaseModel):
    """Invoice was rejected."""
    event: Literal["rejected"] = "rejected"
    timestamp: float
    reason: str
    stage: str  # Which stage rejected
    data: Optional[dict] = None


class ErrorEvent(BaseModel):
    """Error occurred during processing."""
    event: Literal["error"] = "error"
    timestamp: float
    message: str
    stage: Optional[str] = None


# =============================================================================
# RESPONSE MODELS
# =============================================================================

class ContactInfo(BaseModel):
    """Contact information block for vendor or customer."""
    name: Optional[str] = None
    address: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    entity: Optional[str] = None


class InvoiceItem(BaseModel):
    """Line item from invoice - all fields an AP clerk would key."""
    sku: Optional[str] = None
    name: Optional[str] = None  # Legacy compatibility
    description: Optional[str] = None
    quantity: int = 1
    unit_price: Optional[float] = 0.0
    amount: Optional[float] = 0.0


class InvoiceData(BaseModel):
    """
    Extracted invoice data - ALL fields an AP clerk would manually key.
    
    This matches the expanded schema from the ingestion agent.
    """
    # Header Details
    invoice_number: Optional[str] = "UNKNOWN"
    invoice_date: Optional[str] = None
    due_date: Optional[str] = None
    
    # Amounts
    vendor: str  # Legacy - kept for compatibility
    amount: float
    subtotal: Optional[float] = None
    tax: Optional[float] = 0.0
    currency: Optional[str] = "USD"
    
    # Payment Info
    payment_terms: Optional[str] = None
    po_number: Optional[str] = None
    
    # Parties
    bill_from: Optional[ContactInfo] = None
    bill_to: Optional[ContactInfo] = None
    
    # Line Items
    items: List[InvoiceItem] = []
    
    # Metadata
    raw_text: str
    confidence: Optional[int] = 50
    flags: Optional[List[str]] = []


class InventoryCheck(BaseModel):
    """Single inventory check result."""
    requested: int
    in_stock: int
    available: bool


class ValidationResult(BaseModel):
    """Validation result."""
    is_valid: bool
    errors: List[str]
    warnings: List[str]
    inventory_check: dict  # item_name -> InventoryCheck


class ApprovalDecision(BaseModel):
    """Approval decision with reasoning."""
    approved: bool
    reason: str
    requires_review: bool
    risk_score: float
    reasoning_chain: Optional[List[str]] = None


class PaymentResult(BaseModel):
    """Payment result."""
    success: bool
    transaction_id: Optional[str] = None
    error: Optional[str] = None


# =============================================================================
# AUDIT TRAIL MODELS (Session 2026-01-28_EXPLAIN)
# =============================================================================

AuditEventType = Literal[
    "invoice_received",
    "ai_processing",
    "validation_complete",
    "approval_routed",
    "approval_decision",
    "payment_initiated",
    "payment_complete",
    "payment_rejected",
    "payment_failed",
]


class AuditEvent(BaseModel):
    """Single audit trail event for invoice lifecycle tracking."""
    event_type: AuditEventType
    timestamp: str  # ISO 8601
    actor: str  # "system", "ai:ingestion", "ai:payment", "human:email@example.com"
    title: str  # Human-readable event title
    description: str  # Human-readable event description
    details: Optional[dict] = None  # Event-specific structured data
    ai_summary: Optional[str] = None  # Grok-generated summary


class ProcessingResult(BaseModel):
    """Final processing result."""
    status: Literal["completed", "rejected", "failed"]
    invoice_data: Optional[InvoiceData] = None
    validation_result: Optional[ValidationResult] = None
    approval_decision: Optional[ApprovalDecision] = None
    payment_result: Optional[PaymentResult] = None
    error: Optional[str] = None

