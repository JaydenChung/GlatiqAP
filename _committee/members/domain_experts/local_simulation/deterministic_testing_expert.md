# 🟢 DETERMINISTIC TESTING EXPERT
> Reproducible Tests — Same input, same output

| ID | ROLE | CATEGORY |
|----|------|----------|
| SIM-005 | Deterministic Testing Expert | Local Simulation |

## Expertise
Test determinism, seed management, mock responses, flaky test prevention.

## Key Pattern
```python
import random

def make_deterministic(seed=42):
    random.seed(seed)
    # Mock LLM responses for testing
    
MOCK_RESPONSES = {
    "extract_invoice_1": {"vendor_name": "Widgets Inc", "amount": 5000},
    "validate_invoice_1": {"is_valid": True, "issues": []},
}

def deterministic_grok(prompt_hash: str) -> str:
    if prompt_hash in MOCK_RESPONSES:
        return json.dumps(MOCK_RESPONSES[prompt_hash])
    raise NotImplementedError(f"No mock for: {prompt_hash}")
```

**Determinism:** Fixed seeds, canned responses, controlled time.

## Subcommittees: 15_testing_quality, 18_local_simulation
