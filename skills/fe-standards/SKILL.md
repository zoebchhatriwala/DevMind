---
name: fe-standards
description: >-
  MANDATORY TRIGGER: Build, improve, or review frontend pages, components, forms, styles, and client state. Apply task-specific visual direction, complete interactions, accessibility, responsive layout, and browser verification. Preserve an established design system.
---

# Frontend quality contract

Make the user's task clear, make every control work, and give the interface a deliberate visual identity. A different font or palette alone does not make a generic layout good.

## 🚨 Pre-Flight Gate

Read the existing page, its callers, shared components, tokens, package scripts, and data flow before editing. Use `inspect.mjs [project] --json` to find reuse candidates. Resolve tools in the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this source repository's root `scripts/`; verify the actual path before invocation.

For a patch, follow the established framework and design system without an interview. For a new product, settle the audience, primary task, content, and constraints in one compact exchange only when those choices are unknown. State recommended defaults. Do not make the user choose routine dependencies already present in the repository.

Before a substantial UI change, write a short working design brief in the task notes:

- **Task and outcome:** who uses this screen, what they need to do, and what successful completion shows.
- **Content and hierarchy:** real entities, the primary action, information order, and navigation appropriate to the product.
- **Visual direction:** typography roles, composition, density, color roles, and one domain-specific visual device. Reuse existing decisions first.
- **Interaction contract:** each action's effect, required input, pending state, failure recovery, and persistence boundary.

Reject an implementation plan that could apply unchanged to three unrelated products. Use actual supplied content; label invented sample data as demo data and keep it separate from persisted records.

For a new page or a substantial redesign, read the nearest [annotated design example](./references/fe-design-examples.md). Use its decision criteria without copying its composition into unrelated products. For a behavior change, page/journey review, or skill evaluation, read [verification and evaluation](./references/fe-verification.md). Small patches need only the affected checks and states.

## ⚡ Golden Patterns

### Composition and identity

- Build around the content. An invoice table, recipe index, portfolio, and command console need different compositions.
- Choose a clear focal point and readable information hierarchy. Vary section structure when the content changes; do not wrap every paragraph in identical rounded cards.
- Use restrained type roles, consistent spacing, aligned baselines, and purposeful image crops. Reuse tokens or framework theme configuration; do not create a second token system.
- Use photographs, diagrams, or illustrations when they explain the product. Use supplied or authorized assets and meaningful alt text. Do not fabricate customer logos, endorsements, awards, or performance claims.
- Avoid default gradient heroes, decorative glow blobs, ornamental badges, repeated three-card grids, and empty dashboard metrics unless the brief specifically calls for them. Color, dark mode, gradients, and rounded corners are tools, not quality scores or blanket bans.
- Match navigation to scope. Use an app shell for multi-area applications, breadcrumbs for meaningful hierarchy, and simpler navigation for small tools or marketing pages. Never add irrelevant SaaS chrome to satisfy a template.
- Reuse the existing icon library. Prefer a text label if no icon is needed. Avoid emoji as control icons and do not install a package for one decorative symbol.

### Actions and data

Every visible control must have a meaningful result. Links navigate; buttons perform actions. Remove dead controls, `href="#"`, no-op handlers, fake search, fake filters, and fabricated success messages. If an integration is unavailable, make the limitation clear before the user acts.

Use native controls and existing accessible primitives first. Keep derived state derived; do not duplicate server data into multiple independent stores or use effects for values computed during render. Validate external data at the boundary with the project's schema tools, and keep server authority over identity, roles, prices, and permissions.

For asynchronous actions, cover the states that can actually occur: pending, success, failure, empty data, and permission restrictions. Prevent duplicate submissions, preserve entered values on failure, provide a retry path, and only show success after the underlying operation succeeds. Do not invent loading delays, progress percentages, or backend persistence.

```tsx
async function submitInvoice(input: InvoiceInput) {
  setStatus('pending');
  try {
    const saved = await saveInvoice(input);
    setInvoice(saved);
    setStatus('saved');
  } catch {
    setStatus('failed');
  }
}
```

In this example, the page must render a specific, actionable error for `failed` and announce the result. Use the existing query/mutation library instead when it already manages these states. The example does not authorize inventing a new client state framework.

### Copy and trust

Use concrete domain nouns and action verbs: "Send invoice", "Retry upload", "No appointments on Tuesday". Avoid filler such as "Unlock your potential", "Seamless experience", or "Next-gen platform". Describe the user's outcome rather than prompt mechanics or internal pipelines. Follow DevMind's copy convention: use sentences or colons instead of em dashes in UI text.

Explain why an empty state exists and offer a relevant next step only when one exists. State the actual consequence of destructive actions. Keep private data, raw exception text, and secrets out of the interface and logs. Do not claim encryption, uptime, compliance, or customer results without evidence.

### Accessibility and responsive behavior

- Use semantic landmarks and heading order. Inputs need visible associated labels and useful errors. Icon-only controls need accessible names; decorative icons should be hidden from assistive technology.
- Support keyboard operation, visible focus, and logical tab order. Use established dialog/menu primitives with correct dismissal and focus restoration. Avoid clickable `div` elements and blocking browser alert flows.
- Meet WCAG 2.2 AA: normal text contrast at least 4.5:1; large text and meaningful non-text boundaries at least 3:1 where applicable. Distinguish the WCAG 24px target minimum and spacing exceptions from the preferred 44px touch target.
- Use `contrast.mjs "#foreground" "#background" --json` to check opaque color pairs; inspect actual rendered states separately. Do not certify accessibility from that calculation alone.
- Use fluid layout and meaningful responsive changes. Check 320px and 390px mobile, 768px tablet, and 1440px desktop plus the project's supported widths. Contain necessary table/code scrolling inside the component; do not hide page overflow to conceal layout defects.
- Test long labels, real data volume, large text/zoom, and missing assets. Respect reduced motion. Motion should explain state or position without delaying the task.

## 🔍 Anti-Amnesia Receipt

At the initial implementation update, print one concise receipt using checks actually inspected:

`🧠 [DevMind: fe-standards applied | Checked: shared controls inspected, task hierarchy defined, interaction outcomes traced]`

Do not put compliance narration in source comments or product copy.

## ✅ Post-Implementation Checklist

1. Run `verify.mjs [project] --json --strict`; it uses an installed TypeScript parser where supported and reports its fallback. Review evidence against real callers. Neither AST patterns nor lexical hints prove trust boundaries, reachability, or design quality.
2. Inspect `quality.mjs [project] --json`, then use `--run` to execute the existing relevant project scripts. Do not add a second toolchain or report missing checks as passed. For a small patch, run only the applicable existing checks directly.
3. Open the real page and use `browser-audit.mjs [project] <loopback-url> --plan <plan.json>` for repeatable viewport captures and explicit outcome assertions. Exercise keyboard and pointer behavior and applicable pending/error/empty/success states. Screenshots require actual visual review.
4. Look for generic composition, weak hierarchy, clipped text, alignment drift, dead controls, unsupported claims, and layout overflow. Correct concrete defects and repeat the affected checks.
5. For page/journey work, combine current source, project-check, browser, and reviewer evidence with `review.mjs`; stale reports and missing criteria must remain unresolved. Use `eval.mjs`'s seeded tasks when changing the skill itself. Report actual results and gaps. Missing tooling never counts as a pass.

Stop when the requested outcome works and the checks pass. Avoid extra dashboards, themes, settings, packages, animations, and reusable wrappers the task did not require.
