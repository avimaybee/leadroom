# PRD: Autonomous SDR / Founder-Led Sales Agent

## 1. Product Definition

Leadroom is a founder-led sales operating system that uses agentic workflows to discover, research, prioritize, personalize, and manage outbound sales opportunities. The product helps a founder or small team turn a target market into a qualified, approval-ready pipeline without hiring a sales development team.

This is **not** an email spam bot. It is a research-first, approval-gated sales intelligence system.

### The user should be able to answer these questions:
- Which companies should I reach out to first?
- Why is this company a good fit? (Show me the exact evidence)
- What pain point should I lead with?
- Who should I contact?
- What personalized message should I send?
- Has this lead been reviewed and approved by a human?
- What happened after outreach, and what did the AI learn from the outcome?

---

## 2. Core Value Proposition

> A founder-led revenue intelligence system that turns niche markets into researched, scored, and approval-ready sales opportunities.

The product must feel useful even before sending a single email. The research, prioritization, and decision support are the core. Sending is optional and always gated.

---

## 3. Key Entities & Domain Model

1. **Workspace**: Top-level container for a founder or agency.
2. **Offer**: What the user sells (Positioning, pain points, desired outcomes, proof, constraints).
3. **ICP Profile**: Definition of a good-fit customer (Positive/negative signals, disqualifiers, priority weights).
4. **Market**: A segment being explored (e.g., "D2C skincare brands in India").
5. **Prospect**: A potential customer account containing fit scores and agent research artifacts.
6. **Research Task**: A granular background agent job (e.g., website analysis, disqualifier check, contact discovery).
7. **Signal**: Evidence extracted from a Research Task that affects a prospect's score.
8. **Outreach Draft**: Proposed outreach requiring strict human approval, citing evidence.
9. **Outcome**: The result of outreach (e.g., Replied, Bounced, Won), fed into the Learning Loop.

---

## 4. Product Workflows

### 4.1 Configuration (The Brain)
Users define their Workspace, Offer, and ICP Profile. The ICP Profile includes heavily weighted positive signals (e.g., "outdated UX"), negative signals (e.g., "uses competing software"), and hard disqualifiers (e.g., "enterprise size"). 

### 4.2 Prospect Ingestion & Research Queue
Prospect domains are ingested (via manual entry, CSV, or targeted scraper). A queue of Agentic Research Tasks runs asynchronously to fetch data, score against the ICP, and extract exact JSON evidence (citations, quotes).

### 4.3 Command Center Prioritization
The Command Center is a dense, information-rich view showing "Ready to Review" prospects. Fit Score and Confidence Score are decoupled. A user can review a prospect, see the exact quoted evidence for why it scored highly, and make a decision (Approve Draft, Skip, Research More) in under 60 seconds.

### 4.4 Approval-Gated Outreach
Agentic drafting leverages the Offer and the extracted Signals to draft highly targeted emails. Drafts contain "Risk Flags" (e.g., "Weak evidence for this claim"). The user reviews the draft side-by-side with the evidence, and explicitly clicks **Approve** or **Reject with Notes**.

### 4.5 The Learning Loop
When an outcome is logged (e.g., "Meeting Booked" or "Not Interested"), the system compares the outcome against the prospect's signals. The system proactively suggests updates to the ICP Profile (e.g., "Companies with signal 'No clear pricing page' bounce 80% of the time. Do you want to add this as a Disqualifier?").

---

## 5. Non-Goals

- **No autonomous spam.** Every single message requires an explicit human click to approve.
- **No scraping private/social data behind logins.**
- **No black-box scoring.** If a lead is a 95/100, the user must see the exact 5 signals that contributed to the score, with cited evidence.
- **No chat-first UI.** The UI is a dense, structured data workstation. Chat is a secondary interaction layer (if present at all).

---

## 6. UX Principles

- **Side-by-Side Review:** Evidence and Drafts must be visible simultaneously.
- **Receipts:** AI claims must highlight or link to the specific text found on the prospect's website.
- **Failure is Expected:** If a website is down, the system marks the Research Task as failed, drops the Confidence score, but does not crash the prospect record.

---

## 7. Cost & Infrastructure (BYOK)

The product supports BYOK (Bring Your Own Key). Because agentic research uses heavy multi-step LLM calls, users can plug in their own keys and configure budget caps. The system caches website snapshots to avoid re-fetching data redundantly.
