# Pinyu Design Guidelines

## Purpose and source of truth

Use these guidelines when implementing visual changes for the 快樂小狗 Pinyu website. They protect the accepted brand direction and help convert user-approved designs into maintainable frontend code.

The current visual working area is `design-sandbox/**`. The accepted reference version is `visual-demo/**`, which is the Visual Baseline and must remain unchanged unless the user explicitly lifts that protection.

## Decision hierarchy

Apply design inputs in this order:

1. The user's explicit instructions for the current task.
2. A Figma file or visual reference the user supplies or designates.
3. This Pinyu Design Guidelines document.
4. Existing brand, content, and structure in `design-sandbox/`.
5. General frontend design best practices.

Never use a lower-priority preference to reinterpret or override a higher-priority instruction.

## Brand character

The experience should feel:

- Gentle.
- Lively.
- Professional.
- Reassuring.
- Human and warm.
- Personal to Pinyu rather than anonymous or corporate.

It should not resemble:

- A large generic pet-service marketplace.
- A SaaS product or dashboard unless the task is actually an internal tool.
- A hospital or clinical institution.
- A cheap pet-shop advertisement.

Professionalism should come from clarity, care, credible content, and consistent execution. Do not make the site cold or corporate in an attempt to appear premium. Cuteness must not reduce readability or trust.

## Visual language

Appropriate ingredients include:

- Real Pinyu and pet photography.
- Genuine service photos and existing brand materials.
- Illustration-like accents.
- A small amount of hand-drawn lines, arrows, or paw motifs.
- Rounded elements used with purpose.
- Generous whitespace.
- Sections with deliberate rhythm and varied composition.
- Ordered asymmetry when it supports the content.
- Thoughtful combinations of real photography and illustration.

Avoid:

- Generic AI-generated landing-page composition.
- Turning every piece of content into a card.
- Six-tile SaaS feature grids as a default.
- Excessive gradients, glassmorphism, shadows, or floating decorations.
- Making every section use the same composition.
- Motion that does not communicate state, hierarchy, or feedback.
- Replacing brand personality with a generic luxury-corporate style.
- Sacrificing reading comfort for cuteness or novelty.

Use distinctive ideas selectively. One clear visual signature is usually stronger than many competing decorations.

## Typography and readability

- Preserve Pinyu's gentle, rounded, readable character unless the user's current design specifies otherwise.
- Use a clear type hierarchy rather than relying only on heavier font weights.
- Check line length, line height, paragraph spacing, and contrast at every target viewport.
- Avoid overly dense, overly bold, or tightly compressed text.
- Keep labels, actions, and explanatory copy easy to scan in Traditional Chinese.
- Decorative type must never compromise essential service, price, booking, privacy, or safety information.

## Layout and section rhythm

- Let structure communicate meaning. Numbering belongs to real sequences; dividers and labels should clarify relationships.
- Vary section composition when the content calls for it, while keeping page rhythm coherent.
- Use whitespace to separate ideas instead of surrounding every block with a border or card.
- Keep key CTAs visible without making every action equally prominent.
- Avoid accidental horizontal overflow and fragile positioning tied to one viewport.
- Preserve semantic HTML and understandable DOM order when visual placement changes.

## Photography and illustration

- Prefer existing real photos and user-provided assets.
- Do not generate AI pet photos as substitutes for real animals, clients, services, or cases.
- Preserve the subject of important photos when cropping across viewports.
- Do not stretch, distort, or obscure faces and animals with decorative overlays.
- Use illustration and hand-drawn accents as support, not as proof of service or experience.
- If the needed asset is missing, use a clearly identified placeholder or `TODO` and report it.

## Content truth and safety

Do not invent, estimate, embellish, or silently alter:

- Pinyu's experience or biography.
- Service counts.
- Prices, fees, discounts, or service rules.
- Reviews or private feedback.
- Qualifications and certificates.
- Pet identities or service cases.
- Brand history or claims.

Do not expose private customer, family, address, phone, contract, LINE, or pet medical information while creating public visual examples.

When verified copy is not provided, preserve the current wording or mark the gap explicitly instead of drafting a factual claim.

## Working with Figma and visual references

Do not copy an entire Community template blindly. First identify what the user wants to borrow:

- Hero composition.
- Typography hierarchy.
- Section rhythm.
- Spacing system.
- Image treatment and crop behavior.
- Illustration usage.
- CTA hierarchy and treatment.
- Review or testimonial presentation.
- Desktop, tablet, and mobile behavior.

Reassemble only the approved characteristics using Pinyu's real content and assets. If Figma conflicts with the user's written instruction, follow the written instruction. If it conflicts with an unmentioned existing design choice, follow Figma while preserving content truth and functional accessibility.

## Interaction and motion

- Use motion only when it improves orientation, feedback, hierarchy, or delight appropriate to the brand.
- Prefer one coordinated motion idea over scattered effects.
- Honor `prefers-reduced-motion`.
- Preserve visible keyboard focus and logical focus order.
- Ensure interactive controls have clear states and adequate touch targets.
- Do not hide necessary information behind hover-only interactions.

## Responsive quality checklist

After an important UI change, verify the affected page at representative desktop, tablet, and mobile widths. At minimum inspect:

- Desktop layout.
- Tablet layout.
- Mobile layout.
- Horizontal and clipped overflow.
- Header, navigation, and mobile menu behavior.
- Typography, line height, wrapping, and readable line length.
- Section spacing, padding, and alignment.
- Image aspect ratio, crop, focal point, and loading behavior.
- CTA hierarchy and placement.
- Touch-target size and spacing.
- Keyboard focus and tab order.
- Reduced-motion behavior.
- Color contrast and overall readability.

When tools are available, compare browser screenshots before and after the change and run an appropriate layout-regression check. Do not claim a viewport passed unless it was actually inspected or tested.

## Completion report

Report:

- Files changed.
- Pages and components affected.
- Viewports actually checked.
- How the implementation maps to the user's Figma or reference.
- Any deliberate deviations and their reason.
- Missing copy or assets left as placeholders or `TODO`s.
- Any unresolved overflow, navigation, accessibility, or regression risk.
