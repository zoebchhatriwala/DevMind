# AI Coding Agent: Engineering, Simplicity & Verification Standards

> **Universal Engineering Baseline**: These standards apply universally across all domains, features, and skills (`fe-standards`, `be-standards`, `security-standards`, `db-standards`, `auth-patterns`, `deployment`, `api-design`, `ai-standards`).  
> **Audience**: All coding agents and engineers planning, writing, modifying, reviewing, or verifying code.  
> **Final Principle**: Deliver the simplest secure, correct, and maintainable solution that satisfies the requirement. The best code is code you didn't have to write. Inspect before creating, verify before trusting, and eliminate filler prose.

---

## 🎯 Mandatory Skill Routing Matrix

When a user request touches any of the following file globs or task types, you **MUST** load and apply the corresponding DevMind skill(s) before authoring or modifying code:

| Domain & Skill | Triggering Task Types & Keywords | File Globs |
| :--- | :--- | :--- |
| **`ai-standards`** | LLM integration, prompt templates, agent workflows, RAG pipelines, embeddings, tool calls, model routing | `**/{ai,rag,prompts,llm,embeddings,agents}/**` |
| **`api-design`** | REST/GraphQL/RPC routes, OpenAPI spec, controllers, DTOs, endpoint pagination, error payloads, webhooks | `**/{api,routes,controllers,contracts}/**`, `**/*.openapi.*`, `**/*.swagger.*` |
| **`auth-patterns`** | Login, signup, JWT, OAuth, sessions, RBAC/ABAC permissions, guards, password hashing, CSRF, refresh tokens | `**/{auth,middleware,session,security}/**` |
| **`be-standards`** | Backend services, business logic, background jobs, queues, caching, logging, dependency injection, server errors | `**/*.{ts,js,mjs,cjs,go,py,rs}` |
| **`db-standards`** | Database schemas, migrations, ORM models (Prisma/Drizzle/TypeORM/SQL), indexes, transactions, queries | `**/{schema,migrations,models,entities}/**`, `**/*.sql`, `**/prisma/**`, `**/drizzle/**` |
| **`deployment`** | Dockerfiles, docker-compose, CI/CD workflows (.github/workflows), Kubernetes, Terraform, health probes | `**/{.github,deploy,infra}/**`, `**/Dockerfile*`, `**/docker-compose*`, `**/*.tf` |
| **`fe-standards`** | UI components, pages, client state, forms, data fetching hooks, CSS/Tailwind, accessibility, frontend performance | `**/*.{tsx,jsx,css,scss,html,vue,svelte}` |
| **`security-standards`** | User input validation, file uploads, secrets/env vars, rate limiting, CORS, CSP headers, encryption, PII/payments | `**/*` |
| **`strata`** | Visual code map, "generate code map", "visualize code", "show what I built", user journeys, trust boundaries, blast radius | `**/*` |

<EXECUTION_RULE>
### CRITICAL PROTOCOL FOR ALL CODING AGENTS:
1. **ASSESS TASK SCOPE & TIER**:
   - **Tier 1: Targeted Edits & Bug Fixes (Micro-Patches)**: For localized bug fixes, CSS/UI tweaks, or single-function changes in existing files, **DO NOT** dump entire 50KB domain skill files into context. The universal engineering baseline in this document (Simplicity Ladder, Zod runtime boundaries, zero `any`, Pino logging, WCAG 2.2 AA) is already active. Fix root causes directly with the shortest working diff.
   - **Tier 2: Macro-Features & Scaffolding (Architectural Work)**: For new endpoints, database migrations, auth flows, major UI subsystems, or new services:
     a. Identify primary domains via the Mandatory Skill Routing Matrix.
     b. Read the relevant `skills/<domain>/SKILL.md` Pre-Flight Gates and Golden Patterns.
     c. Use targeted slice-reading for deep topic references instead of loading full multi-thousand-line files blindly.
2. **PRINT RECEIPT**: Output a compact badge at the top of your initial plan or implementation response:
   `🧠 [DevMind: <skill-name/tier> | Checked: <top 3 rules verified>]`
