below-create them yourself or use text mocks if PDF parsing is tricky in 24h).
Provided Resources (All Self-Contained):
Mock Invoice Data: Use these as inputs (save as .pdf or .txt for testing).
Invoice1: "Vendor: Widgets Inc. Amount: 5000. Items: WidgetA:10, WidgetB:5. Due: 2026-02-01" (clean).
Invoice2: "Vndr: Gadgets Co. Amt: 15000. Itms: GadgetX:20 (typo in stock). Due: 2026-01-30" (messy, >$10K).
Invoice3: "Vendor: Fraudster. Amount: 100000. Items: FakeItem:100. Due: yesterday" (invalid, should reject).
Mock Inventory DB: Create a local SQLite DB with this schema/data (code snippet below to initialize):
Python
import sqlite3
conn = sqlite3.connect(':memory:')  # Or save to file
conn.execute('''CREATE TABLE inventory (item TEXT, stock INTEGER);''')
conn.execute("INSERT INTO inventory VALUES ('WidgetA', 15), ('WidgetB', 10), ('GadgetX', 5), ('FakeItem', 0);")
conn.commit()
# Tool function example: def query_db(item): return conn.execute(f"SELECT stock FROM inventory WHERE item='{item}'").fetchone()[0]
Mock Payment API: Simple function:
Python
def mock_payment(vendor, amount):
    print(f"Paid {amount} to {vendor}")
    return {"status": "success"}  # Or raise error randomly for testing

Grok API Setup: Use xAI's SDK (pip install xai-sdk if needed, but assume local env). Example call:
Python
from xai import Grok
client = Grok(api_key="your_key")
response = client.chat.completions.create(model= [Grok Model], messages=[{"role": "user", "content": "Reason about this..."}])


