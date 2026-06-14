# PRD — AI Agency Growth OS

## Document status

- Status: Draft v1.
- Product mode: Internal-first.
- Delivery style: Stage-by-stage, working software only.
- Primary audience: founder, product lead, coding agents, future engineering contributors.

This PRD defines the product requirements for an internal AI-assisted growth and client-acquisition platform for a small creative agency.

---

## 1. Product summary

AI Agency Growth OS is a workflow-first internal business system that helps a creative agency:

- discover potential clients.
- research them faster.
- organize public business information.
- assess digital presence and branding weakness.
- identify likely service opportunities.
- prepare personalized outreach.
- track follow-ups and pipeline movement.
- improve consistency across the full lead-to-client cycle.

It is not a generic CRM and not a fully autonomous outbound engine.

The product is designed to combine AI assistance with human review so that repetitive work is accelerated while judgment stays with the operator.

---

## 2. Problem statement

The agency currently relies on manual effort, memory, intuition, and fragmented tools to identify and win clients.

This creates repeated business problems:

- missed opportunities because discovery is inconsistent.
- weak follow-up discipline because actions are not systemized.
- slow research because every lead requires manual investigation.
- inconsistent lead quality because qualification is subjective.
- poor visibility into pipeline status because information is scattered.
- difficulty expanding beyond the agency’s current niche because discovery and evaluation are not structured.

The product must solve these problems through repeatable workflows, structured data, decision support, and accountable tracking.

---

## 3. Vision

Build a credible internal operating system for agency growth.

The system should help the agency go from:

- ad hoc prospecting to repeatable discovery.
- fragmented notes to structured lead records.
- vague opinions to evidence-backed research.
- random outreach to tailored, reviewable outreach preparation.
- forgotten follow-ups to visible pipeline discipline.
- narrow niche dependence to controlled expansion into new sectors.

The long-term vision is a system where AI performs repetitive research, summarization, classification, drafting, and recommendation tasks, while humans remain in control of targeting, approvals, outreach, and relationship management.

---

## 4. Product principles

### 4.1 Human in the loop

The system assists judgment; it does not replace it.

Sensitive or high-risk actions must require explicit user review and approval.

### 4.2 Workflow first

The product must optimize for repeatable operational flow, not disconnected one-off AI features.

### 4.3 Actionable intelligence

Research is only valuable if it leads to useful next steps.

### 4.4 High trust

The system must surface evidence, timestamps, source references, and confidence markers where practical.

### 4.5 Internal-first realism

The product must be useful for the agency’s own operation before any SaaS thinking.

### 4.6 Reliability over impressiveness

A narrow feature that works is better than a broad feature that sounds ambitious but fails in real use.

### 4.7 Graceful handling of uncertainty

The system must handle incomplete, conflicting, stale, and partially verified business data without collapsing or pretending certainty.

---

## 5. Goals

### 5.1 Primary goals

- Reduce time required to research and prepare a lead.
- Increase consistency in lead qualification.
- Improve follow-up discipline.
- Make outreach preparation more personalized and less generic.
- Create a clear operational view of pipeline state and next actions.
- Support expansion into industries beyond the agency’s current niche.

### 5.2 Secondary goals

- Build reusable internal process IP.
- Improve institutional memory across leads and conversations.
- Create a foundation for future reporting, optimization, and limited productization.

### 5.3 Success outcomes

The product should make it possible for a small agency operator to:

- review more qualified leads per week.
- spend less time doing repetitive research.
- maintain cleaner follow-up discipline.
- generate stronger, more specific outreach prep.
- keep better records of why a lead is promising or not.

---

## 6. Non-goals

The product must not aim to do the following in early versions:

- replace a full enterprise CRM.
- automate sales end-to-end without oversight.
- send mass outreach at scale.
- guarantee accurate enrichment for every lead.
- scrape every possible source on the internet.
- become a general-purpose marketing automation suite.
- optimize for flashy chat UX over structured workflows.
- support external customers or multi-tenancy in the MVP.

---

## 7. Users

### 7.1 Primary user

Agency owner, operator, or sales lead.

Core needs:

- define target client scope.
- discover and review candidate businesses.
- understand why a lead matters.
- see what to do next.
- keep outreach and follow-ups organized.

### 7.2 Secondary users

Internal team members supporting outreach, research, design, branding, or follow-up.

Core needs:

- access assigned leads.
- add notes.
- review research.
- prepare deliverables for outreach or proposals.
- update statuses and outcomes.

