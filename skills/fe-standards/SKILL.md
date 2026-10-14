---
name: fe-standards
description: >-
  Frontend Engineering Standards for fullstack web applications.
  Activate when building, reviewing, or scaffolding frontend code (React, Next.js, Vite, Remix).
  Covers: UI/UX consistency, reusable components (Radix, shadcn/ui), Tailwind/CSS tokens,
  TypeScript strict mode, SWR/TanStack data fetching, Zod form validation, table pagination,
  custom accessible modals (no window.alert/confirm), Vitest/RTL testing, responsive design,
  and frontend security (OWASP ASVS XSS/CSP controls).
trigger: model_decision
---

# Frontend Engineering Standards

> **Scope**: Any web frontend  -  React, Next.js, Vite, Remix, or vanilla.
> **Audience**: Coding agents scaffolding or modifying frontend code.
> **How to use**: Read this skill fully before writing any frontend code. Follow
> every section. When decisions are left open (marked **ASK**), interview the
> user before proceeding.

---

## 0  -  Before You Write a Single Line: Interview the User

Run through the **ASK** checklist below in a single, friendly conversation turn.
Group the questions logically. Do **not** ask about things already decided in
the existing codebase.

| # | Topic | ASK |
|---|-------|-----|
| 1 | Framework | Next.js (App Router / Pages), Vite+React, Remix, or other? |
| 2 | Language | TypeScript (strict) or JavaScript? |
| 3 | Styling | Vanilla CSS + tokens, CSS Modules, Tailwind v4, or styled-components? |
| 4 | Component primitives | Radix UI, shadcn/ui, Headless UI, or build from scratch? |
| 5 | State / server-state | SWR (default), TanStack Query, or Apollo? |
| 6 | Form library | react-hook-form + zod, Formik + yup, or native? |
| 7 | Testing | Vitest + RTL, Jest + RTL, Playwright E2E, or combo? |
| 8 | Linting / formatting | ESLint + Prettier (default), Biome, or other? |
| 9 | Auth | NextAuth, Clerk, custom JWT, or none? |
| 10 | Design tokens | Existing brand palette or generate from scratch? |

Once answered, echo back a **stack summary** for the user to confirm before
generating any files.

---

## 1  -  Project & File Structure

Follow a **feature-first** layout. Every feature owns its own folder with
co-located components, hooks, types, tests, and styles.

```
src/
â”œâ”€â”€ app/                        # Next.js App Router pages OR Vite router
â”‚   â””â”€â”€ (feature)/
â”‚       â”œâ”€â”€ page.tsx
â”‚       â””â”€â”€ layout.tsx
â”œâ”€â”€ features/
â”‚   â””â”€â”€ <feature-name>/
â”‚       â”œâ”€â”€ components/         # UI components for this feature
â”‚       â”‚   â”œâ”€â”€ FeatureList.tsx
â”‚       â”‚   â””â”€â”€ FeatureList.test.tsx
â”‚       â”œâ”€â”€ hooks/              # SWR hooks / mutations
â”‚       â”‚   â””â”€â”€ useFeature.ts
â”‚       â”œâ”€â”€ types/              # Feature-specific TypeScript types
â”‚       â”‚   â””â”€â”€ feature.types.ts
â”‚       â”œâ”€â”€ utils/              # Pure helpers, formatters, validators
â”‚       â”‚   â””â”€â”€ feature.utils.ts
â”‚       â”œâ”€â”€ README.md           # Feature-level documentation
â”‚       â””â”€â”€ index.ts            # Barrel export
â”œâ”€â”€ components/
â”‚   â”œâ”€â”€ ui/                     # Generic reusable primitives (Button, Input...)
â”‚   â””â”€â”€ layout/                 # Shell, Sidebar, TopNav
â”œâ”€â”€ hooks/                      # Global / cross-feature hooks
â”œâ”€â”€ lib/                        # API client, SWR config, auth helpers
â”‚   â”œâ”€â”€ api.ts
â”‚   â””â”€â”€ swr.ts
â”œâ”€â”€ styles/
â”‚   â”œâ”€â”€ tokens.css              # CSS custom properties (design tokens)
â”‚   â”œâ”€â”€ global.css
â”‚   â””â”€â”€ reset.css
â””â”€â”€ types/                      # Shared / global TypeScript types
    â””â”€â”€ api.types.ts
```

**Rules:**
- Max 1 default export per file (the primary component/hook/util).
- Named exports for everything else.
- No barrel `index.ts` deeper than one level inside `features/`.
- Keep files under **300 lines**; split when exceeded.
- Test files co-located next to what they test, never in a separate top-level `__tests__/`.

---

## 2  -  Standardized Code

### TypeScript

- Enable `"strict": true` in `tsconfig.json`. No exceptions.
- No `any`  -  use `unknown` + type guards or proper generics.
- Prefer `interface` for object shapes, `type` for unions/intersections.
- All function parameters and return types must be explicitly typed.
- API response shapes must be typed; generate from OpenAPI/Zod when possible.

```ts
// [YES] Good
interface User {
  id: string;
  email: string;
  role: "admin" | "member" | "viewer";
}

async function fetchUser(id: string): Promise<User> { /* ... */ }

// [NO] Bad
async function fetchUser(id: any): Promise<any> { /* ... */ }
```

### Naming Conventions

