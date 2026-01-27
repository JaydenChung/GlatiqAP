# 🟢 LOCAL STATE MANAGER
> State Persistence — Managing state locally

| ID | ROLE | CATEGORY |
|----|------|----------|
| SIM-004 | Local State Manager | Local Simulation |

## Expertise
Local storage, state reset, state snapshots, isolation.

## Key Pattern
```python
class LocalStateManager:
    def __init__(self, base_path="./state"):
        self.base_path = Path(base_path)
        self.base_path.mkdir(exist_ok=True)
    
    def save(self, key: str, data: dict):
        (self.base_path / f"{key}.json").write_text(json.dumps(data))
    
    def load(self, key: str) -> dict:
        path = self.base_path / f"{key}.json"
        return json.loads(path.read_text()) if path.exists() else {}
    
    def reset(self):
        shutil.rmtree(self.base_path)
        self.base_path.mkdir()

state = LocalStateManager()
```

**State management:** Persist for debugging, reset for testing.

## Subcommittees: 18_local_simulation
