# ⚖️ DECISIONS

## Session: 2026-01-26_SCAFFOLD

---

## Decisions Made

### Decision 1: TypedDict over Pydantic

| Field | Value |
|-------|-------|
| **Decision** | Use TypedDict for workflow state schemas |
| **Rationale** | Faster development, less boilerplate, LangGraph native support |
| **Authority** | Carried from BLUEPRINT session |
| **Status** | ✅ Implemented |

---

### Decision 2: Accept Import Hack as Technical Debt

| Field | Value |
|-------|-------|
| **Decision** | Accept `sys.path.insert()` hack in workflow.py for scaffold phase |
| **Rationale** | Works for prototype; proper fix (package install) deferred to Phase 2 |
| **Authority** | SKEP-004, SKEP-012 consensus |
| **Status** | ✅ Accepted with debt tracking |

---

### Decision 3: Keep unit_price Column

| Field | Value |
|-------|-------|
| **Decision** | Retain `unit_price` column in inventory table |
| **Rationale** | May be useful for future validation; minimal overhead |
| **Authority** | No objection raised |
| **Status** | ✅ Kept |

---

## Technical Debt Registered

| # | Item | Severity | Target Phase |
|---|------|----------|--------------|
| 1 | Import hack in `workflow.py` | Medium | Phase 2 |
| 2 | Python 3.9+ type hints (`list[str]`) | Low | Production |
| 3 | Verbose test output formatting | Low | Demo Prep |

---

## Decision Format Reference

| # | Decision | Rationale | Authority | Status |
|---|----------|-----------|-----------|--------|
| 1 | TypedDict over Pydantic | Faster dev, LangGraph native | BLUEPRINT | ✅ |
| 2 | Accept import hack | Works for scaffold | Skeptic consensus | ✅ |
| 3 | Keep unit_price | Future utility | No objection | ✅ |

---

*Decisions recorded by CLERK-003 (Scribe Decisions)*
