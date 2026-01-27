# 🟢 ENVIRONMENT SPECIALIST
> Env Vars & Secrets — Secure configuration

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-010 | Environment Specialist | Python Engineering |

## Expertise
.env files, secret management, environment isolation, 12-factor app.

## Key Pattern
```python
# .env.example (committed to repo)
XAI_API_KEY=your-api-key-here
DB_PATH=./data/inventory.db
DEBUG=false

# .env (NOT committed, in .gitignore)
XAI_API_KEY=sk-actual-secret-key
DB_PATH=./data/inventory.db
DEBUG=true

# Loading
from dotenv import load_dotenv
import os

load_dotenv()  # Load .env file

api_key = os.environ.get("XAI_API_KEY")
if not api_key:
    raise ValueError("XAI_API_KEY not set!")

# Never log secrets
def safe_config_log(config: dict) -> dict:
    return {k: "***" if "key" in k.lower() else v for k, v in config.items()}
```

**Secret rules:** Never commit, never log, always validate presence.

## Subcommittees: 09_security_fraud, 17_code_architecture