3. **NO COMPROMISE ON QUALITY**: Tiered loading prevents token exhaustion and context amnesia, but never waives strict typing, runtime validation, accessibility, or security invariants.
</EXECUTION_RULE>

---

## 0. Operating Modes: Greenfield vs. Incremental Modification

Determine your operating mode before acting:

### Mode A: Greenfield / New Architecture (Scaffolding)
- **Scope**: Creating a new repository, service, major subsystem, or greenfield feature where architectural decisions are uncommitted.
- **Protocol**: Conduct the relevant domain skill's Section 0 interview in a single, friendly turn. Present recommended defaults. Await user confirmation before authoring files.

### Mode B: Incremental Modification / Patch (Bugfix, Refactor, or Feature Extension)
- **Scope**: Modifying, extending, or fixing existing code in an established project.
- **Protocol**: **DO NOT** run the Section 0 interview. Automatically inspect the repository to identify existing stack decisions, frameworks, and conventions.
- **Framework Idiom Alignment**:
  - **Traditional Multi-Tier Backend (Express, Fastify, NestJS)**: Enforce strict separation of Controller (HTTP) -> Service (Domain) -> Repository (Data).
  - **Modern Fullstack & Serverless (Next.js Server Actions, Remix/React Router, Hono RPC, tRPC)**: Colocated typed actions/handlers with direct Zod validation + ORM queries are the idiomatic first choice. Do not artificially introduce multi-file classes or wrapper interfaces for simple CRUD (Rule of Three).
- **Non-Negotiable Invariant**: Skipping the interview does **NOT** waive quality standards. Simplicity (YAGNI), strict typing, security, error handling, and verification strictly apply to every modified or added line of code.

---

## 1. Mandatory Pre-Coding Review: The Simplicity Ladder

Before writing or editing code, climb this ladder and stop at the first rung that holds:

```
[1. Does this need to exist at all? (YAGNI)]
  └── [2. Already in this codebase? (Reuse existing utils/types)]
        └── [3. Standard library or runtime does it?]
              └── [4. Native platform or framework feature covers it?]
                    └── [5. Existing installed dependency solves it?]
                          └── [6. Concise one-liner or simple pure function?]
                                └── [7. Only then: write minimum typed production code]
```

### The 7 Rungs

1. **Does this need to exist at all? (YAGNI)**: Speculative features, imaginary flexibility, and premature config options are bloat. Skip them. Say so in one line.
2. **Already in this codebase?**: Search before you write. Reusing existing helpers, components, hooks, schemas, and types prevents duplicate slop.
3. **Standard library / runtime first**: Reach for built-in JavaScript/TypeScript/Python/Go standard capabilities (`URL`, `fetch`, `Intl`, `crypto.randomUUID()`, `structuredClone`, `Array.prototype.*`) before writing custom helpers or adding packages.
4. **Native platform covers it**: Let the platform do the heavy lifting—HTML semantics (`<input type="date">`, `<dialog>`), CSS over JS animations, database `CHECK`/`UNIQUE` constraints over application validators.
5. **Installed dependency covers it**: Use what's already in `package.json`/`pyproject.toml`. Never add a new dependency for what an existing one or five lines of code can do.
6. **Can it be a concise function?**: Favor clear, readable expressions over elaborate class hierarchies, managers, or design-pattern gymnastics.
7. **Only then: write new code**: Author the smallest clean, typed solution satisfying security, accessibility, and correctness standards.

### Root-Cause Bug Fixing
- **Fix the root cause, not the ticket symptom**: When fixing a bug, grep all callers of the function you're touching before editing.
- **One fix at the shared source**: A single guard or correction in the shared function creates a smaller diff than patching every caller, and avoids leaving sibling call sites broken.

### Pragmatic Shortcut Markers
When making an intentional simplification with a known operational ceiling (e.g. an in-memory store instead of Redis, synchronous execution instead of a worker queue, basic regex instead of a full parser):
- Mark it with a tracked comment:
  `// devmind: <ceiling>, <upgrade-path>`
  *Example:* `// devmind: in-memory cache per instance, migrate to Redis if horizontally scaled`
- This ensures intentional shortcuts are explicit, tracked, and easily audited rather than rotting into accidental technical debt.

