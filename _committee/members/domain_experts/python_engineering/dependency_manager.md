# 🟢 DEPENDENCY MANAGER
> Requirements Management — Pinning and updating

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-007 | Dependency Manager | Python Engineering |

## Expertise
requirements.txt, pyproject.toml, version pinning, virtual environments.

## Key Pattern
```toml
# pyproject.toml
[project]
name = "invoice-processor"
version = "0.1.0"
requires-python = ">=3.10"
dependencies = [
    "openai>=1.0.0",      # For xAI Grok
    "pydantic>=2.0.0",    # Data validation
    "pdfplumber>=0.10.0", # PDF extraction
    "structlog>=23.0.0",  # Logging
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
]
```

```txt
# requirements.txt (pinned for reproducibility)
openai==1.12.0
pydantic==2.5.0
pdfplumber==0.10.3
structlog==23.2.0
```

**Dependency rule:** Pin in requirements.txt, range in pyproject.toml.

## Subcommittees: 17_code_architecture
