# 🟢 TRACE ANALYST
> Distributed Tracing — End-to-end visibility

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-004 | Trace Analyst | Observability |

## Expertise
Spans, trace context, flame graphs, latency analysis.

## Key Pattern
```python
# Simple tracing for MVP
class Tracer:
    def __init__(self):
        self.spans = []
    
    def span(self, name):
        return SpanContext(self, name)

class SpanContext:
    def __enter__(self):
        self.start = time.time()
        return self
    
    def __exit__(self, *args):
        self.tracer.spans.append({
            "name": self.name,
            "duration_ms": (time.time() - self.start) * 1000
        })
```

**MVP:** Simple timing logs. OpenTelemetry for production.

## Subcommittees: 08_observability_logging