### Dependency Evaluation
Before introducing any new dependency:
- Verify it is genuinely needed (cannot be solved by stdlib or existing deps).
- Check maintenance status, known security advisories, license compatibility, and bundle size.
- Pin versions safely and keep reproducible lockfiles intact.

### Security Invariants (Never Simplified Away)
Never simplify away:
- Strict input validation at trust boundaries (Zod schemas).
- Authentication, authorization guards, and session integrity.
- Secrets protection (Pino redaction, zero hardcoded keys, zero secret leaks).
- Output encoding preventing XSS and injection vulnerabilities.
- Safe error handling that prevents process crashes or data loss.

---

## 2. Implementation Standards & Anti-Bloat Invariants

Once the pre-coding review is complete:

1. **No unrequested abstractions**: Do not introduce an interface with one implementation, a factory for one product, or a wrapper that only delegates. Follow the Rule of Three.
2. **No speculative configuration**: Hardcode values that don't change. Do not introduce config files, flags, or env vars for hypothetical flexibility.
3. **Deletion over addition**: Deleting dead code, unused flags, and redundant wrappers is higher value than adding code.
4. **Shortest working diff**: Keep changes tightly focused on the requirement. Understand the problem thoroughly first—the smallest edit in the wrong place is just a second bug.
5. **Anchor to affirmative templates**: Consult the concrete code patterns in the active skill (e.g., RFC 7807 problem details, Pino structured logging, WCAG states) rather than statistical default implementations.
6. **Mitigate context drift**: Re-verify active changes against the skill's execution checklist before concluding.
7. **Intent-Driven UI, Responsive Layout & Value-Driven Copy**: When authoring frontend interfaces, ground design and messaging in the user's specific domain:
   - **Architecture & Wayfinding**: Mandate clear SaaS wayfinding (App Shell navigation, hierarchical breadcrumbs, structured page headers, realistic domain seed data). Strictly ban generic AI design slop (arbitrary dark purple/cyan gradients, glowing blobs, unreadable glassmorphism, fake vanity metrics).
   - **Mobile-First Responsive Design**: Enforce responsive layouts from 320px to 4K with zero horizontal page scroll using fluid grids and collapsible AppShell navigation.
   - **Human-Centric & Value-Driven Copy**: Interface typography and messaging must be engaging, natural, and easy to understand. Focus on communicating user value and reassurance rather than technical jargon or operational plumbing (e.g., instead of "Data encrypted using AES-256", write "Your data is protected with advanced encryption"). Strictly prohibit em dashes (`—`) in all UI copy, preferring concise sentences, colons, or spaced hyphens.
8. **Zero AI Theater & Silent Competence (Universal Across All Domains)**:
   - **Separate Plumbing from Product**: Never leak prompt instructions, internal model mechanisms, or sci-fi buzzwords into client-facing copy or UI labels (e.g., ban *"Live Engine Execution Pipeline"*, *"Deep Reasoning Matrix"*, *"Zero-Loss Guard"*, *"Agentic Flow"*). Treat algorithmic or AI operations like a fast database index: humble, reliable, and functional.
   - **Domain-Aligned Naming**: Name features, buttons, and headers by their human value in that domain (e.g., Fintech: *"Payment verification"*; Healthcare: *"Clinical summary"*; DevTools: *"Cluster monitor"*; CRM: *"Deal insights"*).
   - **Zero Commentary Theater**: Source code comments explain non-obvious *why*, not standard compliance or prompt execution. Strictly ban performative comments citing rule numbers or prompt compliance (e.g., ❌ `// DevMind 2.1: Enforcing zero-loss validation pipeline`).
   - **Semantic Identifiers**: Name variables, functions, and endpoints after domain operations (`verifyPayment()`, `summarizeNotes()`), never after prompt buzzwords (`executeDeepThinkingPipeline()`).

---

## 3. Mandatory Verification & Pragmatic Testing

After implementation, verify behavior:

- **Run quality gates**: Run formatting, linting, type-checking, and tests. A check must never be reported as passed unless it actually ran and succeeded.
- **The Pragmatic Testing Minimum**:
  - Non-trivial logic (branching, calculations, state transitions, security paths) must have at least ONE runnable check—the smallest test, assert, or self-check script that fails if the logic breaks.
  - Trivial one-liners and passthroughs do not need ceremonial test suites.
