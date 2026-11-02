# Design examples: decisions and observable outcomes

Read only the example closest to the current task. These are content and interaction patterns, not templates to copy across products. Preserve the project's established visual language.

## Invoice workspace: information density and authority

**Weak:** a large greeting, four invented revenue cards, a decorative chart, then a small invoice table. Save produces a toast before the request finishes. Every cell is a rounded badge.

**Better:** lead with "Invoices", the billing period, and "New invoice". Put search and meaningful filters immediately above the records. Align amounts, distinguish paid/overdue with text as well as color, and expose the next action for each invoice. On narrow screens, retain client, amount, and status; keep additional columns inside an explicitly scrollable region or use a deliberate compact record layout.

**Why:** the user needs to find and act on a record. Financial numbers come from actual data; decoration must not displace that task. Server confirmation controls success, while a failed save preserves entered fields.

**Review:** Can a user find an overdue invoice, read its amount, and choose the next action without inspecting unrelated statistics? Do long client names and large amounts remain readable? Do empty search results explain the filter and provide a reset?

## Print studio storefront: product imagery and editorial hierarchy

**Weak:** "Unlock creative potential", a gradient hero, three identical feature cards, invented customer logos, and an unrelated dashboard illustration.

**Better:** lead with an actual edition or an honestly labeled artwork study. Set the studio name, edition title, medium, dimensions, price, and availability in a clear hierarchy. Use image scale, crop, whitespace, and type roles to direct attention. Navigation should help visitors browse editions or learn about the studio. Use supplied facts; do not invent scarcity or testimonials.

**Why:** artwork and production details establish the identity. This content can justify an image-led, editorial composition that would obstruct a dense billing table.

**Review:** Is the product recognizable before reading promotional text? Is the artwork dominant at both mobile and desktop sizes? Are price, dimensions, and subscription outcomes truthful? Does every commercial action work or disclose its limitation before use?

## Notes editor: quiet hierarchy and keyboard continuity

**Weak:** a huge title card, multiple toolbars for unsupported functions, placeholder-only fields, a clickable div labeled "Save", and an invisible focus outline.

**Better:** a visible "Notes" label, a comfortably sized editing area, and the actual save action. Keep focus visible and tab order predictable. Announce saved/failed state without moving the user's focus. If editing is local-only, do not imply durable server storage.

**Why:** a small editor should keep attention on writing. More chrome does not add capability. Keyboard interaction and clear persistence semantics are part of the design.

**Review:** Can a user edit and save using Tab and Enter? Does the interface explain unsaved, saved, and failed states where applicable? Can text enlarge without clipping controls?

## Shared button extension: reuse with a real behavioral contract

**Weak:** add a second button component, a new spinner package, a generic state manager, and configuration for hypothetical variants. Existing callers silently change behavior.

**Better:** inspect all callers of the existing primitive. Add the smallest compatible behavior needed for this task. Keep native button semantics, a stable accessible name, visible focus, and a disabled/pending state tied to the actual operation. Preserve the old call form when extending a public helper.

**Why:** consistent behavior reduces maintenance and user confusion. A short helper with verified callers can be better than a new component hierarchy.

**Review:** Does the changed action resist duplicate submission? Does the original sibling action still work? Are pending state, completion, and failure based on the underlying operation? Does the diff contain unnecessary wrappers or dependencies?

## Cross-cutting visual observations

Judge screenshots at their actual viewport size. Record a specific observation under each applicable criterion:

| Criterion | Useful observation | Insufficient observation |
| --- | --- | --- |
| Task fit | Search and overdue status are visible before the first record. | Looks professional. |
| Hierarchy | Edition image leads, while price and dimensions remain adjacent. | Nice font. |
| Composition | Wide artwork and narrow details reflect the supplied content. | No purple used. |
| Content | Empty state names the active filter and offers reset. | Copy sounds human. |
| Responsive | At 390px, long names wrap and only the table scrolls. | Responsive classes exist. |
| Keyboard | Tab reaches Notes then Save; Enter updates the status without losing focus. | Button has an aria-label. |
| States | A 503 response keeps both fields and exposes a retryable error. | There is a catch block. |

Do not combine these observations into an invented "AI slop percentage". Record passed, failed, or not reviewed with artifact paths and a concrete explanation.
