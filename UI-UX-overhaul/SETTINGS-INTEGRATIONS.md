# Integrations Plan

## Priority

- Rank: 9
- Route: `/settings/integrations`
- Role: provider configuration and routing trust surface

## Current issues

- The page is long and form-heavy.
- Active provider state exists, but the hierarchy between active routing and provider configuration can be improved.
- Trust, safety, and fallback semantics are not emphasized enough for a sensitive admin page.

## Main user question

Which provider is active, what is configured, and what happens if a provider fails?

## Target user flow

1. See the active routing state first.
2. Configure or edit providers below in a predictable order.
3. Understand which providers are ready, inactive, or misconfigured.

## IA and layout

- Shared settings shell with Preferences.
- Top `routing control` section.
- Below that, provider cards ordered by recommended/default usage.
- Provider forms should collapse when not actively edited if density becomes excessive.

## Shadcn composition

- `Card` for each provider
- `Badge` for active/configured/missing-key states
- `Alert` for warnings and validation errors
- `Accordion` only for provider forms if needed; not for core routing state

## Key redesign decisions

- Make the active-provider picker a first-class summary control.
- Show provider status before showing all editable fields.
- Reduce vertical fatigue by separating summary state from full configuration forms.

## Acceptance criteria

- The operator can identify the active provider instantly.
- Misconfiguration or inactive state is obvious.
- The page reads like a trustworthy admin control surface, not a stack of unrelated forms.