| Thing | Convention | Example |
|-------|------------|---------|
| Component file | PascalCase | `UserCard.tsx` |
| Hook file | camelCase, `use` prefix | `useUserList.ts` |
| Type / Interface | PascalCase | `UserCardProps` |
| Constant | SCREAMING_SNAKE | `MAX_PAGE_SIZE` |
| CSS class | kebab-case | `.user-card` |
| CSS custom property | `--token-name` | `--color-primary` |
| Event handler | `handle` prefix | `handleSubmit` |
| Boolean variable | `is/has/can` prefix | `isLoading`, `hasError` |

### Code Style

- Prettier config: `{ singleQuote: true, semi: true, printWidth: 100 }`.
- ESLint: `eslint:recommended` + `@typescript-eslint/recommended` + `react-hooks/recommended`.
- No commented-out code in committed files.
- No `console.log` in production code; use a structured logger or remove.
- Early returns over nested `if` blocks.
- Prefer `const` over `let`; never use `var`.

---

## 3  -  Consistent UX, Design System & Accessibility (WCAG 2.2 AA)

### 3.1 The 30 Core UX, UI & Accessibility Standards

Every frontend interface built with this skill must adhere to the 30 foundational standards below:

| Area | Standard / Rule | Implementation & Enforcement |
|------|-----------------|------------------------------|
| **Accessibility** | WCAG 2.2 AA as the baseline | Non-negotiable baseline; run automated axe/RTL audits |
| **Semantic HTML** | Use native HTML elements before custom components | `<button>`, `<nav>`, `<main>`, `<dialog>`, `<header>` before custom `<div>` |
| **Keyboard access** | Every interactive element must be usable without a mouse | Fully operable via Tab, Enter, Space, and Arrow keys |
| **Focus** | Visible, consistent focus indicators; never remove focus styling without replacement | `:focus-visible` outline: `2px solid var(--color-primary)` with `2px offset` |
| **Color contrast** | Meet WCAG AA contrast requirements for text and meaningful UI elements | Minimum $4.5:1$ for normal text, $3:1$ for large text and meaningful icons/borders |
| **Responsive design** | Mobile, tablet, desktop, and intermediate widths must work without horizontal scrolling | Fluid layouts, CSS Grid/Flexbox, tested down to 320px width |
| **Touch targets** | Interactive controls should have sufficiently large touch targets and adequate spacing | Minimum $\ge 44 \times 44\text{px}$ touch area for buttons, inputs, links, checkboxes |
| **Typography** | Consistent type scale, readable line height, clear hierarchy, predictable font weights; human, natural, engaging UX copy across all typographic elements | Standard scale (12px to 32px), `line-height: 1.5` for body, 1.2 for headings. Conversational, warm, and zero jargon |
| **Spacing** | Use a consistent spacing/token system instead of arbitrary margins | 4-point scale (`--space-1` to `--space-16`); no arbitrary `margin: 17px` |
| **Layout** | Prefer predictable grids, flexbox, and responsive constraints over hard-coded positioning | Avoid hard-coded absolute positioning; use responsive constraints |
| **Components** | Reuse established components; don't create duplicate versions of the same control | Import primitives from `src/components/ui/`; zero ad-hoc duplicates |
| **Forms** | Explicit labels, useful validation, clear errors, correct input types, autocomplete where appropriate | Every input has visible `<label htmlFor="...">`, `autoComplete`, and Zod validation |
| **Errors** | Explain what went wrong and how the user can fix it | Human, empathetic copy with an actionable next step; zero raw HTTP error codes, zero internal database or architecture leaks, zero tacky/gimmicky phrasing |
| **Loading** | Provide appropriate loading, skeleton, progress, or pending states | Skeleton loaders for content; `aria-busy="true"` on submitting buttons |
| **Empty states** | Explain why there is no content and provide an appropriate next action | Empty state contract: icon + title + explanation + actionable CTA |
| **Success states** | Clearly communicate completed actions without unnecessary interruption | Ephemeral toast or non-blocking inline banner with undo when appropriate |
| **Destructive actions** | Make consequences clear and require appropriate confirmation | `<ConfirmDialog>` with explicit red/danger action and clear warning copy |
| **Navigation** | Consistent navigation hierarchy, active states, breadcrumbs where useful | Visible `aria-current="page"` indicators, semantic `<nav>`, clear backlinks |
| **Dialogs** | Proper focus management, keyboard dismissal, clear title/action hierarchy | Trap focus on open, dismiss on Esc or backdrop click, restore focus on close |
| **Notifications** | Don't rely on color alone; use accessible status messaging | Pair colors with icons, clear copy, and `aria-live="polite"` / `role="status"` |
| **Motion** | Keep animation purposeful and respect prefers-reduced-motion | $\le 250\text{ms}$ transitions; disable animations when `prefers-reduced-motion: reduce` |
| **Images** | Meaningful images require appropriate alternative text; decorative images should not pollute the accessibility tree | Informative `alt="..."`; decorative images must have `alt=""` or `aria-hidden="true"` |
| **Icons** | Icons should have accessible names when they convey meaning; don't use icons alone when the meaning is ambiguous | `aria-label` on icon buttons; pair icon with label text where ambiguity exists |
| **Internationalization** | Don't assume fixed text widths, date formats, currencies, or text direction | Flexible containers; use `Intl.DateTimeFormat` and `Intl.NumberFormat` |
| **Dark mode** | If supported, ensure contrast and semantic colors remain valid in every theme | Both light and dark palettes must satisfy WCAG AA contrast ratios |
| **Browser support** | Use progressive enhancement and test the application's supported browsers | Standard modern evergreen browser baseline; avoid experimental vendor CSS |
| **Performance** | Avoid unnecessary JavaScript, layout shifts, huge assets, and excessive rendering | Next/Image or optimized WebP, SWR deduping, explicit image dimensions to avoid CLS |
| **Security UI** | Never expose secrets, tokens, internal errors, or sensitive information in the interface | Mask credentials; sanitize error messages; never display stack traces |
| **State consistency** | Every important interaction should have defined default, hover, focus, active, disabled, loading, error, and success states | Full 8-state interaction coverage across all primary interactive controls |
| **Design system** | Use centralized design tokens for color, typography, spacing, radius, shadows, breakpoints, and component variants | All styles consume CSS custom properties declared in `src/styles/tokens.css` |

