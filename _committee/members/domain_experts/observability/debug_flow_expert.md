# 🟢 DEBUG FLOW EXPERT
> Debugging Patterns — Finding problems fast

| ID | ROLE | CATEGORY |
|----|------|----------|
| OBS-005 | Debug Flow Expert | Observability |

## Expertise
Debug modes, verbose logging, state inspection, replay.

## Key Pattern
```python
DEBUG = os.environ.get("DEBUG", "").lower() == "true"

def log_state(state: dict, stage: str):
    if DEBUG:
        logger.debug("state_snapshot", stage=stage, state=state)

def save_debug_artifact(name: str, content: any):
    if DEBUG:
        Path(f"debug/{run_id()}/{name}.json").write_text(json.dumps(content))
```

**Debug checklist:** Input, output, intermediate state, timing, errors.

## Subcommittees: 08_observability_logging
