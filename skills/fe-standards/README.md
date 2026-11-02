# Frontend standards

Read [SKILL.md](./SKILL.md) for the executable workflow.

The guide covers task-specific visual direction, composition, existing token and component reuse, complete asynchronous interactions, useful copy, responsive behavior, WCAG 2.2 AA, and browser-based verification. It follows the project's framework and design system rather than prescribing a data library, icon package, app shell, or fixed visual theme.

Bundled JavaScript tools:

- `scripts/inspect.mjs [project] --json`: discover existing components, tokens, packages, and quality tooling.
- `scripts/verify.mjs [project] --json --strict`: report source-level findings with file/line evidence and review limitations.
- `scripts/contrast.mjs "#111827" "#ffffff" --json`: calculate solid color contrast.
- `scripts/browser-audit.mjs [project] [loopback-url] --plan [plan.json]`: run explicit browser assertions and capture responsive evidence using existing Playwright.
- `scripts/quality.mjs [project] --run --json`: execute existing project check scripts, without installing a second toolchain.
- `scripts/review.mjs [project]`: combine current check reports and observation-based assessments.
- `scripts/eval.mjs --list`: five realistic seeded tasks with behavior checks and review criteria.

Read [design examples](./references/fe-design-examples.md) for content-specific decisions and [verification](./references/fe-verification.md) for plans, reports, evaluation, and checks proportional to the change.

Tools live in each built skill's `scripts/` directory or `.devmind/scripts/` after local installation. In this source repository, use the root `scripts/` directory. Source checks complement real mobile/desktop browser review and keyboard interaction checks; they do not certify design quality or accessibility.
