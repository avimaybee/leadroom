---
version: 1.0.0
name: Leadroom
description: Leadroom’s internal design system.
colors:
  background: "oklch(1 0 0)"
  foreground: "oklch(0.145 0 0)"
  card: "oklch(1 0 0)"
  card-foreground: "oklch(0.145 0 0)"
  popover: "oklch(1 0 0)"
  popover-foreground: "oklch(0.145 0 0)"
  primary: "oklch(0.6 0.13 30)"
  primary-foreground: "oklch(1 0 0)"
  secondary: "oklch(0.965 0.01 30)"
  secondary-foreground: "oklch(0.25 0.03 30)"
  muted: "oklch(0.965 0.005 30)"
  muted-foreground: "oklch(0.55 0.02 30)"
  accent: "oklch(0.92 0.03 30)"
  accent-foreground: "oklch(0.3 0.05 30)"
  destructive: "oklch(0.577 0.245 27.325)"
  border: "oklch(0.91 0.01 30)"
  input: "oklch(0.91 0.01 30)"
  ring: "oklch(0.6 0.13 30)"
  chart-1: "oklch(0.6 0.13 30)"
  chart-2: "oklch(0.55 0.08 160)"
  chart-3: "oklch(0.65 0.09 25)"
  chart-4: "oklch(0.75 0.06 85)"
  chart-5: "oklch(0.45 0.05 30)"
typography:
  heading-4xl:
    fontFamily: Geist Sans
    fontSize: 36px
    fontWeight: 700
    lineHeight: 40px
    letterSpacing: -0.9px
  heading-3xl:
    fontFamily: Geist Sans
    fontSize: 30px
    fontWeight: 700
    lineHeight: 36px
    letterSpacing: -0.75px
  heading-2xl:
    fontFamily: Geist Sans
    fontSize: 24px
    fontWeight: 700
    lineHeight: 32px
    letterSpacing: -0.6px
  heading-xl:
    fontFamily: Geist Sans
    fontSize: 20px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.4px
  heading-lg:
    fontFamily: Geist Sans
    fontSize: 18px
    fontWeight: 600
    lineHeight: 28px
    letterSpacing: -0.36px
  label-14:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: 600
    lineHeight: 20px
  label-12:
    fontFamily: Geist Sans
    fontSize: 12px
    fontWeight: 600
    lineHeight: 16px
  copy-16:
    fontFamily: Geist Sans
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
  copy-14:
    fontFamily: Geist Sans
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
  copy-13:
    fontFamily: Geist Sans
    fontSize: 13px
    fontWeight: 400
    lineHeight: 18px
  mono-14:
    fontFamily: Geist Mono
    fontSize: 14px
    fontWeight: 500
    lineHeight: 20px
  mono-12:
    fontFamily: Geist Mono
    fontSize: 12px
    fontWeight: 500
    lineHeight: 16px
spacing:
  1: 4px
  2: 8px
  3: 12px
  4: 16px
  6: 24px
  8: 32px
  10: 40px
  12: 48px
  16: 64px
rounded:
  sm: 6px
  md: 8px
  lg: 10px
  xl: 14px
  2xl: 18px
  full: 9999px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    typography: "{typography.label-14}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: 40px
  button-secondary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.secondary-foreground}"
    typography: "{typography.label-14}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: 40px
  button-outline:
    backgroundColor: "transparent"
    borderColor: "{colors.border}"
    textColor: "{colors.foreground}"
    typography: "{typography.label-14}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: 40px
  button-destructive:
    backgroundColor: "{colors.destructive}"
    textColor: "oklch(1 0 0)"
    typography: "{typography.label-14}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: 40px
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    borderColor: "{colors.input}"
    typography: "{typography.copy-14}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: 40px
---

# Leadroom Design System

## Overview

Leadroom is an internal operating system designed for raw operator speed, high information density, and unambiguous clarity. Borrowing from Vercel’s minimal, high-contrast aesthetic, Leadroom relies heavily on whitespace, rigorous layout alignment, and semantic coloring to guide agency workflows. If a design choice does not make an operator faster or more accurate, it is removed.

This is the Light theme. The system is built on top of Shadcn UI and Tailwind CSS, utilizing `oklch` for all color definitions to ensure perceptual uniformity and Display P3 compatibility.

## Colors

Color is intent, not decoration. Our palette avoids excessive saturation on generic surfaces, saving strict color usage for signaling states, hierarchy, and urgency:

- `background` and `card` form the primary canvases.
- `muted` and `secondary` provide subtle tonal separation.
- `primary` is the dominant call-to-action color, emphasizing the single most important action on a view.
- `destructive` isolates permanent, high-risk actions.
- `chart-1` through `chart-5` are used exclusively for data visualization and categorical tagging (e.g. Pipeline Stage badges).

