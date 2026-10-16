# fe-standards

> Frontend Engineering Standards for fullstack web applications.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for all tech-stack decisions (framework, language, styling, component primitives, server state) before writing any code.
2. Enforce the **30 Core UX, UI & Accessibility Standards** with **WCAG 2.2 AA** as the non-negotiable baseline.
3. **Scaffold a centralized design token system (`tokens.css`)** for color, typography, spacing, radius, shadows, touch targets ($\ge 44\text{px}$), and `:focus-visible` rings.
4. Ensure **complete 8-state interaction coverage** (default, hover, focus, active, disabled, loading, error, success) across interactive controls.
5. Enforce **TypeScript strict mode**, Zod runtime validation, and semantic HTML throughout.
6. Build **reusable, accessible UI primitives** (Radix / shadcn/ui headless-first contracts, user-confirmed vector icon library, strictly zero emojis, and optical flex alignment).
7. Wire **SWR** for data fetching and mutations with automatic cache invalidation and toast feedback.
8. Enforce **human, engaging typography and UX copy** with zero technical jargon, no tacky phrasing, and no internal business logic or architecture leaks.
9. Enforce **server-side pagination** on all tables and lists, synchronized with URL search params.
10. Prohibit native browser dialogs (`window.alert`, `confirm`, `prompt`) in favor of accessible custom modals and confirm dialogs.
11. Write **co-located Vitest + RTL + MSW tests** covering all interaction and UI states.
12. Apply **frontend security controls** (DOMPurify XSS mitigation, secure cookies, route guards, CSP headers).

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (tech-stack & icon library selection - ask user, no hardcoded default) |
| 1   | Project & file structure (feature-first) |
| 2   | Standardized code (TypeScript strict, naming conventions, style) |
| 3   | Consistent UX, design tokens & accessibility (30 UX areas, WCAG 2.2 AA, 8-state matrix) |
| 4   | Reusable components & contracts (primitives, zero-emoji rule, optical icon alignment) |
| 5   | Type safety (Zod validation, typed API client) |
| 6   | Documentation standards (JSDoc, module blocks) |
| 7   | Clean code rules (single responsibility, pure utils) |
| 8   | Purposeful UI & human UX copy (anti-jargon, zero leaks, no placeholders) |
| 9   | Pagination (URL-synced hook, DataTable pattern) |
| 10  | SWR & optimized data fetching (deduping, mutations) |
| 11  | No browser alerts or native dialogs (accessible ConfirmDialog) |
| 12  | Component testing (Vitest + RTL + MSW) |
| 13  | Frontend security (XSS, cookies, route guards, CSP) |

## Works well with

- `be-standards` — backend counterpart; shares Zod schemas and API contracts
- `security-standards` — security compliance; references for cross-cutting security controls
- `auth-patterns` — authentication and session handling; handles auth cookies and login UX
- `api-design` — REST and GraphQL contract design; consumes OpenAPI specs
- `db-standards` — database patterns; aligns cursor pagination contracts
