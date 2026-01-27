# 🟢 CONFIG MANAGEMENT EXPERT
> Configuration Patterns — Managing settings

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-008 | Config Management Expert | Python Engineering |

## Expertise
Environment variables, config files, pydantic-settings, secrets.

## Key Pattern
```python
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # API
    xai_api_key: str
    xai_base_url: str = "https://api.x.ai/v1"
    
    # Database
    db_path: str = "inventory.db"
    
    # Processing
    max_retries: int = 3
    timeout_seconds: int = 30
    
    # Features
    debug: bool = False
    
    class Config:
        env_file = ".env"

@lru_cache
def get_settings() -> Settings:
    return Settings()

# Usage
settings = get_settings()
client = OpenAI(api_key=settings.xai_api_key)
```

**Config principle:** Environment for secrets, defaults for everything else.

## Subcommittees: 14_data_persistence, 17_code_architecture
