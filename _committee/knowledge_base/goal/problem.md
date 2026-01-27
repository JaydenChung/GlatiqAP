$2M/year on manual invoice processing. Invoices arrive via email as PDFs (messy formats, errors common). Staff manually extract data, validate against a legacy inventory database (inconsistent), get VP approval (via email chains), and process payment (via a mock banking API). Issues: 30% error rate, 5-day delays, angry stakeholders.
Current "hellscape" (mapped for you-normally you'd do this onsite):
Invoices: PDFs with fields like Vendor, Amount, Items (list), Due Date. Errors: Typos, missing data, fraud risks.
Validation: Check items against inventory DB (SQLite mock provided below). Flag mismatches (e.g., quantity > stock).
Approval: Simulate VP review-agent decides based on rules (e.g., >$10K needs human-like critique).
Payment: Call a mock API to "pay" if approved.
Exceptions: Handle bad data, retries, logging.