### 7.3 Future users

Other small creative agencies, branding studios, marketing firms, or freelancers.

These users are out of current scope but influence architectural hygiene.

---

## 8. Core user jobs to be done

### 8.1 Discovery job

When the agency wants to target a specific type of business, the operator needs to define a discovery scope and generate a workable list of relevant leads.

### 8.2 Research job

When a lead is found, the operator needs a fast, structured understanding of the business, its digital presence, likely pain points, and possible service opportunities.

### 8.3 Qualification job

When many possible leads exist, the operator needs a way to prioritize which ones are worth time and follow-up.

### 8.4 Outreach preparation job

When the agency decides to pursue a lead, the operator needs tailored outreach support that reflects the lead’s actual business context.

### 8.5 Pipeline job

When leads move across time, the operator needs a clear record of status, next steps, prior interactions, and pending follow-ups.

---

## 9. Core product loop

The product must support this end-to-end loop:

1. User defines a client discovery scope.
2. System identifies potential businesses matching the scope.
3. System creates or imports lead records.
4. System gathers public business and contact information where available.
5. System produces a research snapshot for each lead.
6. System audits digital presence and identifies weak spots or opportunities.
7. System calculates or proposes a lead priority score.
8. System suggests next-best actions and outreach approaches.
9. User reviews, edits, approves, and executes follow-up actions.
10. System logs outcomes and updates status.
11. The cycle repeats until the lead is won, lost, paused, or disqualified.

This loop is the backbone of the product. New features must strengthen it, not distract from it.

---

## 10. Functional requirements

### 10.1 Lead discovery scope definition (Campaigns)

The system must allow the user to define a target discovery scope (exposed in the UI as an **Outreach Campaign** or **Campaign**) using filters such as:

- industry.
- geography or city.
- business type.
- company size band when available.
- digital presence quality signals.
- branding or aesthetic weakness signals.
- custom notes or targeting hypotheses.

> [!NOTE]
> For ease of use and terminology alignment, "Discovery Scopes" and the standalone "Discovery Search" route have been unified in the UI under **Campaigns** (`/scopes`). Creating a campaign automatically auto-names the workspace, applies geography fallbacks, and triggers a background discovery crawler. Subsequent runs inside the campaign are initiated via a refinement prompt ("Find More Leads") to prevent duplicate API spend.

#### Acceptance criteria

- User can create and save a campaign.
- A campaign has an automatically generated name based on niche and location.
- Campaign inputs are editable or refineable.
- Scraper history is preserved within the campaign workspace.

### 10.2 Lead record management

The system must create and manage structured lead records.

Each lead record should support, where available:

- business name.
- website.
- email address.
- phone number.
- address.
- social links.
- industry.
- business summary.
- lead source.
- status.
- owner.
- notes.
- timestamps.

#### Acceptance criteria

- User can create, edit, archive, and view a lead.
- User can manually override any editable lead field.
- Missing data does not block lead creation.
- Lead duplicates are detectable or flaggable.

### 10.3 Research snapshots

The system must support research summaries for a lead based on public information.

A research snapshot may include:

- company summary.
- what the business appears to do.
- digital presence observations.
- website observations.
- brand or aesthetic observations.
- likely marketing or positioning gaps.
- possible service opportunities.
- source references.
- freshness timestamp.

#### Acceptance criteria

- A lead can have multiple research snapshots over time.
- Research generation leverages durable background execution (e.g. Cloudflare Workflows) to prevent timeouts and handle partial failures safely.
- Snapshot content is based on actual scraped website data (e.g. via Jina Reader), not AI hallucination.
- Each snapshot stores generation timestamp.
- Snapshot content is editable by a human.
- Snapshot can store linked source references.
- Snapshot clearly distinguishes generated analysis from confirmed facts.

### 10.4 Contact and profile enrichment

The system must support enrichment of public lead information.

Enrichment should attempt to gather or infer:

- website.
- phone.
- email when publicly discoverable.
- address.
- social links.
- industry.
- profile summary.

#### Acceptance criteria

- Enrichment can be run on a lead manually.
- Enrichment can partially succeed.
- Existing human-edited data is not overwritten blindly.
- Enriched fields store provenance or confidence when possible.

### 10.5 Digital presence audit

The system must help the operator evaluate the lead’s outward-facing brand and digital presence.

An audit may include:

