# 📜 SESSION PROCEEDINGS

## Session: 2026-01-27_WORKFLOW

---

## Opening

**[CHAIR-001] ARCHON PRIME opens session at 2026-01-27T12:00:00Z**

---

## Human Director Input

The Human Director has provided critical domain insight from direct observation of AP specialists:

> "Currently, our agentic pipeline has the ingestion agent process the invoice, then the validation agent looks over that information, then the approver agent does its thing, then the payment agent does its thing. I don't fully understand what they're doing.
>
> However, I think the correct way we should be showing this is: An invoice is uploaded and passed to the ingestion agent which then passes it to the validation agent. In a real AP flow, this would then populate in our invoice inbox and it's ready to route and go to the approver.
>
> This is where the approver agent would come in and help the VP with his approval process. Once approved, it should go into the payments tab. Then the payments agent can run its function to act on what the approval agent did.
>
> I currently think the way we're showing this is incorrect. It shouldn't all just be in this inbox phase. It doesn't make any sense."

---

## Deliberation Record

### Opening — Chair [CHAIR-001]

Archon Prime opened the session, framing the fundamental question: Is the current linear automation model misaligned with actual AP processes?

### Domain Expert Input — [FIN-001] Invoice Domain Expert

Confirmed the Human Director's insight. Described the 5-stage real AP workflow:
1. Arrival & Ingestion (automation appropriate)
2. Validation & Inbox (automation + human visibility)
3. Routing & Coding (human-initiated)
4. Approval Queue (human decision with AI assistance)
5. Payment Processing (automation on human-approved items)

Key insight: Current implementation "replaces AP" rather than "automates AP."

### Business Rules — [FIN-003] Approval Workflow Expert

Detailed the approval layer problems:
- Current auto-approve violates segregation of duties
- Audit trail requires identifiable human approvers
- Approval Agent should analyze, not decide

### State Machine Design — [HUM-003] Handoff Coordinator

Defined the complete invoice state machine mapping states to UI tabs:
- INBOX tab: After Workflow 1 (Ingestion + Validation)
- APPROVALS tab: After Workflow 2 (Approval analysis)
- PAY tab: After Workflow 3 (Payment execution)

### Challenge Phase — [SKEP-014] The Interrogator

Raised four critical questions:
1. What problem are we solving? (Automate everything vs. assist humans)
2. If "assisting" — what value does Approval Agent add?
3. Is LangGraph appropriate for human-in-the-loop?
4. How do we demo with human steps?

### Opposition — [SKEP-002] Devil's Advocate

Argued FOR current implementation:
- "Real AP workflow" is the old way we're trying to fix
- Human checkpoints create bottlenecks
- Demo will be awkward with manual steps

Counterproposal: Keep automated model but add visibility, override, and escalation.

### Human Director Clarification

Human Director resolved the debate:
- It IS a demo/prototype BUT modeling a realistic tool
- Human-in-the-loop is correct
- Only Ingestion + Validation should trigger on upload
- UI already supports manual routing
- Agents should be developed incrementally after flow is correct

### Implementation Guidance — [PRAG-003] MVP Advocate

Defined minimal change: Three separate workflow functions (Option A) rather than LangGraph checkpoints (Option B).

### Final Challenge — [SKEP-002] Devil's Advocate

Withdrew opposition but insisted Approval Agent must provide genuine value beyond validation results (vendor history, anomaly detection, contextual reasoning).

### Vote & Decision

Decisions 001 and 002 passed unanimously (6-0).

---

## Artifacts Created

1. `artifacts/STAGED_WORKFLOW_DESIGN.md` — Complete design document with diagrams, API contracts, and implementation guidance