---

### 3.2 Design Tokens (tokens.css)

Always scaffold `tokens.css` before writing any component. Ask the user for a
brand palette if one exists; otherwise generate a harmonious one.

```css
/* tokens.css  -  replace with your brand values */
:root {
  /* Color */
  --color-primary:        hsl(222 89% 55%);
  --color-primary-hover:  hsl(222 89% 48%);
  --color-danger:         hsl(0 72% 51%);
  --color-success:        hsl(142 71% 45%);
  --color-warning:        hsl(38 92% 50%);
  --color-surface:        hsl(0 0% 100%);
  --color-surface-raised: hsl(0 0% 97%);
  --color-border:         hsl(220 13% 91%);
  --color-text:           hsl(224 71% 4%);
  --color-text-muted:     hsl(220 9% 46%);

  /* Typography */
  --font-sans:   'Inter', system-ui, sans-serif;
  --font-mono:   'JetBrains Mono', monospace;
  --text-xs:  0.75rem;
  --text-sm:  0.875rem;
  --text-base: 1rem;
  --text-lg:  1.125rem;
  --text-xl:  1.25rem;
  --text-2xl: 1.5rem;

  /* Spacing (4-point scale) */
  --space-1:  0.25rem;
  --space-2:  0.5rem;
  --space-3:  0.75rem;
  --space-4:  1rem;
  --space-6:  1.5rem;
  --space-8:  2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Border radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-full: 9999px;

  /* Shadow */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);

  /* Touch Target & Accessibility */
  --min-touch-target: 44px;
  --focus-ring: 2px solid var(--color-primary);
  --focus-offset: 2px;

  /* Transitions */
  --transition-fast:   150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow:   400ms ease;

  /* Z-index scale */
  --z-dropdown: 10;
  --z-sticky:   20;
  --z-overlay:  30;
  --z-modal:    40;
  --z-toast:    50;
}

/* Dark mode */
[data-theme="dark"] {
  --color-surface:        hsl(224 71% 4%);
  --color-surface-raised: hsl(222 47% 8%);
  --color-border:         hsl(216 34% 17%);
  --color-text:           hsl(213 31% 91%);
  --color-text-muted:     hsl(218 11% 65%);
}

/* Universal Visible Focus Indicator */
:focus-visible {
  outline: var(--focus-ring);
  outline-offset: var(--focus-offset);
}

/* Respect reduced-motion preference */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### 3.3 State Consistency Matrix

Every interactive component (buttons, inputs, select, cards) must support the full interaction lifecycle:

| State | Visual Treatment & Behavior |
|-------|-----------------------------|
| **Default** | Clean baseline; meets color contrast requirements |
| **Hover** | Subtle background or border shift; never move element geometry (prevents layout shift) |
| **Focus** | High-contrast `:focus-visible` ring; keyboard users clearly see current cursor |
| **Active** | Slight scale reduction (`transform: scale(0.98)`) or pressed depth |
| **Disabled** | `opacity: 0.5`, `cursor: not-allowed`, `pointer-events: none` (or prevent clicks with `aria-disabled="true"`) |
| **Loading** | Retains button size, displays accessible `<Spinner>`, announces `aria-busy="true"` |
| **Error** | Red border/text (`var(--color-danger)`), paired with error message text and icon |
| **Success** | Temporary green confirmation tint or icon, returns gracefully to default state |

---

## 4  -  Reusable Components

Every generic UI element lives in `src/components/ui/`. Build as
**headless-first** primitives: accessibility + behaviour first, styling second.

### Mandatory UI Primitives (build or integrate before feature work)

- [ ] `Button`  -  variants: `primary`, `secondary`, `danger`, `ghost`; `isLoading` prop
- [ ] `Input`  -  label, helper text, error state; accessible via `id`/`htmlFor`
- [ ] `Textarea`  -  same as Input
- [ ] `Select`  -  custom styled, keyboard-navigable
- [ ] `Checkbox` / `Radio` / `Switch`  -  accessible
- [ ] `Modal` / `Dialog`  -  focus-trap, scroll-lock, `aria-modal`
- [ ] `Toast`  -  programmatic API, auto-dismiss (no `alert()`)
- [ ] `Badge` / `Tag`
- [ ] `Avatar`
- [ ] `Spinner` / `Skeleton`
- [ ] `Table` + `Pagination` (see Section 8)
- [ ] `Breadcrumb`
- [ ] `Tabs`
- [ ] `Dropdown` / `Menu`
- [ ] `Tooltip`
- [ ] `EmptyState`
- [ ] `ErrorBoundary`

### Component Contract Pattern

```tsx
// src/components/ui/Button/Button.tsx
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import styles from './Button.module.css';

