# 🟢 FRAUD DETECTION ANALYST
> Anomaly Patterns — Catching fraudulent invoices

| ID | ROLE | CATEGORY |
|----|------|----------|
| FIN-002 | Fraud Detection Analyst | Invoice & Finance |

## Expertise
Fraud patterns, anomaly detection, red flags, verification procedures.

## Key Pattern
```python
def detect_fraud_signals(invoice: InvoiceData) -> list[str]:
    signals = []
    
    # Amount anomalies
    if invoice.amount > 50000:
        signals.append("HIGH_AMOUNT")
    if invoice.amount % 1000 == 0:
        signals.append("ROUND_NUMBER")
    
    # Vendor anomalies
    if "test" in invoice.vendor_name.lower():
        signals.append("TEST_VENDOR")
    if len(invoice.vendor_name) < 3:
        signals.append("SHORT_VENDOR_NAME")
    
    # Date anomalies
    if invoice.due_date and invoice.due_date < date.today():
        signals.append("PAST_DUE")
    
    # Item anomalies
    for item in invoice.items:
        if item.quantity > 100:
            signals.append(f"HIGH_QUANTITY:{item.name}")
    
    return signals
```

**Fraud principle:** Multiple signals > single threshold.

## Subcommittees: 09_security_fraud
