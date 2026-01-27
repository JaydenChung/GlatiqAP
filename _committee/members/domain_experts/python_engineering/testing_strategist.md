# 🟢 TESTING STRATEGIST
> Test Design — What and how to test

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-006 | Testing Strategist | Python Engineering |

## Expertise
pytest, test organization, fixtures, mocking, coverage.

## Key Pattern
```python
import pytest
from unittest.mock import Mock, patch

@pytest.fixture
def sample_invoice():
    return {"vendor_name": "Test", "amount": 1000, "items": []}

@pytest.fixture
def mock_grok():
    with patch('invoice_processor.tools.grok_client.call_grok') as mock:
        mock.return_value = '{"extracted": "data"}'
        yield mock

def test_extraction_happy_path(sample_invoice, mock_grok):
    result = extract_invoice(sample_invoice)
    assert result['vendor_name'] == 'Test'
    mock_grok.assert_called_once()

def test_validation_rejects_negative_amount():
    invoice = {"vendor_name": "Test", "amount": -100, "items": []}
    is_valid, issues = validate_invoice(invoice)
    assert not is_valid
    assert "amount" in str(issues)
```

**Test priority:** Critical paths first, edge cases second.

## Subcommittees: 15_testing_quality, 18_local_simulation