/** Visual style variants for the Button component. */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/** Size presets for the Button component. */
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual style variant. Defaults to 'primary'. */
  variant?: ButtonVariant;
  /** Size preset. Defaults to 'md'. */
  size?: ButtonSize;
  /** When true, disables the button and shows a loading indicator. */
  isLoading?: boolean;
  /** Icon rendered before the label. Must be an accessible SVG or icon component. */
  leadingIcon?: ReactNode;
  /** Icon rendered after the label. Must be an accessible SVG or icon component. */
  trailingIcon?: ReactNode;
  /** Button label. Must be descriptive  -  never "Click here". */
  children: ReactNode;
}

/**
 * Primary interactive element. All interactive actions must use Button,
 * not a bare <div> or <span> with an onClick handler.
 *
 * @example
 * <Button variant="danger" onClick={handleDelete} isLoading={isDeleting}>
 *   Delete project
 * </Button>
 */
export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={[styles.btn, styles[variant], styles[size], className].filter(Boolean).join(' ')}
      disabled={disabled || isLoading}
      aria-busy={isLoading}
      {...rest}
    >
      {isLoading ? <Spinner size="sm" aria-hidden /> : leadingIcon}
      <span>{children}</span>
      {!isLoading && trailingIcon}
    </button>
  );
}
```

**Rules for all components:**
- Every prop has a JSDoc comment.
- No hardcoded colours, spacing, or font sizes  -  use CSS tokens only.
- Forward `ref` when wrapping a native element.
- Export both the component **and** its props interface.
- All interactive elements have unique, descriptive `id` attributes at point of use.

---

## 5  -  Type Safety

### Zod for Runtime Validation

Validate **all** external data (API responses, form input, URL params) with Zod.

```ts
// src/features/users/types/user.types.ts
import { z } from 'zod';

export const UserSchema = z.object({
  id:        z.string().uuid(),
  email:     z.string().email(),
  name:      z.string().min(1).max(100),
  role:      z.enum(['admin', 'member', 'viewer']),
  createdAt: z.string().datetime(),
});

export type User = z.infer<typeof UserSchema>;

export const UserListSchema = z.object({
  data: z.array(UserSchema),
  pagination: z.object({
    page:       z.number().int().positive(),
    pageSize:   z.number().int().positive(),
    total:      z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});

export type UserList = z.infer<typeof UserListSchema>;
```

### API Client Pattern

```ts
// src/lib/api.ts

/** Base fetch wrapper  -  typed responses, centralised error handling. */
export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api${endpoint}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, body.message ?? res.statusText, body);
  }

  return res.json() as Promise<T>;
}

/** Typed API error with HTTP status and response body. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}
```

---

## 6  -  Documentation Standards

### File-level module docblock

```ts
/**
 * @module useUsers
 * SWR-backed hooks for fetching and mutating user data.
 * All hooks handle loading, error, and optimistic update states.
 */
```

### Rules

- JSDoc `@param`, `@returns`, `@example` on every exported function/hook.
- Every prop interface has inline JSDoc on every prop.
- Complex logic: inline comments explain **why**, not **what**.
- No obvious comments (`// increment i`).
- Every `features/<name>/` folder must have a `README.md` documenting:
  - Purpose (1-2 sentences)
  - Components list
  - Hooks list
  - Data flow diagram (text or Mermaid)

---

## 7  -  Clean Code Standards

| Rule | Detail |
|------|--------|
| **Single Responsibility** | One component = one concern. Split when a component does 2+ unrelated things. |
| **DRY** | Extract repeated logic into hooks or utils after the 2nd occurrence. |
| **YAGNI** | Don't build for hypothetical future requirements. |
| **Small functions** | Functions > 30 lines are a signal to split. |
| **No magic numbers** | Every literal has a named constant or CSS token. |
| **Fail fast** | Validate at the boundary; return early on bad data. |
| **Pure utils** | Utility functions must be pure (no side effects). |
| **Immutability** | Never mutate props or state directly. |
| **Avoid prop drilling** | Use Context or a state library beyond 2 levels deep. |
| **Error boundaries** | Wrap every major page section in an `ErrorBoundary`. |

---

## 8  -  Purposeful UI & Human UX Copy (No Placeholders, No Jargon, No Implementation Leaks)

All interface typography and copy—headings, labels, instructions, empty states, toasts, validation alerts, and error messages—must be **human, natural, engaging, and respectful**. Copy must never leak internal business logic, database structures, or system architecture, and must strictly avoid technical jargon and tacky, patronizing phrasing.

### 8.1 Voice, Tone & Typography Principles

| Principle | Guideline | Rule |
|-----------|-----------|------|
| **Human & Conversational** | Speak like a helpful, competent human colleague | Use natural, clear, concise language. Prefer plain language over abstract system states. |
| **Respectful & Empathetic** | Treat the user's time and intelligence with respect | Acknowledge issues directly without deflection, panic, or false cheerfulness. |
| **Action-Oriented** | Always explain what happened and what to do next | Every notice, empty state, and error must present a clear, frictionless next action. |
| **Zero Implementation Leaks** | Never expose internal data models or architecture | Ban database table names, SQL errors, internal enum keys, stack traces, and API route paths. |
| **No Technical Jargon** | Translate system mechanics into user-centric context | Ban developer terms (e.g., "serialization failed", "null pointer", "payload syntax error", "404 route"). |
| **No Tacky or Gimmicky Copy** | Keep the tone professional, warm, and mature | Prohibit cringe phrases, faux-playful slang, and patronizing humor (e.g., "Whoopsie-daisy!", "Our hamsters took a nap", "Boom! You did it!"). |

