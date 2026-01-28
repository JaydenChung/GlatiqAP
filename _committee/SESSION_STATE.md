# 📊 SESSION STATE — LIVE

> ⚠️ This file is OVERWRITTEN, not appended. It reflects current state only.

```yaml
session:
  id: "2026-01-28_REVIEW"
  status: CLOSED
  goal: "Pre-demo documentation review — sync demo_script.md with codebase changes"
  started: "2026-01-28T17:00:00Z"
  
phase: COMPLETE

current_speaker: null

speaker_queue: []

active_subcommittee: null

decisions:
  made: 0
  pending: 0
  
open_questions:
  count: 0
  blocking: 0
  
artifacts:
  created: 1

participants:
  active: []
  on_call: []

last_updated: "2026-01-28T17:30:00Z"

last_session:
  id: "2026-01-28_REVIEW"
  status: CLOSED
  outcome: "UPDATED: demo_script.md synchronized with TRIAGE, VENDOR, and EXPLAIN session changes"
```

---

## State Definitions

| Status | Meaning |
|--------|---------|
| `NO_ACTIVE_SESSION` | Committee not in session |
| `OPEN` | Session active, general deliberation |
| `DELIBERATING` | Focused discussion on specific topic |
| `VOTING` | Vote in progress |
| `RECESSED` | Temporary pause, state preserved |
| `CLOSED` | Session ended, see closure report |

---

## Quick Commands for Chair

- **Open Session:** Update status to `OPEN`, set goal, timestamp
- **Add Speaker:** Append to `speaker_queue`
- **Advance Speaker:** Move first from queue to `current_speaker`
- **Record Decision:** Increment `decisions.made`
- **Flag Blocker:** Increment `open_questions.blocking`
- **Close Session:** Update status to `CLOSED`, clear transient state
