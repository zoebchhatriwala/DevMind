# DevMind

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
[![GitHub Repository](https://img.shields.io/badge/GitHub-zoebchhatriwala%2FDevMind-black?logo=github)](https://github.com/zoebchhatriwala/DevMind)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Engineering Baseline](https://img.shields.io/badge/AI%20Agent-Engineering%20Baseline-emerald.svg)](./AGENTS.md)

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

**Git Tracking Choice**: `.devmind/` is ignored locally by default. Track it only when the team explicitly chooses shared task memory.

### 6. Anti-Amnesia Receipts
To prevent agents from forgetting standards mid-session, they print a single-line receipt badge at the top of their response:
```text
🧠 [DevMind: db-standards applied | Checked: expand-contract migration, foreign key index added, keyset cursor pagination]
```
The receipt records which checks the agent inspected. It does not replace tests or guarantee that an agent retains every earlier decision.

### 7. Strata: Code Visualization for Vibe Coders & Seniors
Vibe coders often struggle to read complex AI-generated code, while senior engineers need to review the blast radius of AI edits fast. DevMind includes **Strata**, an interactive visual architecture map generated on demand by your AI agent.

Just ask your AI agent in chat:
> *"Generate code map"*  
> *"Visualize this app"*  
> *"Show me what I built"*

The agent inspects your codebase, evaluates trust boundaries, and automatically generates an interactive map at `.devmind/strata.html`:

The automated helper currently inventories observed files and dependency names and attaches source-check findings. It does not establish runtime edges, user journeys, traffic scores, or commit blast radius. Those require traced evidence and agent review; missing information stays unknown. The overlays below support manually reviewed map data and the included demo, rather than proving those behaviors from filenames alone.
- **Structure Overlay**: Visualizes screens, buttons, routes, database tables, and external services arranged by behavior across three zones: Browser, Server, and Database/Services.
- **Flow Overlay**: Lights up user journeys (e.g. checkout, login, password reset) and highlights dead ends (unhandled buttons or swallowed errors).
- **Security Overlay**: Draws physical trust boundaries as glowing walls (Browser Wall, Database Wall) and detects leaked secrets, public tables without RLS, and unauthenticated endpoints.
- **Clickable Red Spots with AI Fix Prompts**: Every flagged risk displays exact file:line evidence and provides a 1-click **"Copy Fix Prompt"** button to feed back into your AI tool.
- **The Change Ledger**: Summarizes AI edits by *consequences* rather than confusing diffs.
- **Junior & Senior Modes**: Switch between plain-language labels and technical blast radius metrics.
- Standalone, offline HTML generated at `.devmind/strata.html` (no npm dependencies needed in your project).

---

## Instruction loading

Each domain starts with concise gates and links to topic references. Small patches use the gates; substantial work loads the relevant examples. Installed root instructions contain the shared baseline and domain catalog. The complete topic references ship alongside them. The repository's own `AGENTS.md` remains the contributor policy.

Measured UTF-8 instruction sizes before and after this optimization:

| Instructions | Before | After | Reduction |
| --- | ---: | ---: | ---: |
| Nine domain entrypoints combined | 257,584 B | 42,425 B | 83.5% |
| Claude root instructions | 85,921 B | 4,168 B | 95.1% |
| Windsurf root instructions | 287,051 B | 4,168 B | 98.5% |
| Cline root instructions | 286,941 B | 4,168 B | 98.5% |

These are text-size measurements, not model token counts or a benchmark of coding quality. Topic references load on demand. Validation caps domain entrypoints at 12 KB and tests compact root baselines, reference resolution, and installation behavior.

The CLI loads command implementations when invoked, and memory initialization does not scan the project or generate Strata. Request the map separately when needed. No runtime dependencies are required.

## The 9 Skill Domains

DevMind includes specialized, modular rules across the full stack:

| Skill | What it Covers | Key Standards Enforced |
| :--- | :--- | :--- |
| **[`ai-standards`](./skills/ai-standards/)** | AI Platforms, RAG & Agents | Validated outputs, authorized tool calls, bounded context and spend, permission-scoped retrieval, and measured evaluations. Add retrieval complexity only when needed. |
| **[`api-design`](./skills/api-design/)** | REST, GraphQL & RPC | Clean RESTful URI semantics, Zod-first OpenAPI schemas, RFC 7807 problem details, IETF `Idempotency-Key` locks, keyset pagination, and weak ETags. |
| **[`auth-patterns`](./skills/auth-patterns/)** | Auth, Sessions & RBAC | Refresh token rotation, zero tokens in `localStorage` (HttpOnly SameSite cookies), OAuth 2.0 PKCE, WebAuthn Passkeys, TOTP 2FA, and explicit role guards. |
| **[`be-standards`](./skills/be-standards/)** | Backend Logic & Services | Runtime boundary validation, framework-aligned architecture, redacted structured logging, bounded work, and tested recovery paths. |
| **[`db-standards`](./skills/db-standards/)** | Databases & Migrations | Zero-downtime expand-contract migrations, foreign key indexes, N+1 query elimination, keyset cursor pagination, and ACID transaction boundaries. |
| **[`deployment`](./skills/deployment/)** | Docker, CI/CD & Cloud | Multi-stage rootless Dockerfiles (`USER nonroot`), explicit health probes, SHA-pinned GitHub Actions, Trivy vulnerability scans, and zero hardcoded secrets. |
| **[`fe-standards`](./skills/fe-standards/)** | UI, Accessibility & Design | Task-specific composition, complete interactions, existing design-system reuse, honest content, WCAG 2.2 AA, and real browser verification. No forced SaaS templates or blanket palette bans. |
| **[`security-standards`](./skills/security-standards/)** | AppSec & Defense-in-Depth | NIST SSDF & OWASP ASVS compliance, Argon2id hashing, AES-256-GCM encryption, magic-byte file validation, rate limiting, and zero-tolerance dependency audit. |
| **[`strata`](./skills/strata/)** | Code Visualization & Trust Boundaries | Visual app maps for vibe coders, 3 behavioral zones (Browser/Server/Database), 10 high-value security checks with copyable AI fix prompts, animated journey flows, and AI Change Ledger. |

---

## Quick Setup & Interactive Installer

DevMind provides an interactive installer CLI for local and global installation across all major AI coding agents:

### 1. Interactive Installer Wizard (Recommended)
Run with zero installation to launch the interactive terminal setup wizard:

```bash
npx devmind
```
From this repository, `npm run install` asks which platform to install for, then whether to install locally, globally, or both. Platforms with only local integration are labeled accordingly. `npx devmind install --interactive` opens the same installation flow. Explicit `--local`/`--global` and `--target` options remain available for automation.

Ordinary npm package installation does not configure your editor or launch this wizard. Installation preserves existing project instructions and reports files needing a manual merge. `.devmind/install.json` records hashes of installed files: later installs update unchanged managed files while preserving local edits. Unknown platforms, unsupported scopes, and malformed options fail before writing project files.

Each skill installation has one master entrypoint. Plugin packages are separate. Reinstalling removes an obsolete duplicate entrypoint only when its content is recognized as unchanged; modified copies are preserved and reported.

The wizard prompts you interactively:
- **Scope**: Local project workspace (`./.devmind`, `.cursor/`, `CLAUDE.md`, `.agents/`) or Global user environment (`~/.gemini/config/skills/devmind`, `~/.claude/skills/devmind`, `~/.cursor/rules/`).
- **Target Agents**: Google Antigravity, Cursor, Claude Code, Windsurf, GitHub Copilot, Cline/Roo Code, or All.
- **Helper Scripts**: Installs executable JS helper scripts directly into `.devmind/scripts/` for your AI agents to use.

### 2. Fast Non-Interactive Installation
```bash
# Equip current project with all agent hooks & memory vault
npx devmind install --local --target all

# Install globally across all user profile directories on your machine
npx devmind install --global --target all

# Install for a specific agent (e.g. Antigravity or Cursor)
npx devmind install --global --target antigravity
npx devmind install --local --target cursor
```

### 3. OpenSkills / Agent Skills Compatible
Install directly via the open-source `skills` CLI:
```bash
npx skills add zoebchhatriwala/DevMind
```

---

## 🧰 Executable Helper Scripts (For AI Agents & Developers)

DevMind equips AI agents (and developers) with zero-dependency Node.js automation scripts located in `scripts/` (and `.devmind/scripts/` when installed locally):

Use `inspect` before creating code, `verify` after changes, and the existing project checks plus a browser before declaring UI work complete. The frontend guide now requires a short design brief, domain-specific composition, working controls, and observed mobile/desktop behavior. A clean scanner cannot prove visual quality, security, or accessibility.

`verify` exits 0 when no errors match, 1 for findings, and 2 for usage/scan failures. Add `--strict` to also fail on warnings. JSON includes implemented rules, manual checks, exclusions, and limitations. Automatic `--fix` was removed: the verifier never rewrites source or local preferences. Tests, fixtures, generated folders, and symbolic links are excluded from source checks; scripts are included. Custom gitignore patterns are not interpreted.

Run `npm run build` and `npm test` to validate behavioral fixtures and distribution artifacts. Core tools have no required package dependencies. Browser tests reuse existing Playwright and a browser; AST tests reuse an installed TypeScript compiler. Optional tests report skips when those tools are absent. Set `DEVMIND_TEST_TOOLING` to an existing tooling directory and `DEVMIND_TEST_CHANNEL` to `chrome` or `msedge` when appropriate. Set `DEVMIND_REQUIRE_TOOLING=1` to make missing browser/parser packages fail the test gate.

Built skill folders include their tools and shared modules. Rules-only distributions include a `scripts/` folder; the CLI installer puts tools in `.devmind/scripts/` for local projects and `~/.devmind/scripts/` for global rules installations.

| Helper Script | Purpose & Capabilities | Terminal Command |
| :--- | :--- | :--- |
| **`scripts/inspect.mjs`** | Read-only project discovery: packages, component/helper candidates, tokens, and quality tooling. Does not run discovered commands or print dependency/script values. | `npx devmind inspect . --json` |
| **`scripts/verify.mjs`** | Read-only AST checks using an installed TypeScript parser, plus labeled lexical/review hints for secret exposure, raw SQL, errors, interactions, types, and accessibility. | `npx devmind verify . --json --strict` |
| **`scripts/contrast.mjs`** | Solid hex color contrast with AA thresholds. Default checks normal text; use `--large` or `--non-text` for the 3:1 threshold. | `npx devmind contrast "#111827" "#ffffff" --json` |
| **`scripts/browser-audit.mjs`** | Isolated local browser screenshots, explicit keyboard/pointer assertions, DOM hints, and runtime error counts. Reuses installed Playwright. | `npx devmind browser-audit . http://127.0.0.1:3000 --plan browser-plan.json --json` |
| **`scripts/quality.mjs`** | Discover existing root package formatting/lint/type/test scripts; execute only with `--run`. Missing scripts remain unverified. | `npx devmind quality . --run --json` |
| **`scripts/review.mjs`** | Combine current source/check/browser/reviewer evidence. Reject stale source fingerprints, altered screenshots, and missing observations. | `npx devmind review . --quality .devmind/quality.json --browser .devmind/browser/report.json --assessment .devmind/assessment.json --json` |
| **`scripts/eval.mjs`** | Prepare eight isolated frontend/server tasks and evaluate actual candidate behavior. Compare identical case definitions and browser environments. | `npx devmind eval --list` |
| **`scripts/strata.mjs`** | Behavioral architecture mapper: automatically inspects project across Browser, Server, and Database zones, checks trust boundaries, and generates self-contained `.devmind/strata.html`. | `npx devmind strata` or `node scripts/strata.mjs` |
| **`scripts/init.mjs`** | Memory Vault bootstrapper: auto-detects tech stack (runtime, framework, DB, styling) and generates `.devmind/task.md`, `memory.md`, and `rules.md` with `.gitignore` safety. | `npx devmind init` or `node scripts/init.mjs` |
| **`scripts/handover.mjs`** | Session continuity: inspects git diffs and tracked shortcuts (`// devmind:`) to update `.devmind/handover.md`. | `npx devmind handover` or `node scripts/handover.mjs` |

The frontend skill loads [annotated design examples](skills/fe-standards/references/fe-design-examples.md) and [verification/evaluation procedures](skills/fe-standards/references/fe-verification.md) only when relevant. Small patches use affected checks; page/journey changes use fuller evidence. `eval` reports `behaviorStatus` separately from overall reviewed status, so successful functional checks do not hide missing reviewer evidence. The evaluator does not invoke a model itself or claim broad improvement from one case.

The eight evaluation cases include five browser tasks and three Node contracts: pagination validation, tenant authorization, and atomic transfer rollback. Node cases do not require a server URL. Candidate code executes locally, so use an isolated workspace. For a controlled skill experiment, see [the evaluation procedure](skills/ai-standards/references/ai-standards-evaluations.md). `--model-run` records the actual model/settings, skill revision, and observed resource metrics. Comparisons reject differing declared models/settings; missing provenance remains explicitly unverified. No cross-model improvement benchmark is claimed.

The handover helper preserves manual notes and refreshes only its marked repository snapshot. It reports quality as unverified: generating a summary does not establish that tests passed.

---

## Manual Multi-Agent Drop-In (dist/)

### Cursor IDE
Copy the auto-attaching rules into your project:
```bash
# Modular rules that auto-attach based on the files you open (Recommended)
cp -r dist/cursor/.cursor your-project/
cp -r dist/cursor/.devmind your-project/

# Or as a single fallback file
cp dist/cursor/.cursorrules your-project/
cp -r dist/cursor/.devmind your-project/
```

### Claude Code (Anthropic CLI)
```bash
cp dist/claude-code/CLAUDE.md your-project/
cp -r dist/claude-code/.claude your-project/
cp -r dist/claude-code/.devmind your-project/
```

### Windsurf / Cascade
```bash
cp dist/windsurf/.windsurfrules your-project/
cp -r dist/windsurf/.windsurf your-project/
cp -r dist/windsurf/.devmind your-project/
```

### Google Antigravity & Gemini CLI
Install directly into your global Antigravity config:
```bash
npx devmind install --global --target antigravity
```

### Universal Agents (Cline, Roo Code, OpenHands)
```bash
cp dist/agents/AGENTS.md your-project/
cp -r dist/agents/.devmind your-project/
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
- Skill discovery metadata and required protocol sections.
- Mandatory sections: Pre-Flight Gate, Golden Patterns, Anti-Amnesia Receipt, and Post-Implementation Checklist.
- Entrypoint size budgets and relative links across canonical, compiled, and installed guides.
- Fresh-package installation outside the package directory, preservation of the caller's build output, and idempotent memory initialization.
- Source heuristics, command dispatch, current evidence reports, and optional real-browser evaluation fixtures. Missing optional tooling is reported explicitly.

---

## Contributing

Suggestions, refinements, and new domain skills are welcome! Check out [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on skill structure and pull requests.

---

## License

[MIT](./LICENSE) — © 2026 DevMind contributors.
