# 📊 SESSION STATE — LIVE

> ⚠️ This file is OVERWRITTEN, not appended. It reflects current state only.

```yaml
session:
  id: null
  status: NO_ACTIVE_SESSION
  goal: null
  started: null
  
phase: AWAITING_OPENING

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
  created: 0

participants:
  active: []
  on_call: []

last_updated: "2026-01-27T14:30:00Z"

last_session:
  id: "2026-01-27_INGEST"
  status: CLOSED
  outcome: "PDF parsing integrated into Ingestion Agent — pdfplumber extracts text from invoice PDFs, smart detection handles both PDF paths and raw text input"
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
