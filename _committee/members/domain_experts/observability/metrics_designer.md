# 🟢 METRICS DESIGNER
> What to Measure — Meaningful metrics

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-003 | Metrics Designer | Observability |

## Expertise
Metric types, cardinality, dashboards, alerting thresholds.

## Key Metrics for Invoice System
```python
METRICS = {
    "invoices_processed_total": Counter,
    "invoice_processing_seconds": Histogram,
    "validation_errors_total": Counter(labels=["error_type"]),
    "approval_rate": Gauge,
    "grok_api_latency_seconds": Histogram,
    "self_correction_iterations": Histogram,
}
```

**MVP:** Log-based metrics are fine. Prometheus later.

## Subcommittees: 08_observability_logging