---

### 8.2 Copy Comparison Guide (Good vs Bad)

| Context | [NO] Leaky, Jargon-Heavy, or Tacky Copy | [YES] Human, Natural & Actionable Copy | Why |
|---------|-----------------------------------------|----------------------------------------|-----|
| **Data Fetch Error** | `Error 500: Failed to query pg_table 'user_accounts'. Connection reset.` | `We couldn't load your account details right now. Please refresh the page or try again in a few moments.` | Hides database engine & table name; offers user next step. |
| **Item Not Found** | `404: Resource /api/v1/projects/proj_9821 not found in registry.` | `We couldn't find that project. It may have been deleted or the link might be out of date. [Return to Projects]` | Avoids HTTP status codes & internal URIs; gives path back. |
| **Validation Error** | `field 'tax_ident_no' must satisfy regex ^\d{9}$ constraint` | `Please enter a valid 9-digit tax ID number without spaces or dashes.` | Replaces backend column name and regex jargon with clear user instructions. |
| **Auth / Session Expiry** | `JWT Token expired: verifyToken() signature mismatch.` | `Your session has timed out for security. Please sign in again to continue.` | Hides cryptographic internals; explains security reason clearly. |
| **Empty State** | `Array<Workspace> length is 0. No records present.` or `Whoops! Nothing here yet, superstar! 🚀` | `You don't have any active projects yet. Create your first project to invite team members and start tracking tasks.` | Eliminates data structure jargon and tacky cheerleading. |
| **Conflict / Duplicate** | `psql unique_violation on constraint 'idx_users_email_uq'` | `An account with this email address already exists. [Sign in instead] or [Reset password].` | Protects schema constraints; provides immediate login / recovery path. |
| **Destructive Action** | `Delete record from DB? Cascade delete active.` | `Delete this project? This will permanently remove all tasks, comments, and attachments for all team members. This action cannot be undone.` | Clarifies real-world consequences instead of database mechanics. |
| **Server Overload** | `Oopsie! Our servers went on strike! 🛠️ Try again later!` | `Our service is currently experiencing heavy traffic. We're on it—please check back in a few minutes.` | Eliminates immature, dismissive slang while retaining calm competence. |

---

### 8.3 Anti-Jargon & Anti-Leak Rules for AI & Engineers

1. **Zero Database or Architecture Terms**:
   - Prohibited in UI: `table`, `column`, `primary key`, `foreign key`, `schema`, `payload`, `mutation`, `endpoint`, `controller`, `null pointer`, `middleware`, `PostgreSQL`, `Redis`, `Kafka`, `Prisma`, `Drizzle`.
   - Frame every message around the user's domain model (e.g., "account", "team", "project", "invoice", "setting").
2. **Zero Internal Error Enum Leakage**:
   - Prohibited in UI: `ERR_INTERNAL_SVC_UNAVAILABLE`, `INVALID_UUID_FORMAT`, `UNAUTHORIZED_ROLE_ACCESS`.
   - Map raw backend codes to friendly human strings via a centralized dictionary or component mapping before rendering.
3. **No Artificial Enthusiastic Punctuation or Slang**:
   - Avoid multiple exclamation marks (`!!!`), slang acronyms, or patronizing colloquialisms.
4. **Natural Sentence Case**:
   - Use sentence case for headings, buttons, and form labels (e.g., "Create project", "Account settings", "Save changes") unless following a brand-specific title-casing rule. Avoid ALL CAPS for body or helper text.

---

### 8.4 Purposeful UI (No Placeholders)

- **Every input has a visible `<label>`**  -  never placeholder-only inputs.
- **Every button has descriptive text**  -  no icon-only buttons without accessible `aria-label`.
- **Every form field has a purpose**  -  if the API doesn't use it, remove it.
- **No lorem ipsum or mock names**  -  use realistic, domain-relevant copy (e.g., "Jane Cooper", "Acme Logistics").
- **No `// TODO: implement`** in shipped components.
- **Empty states are designed**  -  clear icon + human title + informative description + actionable CTA button.

#### Form Field Contract

```tsx
<FormField
  id="user-email"
  label="Email address"
  helperText="We'll send your invoice receipts and login confirmations here."
  error={errors.email?.message}
>
  <Input
    id="user-email"
    type="email"
    autoComplete="email"
    placeholder="alex@company.com"   {/* realistic hint only, never replaces label */}
  />
</FormField>
```

---

## 9  -  Dynamic Lists: Pagination & Filtering

### 9.0 Cardinal Rule: Dynamic List & Table Contract

**Every table, infinite list, or dynamic collection view MUST support server-side pagination and filters (search terms, status flags, date ranges). Rendering unbounded datasets is strictly forbidden.**

The pagination strategy must be selected based on user requirements:

| Strategy | When to Choose (User Ask) | Hook Pattern | URL Parameters |
|----------|---------------------------|--------------|----------------|
| **Offset-based** | Traditional tabular data with page numbers, items per page, and total count. | `usePagination()` | `?page=1&pageSize=20&search=...` |
| **Cursor-based** | Infinite scroll, stream feeds, or high-throughput datasets without random page jumps. | `useCursorPagination()` / `useSWRInfinite` | `?cursor=...&limit=20&search=...` |

