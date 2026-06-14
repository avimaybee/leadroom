---
plan_id: "007"
title: "Implement edit and delete logic for Stage 3 Contacts"
status: "Pending"
priority: "High"
stage: "Stage 3"
---

# Plan 007: Implement edit and delete logic for Stage 3 Contacts

## Problem Statement
Stage 3 defines contacts/stakeholders as a key feature. Currently, users can add contacts via the UI (`ClientContactsList.tsx`) but cannot edit or delete them. `ResearchService` lacks `updateContact` and `deleteContact` methods, and there are no UI controls to manage an existing contact list.

## File targets
- `src/services/research.ts`
- `src/app/actions/research.ts`
- `src/app/(dashboard)/leads/[id]/ClientContactsList.tsx`
- `src/app/(dashboard)/leads/[id]/page.tsx`

## Step-by-step instructions
1. Open `src/services/research.ts`.
2. Add `deleteContact(leadId: string, contactId: string)`:
   - Perform a soft-delete by setting `deletedAt` to `new Date()`.
   - Log an activity that the contact was removed.
3. Add `updateContact(leadId: string, contactId: string, input: Partial<Contact>)`:
   - Enforce primary contact uniqueness (if making this primary, unmark others).
   - Update the contact row.
   - Log an activity.
4. Open `src/app/actions/research.ts`.
5. Export `deleteContactAction(prevState: any, formData: FormData)` extracting `leadId` and `contactId`.
6. Export `updateContactAction(prevState: any, formData: FormData)` to handle edits.
7. Open `src/app/(dashboard)/leads/[id]/ClientContactsList.tsx`.
8. Add an "Edit" and "Delete" button to the layout of each contact card.
9. Implement minimal form state to switch a contact card from view mode to edit mode, wiring it up to `updateContactAction`. Wire the delete button to `deleteContactAction`.
10. Update `page.tsx` to pass the new actions to `ClientContactsList`.

## Verification
- Open the UI and attempt to add, edit, and delete a contact on a lead's page.
- Ensure the primary contact radio logic works across edits.
- Ensure activities are logged for all mutations.

## Drift check
Check `src/services/research.ts`. If `deleteContact` exists, this plan may be partially or completely done.
