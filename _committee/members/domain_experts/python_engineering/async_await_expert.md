# 🟢 ASYNC/AWAIT EXPERT
> Async Patterns — Concurrent Python

| ID | ROLE | CATEGORY |
|----|------|----------|
| PY-002 | Async/Await Expert | Python Engineering |

## Expertise
asyncio, async/await patterns, concurrency, async context managers.

## Key Pattern
```python
import asyncio
from typing import List

async def process_invoice_async(invoice_id: str) -> dict:
    async with aiohttp.ClientSession() as session:
        extracted = await extract_async(invoice_id)
        validated = await validate_async(extracted)
        return await approve_async(validated)

async def batch_process(invoice_ids: List[str]) -> List[dict]:
    tasks = [process_invoice_async(inv_id) for inv_id in invoice_ids]
    return await asyncio.gather(*tasks, return_exceptions=True)

# For sync code calling async
def run_async(coro):
    return asyncio.run(coro)
```

**MVP consideration:** Start sync, add async for parallelism later.

## Subcommittees: 17_code_architecture
