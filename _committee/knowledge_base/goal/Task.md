Task: Build a Multi-Agent System to Automate This. Reimagine the workflow as an agentic system:
Ingestion Agent: Extract data from PDF invoice (use a library like PyMuPDF or pdfplumber for parsing-handle unstructured text).
Validation Agent: Use Grok to reason over extracted data, call tools to query mock DB, flag issues with self-correction (e.g., if mismatch, retry parse or query).
Approval Agent: Orchestrate reflection/critique loop with Grok (e.g., generate pros/cons, decide approve/reject).
Payment Agent: If approved, call mock payment function; else, log rejection.
Orchestrate as multi-agent (e.g., via CrewAI tasks or LangGraph graph).
Include observability: Log agent steps, errors, decisions to a file (e.g., JSON).
Self-correction: If an agent fails (e.g., parse error), loop back with Grok for fixes.
Handle ambiguity: System should work on "messy" inputs (provide 3 sample PDFs below-create them yourself or use text mocks if PDF parsing is tricky in 24h).