### 9.1 Offset-Based Pagination Hook (URL-Synced)

```ts
// src/hooks/usePagination.ts
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export interface PaginationState {
  page:     number;
  pageSize: number;
}

/**
 * Syncs offset pagination state to URL search params.
 * Preserves all search and filter params when updating.
 * Resets to page 1 when pageSize changes.
 */
export function usePagination(defaults: PaginationState = { page: 1, pageSize: 20 }) {
  const searchParams = useSearchParams();
  const router      = useRouter();
  const pathname    = usePathname();

  const page     = Number(searchParams.get('page')     ?? defaults.page);
  const pageSize = Number(searchParams.get('pageSize') ?? defaults.pageSize);

  function navigate(next: Partial<PaginationState>) {
    const params = new URLSearchParams(searchParams.toString());
    if (next.page     !== undefined) params.set('page',     String(next.page));
    if (next.pageSize !== undefined) {
      params.set('pageSize', String(next.pageSize));
      params.set('page', '1');
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return {
    page,
    pageSize,
    setPage:     (p: number) => navigate({ page: p }),
    setPageSize: (s: number) => navigate({ pageSize: s }),
  };
}
```

### 9.2 Cursor-Based Pagination Hook (Stream / Infinite Scroll)

```ts
// src/hooks/useCursorPagination.ts
import useSWRInfinite from 'swr/infinite';
import { apiFetch } from '@/lib/api';

export interface CursorPaginatedResponse<T> {
  data:       T[];
  pagination: { nextCursor: string | null; hasMore: boolean };
}

export function useCursorList<T>(endpoint: string, filters: Record<string, string> = {}) {
  const queryParams = new URLSearchParams(filters);

  const getKey = (pageIndex: number, previousPageData: CursorPaginatedResponse<T> | null) => {
    if (previousPageData && !previousPageData.pagination.hasMore) return null; // Reached the end
    if (pageIndex === 0) return `${endpoint}?${queryParams.toString()}&limit=20`;
    return `${endpoint}?${queryParams.toString()}&cursor=${previousPageData?.pagination.nextCursor}&limit=20`;
  };

  const { data, size, setSize, isValidating, error } = useSWRInfinite<CursorPaginatedResponse<T>>(
    getKey,
    apiFetch
  );

  const items = data ? data.flatMap(d => d.data) : [];
  const isLoading = !data && !error;
  const hasMore = Boolean(data?.[data.length - 1]?.pagination.hasMore);

  return { items, isLoading, isValidating, loadMore: () => setSize(size + 1), hasMore, error };
}
```

### DataTable Usage Pattern

```tsx
<DataTable
  columns={columns}
  data={users}
  isLoading={isLoading}
  pagination={{
    page,
    pageSize,
    total,
    onPageChange:     setPage,
    onPageSizeChange: setPageSize,
  }}
  emptyState={
    <EmptyState
      icon={UsersIcon}
      title="No users yet"
      description="Invite team members to get started."
      action={<Button onClick={openInviteModal}>Invite member</Button>}
    />
  }
/>
```

---

## 10  -  SWR & Optimized Data Fetching

Use **SWR** as the default server-state library. Configure globally once.

### Global Config

```ts
// src/lib/swr.ts
import type { SWRConfiguration } from 'swr';
import { apiFetch } from './api';

export const swrConfig: SWRConfiguration = {
  fetcher:              (url: string) => apiFetch(url),
  revalidateOnFocus:    false,
  revalidateOnReconnect: true,
  shouldRetryOnError:   true,
  errorRetryCount:      3,
  dedupingInterval:     5_000,
};
```

### Feature Fetch Hook Pattern

```ts
// src/features/users/hooks/useUsers.ts
/**
 * @module useUsers
 * SWR hook for paginated, filterable user list.
 */
import useSWR from 'swr';
import { UserListSchema } from '../types/user.types';
import type { PaginationState } from '@/hooks/usePagination';

interface UseUsersParams extends PaginationState {
  /** Optional search query, matched against name and email. */
  search?: string;
  /** Filter by user role. */
  role?: string;
}

/**
 * Fetches a paginated, filterable list of users.
 * Validates the API response shape at runtime via Zod.
 *
 * @param params - Pagination and filter options.
 * @returns SWR response with typed data and pagination metadata.
 *
 * @example
 * const { data, isLoading, error } = useUsers({ page: 1, pageSize: 20 });
 */
export function useUsers(params: UseUsersParams) {
  const query = new URLSearchParams(
    Object.entries(params)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, String(v)])
  ).toString();

  return useSWR(`/users?${query}`, {
    use: [
      (next) => (key, fetcher, config) =>
        next(key, async (...args) => UserListSchema.parse(await fetcher!(...args)), config),
    ],
  });
}
```

### Mutation Pattern

```ts
// src/features/users/hooks/useMutateUser.ts
import useSWRMutation from 'swr/mutation';
import { apiFetch } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

/**
 * Delete mutation for a single user.
 * Shows a success toast on completion and an error toast on failure.
 * Automatically revalidates the users list cache.
 */
export function useDeleteUser() {
  const { toast } = useToast();

  const { trigger, isMutating } = useSWRMutation(
    '/users',
    async (_key, { arg: id }: { arg: string }) =>
      apiFetch(`/users/${id}`, { method: 'DELETE' }),
    {
      onSuccess: () => toast({ type: 'success', message: 'User deleted successfully.' }),
      onError:   (err) =>
        toast({ type: 'error', message: err.message ?? 'Failed to delete user. Please try again.' }),
      revalidate: true,
    }
  );

  return { deleteUser: trigger, isDeleting: isMutating };
}
```

