# DevMind

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-zoebchhatriwala%2FDevMind-black?logo=github)](https://github.com/zoebchhatriwala/DevMind)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Zero-Amnesia Enforced](https://img.shields.io/badge/AI%20Agent-Zero--Amnesia%20Enforced-emerald.svg)](./AGENTS.md)

> **Pragmatic engineering standards and sanity checks for AI coding agents.**  
> Keeps Claude Code, Cursor, Windsurf, Cline, and GitHub Copilot from over-engineering, writing sloppy defaults, or drifting off track mid-session.

---

## Why DevMind?

If you build software with AI coding tools, you've probably run into these exact frustrations:

1. **They over-engineer everything.** Ask for a simple utility function, and you get an abstract factory, three single-implementation interfaces, a speculative config file, and a brand-new npm package you didn't ask for.
2. **They take lazy shortcuts on basics.** Unvalidated `req.body`, tokens saved in `localStorage`, missing database indexes, unhandled network timeouts, and raw `any` types everywhere.
3. **They suffer from mid-session amnesia.** By turn 5 or 6, earlier decisions scroll out of the model's active attention window, and the agent quietly reverts to generic defaults.
4. **They bury you in conversational fluff.** Paragraphs of robotic preamble (*"Certainly! I would be delighted to assist you with..."*) instead of getting straight to the point with working code.

DevMind replaces these habits with a straightforward engineering baseline that agents actually follow.

---

## Core Principles

### 1. The Simplicity Ladder
Before writing a single line of new code, agents must climb down this ladder and stop at the first rung that works:

```
[1. Does this need to exist at all? (YAGNI)]
  └── [2. Already in this codebase? (Search before writing)]
        └── [3. Does the standard library / runtime do it?]
              └── [4. Does the native platform or framework handle it?]
                    └── [5. Does an installed dependency already solve it?]
                          └── [6. Can it be a clean, concise pure function?]
                                └── [7. Only then: write minimum typed production code]
```
The best code is the code you never had to write.

### 2. Fix the Root Cause, Not the Symptom
When fixing a bug or refactoring, search all callers before editing. Fix once at the shared source rather than patching individual call sites and leaving edge cases broken.

### 3. Track Deliberate Shortcuts
Taking a pragmatic shortcut for now is fine, but it shouldn't rot into mystery tech debt. Any deliberate simplification is marked with an explicit comment:
```ts
// devmind: in-memory cache per instance, migrate to Redis if horizontally scaled
```

### 4. Talk Like an Engineer (Zero Filler)
No unsolicited essays, no cheerleading, and no robotic filler text. Agents lead directly with the solution or diff, followed by a concise 1–3 line note on what was done and what was intentionally deferred.

### 5. Token Optimization & The `.devmind/` Memory Vault
AI coding agents waste thousands of tokens repeating checklists in chat turns, dumping huge file reads, and losing track of project facts across sessions. DevMind solves this by externalizing state into a lightweight `.devmind/` workspace folder:
- **`task.md`**: Live progress scratchpad. The agent updates this file directly instead of spitting out multi-page checklists in chat.
- **`memory.md`**: Repository facts, verified stack versions, project conventions, and intentional shortcut markers (`// devmind:`). Booting a fresh turn reads this small file (~150 tokens) instead of re-scanning the entire codebase (~3,000+ tokens).
- **`rules.md`**: Custom project-specific user rules, team conventions, and hard constraints that agents must obey on every turn.
- **`handover.md`**: Standardized session summary for zero-loss resumption across agent sessions.

**Git Tracking Choice**: When `.devmind/` is first created, the agent asks whether to commit it to Git (to share session memory with your team and other AI agents) or append it to `.gitignore` (keep it local to your machine only).

### 6. Anti-Amnesia Receipts
To prevent agents from forgetting standards mid-session, they print a single-line receipt badge at the top of their response:
```text
🧠 [DevMind: db-standards applied | Checked: expand-contract migration, foreign key index added, keyset cursor pagination]
```
This forces the rules directly into the model's immediate context window, preventing context drift across long conversations.

---

## The 8 Skill Domains

DevMind includes specialized, modular rules across the full stack:

| Skill | What it Covers | Key Standards Enforced |
| :--- | :--- | :--- |
| **[`ai-standards`](./skills/ai-standards/)** | AI Platforms, RAG & Agents | Hybrid search (BM25 + Dense Vectors + RRF), Cross-Encoder reranking, Prompt-Master XML prompts, Primacy Zone constraints, bounded context & chat compaction, and DeepEval/Ragas CI eval tests. |
| **[`api-design`](./skills/api-design/)** | REST, GraphQL & RPC | Clean RESTful URI semantics, Zod-first OpenAPI schemas, RFC 7807 problem details, IETF `Idempotency-Key` locks, keyset pagination, and weak ETags. |
| **[`auth-patterns`](./skills/auth-patterns/)** | Auth, Sessions & RBAC | Refresh token rotation, zero tokens in `localStorage` (HttpOnly SameSite cookies), OAuth 2.0 PKCE, WebAuthn Passkeys, TOTP 2FA, and explicit role guards. |
| **[`be-standards`](./skills/be-standards/)** | Backend Logic & Services | Strict DTO validation, clean service/repository boundaries, Pino structured logging (secrets redacted), collection pagination, and safe graceful shutdowns. |
| **[`db-standards`](./skills/db-standards/)** | Databases & Migrations | Zero-downtime expand-contract migrations, foreign key indexes, N+1 query elimination, keyset cursor pagination, and ACID transaction boundaries. |
| **[`deployment`](./skills/deployment/)** | Docker, CI/CD & Cloud | Multi-stage rootless Dockerfiles (`USER nonroot`), explicit health probes, SHA-pinned GitHub Actions, Trivy vulnerability scans, and zero hardcoded secrets. |
| **[`fe-standards`](./skills/fe-standards/)** | UI, Accessibility & Design | Intent-driven SaaS UI (zero generic AI slop, no arbitrary purple gradients/blobs), full wayfinding (AppShell, breadcrumbs, page headers), WCAG 2.2 AA accessibility, 8-state interaction matrices, semantic CSS tokens, and real icon libraries (no unstyled emojis). |
| **[`security-standards`](./skills/security-standards/)** | AppSec & Defense-in-Depth | NIST SSDF & OWASP ASVS compliance, Argon2id hashing, AES-256-GCM encryption, magic-byte file validation, rate limiting, and zero-tolerance dependency audit. |

---

## Quick Setup

Clone the repository and build the compiled rules for your tool of choice:

```bash
git clone https://github.com/zoebchhatriwala/DevMind.git
cd DevMind
npm run build
```

This generates drop-in configurations inside `dist/`:

### Cursor IDE
Copy the auto-attaching rules into your project:
```bash
# Modular rules that auto-attach based on the files you open (Recommended)
cp -r dist/cursor/.cursor your-project/

# Or as a single fallback file
cp dist/cursor/.cursorrules your-project/
```

### Claude Code (Anthropic CLI)
```bash
cp dist/claude-code/CLAUDE.md your-project/
cp -r dist/claude-code/.claude your-project/
```

### Windsurf / Cascade
```bash
cp dist/windsurf/.windsurfrules your-project/
cp -r dist/windsurf/.windsurf your-project/
```

### Google Antigravity & Gemini CLI
Install directly into your global Antigravity config:
```bash
npm run install:gemini
```

### Universal Agents (Cline, Roo Code, OpenHands)
```bash
cp AGENTS.md your-project/
```

### One-Command Drop-In for Any Repo
To copy all multi-agent hooks into an existing project at once:
```bash
node scripts/build.mjs --install-hooks
```

---

## Validation & Testing

Every skill and build target in DevMind is covered by automated verification:

```bash
# Run the verification suite
npm test

# Rebuild all distribution packages
npm run build
```

The test runner validates:
- YAML frontmatter triggers and natural language keywords.
- Mandatory sections: Pre-Flight Gate, Golden Patterns, Anti-Amnesia Receipt, and Post-Implementation Checklist.
- Code blocks, token efficiency, and multi-agent distribution integrity.

---

## Contributing

Suggestions, refinements, and new domain skills are welcome! Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on skill structure and pull requests.

---

## License

[MIT](./LICENSE) — © 2026 DevMind contributors.