- website quality.
- visual coherence.
- messaging clarity.
- social presence quality.
- perceived professionalism.
- conversion weakness indicators.
- trust signal gaps.
- opportunity notes.

#### Acceptance criteria

- Audit output is structured, not just a raw blob.
- Audit can be reviewed and edited.
- Audit can store multiple issue/opportunity findings.
- Audit findings can be linked to outreach strategy.

### 10.6 Lead scoring and prioritization

The system must support lead scoring or prioritization.

Scoring must be explainable and based on visible factors, such as:

- fit with target scope.
- availability of contact paths.
- visible branding weakness.
- website or digital improvement opportunity.
- market attractiveness.
- urgency clues.
- strategic value.
- operator overrides.

#### Acceptance criteria

- Score includes visible rationale or contributing factors.
- User can manually adjust or override score.
- Missing data does not force false precision.
- Score updates are tracked historically when material.

### 10.7 Outreach preparation

The system must assist with, but not autonomously execute, outreach preparation.

Supported formats may include:

- email draft.
- WhatsApp or message prep.
- call prep.
- in-person visit prep.
- pitch or proposal prep.

Each draft should be grounded in lead-specific context.

#### Acceptance criteria

- Drafts are editable before use.
- Drafts are linked to the lead record.
- Drafts can reflect selected outreach channel.
- Draft generation never sends the message automatically.
- User approval is required before any send-capable integration is introduced.

### 10.8 Pipeline and stage tracking

The system must track the lifecycle of each lead.

Initial stage model may include:

- new.
- researching.
- qualified.
- outreach ready.
- contacted.
- follow-up due.
- meeting scheduled.
- proposal stage.
- won.
- lost.
- paused.
- disqualified.

#### Acceptance criteria

- User can update lead stage.
- Stage history is stored.
- Important stage changes can require notes.
- Next-step visibility exists on the lead record and in list views.

### 10.9 Tasks, reminders, and next-step management

The system must help the user stay consistent in follow-up.

This includes:

- tasks.
- due dates.
- reminders.
- suggested next actions.
- overdue visibility.

#### Acceptance criteria

- User can create manual tasks.
- System can suggest a next action based on lead state.
- Overdue tasks are visible.
- Completed tasks remain in history.

### 10.10 Notes and interaction history

The system must maintain a clear activity trail.

Activity may include:

- notes.
- calls.
- outreach drafts.
- meetings.
- status changes.
- reminders.
- manual edits.
- approval decisions.

#### Acceptance criteria

- Activity history is chronological.
- Important changes are attributable and timestamped.
- Notes support freeform capture.
- History is visible on the lead detail page.

### 10.11 Dashboard and operational visibility

The system must provide a practical dashboard for internal operations.

Dashboard elements may include:

- leads by stage.
- tasks due today.
- overdue follow-ups.
- newly researched leads.
- high-priority leads.
- recent activity.

#### Acceptance criteria

- Dashboard reflects current lead and task state.
- Dashboard helps users identify what to do next.
- Metrics do not require perfect data to be useful.

---

## 11. Experience requirements

The product should feel like a serious internal business system.

### 11.1 UX qualities

The system must be:

- practical.
- clear.
- low-friction.
- information-dense but navigable.
- calm and credible.
- easy to review and correct.

### 11.2 Required surfaces

The product should include, over time:

- dashboard.
- lead list.
- lead detail page.
- research summary view.
- audit view.
- outreach assistant.
- pipeline tracking.
- task and status management.
- notes and activity history.
- next-step suggestions.

### 11.3 UX constraints

The system must not feel like:

- a generic bloated CRM.
- a prompt playground.
- a chat toy.
- an autonomous spam engine.
- a flashy AI demo with weak operational structure.

---

## 12. Human-in-the-loop requirements

Human review is mandatory in the following areas:

- final lead qualification.
- meaningful score overrides.
- outreach draft approval before use.
- any future send-capable integrations.
- sensitive edits to business-critical records when workflow policy requires it.

The product must support:

- manual edits.
- approval checkpoints.
- explicit override paths.
- visible evidence and rationale.

The product must not hide or collapse uncertainty into a fake yes/no answer.

---

## 13. Data and quality requirements

### 13.1 Data realism

The product must assume data will often be incomplete or imperfect.

Required handling:

- nullable fields where necessary.
- support for partial lead profiles.
- confidence or verification markers where practical.
- source storage where practical.
- timestamps for enrichment and audits.

### 13.2 Record integrity

The system must:

