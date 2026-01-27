# 🔄 HANDOFF CONVENTIONS

## Purpose

Clear handoffs ensure:
- No confusion about who is speaking
- Smooth transitions between contributors
- Explicit flow that can be followed
- Accountability for each statement

---

## Speaker Announcement Format

Every contribution MUST begin with this header:

```
╔══════════════════════════════════════════════════════════════╗
║ [MEMBER-ID] NAME speaking as ROLE                            ║
║ {Optional: Subcommittee context}                             ║
╠══════════════════════════════════════════════════════════════╣

{Content of the contribution}

╠══════════════════════════════════════════════════════════════╣
║ >>> YIELDING TO: {SPECIFIC_MEMBER or CHAIR}                  ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Examples

### Domain Expert Contributing
```
╔══════════════════════════════════════════════════════════════╗
║ [MAS-004] LangGraph Master speaking as Multi-Agent Expert    ║
╠══════════════════════════════════════════════════════════════╣

For this workflow, I recommend a StateGraph with explicit 
channels for invoice data, validation results, and approval 
status. The graph should have conditional edges based on 
validation outcomes...

╠══════════════════════════════════════════════════════════════╣
║ >>> YIELDING TO: SKEP-004 (Complexity Critic) for review     ║
╚══════════════════════════════════════════════════════════════╝
```

### Skeptic Challenging
```
╔══════════════════════════════════════════════════════════════╗
║ [SKEP-004] Complexity Critic speaking as Opposition          ║
╠══════════════════════════════════════════════════════════════╣

I have concerns. A StateGraph with multiple channels adds 
complexity we may not need for 3 invoice types. Have we 
considered a simpler linear pipeline first? The requirements 
don't mandate parallel processing...

╠══════════════════════════════════════════════════════════════╣
║ >>> YIELDING TO: CHAIR for direction                         ║
╚══════════════════════════════════════════════════════════════╝
```

### Chair Redirecting
```
╔══════════════════════════════════════════════════════════════╗
║ [CHAIR-001] Archon Prime speaking as Chair                   ║
╠══════════════════════════════════════════════════════════════╣

Valid concern from the Complexity Critic. Let's hear from 
PRAG-003 (MVP Advocate) on what the minimum viable 
orchestration would look like.

╠══════════════════════════════════════════════════════════════╣
║ >>> RECOGNIZING: PRAG-003                                    ║
╚══════════════════════════════════════════════════════════════╝
```

---

## Research Announcement

Before conducting any research, members MUST announce:

```
┌─────────────────────────────────────────────────────────────┐
│ 🔍 RESEARCH INITIATED                                       │
│                                                             │
│ Researcher: [MEMBER-ID] NAME                                │
│ Topic: {What they are investigating}                        │
│ Sources: {Where they will look}                             │
│   - knowledge_base/domain/...                               │
│   - Past sessions: sessions/YYYY-MM-DD_*/                   │
│   - External reference (specify)                            │
│ Expected Duration: {Estimate}                               │
└─────────────────────────────────────────────────────────────┘
```

### Research Completion
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ RESEARCH COMPLETE                                        │
│                                                             │
│ Researcher: [MEMBER-ID] NAME                                │
│ Findings: {Summary of what was discovered}                  │
│ Relevance: {How it applies to current discussion}           │
└─────────────────────────────────────────────────────────────┘
```

---

## Yield Targets

### Yield to Specific Member
Use when you know who should respond:
```
>>> YIELDING TO: [MAS-001] Orchestration Architect
```

### Yield to Chair
Use when uncertain who should speak next:
```
>>> YIELDING TO: CHAIR for direction
```

### Yield to Category
Use when any member of a type would be appropriate:
```
>>> YIELDING TO: Any skeptic for challenge
>>> YIELDING TO: Pragmatist perspective needed
```

### Yield to Subcommittee
Use when topic belongs to specific subcommittee:
```
>>> YIELDING TO: Subcommittee 07 (Error & Recovery)
```

---

## Human Director Convention

The Human Director has special status:

```
╔══════════════════════════════════════════════════════════════╗
║ [HUMAN] Human Director speaking                              ║
╠══════════════════════════════════════════════════════════════╣

{Human's input}

╠══════════════════════════════════════════════════════════════╣
║ >>> {Human may or may not yield explicitly}                  ║
╚══════════════════════════════════════════════════════════════╝
```

When Human speaks:
1. Chair acknowledges immediately
2. Other speakers pause
3. Direction is implemented
4. No debate unless Human invites it

---

## Interruption Protocol

Interruptions are generally NOT allowed. Exceptions:

1. **Chair interrupt** — Always allowed
2. **Human interrupt** — Always allowed  
3. **Point of order** — Parliamentarian only
4. **Emergency** — Safety/critical error

Format for allowed interruption:
```
⚠️ [MEMBER-ID] POINT OF ORDER / EMERGENCY
{Brief statement of issue}
```

---

## Quick Reference

| Situation | Yield To |
|-----------|----------|
| Made a proposal | Skeptic for challenge |
| Answered a challenge | Chair or proposer |
| Completed research | Chair for next steps |
| Asked a question | Relevant expert |
| Unsure what's next | Chair for direction |
| Technical deep-dive done | Pragmatist for reality check |
| Scope discussion | SKEP-008 (Scope Sentinel) |
| Historical context needed | Any HIST-* member |

---

*Conventions established by founding charter*
