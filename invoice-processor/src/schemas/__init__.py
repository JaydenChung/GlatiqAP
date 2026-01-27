# Data schemas for workflow state
# Uses TypedDict for type hints without runtime overhead

from .models import (
    ContactInfo,
    InvoiceItem,
    InvoiceData,
    InventoryCheck,
    ValidationResult,
    ApprovalDecision,
    ApprovalAnalysis,
    PaymentResult,
    WorkflowStatus,
    WorkflowState,
    State,
    InvoiceStatus,
    APPROVAL_THRESHOLDS,
)

__all__ = [
    "ContactInfo",
    "InvoiceItem",
    "InvoiceData",
    "InventoryCheck",
    "ValidationResult",
    "ApprovalDecision",
    "ApprovalAnalysis",
    "PaymentResult",
    "WorkflowStatus",
    "WorkflowState",
    "State",
    "InvoiceStatus",
    "APPROVAL_THRESHOLDS",
]