- avoid accidental destructive overwrites.
- preserve activity history.
- support duplicate review.
- distinguish human-entered data from generated or inferred data where practical.

### 13.3 Explainability

AI-derived outputs should be explainable enough for operational use.

At minimum:

- why this score exists.
- why this opportunity is suggested.
- why this outreach angle was recommended.
- what evidence was considered.

---

## 14. Non-functional requirements

### 14.1 Reliability

The product must support daily internal use.

It should fail gracefully when:

- enrichment is unavailable.
- research sources are incomplete.
- AI output is poor.
- a task has partial data.

### 14.2 Performance

Common operator actions should feel responsive, especially:

- viewing lead lists.
- opening lead detail pages.
- updating status.
- creating notes and tasks.

Long-running work such as enrichment, audits, or AI generation can be asynchronous, but status must be visible.

### 14.3 Traceability

Important system outputs should be attributable to:

- source.
- timestamp.
- actor or generator.
- approval state where relevant.

### 14.4 Maintainability

The system should be designed so workflows, fields, scoring rules, and stage definitions can evolve without full rewrites.

### 14.5 Security and access

Even as an internal tool, the system must treat agency data as operationally sensitive.

At minimum it should support:

- authenticated access.
- controlled edit actions.
- safe handling of secrets and integrations.

### 14.6 Compliance posture

The product must be designed to support lawful, reviewable outreach and responsible handling of public business data.

It must not assume that any data source or scraping behavior is automatically permissible.

---

## 15. MVP definition

The MVP should solve one real weekly workflow end-to-end.

### 15.1 MVP objective

Enable the agency to manage leads in one system and move from raw prospect to researched, prioritized, outreach-ready lead with human review.

### 15.2 MVP included

- manual or simple imported lead creation.
- lead list and lead detail page.
- editable lead fields.
- notes and activity history.
- tasks and reminders.
- basic stage tracking.
- research summary generation or entry.
- basic digital presence audit structure.
- simple transparent lead scoring.
- outreach draft generation with approval-before-use workflow.
- dashboard for immediate operational visibility.

### 15.3 MVP excluded

- autonomous sending.
- complex multi-user permission systems.
- deep external integrations beyond what is required to prove the workflow.
- generalized multi-tenant SaaS concerns.
- heavy predictive analytics.
- advanced automation across many channels.

---

## 16. Release logic

### 16.1 Stage 1 release target

A working internal lead workspace.

Must include:

- dashboard basics.
- lead list.
- lead detail.
- status.
- notes.
- tasks.
- history.

### 16.2 Stage 2 release target

Discovery scope plus candidate lead intake.

### 16.3 Stage 3 release target

Lead research and public-data enrichment.

### 16.4 Stage 4 release target

Audits and transparent scoring.

### 16.5 Stage 5 release target

Outreach preparation and approval workflow.

### 16.6 Stage 6 release target

Pipeline discipline, reminders, and next-best-action support.

### 16.7 Stage 7 release target

Operational reporting and optimization loops.

---

## 17. Risks and limitations

### 17.1 Data quality risk

Public business data may be incomplete, stale, or contradictory.

### 17.2 Over-automation risk

If the product pushes too far into autonomy, quality and trust will fall.

### 17.3 Adoption risk

If the workflow is slower than current informal habits, the system will be bypassed.

### 17.4 False precision risk

Scores and AI summaries may look authoritative even when evidence is weak.

### 17.5 Compliance risk

Outreach workflows and data collection practices must be designed carefully and reviewed before scaling.

### 17.6 Scope creep risk

There is a high risk of turning this into a CRM clone or a generic AI workspace.

---

## 18. Open questions

These questions will need explicit answers in later docs:

- What exact sources are allowed for discovery and enrichment in early versions?
- What fields are required versus optional in a lead record?
- What is the first scoring model and how transparent should it be?
- What approval model is required for outreach drafts and future integrations?
- What is the initial stage model and which transitions require notes?
- What is the minimum viable dashboard metric set?
- Which user roles matter in v1, if any beyond a single operator?
- What data should be versioned historically versus updated in place?

---

## 19. Definition of product success

This product is successful if a small creative agency can use it repeatedly to:

- capture and manage leads in one place.
- reduce research effort.
- prioritize better.
- prepare more relevant outreach.
- follow up more consistently.
- understand current pipeline state at a glance.

The product is not successful if it looks impressive but still requires the team to fall back to scattered notes, memory, and ad hoc workflows.