**Layering & Alphas:** We heavily utilize translucent backgrounds (e.g., `bg-primary/10`, `hover:bg-muted/80`) to create elegant hover states and badges that blend cleanly over their background surfaces without hard clashes.

## Typography

Geist Sans sets the UI and prose; Geist Mono sets code, technical logs, IDs, and tabular figures. 

- Headings (`heading-4xl` to `heading-lg`) establish structural hierarchy. Tracking (letter-spacing) tightens automatically as the size increases.
- Labels (`label-14`, `label-12`) are used for dense, scannable elements: table headers, form labels, small actions, and metadata.
- Copy (`copy-16`, `copy-14`) is strictly reserved for body text that wraps to multiple lines.
- Mono (`mono-14`, `mono-12`) is used inside the Activity timeline and Error/Diagnostics overlays to guarantee alignment.

## Layout & Rhythm

Spacing strictly follows the 4px baseline. We employ a three-step rhythm for predictable UI density:

1. **Tight (4px–8px):** Inside a group (e.g. spacing between an icon and its label, or a heading and its subtitle).
2. **Section (16px–24px):** Between related groups (e.g. distinct form fieldsets or adjacent cards).
3. **Breathing Room (32px–40px):** Between major structural zones (e.g. separating the Page Header from the Main Content grid).

**Grid:** Desktop layouts center content within a max-width container, strictly utilizing a 12-column grid. Most workspaces operate on an **8/4 split** (Main Content takes 8 spans; Supporting Actions take 4 spans). We enforce *one scroll container per page* to prevent scroll-in-scroll trapping.

## Elevation & Depth

Hierarchy comes from tonal surfaces and borders first. Shadows are earned.

- Standard cards and inputs sit flat, relying entirely on `border-border` and background shifts for separation.
- **Card-in-Card Anti-Pattern:** Do not place a bordered element inside another bordered card. Embedded tools (like a note composer) must strip their borders and merge transparently into the host surface.
- **Z-Index Elevation:** Subtle shadows (`shadow-sm`) are applied to floating headers and dropdown menus. Deep shadows (`shadow-lg`) are reserved strictly for modals, sheets, and popovers.

## Motion

Motion must be functional, physical, and short. Never animate for the sake of decoration.

- Interaction feedback on hovers and clicks should be nearly instantaneous (150ms).
- Structural reveals, overlays, modals, and drawers enter the viewport with a physical, tight `ease-out` easing over 200ms–300ms.
- Any long-running operation must immediately display a status indicator (using the present participle `Saving...`, `Generating...`) so the user is never wondering if the system froze.
- Always honor `prefers-reduced-motion` to kill unnecessary transitions for accessibility.

## Shapes

Radii stay tight and consistent. Do not mix sharp and rounded corners within the same view.

- `6px–10px (rounded-md/lg):` Standard inputs, interactive buttons, and badges.
- `12px–18px (rounded-xl/2xl):` Large structural cards, modals, and sheets.
- `9999px (rounded-full):` Avatars, notification dots, and isolated pill elements.

## Focus & Accessibility

Every interactive element must provide visible feedback.

- **Focus Rings:** Accessibility is non-negotiable. Every focused element must expose a clear `:focus-visible` ring. Our system enforces a strict 2px offset solid outline via `outline-ring/50`.
- Never remove a focus outline without providing a visible replacement.

## Voice & Content

Copy is part of the design. Remove all filler.

- Use Title Case for page headings and tabs; sentence case for body text, helper text, and alerts.
- Name actions with a **Verb + Noun** structure (`Open Lead`, `Run Scan`, `Add Contact`), avoiding generic verbs like `Confirm`, `OK`, or `Submit`.
- Strip marketing fluff and hyperbole. Drop the word "successfully" from toasts (use `Lead archived`, not `Successfully archived the lead`).
- Errors must explain what happened and what the operator must do next: `Scrape failed. Target site timed out. Enter details manually.`
- Empty states must *always* offer a primary action pointing the operator out of the dead end.

## Do's and Don'ts

- **Do** rely on the 4px spacing scale and 8/4 grid column splits for structural alignment.
- **Do** hold strict WCAG AA contrast ratios, primarily by reserving `text-foreground` and `text-muted-foreground` for their explicit purposes.
- **Don't** use `bg-card` or `bg-muted` indiscriminately; they exist for grouping and subtle separation.
- **Don't** signal state with color alone; pair destructive or warning colors with explicit text labels or standard Lucide icons (`ShieldAlert`, `Clock`).
- **Don't** use long, looping, or attention-grabbing animations. Keep it boring, keep it fast.
