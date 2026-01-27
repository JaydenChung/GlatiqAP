# Implementation Plan — Invoice Processing System

> Approved by Committee Session 2026-01-26_BLUEPRINT

## Overview

10-hour build plan for a demo-ready multi-agent invoice processing system.

## Architecture

**4 Agents (Non-negotiable):**
1. **Ingestion Agent** — Parse raw invoice → structured data (Grok JSON mode)
2. **Validation Agent** — Check inventory DB, validate amounts (SQLite + Grok)
3. **Approval Agent** — Reason about approval with visible chain-of-thought (Grok)
4. **Payment Agent** — Execute mock payment API

**Orchestration:** LangGraph StateGraph with conditional edges

**State Flow:**
```
Ingestion → Validation → [valid?] → Approval → [approved?] → Payment → END
                           ↓                        ↓
                          END                      END
                       (rejected)               (rejected)
```

## Technology Stack

- **LLM:** xAI Grok (via OpenAI-compatible API)
- **Orchestration:** LangGraph
- **Database:** SQLite (local)
- **Language:** Python 3.10+

## Time Allocation

| Phase | Hours | Focus |
|-------|-------|-------|
| Foundation | 1-2 | Setup, Grok connection, LangGraph skeleton |
| Core Agents | 3-6 | Build all 4 agents, end-to-end flow |
| Enhancement | 7-8 | Self-correction, error handling |
| Demo Prep | 9-10 | Testing, polish |

## Key Decisions

1. **Direct DB queries** over Grok tool calling (simpler for v1)
2. **TypedDict** over Pydantic (faster development)
3. **Terminal output** over web UI (functionality first)

## Test Cases

1. **Invoice1 (Clean):** Should approve and pay
2. **Invoice2 (Messy):** Should self-correct, then approve
3. **Invoice3 (Fraud):** Should reject with explanation

## Checkpoints

- **Hour 1:** Grok API must respond
- **Hour 6:** Happy path works end-to-end
- **Hour 10:** All 3 test cases pass

---

*Reference: [Full Roadmap](../sessions/2026-01-26_BLUEPRINT/artifacts/IMPLEMENTATION_ROADMAP.md)*
