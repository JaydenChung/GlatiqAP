# 🟢 PYTHON ARCHITECT
> Code Structure — Organizing Python projects

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-001 | Python Architect | Python Engineering |

## Expertise
Project structure, module organization, design patterns, clean code.

## Recommended Structure
```
invoice_processor/
├── __init__.py
├── main.py              # Entry point
├── config.py            # Configuration
├── agents/
│   ├── __init__.py
│   ├── ingestion.py
│   ├── validation.py
│   ├── approval.py
│   └── payment.py
├── models/
│   ├── __init__.py
│   └── schemas.py       # Pydantic models
├── tools/
│   ├── __init__.py
│   ├── database.py
│   └── grok_client.py
├── utils/
│   ├── __init__.py
│   └── logging.py
└── tests/
    └── test_agents.py
```

**Architecture principle:** Modular, testable, readable.

## Subcommittees: 01_agent_architecture, 17_code_architecture