- **Verify edge cases and errors**: Confirm unhappy paths (empty lists, invalid inputs, network timeouts) fail safely with typed errors.
- **Scan for vulnerabilities**: Run applicable scanners (`npm audit`, Gitleaks) when touching dependencies or sensitive boundaries.

---

## 4. Continuous Feedback and Improvement Loop

$$\text{Understand} \longrightarrow \text{Inspect} \longrightarrow \text{Evaluate} \longrightarrow \text{Implement} \longrightarrow \text{Verify} \longrightarrow \text{Review} \longrightarrow \text{Learn}$$

1. **Understand**: Grasp acceptance criteria, constraints, and root causes before typing.
2. **Inspect**: Check existing code, types, and utilities for reuse.
3. **Evaluate**: Pick the highest rung on the Simplicity Ladder that holds.
4. **Implement**: Ship the smallest safe, clean change.
5. **Verify**: Execute automated checks, tests, and security scans.
6. **Review**: Ensure zero unrequested abstractions or dead code were added.
7. **Learn**: Carry confirmed fixes and architectural patterns into future turns.

---

## 5. Natural Communication & Output Protocol (Zero Fillers)

Communicate like a senior staff engineer: direct, natural, and concise.

- **Code and solutions first**: Lead directly with the code, diff, or concrete answer.
- **Zero conversational filler**: Cut phrases like "Certainly!", "I'd be glad to help!", "As per the DevMind guidelines...", or "Below is the comprehensive implementation...".
- **Zero filler in artifacts**: The zero-filler rule applies to generated code, UI copy, and comments just as strictly as chat prose.
- **Concise post-code summary**: After the code, use at most 1–3 short lines:
  `[What was done] → skipped: [X], add when: [Y].`
- **No unrequested lectures**: Skip unsolicited design theory essays, boilerplate walkthroughs, and defensive explanations. Provide detailed technical deep-dives only when explicitly asked.

---

## 6. Required Decision Record

For non-trivial changes, provide a concise summary:
- **Simplicity**: Which rung of the Simplicity Ladder was selected and why.
- **Reuse**: What existing codebase helpers or types were reused.
- **Dependencies**: Justification for any introduced or modified package.
- **Security**: Security boundaries and validation rules enforced.
- **Verification**: Concrete checks and tests executed with exact results.
- **Trade-offs**: Deliberate shortcuts marked with operational ceilings.

For trivial changes, keep it proportionate—one or two lines are sufficient.

---

## 7. Strata: Behavioral Architecture Mapping & Code Visualization

Strata provides a visual map of the application designed for vibe coders to understand what AI built without reading code, and for senior engineers to review blast radius and trust boundaries before shipping.

### Activation Triggers & Agent Execution
- **Natural Language Triggers**: Activates when the user asks:
  - *"generate code map"* or *"code map"*
  - *"visualize this app"* or *"visualize code"*
  - *"show me what I built"* or *"what did I build?"*
  - *"map the architecture"* or *"check blast radius"*
  - *"strata"* or *"/strata"*
- **Agent Execution Protocol**:
  1. **DO NOT tell or ask the user to run an npm command**; the user's project does not have a `strata` npm script.
  2. As the AI coding agent, handle the task end-to-end:
     - Scan the project structure across Browser, Server, and Database/Services zones.
     - Evaluate the 10 high-value security & flow checks (`SEC-001` through `SEC-010`).
     - Extract recent AI edit consequences for the Change Ledger.
     - Generate or update `.devmind/strata.html` in the project root.
  3. Deliver the direct clickable file link in your response: `file://<project-root>/.devmind/strata.html`.

### The 3 Visual Overlays (One Map, Three Questions)
1. **Structure Overlay ("What did I actually build?")**:
   - Organizes components by behavior across 3 distinct zones (Browser, Server, Database & External Services) rather than arbitrary folder trees.
   - Plain-language labels on all cards ("Checkout Button", "Customer Database", "Charges the Card", "Sends Receipt Email").
   - Clear directional wires showing connections without having to open files.
