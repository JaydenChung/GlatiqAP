# 📋 DECISIONS

## Session: 2026-01-26_FORGE

> Formal decisions made during this session

---

## Decision Log

| # | Decision | Rationale | Authority | Status |
|---|----------|-----------|-----------|--------|
| 1 | Use escaped braces `{{}}` in prompts | Python `.format()` KeyError fix | SKEP-005 | ✅ Implemented |
| 2 | Add `clean_json_response()` helper | Handle markdown-wrapped JSON from Grok | PRAG-001 | ✅ Implemented |
| 3 | Keep import hack, log as tech debt | Works for MVP, fix in Phase 3 | SKEP-004 | ✅ Accepted |
| 4 | Phase 2 initial implementation complete | All 3 test cases pass | Committee | ✅ Ratified |
| 5 | Upgrade prompts to senior-level | CTO demo quality requirement | Human Director | ✅ Implemented |
| 6 | Use System/User message separation | LLM best practice | LLM-002 | ✅ Implemented |
| 7 | Add few-shot examples to all agents | Improves reliability | LLM-002 | ✅ Implemented |
| 8 | Implement 5-step decision framework | Explainable AI for approval | LLM-002 | ✅ Implemented |
| 9 | Use `Optional[]` for Python 3.9 compat | Avoid `str \| None` syntax | SKEP-005 | ✅ Implemented |

---

## Technical Debt Registered

| # | Item | Severity | Session | When to Fix |
|---|------|----------|---------|-------------|
| 1 | `sys.path.insert()` hack in agents | Medium | SCAFFOLD | Phase 3 |
| 2 | `clean_json_response()` duplicated 3x | Low | FORGE | Phase 3 |
| 3 | No API timeouts | Medium | FORGE | Phase 3 |
| 4 | No retry/backoff strategy | Medium | FORGE | Phase 3 |

---

## Key Design Decisions Explained

### System/User Message Separation
**What:** Instructions in `system` role, data in `user` role.  
**Why:** System prompts treated as authoritative context by LLMs. Separates "what to do" from "what to process."  
**Impact:** More reliable behavior, easier prompt maintenance.

### Few-Shot Examples
**What:** 2 concrete input→output examples per agent.  
**Why:** Demonstrates expected format explicitly rather than describing it.  
**Impact:** Dramatically improved extraction reliability.

### 5-Step Decision Framework (Approval)
**What:** Structured reasoning: Validation Gate → Vendor Risk → Amount → Fraud Scan → Decision.  
**Why:** Makes approval decisions explainable and auditable.  
**Impact:** Visible chain-of-thought, compliance-friendly.

### Defensive Defaults
**What:** Every field has explicit default: "UNKNOWN", 0.0, [], null.  
**Why:** Downstream code never receives unexpected nulls.  
**Impact:** Graceful failure handling, no crashes on partial extraction.

---

*Decisions recorded by CLERK-003 (Scribe Decisions)*