**Rules:**
- Always pair mutations with `onSuccess` + `onError` toast feedback.
- Use `optimisticData` for mutations that don't navigate away.
- Never call `mutate()` directly in event handlers  -  use `useSWRMutation`.
- SWR cache keys must be deterministic strings or arrays.

---

## 11  -  No Browser Alerts or Native Dialogs

`alert()`, `confirm()`, and `prompt()` are **banned**.

| Native | Replacement |
|--------|-------------|
| `alert(message)` | `toast({ type: 'info', message })` |
| `confirm('Delete?')` | `<ConfirmDialog>` with Cancel + Confirm buttons |
| `prompt('Enter name')` | `<Modal>` with a controlled `<Input>` and form |

### ConfirmDialog Pattern

```tsx
function DeleteUserButton({ userId }: { userId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { deleteUser, isDeleting } = useDeleteUser();

  async function handleConfirm() {
    await deleteUser(userId);
    setIsOpen(false);
  }

  return (
    <>
      <Button
        id={`delete-user-${userId}`}
        variant="danger"
        onClick={() => setIsOpen(true)}
      >
        Delete user
      </Button>

      <ConfirmDialog
        id={`delete-user-${userId}-confirm`}
        isOpen={isOpen}
        title="Delete user?"
        description="This action cannot be undone. The user will lose access immediately."
        confirmLabel="Delete"
        confirmVariant="danger"
        isConfirming={isDeleting}
        onConfirm={handleConfirm}
        onCancel={() => setIsOpen(false)}
      />
    </>
  );
}
```

---

## 12  -  Component Testing

Every component and hook must have co-located tests.

### Default Stack (confirm with user in Section 0)

**Vitest + React Testing Library + MSW**

### File Naming

- Component: `ComponentName.test.tsx`
- Hook: `useHookName.test.ts`
- Util: `utilName.test.ts`

### Test Structure

```tsx
// src/features/users/components/UserList.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '@/test/server';
import { UserList } from './UserList';
import { createWrapper } from '@/test/utils';

describe('UserList', () => {
  describe('when data loads successfully', () => {
    it('renders a row for each user', async () => {
      render(<UserList />, { wrapper: createWrapper() });
      expect(await screen.findByRole('row', { name: /alice/i })).toBeInTheDocument();
    });

    it('navigates to the next page when Next is clicked', async () => {
      const user = userEvent.setup();
      render(<UserList />, { wrapper: createWrapper() });
      await screen.findByRole('table');
      await user.click(screen.getByRole('button', { name: /next page/i }));
      expect(await screen.findByText(/page 2/i)).toBeInTheDocument();
    });
  });

  describe('when the API returns an error', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/users', () =>
          HttpResponse.json({ message: 'Server error' }, { status: 500 })
        )
      );
    });

    it('shows an error message and a retry button', async () => {
      render(<UserList />, { wrapper: createWrapper() });
      expect(await screen.findByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  describe('when the list is empty', () => {
    beforeEach(() => {
      server.use(
        http.get('/api/users', () =>
          HttpResponse.json({
            data: [],
            pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
          })
        )
      );
    });

    it('shows the empty state with an invite CTA', async () => {
      render(<UserList />, { wrapper: createWrapper() });
      expect(await screen.findByRole('button', { name: /invite member/i })).toBeInTheDocument();
    });
  });
});
```

### What to Test

| Must test | Skip |
|-----------|------|
| User interactions (click, type, submit) | Implementation internals |
| All UI states (loading, error, empty, data) | CSS styles |
| Form validation messages | Snapshot tests of static markup |
| Accessibility roles and labels | Third-party library internals |
| Pagination navigation | |
| Mutation success and error feedback | |

---

## 13  -  Frontend Security

> **Full security standards are in the `security-standards` skill.**
> This section covers **frontend-specific** controls grounded in OWASP ASVS 5.0.
> Read `security-standards` in full for cross-cutting domains (auth, secrets,
> cryptography, CI/CD, logging, data protection, and supply chain).

### XSS Prevention (ASVS V5)

```tsx
// [NO] Never  -  XSS via dangerouslySetInnerHTML
<div dangerouslySetInnerHTML={{ __html: userContent }} />

// [YES] Only when unavoidable  -  sanitize first with DOMPurify
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(richContent) }} />

// [YES] Always prefer React's built-in escaping
<p>{userContent}</p>
```

Rules:
- Never build HTML strings by concatenating user input.
- Never use `eval()`, `new Function()`, or `setTimeout(string)`.
- Avoid `innerHTML` on DOM nodes; use `textContent` for plain text.

### Auth Token Storage (ASVS V3)

```ts
// [NO] Never  -  tokens in localStorage are accessible to any JS on the page (XSS)
localStorage.setItem('token', jwt);
sessionStorage.setItem('token', jwt);

// [YES] Use httpOnly, Secure, SameSite=Strict cookies (set by the server)
// The frontend never touches the token directly.
// For SPAs, verify auth state via a /me or /session endpoint.
```

### Route Guards (ASVS V4)

Every authenticated route must be wrapped in a guard. Never rely on
hiding navigation links as the sole access control  -  that is UX only.