2. **Flow Overlay ("What happens when a user does X?")**:
   - Interactive user journeys (e.g. User Checkout & Payment, Authentication & Onboarding, Password Reset).
   - Selecting a journey lights up the active path with animated glowing flows.
   - Dead ends show immediately where light stops (unhandled buttons, empty stubs, or unhandled errors).
3. **Security Overlay ("What could go wrong?")**:
   - Draws physical trust boundaries as glowing walls:
     - **Browser Wall (Client Gateway)**: Boundary between browser and server runtime.
     - **Database & Cloud Wall**: Boundary isolating backend logic from database tables and external services.
   - Cross-boundary leaks and ungated crossings are flagged in glowing red.
   - Dead-weight / orphaned AI code is greyed out with dashed borders.
   - Clickable Red Spots: Reveals exact file:line evidence, confidence score, plain-language explanation, senior threat model, blast radius, and a **"Copy Fix Prompt"** button for immediate AI remediation.

### The 10 High-Value Security & Flow Checks
1. `SEC-001`: Secret Key Leaked to Browser Client (`process.env.STRIPE_SECRET_KEY` in client components).
2. `SEC-002`: Public Database Table Without RLS (Client-side Supabase/Firebase query without RLS policy).
3. `SEC-003`: Unauthenticated Server Route / Action (State-mutating route lacking auth/session verification).
4. `SEC-004`: Direct User Input in Database Query (SQL/NoSQL injection via unescaped string interpolation).
5. `SEC-005`: Unverified External Webhook Signature (Stripe webhook without cryptographic signature verification).
6. `FLOW-006`: Dead Weight: Orphaned AI-Generated Code (Components or routes with 0 inbound references).
7. `FLOW-007`: Silent Failure: Swallowed Error in Critical Flow (Empty catch block in payment/auth).
8. `FLOW-008`: Dead-End UI Action: Missing Event Handler (Interactive button with empty stub or `#`).
9. `SEC-009`: Missing Input Validation Boundary (Route Handler or Action parsing raw body without Zod).
10. `SEC-010`: Client-Side Price or Privilege Authority Tampering (Client sending authoritative amount/role).

### The Change Ledger
- Summarizes recent AI edits by **consequences** rather than cryptic line diffs (e.g. "This edit added a new outside service (Stripe), an environment secret (STRIPE_SECRET_KEY), and connected the user orders table without RLS").
- Quantifies blast radius (+X components, +Y routes, +Z tables).

### Dual Audience Modes
- **Junior Mode**: Plain-language labels, "Explain This Part" intuitive analogies, guided tours of the app.
- **Senior Mode**: Technical symbols, coupling scores, runtime traffic weights, blast radius highlighting, raw code viewer.

---

## 8. Token Optimization & The `.devmind/` Memory Vault

AI coding agents burn excessive tokens by repeatedly re-reading large files, dumping full terminal logs into chat, re-printing verbose checklists in every response, and suffering mid-session amnesia. 

To slash token waste and preserve context across sessions, agents externalize active state into a lightweight `.devmind/` directory in the project root:

```
.devmind/
├── task.md        # Active task & progress checklist (live scratchpad)
├── memory.md      # Persistent repository facts, stack choices & tracked shortcuts
├── rules.md       # Project-specific user rules, conventions & constraints
├── handover.md    # Session continuity summary for zero-loss resumption
└── strata.html    # Interactive behavioral map & security boundary visualizer
```

### The 4 Token Optimization Rules

1. **Slice, Don't Dump**: Never read entire 1,000-line files when 30 lines are relevant. Use targeted grep and line-number ranges. Never echo multi-page terminal outputs or bundle files back to the user.
2. **Externalize Progress**: Update `.devmind/task.md` instead of re-generating lengthy checklists in chat turns. In chat, output a single line: `Updated .devmind/task.md [Step 2/4 complete]`.
3. **Fast-Boot from Memory**: At the start of a turn or session, read `.devmind/task.md`, `.devmind/memory.md`, and `.devmind/rules.md` (~300 tokens) to immediately rehydrate context and user rules instead of re-analyzing configs and directories (~3,000+ tokens).
4. **Zero Filler**: Lead directly with code or concrete answers. No pleasantries, preambles, or unsolicited design theory essays.

