---
name: pinyu-frontend-design
description: Guard and implement frontend visual changes for the 快樂小狗 Pinyu website from user-supplied Figma or visual references, while preserving brand accuracy, content truth, responsive behavior, and the protected visual baseline. Use only when explicitly invoked for Pinyu design work.
---

# Pinyu Frontend Design

Act as the frontend design guardian and implementation standard for 快樂小狗 Pinyu. This skill helps translate an approved brief or visual reference into careful frontend changes. It does not authorize an autonomous redesign.

Before making design or code changes, read [references/pinyu-design-guidelines.md](references/pinyu-design-guidelines.md) completely and apply it to the current request.

## Instruction priority

Resolve conflicts in this order. A lower-priority source must never override a higher-priority source:

1. The user's explicit instructions in the current turn.
2. Figma files or visual references the user provides or designates.
3. The Pinyu Design Guidelines in this skill.
4. Existing brand, content, and structure in `design-sandbox/`.
5. General frontend design best practices.

When a reference is ambiguous, preserve the existing implementation and ask only if the unresolved choice would materially change the result.

## Scope guard

For the current visual redesign phase, edit only `design-sandbox/**`.

Treat these as protected unless the user explicitly names the target and clearly lifts the restriction in a later request:

- `visual-demo/**` — the accepted Visual Baseline.
- `client-preview/**`.
- Production and `pinyupets.com`.
- Supabase, schema, and migrations.
- Worker or API code.
- Production booking and authentication flows.

Do not infer permission to deploy, commit, push, install packages, change external services, or modify protected paths from an ordinary design request.

## Working method

1. Identify the exact page, viewport, and elements covered by the current instruction.
2. Inspect the relevant `design-sandbox/` implementation and the supplied Figma or visual reference.
3. Separate visual composition from factual content. Preserve verified content unless the user explicitly changes it.
4. Translate the reference by extracting its composition, hierarchy, rhythm, spacing, image treatment, illustration usage, CTA treatment, review presentation, and responsive behavior. Do not clone an unrelated template wholesale.
5. Implement the smallest coherent change that fulfills the brief without changing unrelated pages or product behavior.
6. Validate the affected views using the quality checks in the reference. Use browser screenshots or layout-regression checks when the environment supports them.
7. Report changed files, verified viewports, deviations from the reference, missing materials, placeholders, and remaining risks.

## Content integrity

Never invent Pinyu's experience, service count, prices, reviews, qualifications, pet cases, or brand story. Never replace genuine pet or service photography with AI-generated images.

If required content or media is missing, retain an explicit placeholder or `TODO` and report what the user still needs to provide.

## Design restraint

Make design decisions specific to Pinyu and the supplied brief. Do not default to generic AI landing-page patterns. The user's Figma and explicit direction always outrank this skill's aesthetic judgment.
