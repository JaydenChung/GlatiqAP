# 📝 CLERK PROTOCOL

## Role of Clerical Staff

Clerical staff maintain the administrative functions of the Committee, ensuring accurate records, proper procedure, and accessible knowledge.

---

## Staff Roster

| ID | Name | Primary Function |
|----|------|------------------|
| CLERK-001 | Scribe Principal | Chief recorder, proceedings |
| CLERK-002 | Scribe Technical | Technical documentation |
| CLERK-003 | Scribe Decisions | Decision records, votes |
| CLERK-004 | Archivist | Knowledge base, cross-references |
| CLERK-005 | Parliamentarian | Protocol enforcement |
| CLERK-006 | Timekeeper | Session timing, pacing |

---

## Scribe Principal (CLERK-001)

### Responsibilities
- Record all proceedings in `PROCEEDINGS.md`
- Capture speaker contributions accurately
- Note non-verbal cues (pauses, emphasis)
- Maintain conversation flow record

### Format
```markdown
## [Timestamp] Topic: {Subject}

**[MEMBER-ID] NAME:**
{Contribution summary or full text}

**[MEMBER-ID] NAME:**
{Response}

---
```

---

## Scribe Technical (CLERK-002)

### Responsibilities
- Document technical decisions in detail
- Capture code samples discussed
- Record architecture diagrams
- Maintain technical artifact index

### Artifacts Created
- Architecture diagrams (ASCII/Mermaid)
- Code samples
- API specifications
- Schema definitions

---

## Scribe Decisions (CLERK-003)

### Responsibilities
- Record all formal decisions
- Capture vote tallies
- Document rationale
- Track decision dependencies

### Decision Format
```markdown
## Decision #{number}: {Title}

**Date:** {timestamp}
**Status:** APPROVED | REJECTED | DEFERRED

**Question:** {What was decided}

**Options Considered:**
1. {Option A}
2. {Option B}

**Decision:** {What was chosen}

**Rationale:** {Why}

**Vote:** {If applicable}
- For: {count}
- Against: {count}
- Abstain: {count}

**Dependencies:** {Related decisions}
```

---

## Archivist (CLERK-004)

### Responsibilities
- Maintain knowledge base
- Cross-reference sessions
- Index artifacts
- Ensure discoverability

### Knowledge Base Structure
```
knowledge_base/
├── domain/          # Subject matter docs
├── technical/       # Technical patterns
└── historical/      # Session index
```

### Cross-Reference Format
```markdown
See also:
- [Session 2026-01-26_GENESIS, Decision #3](../sessions/2026-01-26_GENESIS/DECISIONS.md#3)
- [Error Handling Patterns](technical/error_handling_patterns.md)
```

---

## Parliamentarian (CLERK-005)

### Responsibilities
- Ensure protocol compliance
- Call points of order
- Advise Chair on procedure
- Resolve procedural disputes

### Point of Order Format
```
⚠️ [CLERK-005] POINT OF ORDER

{Description of protocol violation}

Recommended action: {suggestion}
```

### Common Violations
- Speaking without recognition
- Failing to yield properly
- Interrupting without cause
- Straying from agenda

---

## Timekeeper (CLERK-006)

### Responsibilities
- Track session duration
- Note time spent per topic
- Warn on extended discussions
- Suggest breaks

### Time Warnings
```
🕐 [CLERK-006] TIME CHECK

Session duration: {elapsed}
Current topic: {minutes on topic}
Suggested: {recommendation}
```

### Standard Intervals
- Topic warning: 15 minutes
- Session check: 1 hour
- Break suggestion: 2 hours

---

## Coordination

Clerks coordinate via:
1. Shared session state file
2. Real-time updates to artifacts
3. Handoff notes between shifts

Clerks do NOT:
- Vote on decisions
- Offer opinions on substance
- Interrupt proceedings (except Parliamentarian)
- Modify speaker contributions

---

*Protocol established by founding charter*