```tsx
// src/components/layout/AuthGuard.tsx
export function AuthGuard({ children }: { children: ReactNode }) {
  const { user, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace(`/login?returnTo=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [user, isLoading, router]);

  if (isLoading) return <PageSkeleton />;
  if (!user) return null;
  return <>{children}</>;
}
```

### Redirect URL Validation (ASVS V5)

```ts
// [NO] Never follow arbitrary returnTo params  -  open redirect
router.push(searchParams.get('returnTo') ?? '/');

// [YES] Validate returnTo is a same-origin relative path only
function isSafeRedirect(url: string): boolean {
  // Allow only relative paths starting with /
  return url.startsWith('/') && !url.startsWith('//') && !url.includes(':');
}

const returnTo = searchParams.get('returnTo');
router.push(returnTo && isSafeRedirect(returnTo) ? returnTo : '/dashboard');
```

### External Links (ASVS V5)

```tsx
// [YES] All external links must include rel="noopener noreferrer"
<a href={externalUrl} target="_blank" rel="noopener noreferrer">
  Open documentation
</a>

// [YES] Validate external URLs before rendering
function isHttpsUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}
```

### Content Security Policy (ASVS V14)

Request that the server sets a `Content-Security-Policy` header. Document
any required policy changes when introducing new external resources (fonts,
analytics, CDN assets). Inline scripts and `unsafe-eval` require explicit
threat model justification.

### Cookie Flags (ASVS V3)

Verify the following flags on all session/auth cookies (set server-side):

| Flag | Value | Purpose |
|------|-------|---------|
| `HttpOnly` | true | Prevents JS access |
| `Secure` | true | HTTPS only |
| `SameSite` | `Strict` or `Lax` | CSRF prevention |
| `Path` | `/` | Minimal scope |
| `Max-Age` | Session or defined TTL | No indefinite cookies |

### Form Security (ASVS V5)

```tsx
// Password fields must never be stored, logged, or prefilled with a value prop
<Input
  id="current-password"
  type="password"
  autoComplete="current-password"    // enables credential manager
  // [NO] Never: value={storedPassword}
/>

// Sensitive forms must not be cacheable
// Add to the page/route: <meta name="robots" content="noindex" /> if applicable
```

### Secrets (ASVS V6)

- No API keys, secrets, or credentials in frontend source code or committed env files.
- `NEXT_PUBLIC_` / `VITE_` prefixed variables are **public**  -  never put secrets there.
- Secret scanning (Gitleaks) must run in CI before any merge.

### Dependency Security (ASVS V14)

```bash
# Must pass with zero high/critical findings before any merge
npm audit --audit-level=high
```

### Error Display (ASVS V7)

```tsx
// [NO] Never expose internal errors, stack traces, or server details
<p>{error.stack}</p>
<p>{error.message}</p>  // may contain internal details

// [YES] Show a safe, user-friendly message
<p>Something went wrong. Please try again or contact support.</p>
// Log the full error internally via your structured logger
```

### Frontend Security Checklist

Before shipping any frontend feature:

- [ ] No `dangerouslySetInnerHTML` without DOMPurify sanitization
- [ ] No `eval()`, `new Function()`, or string-based `setTimeout`
- [ ] Auth tokens stored in `httpOnly` cookies only (not localStorage)
- [ ] All authenticated routes wrapped in `<AuthGuard>`
- [ ] `returnTo` redirect params validated as same-origin relative paths
- [ ] All external links have `rel="noopener noreferrer"`
- [ ] No secrets or API keys in frontend env variables or source code
- [ ] Secret scanner (Gitleaks) passes in CI
- [ ] `npm audit` passes  -  no high/critical findings
- [ ] CSP header reviewed for any new external resource domains
- [ ] Error messages show safe user-facing copy only (no stack traces)

> **Also run the `security-standards` Master Security Checklist** before any release.

---

## Agent Execution Checklist

Before marking any frontend task complete, verify every item:

- [ ] All Section 0 **ASK** items answered and stack summary confirmed by user
- [ ] TypeScript strict mode enabled; zero `any` usage
- [ ] Semantic HTML used: native buttons, forms, inputs, dialogs before custom constructs
- [ ] All components follow the contract pattern in Section 4
- [ ] Centralized design tokens (`tokens.css`) used for all colors, spacing, typography, and radius
- [ ] WCAG 2.2 AA accessibility satisfied: keyboard operable, visible `:focus-visible` rings, contrast $\ge 4.5:1$
- [ ] Touch targets meet minimum $\ge 44 \times 44\text{px}$ with adequate spacing
- [ ] All interactive components define state consistency (default, hover, focus, active, disabled, loading, error, success)
- [ ] UX copy is human, natural, engaging, and empathetic; zero technical jargon, zero tacky/gimmicky phrasing, and zero internal implementation or business-logic leaks (Section 8)
- [ ] No placeholder copy, lorem ipsum, or `// TODO` components
- [ ] All tables and dynamic lists support server-side pagination and filters (offset-based or cursor-based per user ask) (Section 9)
- [ ] SWR hooks follow the fetch and mutation patterns in Section 10
- [ ] Zero `alert()` / `confirm()` / `prompt()` calls
- [ ] Every mutation has `onSuccess` + `onError` toast feedback
- [ ] Tests cover all UI states: loading, error, empty, and data (Section 12)
- [ ] Frontend security checklist (Section 13) complete
- [ ] `security-standards` Master Security Checklist reviewed
- [ ] `npm audit` passes  -  no high or critical findings
- [ ] ESLint + Prettier pass with zero warnings
