# 📋 DECISIONS LOG

## Session: 2026-01-26_PHOENIX

---

## Approved Decisions

### DECISION #1: Import Hack Fix Approach
**Status:** ✅ APPROVED & IMPLEMENTED
**Proposed by:** [PY-001] Python Architect
**Endorsed by:** [SKEP-012] Simplicity Purist

**Resolution:**
- Centralize path setup in `src/__init__.py`
- Remove `sys.path.insert()` hacks from all 5 files
- Create `src/utils.py` for shared utilities
- Keep `pyproject.toml` + `setup.py` for future proper packaging

**Rationale:**
Environment constraints prevented editable pip install, but centralizing the hack
is cleaner than duplicating it across 5 files. This resolves the technical debt
while maintaining functionality.

---

### DECISION #2: Self-Correction Scope
**Status:** ✅ APPROVED & IMPLEMENTED
**Proposed by:** [PRAG-003] MVP Advocate
**Challenged by:** [SKEP-004] Complexity Critic, [SKEP-010] Latency Paranoiac

**Resolution:**
- Implement self-correction in **Ingestion Agent only**
- Maximum **1 retry** per invocation
- Trigger when: `vendor == "UNKNOWN"` OR `amount == 0.0` with real data present
- Use enhanced extraction hints on retry
- Log retry attempts for observability

**Rationale:**
Skeptics raised valid concerns about complexity and latency. The MVP approach
satisfies the Human Director's request while minimizing risk. One agent with
one retry is measurable and controllable.

---

## Implementation Details

### Files Modified
| File | Change |
|------|--------|
| `src/__init__.py` | Path setup centralized here |
| `src/utils.py` | **NEW** - shared `clean_json_response()`, `safe_get()` |
| `src/workflow.py` | Removed sys.path hack |
| `src/agents/ingestion.py` | Removed hack, added self-correction loop |
| `src/agents/validation.py` | Removed hack, uses shared utils |
| `src/agents/approval.py` | Removed hack, uses shared utils |
| `src/agents/payment.py` | Removed hack |
| `pyproject.toml` | **NEW** - package definition |
| `setup.py` | **NEW** - backwards compatibility |

### Technical Debt Resolved
- ✅ Import hack (Medium) — Centralized
- ✅ `clean_json_response` duplication (Low) — Extracted to utils

### Test Results
| Invoice | Expected | Actual | Status |
|---------|----------|--------|--------|
| Invoice 1 (Clean) | APPROVE + PAY | APPROVE + PAY | ✅ PASS |
| Invoice 2 (Messy) | REJECT (stock) | REJECT (stock) | ✅ PASS |
| Invoice 3 (Fraud) | REJECT | REJECT | ✅ PASS |

---

*Decisions recorded by CLERK-003 (Scribe Decisions)*
