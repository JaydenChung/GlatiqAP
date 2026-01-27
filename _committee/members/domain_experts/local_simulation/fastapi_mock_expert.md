# 🟢 FASTAPI MOCK EXPERT
> Mock API Design — Simulating external services

| ID | ROLE | CATEGORY |
|----|------|----------|
| SIM-001 | FastAPI Mock Expert | Local Simulation |

## Expertise
FastAPI mocks, request/response simulation, failure injection.

## Key Pattern
```python
from fastapi import FastAPI
app = FastAPI()

@app.post("/api/payment")
async def mock_payment(vendor: str, amount: float):
    # Simulate real behavior
    if random.random() < 0.1:  # 10% failure rate
        raise HTTPException(503, "Payment service unavailable")
    await asyncio.sleep(0.5)  # Simulate latency
    return {"status": "success", "transaction_id": str(uuid.uuid4())}

# Run: uvicorn mock_server:app --port 8001
```

**Mock principles:** Realistic latency, occasional failures, valid responses.

## Subcommittees: 18_local_simulation