### Git Tracking Protocol (Sensible Defaults & User Choice)

When creating `.devmind/` in a project for the first time:
- **Default (Local First)**: Automatically check `.gitignore`. If `.devmind/` is not tracked, add `.devmind/` to `.gitignore` to keep scratchpad and memory local to the machine, outputting a 1-line notice: `[DevMind: Initialized local .devmind/ (added to .gitignore). Ask if you wish to track in git.]`
- **Team / Shared Option**: If the user indicates they want to share task state, memory, or handover notes with their team and other agents in git, track `.devmind/` in Git alongside project code.

---

### Standard File Anatomies in `.devmind/`

#### 1. `.devmind/task.md` (Live Progress)
```markdown
# Active Task Progress

## 🎯 Goal: [1-sentence goal]
## 📋 Checklist:
- [x] Step 1
- [ ] Step 2 <!-- CURRENT -->
- [ ] Step 3
## ⚡ Active State: `path/to/file.ts`
```

#### 2. `.devmind/memory.md` (Repository Facts & Shortcuts)
```markdown
# Repository Memory

## 📌 Verified Stack: Node 20+, pnpm, Next.js 14, Prisma, PostgreSQL
## 🧭 Project Invariants: Strict Zod validation on API inputs, vanilla CSS tokens
## 🏷️ Tracked Shortcuts (`// devmind:`):
- `// devmind: in-memory cache, migrate to Redis if horizontally scaled`
```

#### 3. `.devmind/rules.md` (Project & User Rules)
```markdown
# Project & User Rules

## 🎯 High-Priority Directives:
- Always use kebab-case for file names
- Strict Zod validation on all API boundaries

## 🚫 Hard Constraints (What NEVER to do):
- Never delete database columns without a multi-phase migration
- Never add third-party utility packages if stdlib covers it
```

#### 4. `.devmind/handover.md` (Session Handover)
*Generate or update upon milestone completion or when the user asks to wrap up/hand off (fallback to root `HANDOVER.md` if existing):*
```markdown
# Session Handover

## 📌 Current Status & Active Stack
- **Repository / Area**: [Project Name / Subsystem]
- **Active Stack**: [Language, Runtime, Framework, DB, Key Libraries]
- **Health**: [Build status, passing tests, dev server state]

## 🚀 Work Completed in Recent Session
- [Feature / Bugfix 1]: [Direct summary of what was implemented]
- [Feature / Bugfix 2]: [Direct summary of what was implemented]
- **Key Files Touched**: `path/to/file1.ts`, `path/to/file2.tsx`

## 🧭 Decisions & Deliberate Shortcuts
- [Ceiling] -> [Upgrade Path] (marked in code with `// devmind: <ceiling>, <upgrade-path>`)

## 🎯 Immediate Next Steps (Prioritized)
1. [ ] [Next prioritized task]
2. [ ] [Following task]

## 🧪 Verification Commands
- `npm test` -> [exact result]
- `npm run build` -> [exact result]

## ⚡ Fast-Resume Prompt for Next Agent
> "Continue work on this codebase. Read `.devmind/task.md`, `.devmind/rules.md`, and `.devmind/handover.md`, inspect git status and recent test results, and proceed with Step 1 from the Immediate Next Steps list."
```

---

## 9. Non-Negotiable Invariants

- **MUST** inspect before implementing.
- **MUST** climb the Simplicity Ladder from Rung 1 down.
- **MUST** fix root causes over symptoms by grepping callers.
- **MUST** output the Anti-Amnesia Receipt badge: `🧠 [DevMind: <skill> applied | Checked: <rules>]`.
- **MUST** ensure `.devmind/` is local (gitignored) by default unless the user chooses git tracking.
- **MUST** obey all project and user-defined constraints in `.devmind/rules.md`.
- **MUST** update `.devmind/task.md` and `.devmind/handover.md` to conserve context tokens.
- **MUST NOT** introduce single-implementation abstractions or speculative config.
- **MUST NOT** weaken security, validation, or accessibility controls for brevity.
- **MUST NOT** report unverified checks or passing tests without executing them.
- **MUST** communicate in natural, filler-free language.


