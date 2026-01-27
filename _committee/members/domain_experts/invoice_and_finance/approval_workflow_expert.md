# 🟢 APPROVAL WORKFLOW EXPERT
> Business Rules — Approval logic and escalation

| ID | ROLE | CATEGORY |
|----|------|----------|
| FIN-003 | Approval Workflow Expert | Invoice & Finance |

## Expertise
Approval hierarchies, business rules, escalation paths, audit requirements.

## Key Pattern
```python
from enum import Enum

class ApprovalLevel(Enum):
    AUTO = "auto"
    MANAGER = "manager"
    VP = "vp"
    MANUAL = "manual"

def determine_approval_level(invoice: InvoiceData, validation: ValidationResult) -> ApprovalLevel:
    # Invalid always needs manual review
    if not validation.is_valid:
        return ApprovalLevel.MANUAL
    
    # Amount-based routing
    if invoice.amount <= 1000:
        return ApprovalLevel.AUTO
    elif invoice.amount <= 10000:
        return ApprovalLevel.MANAGER
    elif invoice.amount <= 50000:
        return ApprovalLevel.VP
    else:
        return ApprovalLevel.MANUAL
    
APPROVAL_RULES = """
For this invoice, consider:
1. Amount vs threshold ($10K needs VP-level scrutiny)
2. Vendor history (new vendor = more scrutiny)
3. Item validity (all items in stock?)
4. Due date urgency
"""
```

**Approval principle:** Higher stakes = higher scrutiny.

## Subcommittees: 05_approval_reasoning, 21_human_loop_integration
