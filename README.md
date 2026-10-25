# DevMind

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-zoebchhatriwala%2FDevMind-black?logo=github)](https://github.com/zoebchhatriwala/DevMind)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Zero-Amnesia Enforced](https://img.shields.io/badge/AI%20Agent-Zero--Amnesia%20Enforced-emerald.svg)](./AGENTS.md)

> **The Zero-Amnesia Brain for AI Coding Agents**  
> *Production-grade engineering standards, security gates, and multi-skill auto-routing that coding agents (Claude Code, Cursor, Windsurf, Cline, OpenSkills, GitHub Copilot) NEVER ignore, bypass, or forget mid-session.*

---

## ⚡ Why DevMind Exists

### The Problem: Agent Amnesia & Bloated Default Code
Every developer using AI coding agents faces the same recurring frustrations:
1. **Agents Over-Engineer and Write AI Slop**: LLMs default to speculative abstractions—generating single-implementation interfaces, single-product factories, premature config files, and paragraphs of robotic filler prose instead of shipping the simplest working diff.
2. **Sloppy Security Defaults**: Agents fall back to their training priors—generating raw `any`, unvalidated `req.body`, tokens in `localStorage`, N+1 queries, unindexed foreign keys, or unstyled emojis instead of real UI icons.
3. **Multi-Domain Blindness**: When asked to *"Build a user profile API with DB migration and a React form"*, agents only implement one part while ignoring the security, database, and backend contracts they silently touched.
4. **Mid-Session Amnesia (Context Drift)**: By turn 5 or 6, earlier instructions scroll out of the agent's token window, and the agent reverts to naive statistical defaults.

### The Solution: DevMind's Architecture
DevMind turns passive reference docs into an **enforceable engineering baseline**:

1. **The Simplicity Ladder**: Enforces a strict 7-rung hierarchy (YAGNI → codebase reuse → stdlib → platform native → installed deps → pure functions → minimal safe code). The best code is code you never had to write.
2. **Root-Cause First**: Grep all callers before editing a function. Fix once at the shared source rather than patching isolated ticket symptoms.
3. **Pragmatic Shortcut Tracking**: Deliberate simplifications with known operational limits are tracked with explicit inline markers (`// devmind: <ceiling>, <upgrade-path>`), preventing technical debt rot.
4. **Natural, Zero-Filler Communication**: Code first, direct answers, and at most 1–3 lines summarizing what was done and what was skipped. Zero canned AI sycophancy.
5. **Action- & Glob-Triggered Frontmatter**: Every skill's YAML maps exact file globs and user intents, forcing agents to load the right skill before touching code.
6. **Pre-Flight Gates & Golden Patterns**: Bans common anti-patterns with concrete DO vs. DON'T code examples.
7. **Anti-Amnesia Receipt Badges**: Agents output a 1-line receipt badge at the top of their response:
   ```text
   🧠 [DevMind: <skill-name> applied | Checked: <top 3 rules verified>]
   ```
   This anchors DevMind directly in the LLM's active attention window so it never forgets standards mid-session.
8. **Auto-Injecting IDE Rules**: Compiles into `.cursor/rules/*.mdc`, `.windsurfrules`, and `CLAUDE.md` with targeted globs that editors inject automatically.
9. **`HANDOVER.md` Session Continuity**: Standardized session summary format enabling any engineer or AI agent to resume work across new sessions with zero context loss.

---

## 🧠 The 8 Core Engineering Skills

| Skill | Domain & Mandatory Trigger | File Globs | Core Enforcement Highlights |
| :--- | :--- | :--- | :--- |
| **[`ai-standards`](./skills/ai-standards/)** | **AI Platforms, RAG & Agents**<br>`MANDATORY TRIGGER: Invoke BEFORE writing or modifying any LLM/AI integration, prompt templates, agent workflows, RAG pipelines, embeddings, tool calls, or model routing.` | `**/{ai,rag,prompts,llm,embeddings,agents}/**` | Hybrid search (sparse BM25 + dense vector via RRF), cross-encoder neural reranking (Cohere/BGE), contextual chunking, prompt-master XML structures, agent circuit breakers, and DeepEval/Ragas automated evals (RAG Triad). |
| **[`api-design`](./skills/api-design/)** | **API Contracts & Protocols**<br>`MANDATORY TRIGGER: Invoke BEFORE creating, modifying, or reviewing any REST/GraphQL/RPC route, controller, OpenAPI spec, DTO, pagination, error payload, or webhook handler.` | `**/{api,routes,controllers,contracts}/**`, `**/*.openapi.*`, `**/*.swagger.*` | RESTful URI semantics, OpenAPI 3.1 code-first from Zod, RFC 7807 problem details, IETF Idempotency-Key with Redis locks, mandatory dynamic list pagination & weak ETags. |
| **[`auth-patterns`](./skills/auth-patterns/)** | **Auth & Permissions**<br>`MANDATORY TRIGGER: Invoke BEFORE touching login, signup, JWT, OAuth, sessions, RBAC/permissions, middleware/guards, password hashing, CSRF, or token refresh logic.` | `**/{auth,middleware,session,security}/**` | Refresh token rotation with reuse detection, zero `localStorage` tokens (HttpOnly SameSite cookies), OAuth 2.0 PKCE, WebAuthn Passkeys, TOTP 2FA, session invalidation. |
| **[`be-standards`](./skills/be-standards/)** | **Backend Engineering**<br>`MANDATORY TRIGGER: Invoke BEFORE writing or refactoring backend services, business logic, background jobs, queues, caching, logging, dependency injection, or server error handling.` | `**/*.{ts,js,mjs,cjs,go,py,rs}` | Strict DTO validation (no raw `req.body`), clean service/repository boundaries, Pino structured logging (zero secret leaks), mandatory collection pagination, RFC 7807 errors. |
| **[`db-standards`](./skills/db-standards/)** | **Database & Migrations**<br>`MANDATORY TRIGGER: Invoke BEFORE creating or editing database schemas, migrations, ORM models (Prisma/Drizzle/TypeORM/SQL), indexes, transactions, or complex queries.` | `**/{schema,migrations,models,entities}/**`, `**/*.sql`, `**/prisma/**`, `**/drizzle/**` | Strict auto-generation (no manual SQL edit drift), zero-downtime expand-contract migrations, N+1 query elimination, foreign key indexes, keyset pagination. |
| **[`deployment`](./skills/deployment/)** | **CI/CD & Cloud Infrastructure**<br>`MANDATORY TRIGGER: Invoke BEFORE creating or editing Dockerfiles, docker-compose, CI/CD workflows (.github/workflows), Kubernetes/Terraform, env configs, or healthcheck endpoints.` | `**/{.github,deploy,infra}/**`, `**/Dockerfile*`, `**/docker-compose*`, `**/*.tf` | Multi-stage rootless Dockerfiles (`USER nonroot`), explicit healthchecks, SHA-pinned GitHub Actions, Trivy container scans, secret masking, zero hardcoded credentials. |
| **[`fe-standards`](./skills/fe-standards/)** | **Frontend Engineering**<br>`MANDATORY TRIGGER: Invoke BEFORE building or editing UI components, pages, client state, forms, data fetching hooks, CSS/Tailwind, accessibility, or frontend performance.` | `**/*.{tsx,jsx,css,scss,html,vue,svelte}` | WCAG 2.2 AA (30 UX areas), 8-state interaction matrix, design tokens (`tokens.css`), zero unstyled emojis as icons (curated icon libraries aligned with text), human UX copy. |
| **[`security-standards`](./skills/security-standards/)** | **Application Security**<br>`MANDATORY TRIGGER: Invoke BEFORE handling user input validation, file uploads, secrets/env vars, rate limiting, CORS, CSP headers, encryption, or payment/PII flows.` | `**/*` | NIST SP 800-218 (SSDF) and OWASP ASVS 5.0, Argon2id password hashing, AES-256-GCM authenticated encryption, magic bytes file validation, Gitleaks, `npm audit` zero tolerance. |

---

## 🎯 How Auto-Routing & Anti-Amnesia Work

```
User Prompt (e.g. "Add user profile API with DB migration and React form")
                              │
                              ▼
                 AGENTS.md Skill Routing Matrix
         ┌────────────────────┼────────────────────┐
         ▼                    ▼                    ▼
   db-standards         be-standards          fe-standards
         │                    │                    │
         ▼                    ▼                    ▼
   Pre-Flight Gate      Pre-Flight Gate      Pre-Flight Gate
   (No manual SQL)      (Strict DTO validation) (WCAG 2.2 AA & Tokens)
         │                    │                    │
         └────────────────────┼────────────────────┘
                              ▼
                  Print Anti-Amnesia Receipt
        🧠 [DevMind Active: db-standards, be-standards, fe-standards]
                              │
                              ▼
            Verified Implementation with Zero Amnesia
```

### The Anti-Amnesia Receipt Protocol
Whenever an agent executes an engineering task governed by DevMind, it must emit a receipt badge at the very beginning of its plan and output:
```text
🧠 [DevMind: <skill-name> applied | Checked: <top 3 rules verified>]
```
*Example:*
```text
🧠 [DevMind: db-standards applied | Checked: expand-contract migration, foreign key index added, keyset cursor pagination]
```
This single line anchors the agent's memory in its immediate context window, preventing it from drifting back into generic statistical defaults during multi-turn refactorings.

---

## 🚀 1-Command Installation & Build

```bash
git clone https://github.com/zoebchhatriwala/DevMind.git
cd DevMind
npm run build
```

DevMind generates ready-to-use drop-in artifacts for all major coding agents in `dist/`:

### 1. Claude Code (Anthropic CLI)
Drop the universal agent configuration and skills directly into your project:
```bash
cp dist/claude-code/CLAUDE.md your-project/
cp -r dist/claude-code/.claude your-project/
```

### 2. Cursor IDE
Enable auto-injecting `.mdc` rules that trigger automatically based on the files you open:
```bash
# Modular rules with file globs (Recommended)
cp -r dist/cursor/.cursor your-project/

# Unified single rule fallback
cp dist/cursor/.cursorrules your-project/
```
*Cursor Pro-Tip:* The generated `.cursor/rules/devmind.mdc` has `alwaysApply: true`, guaranteeing the baseline is always loaded, while the individual `.mdc` files auto-attach whenever relevant files (e.g., `schema.prisma`, `*.tsx`, `Dockerfile`) are opened!

### 3. Windsurf / Cascade
```bash
cp dist/windsurf/.windsurfrules your-project/
# Or modular rules:
cp -r dist/windsurf/.windsurf your-project/
```

### 4. OpenSkills / Universal Agents
Works with any agent supporting `AGENTS.md` (e.g., Cline, Roo Code, OpenHands):
```bash
cp AGENTS.md your-project/
```

### 5. Google Antigravity & Gemini CLI
Install DevMind into your global Antigravity config in a single command:
```bash
npm run install:gemini
```
*Or copy manually:*
```bash
cp -r dist/antigravity/devmind ~/.gemini/config/skills/devmind
```

### 6. GitHub Copilot
```bash
cp -r dist/github-copilot/.github your-project/
```

### 7. Universal 1-Command Drop-In for ANY Repository
To copy all multi-agent root hooks into your current repository in one command:
```bash
node scripts/build.mjs --install-hooks
```

---

## 🛠 Validation & Quality Suite

DevMind includes a zero-dependency validation script that strictly verifies every skill:

```bash
npm test
```

The validation suite verifies:
- Frontmatter format, valid names, and descriptions starting with `MANDATORY TRIGGER:`.
- Presence of all 4 enforceable protocol sections: `Pre-Flight Gate`, `Golden Patterns`, `Anti-Amnesia Receipt`, and `Post-Implementation Checklist`.
- Receipt badge format compliance (`🧠 [DevMind: ...`).
- Scannable, token-efficient size constraints.
- Multi-agent compilation artifacts in `dist/`.

---

## 🤝 Contributing

We welcome contributions to expand and refine agent skills. Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for our skill quality bar, frontmatter specifications, and pull request workflow.

---

## 📄 License

[MIT](./LICENSE) — © 2026 DevMind contributors.
