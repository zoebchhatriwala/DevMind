# AI Coding Agent: Pre-Implementation, Simplicity, Security & Feedback Standards

> **Universal Engineering Baseline**: These standards apply universally across all domains, features, and skills (`fe-standards`, `be-standards`, `security-standards`, `db-standards`, `auth-patterns`, `deployment`, `api-design`, `ai-standards`).  
> **Audience**: All coding agents and engineers planning, writing, modifying, reviewing, or verifying code.  
> **Final Principle**: Build the smallest secure, correct, reusable, and maintainable solution that satisfies the requirement. Inspect before creating, verify before trusting, and use every implementation and review cycle to improve the quality of the system.

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

<EXECUTION_RULE>
### CRITICAL PROTOCOL FOR ALL CODING AGENTS:
1. **STOP BEFORE CODING**: Identify every domain and skill touched by the user's request. (e.g. A prompt to "Add user profile endpoint with database migration and React form" touches `db-standards`, `be-standards`, `api-design`, and `fe-standards`).
2. **LOAD SKILLS FIRST**: Read the corresponding `skills/<domain>/SKILL.md` file(s) BEFORE writing or modifying any code.
3. **PRINT RECEIPT**: Output `🧠 [DevMind Active: <loaded-skills>]` at the very top of your initial plan or implementation response.
4. **NO COMPROMISE**: Never bypass or skip a skill to save time or tokens. Enforce every Pre-Flight Gate and Golden Pattern.
</EXECUTION_RULE>

---

## 0. Operating Modes: Greenfield vs. Incremental Modification

Coding agents MUST determine their operating mode before taking any action:

### Mode A: Greenfield / New Architecture (Scaffolding)
- **Scope**: Creating a new repository, service, major subsystem, or greenfield feature where architectural decisions are uncommitted.
- **Protocol**: Conduct the relevant domain skill's Section 0 interview in a single, friendly turn. Present recommended defaults. Await user confirmation before authoring files.

### Mode B: Incremental Modification / Patch (Bugfix, Refactor, or Feature Extension)
- **Scope**: Modifying, extending, or fixing existing code in an established project.
- **Protocol**: **DO NOT** run the Section 0 interview. Automatically inspect the repository to identify existing stack decisions, frameworks, and conventions.
- **Non-Negotiable Invariant**: Skipping the interview does **NOT** waive any quality standards. All simplicity (YAGNI), typing, security, error handling, and verification requirements strictly apply to every modified or newly introduced line of code.

---

## 1. Mandatory Pre-Coding Review

Before writing or modifying any code, the AI agent **MUST** evaluate the proposed solution against the following questions:

### A. Simplicity and Overengineering
- Is this implementation unnecessarily complex or overengineered?
- Can the requirement be fulfilled with a simpler, more readable, and maintainable solution?
- Can an existing language feature, standard library function, framework capability, or established design pattern solve the problem?
- Am I introducing unnecessary abstractions, classes, interfaces, layers, wrappers, configuration, or design patterns?
- Is every part of the proposed implementation necessary to satisfy an actual requirement?

> **Rule:** Prefer the simplest solution that meets functional, security, performance, and maintainability requirements. Do not introduce complexity without a clear, measurable benefit.

### B. Existing Functionality and Reusability
- Does equivalent functionality already exist in the codebase, framework, shared utilities, or existing components?
- Can an existing function, service, module, component, hook, helper, or utility be reused or extended?
- Does the proposed implementation duplicate existing business logic or functionality?
- Can the solution use a standard, reusable function instead of creating a specialized implementation?
- Will the abstraction provide genuine reuse, or is it being introduced for a hypothetical future requirement?

> **Rule:** Inspect the existing system before creating new functionality. Reuse established implementations where appropriate. Avoid duplicate logic and unnecessary abstractions.

### C. Dependency and Library Evaluation
Before introducing a new dependency, the agent **MUST** determine:

- Is the dependency genuinely necessary?
- Can the requirement be implemented using built-in language features, existing project dependencies, or a small amount of clear, maintainable code?
- Would replacing the dependency create more maintenance, security, correctness, or compatibility risks than retaining it?
- Is the library widely used or otherwise demonstrably trustworthy, actively maintained, supported, and compatible with the project?
- Is the library compatible with the project's runtime, framework, license requirements, and deployment environment?
- Are there known vulnerabilities, unresolved security issues, abandoned releases, or risky transitive dependencies?
- Is the selected version a suitable, supported release?

> **Rule:** Do not add a library when a simpler built-in or existing solution is sufficient. Do not reject a library solely because it can be replaced with a few lines of code. Compare the complete maintenance, correctness, security, and operational costs.

### D. Dependency Currency and Compatibility
- Inspect the project's current dependency manifest and lockfile.
- Identify outdated, deprecated, unsupported, or vulnerable dependencies relevant to the change.
- Check current stable releases and official security advisories when reliable sources are available.
- Prefer supported, compatible versions and apply security updates where appropriate.
- Verify peer dependencies, transitive dependencies, runtime requirements, and breaking changes before upgrading.
- Preserve reproducible builds through the project's package manager and lockfile.

> **Rule:** Keep dependencies current within supported compatibility constraints. Do not blindly upgrade every dependency to its newest version. Never claim that all dependencies are up to date unless this has been verified.

### E. Security and Vulnerability Prevention
The agent **MUST** assess both newly written code and dependencies for security risks, including:

- Injection vulnerabilities and unsafe input handling.
- Authentication and authorization failures.
- Insecure access to sensitive data.
- Secrets, credentials, or tokens exposed in code, logs, or configuration.
- Vulnerable direct or transitive dependencies.
- Unsafe deserialization, file handling, network requests, and cryptographic implementations.
- Race conditions, resource exhaustion, and missing limits where relevant.
- Insecure defaults, excessive permissions, and unnecessary attack surface.
- UI-specific risks, including cross-site scripting, unsafe HTML rendering, and client-side-only authorization.

Use established security controls and libraries when appropriate. Never invent cryptography or weaken an existing security control to simplify implementation.

> **Rule:** Do not knowingly introduce code or dependencies with unresolved, relevant vulnerabilities. If a vulnerability cannot be safely resolved, clearly document the risk, affected functionality, and required mitigation. Do not claim the system is vulnerability-free solely because automated scans pass.

---

## 2. Implementation Standards

Once the pre-coding review is complete:

1. **Implement only what the requirement needs** — avoid speculative features or YAGNI bloat.
2. **Follow existing architecture, naming conventions, formatting rules, and design patterns.**
3. **Prefer readable, idiomatic, maintainable code** over clever or excessively generic implementations.
4. **Reuse existing functions and components** where appropriate.
5. **Keep changes focused** and avoid unrelated refactoring.
6. **Preserve existing functionality, contracts, permissions, and data integrity.**
7. **Add abstractions only when they solve a demonstrated problem** (Rule of Three).
8. **Handle errors, edge cases, and resource limits explicitly.**
9. **Add or update tests** that verify the intended behavior and relevant failure scenarios.
10. **Document meaningful design decisions, security assumptions, and unavoidable trade-offs.**
11. **Anchor to affirmative templates over training priors**: Actively consult the concrete code patterns in the active skill (e.g., RFC 7807 problem details, Pino structured logging, WCAG states) rather than reverting to statistical default implementations.
12. **Mitigate context drift on long tasks**: Re-verify the active changes against the skill's execution checklist before concluding, ensuring secondary constraints were not dropped during execution.

---

## 3. Mandatory Verification Before Completion

After implementation, the agent **MUST**:

- Run relevant formatting, linting, type-checking, and automated tests.
- Verify the actual behavior against the original requirements.
- Review the change for duplicated logic, unnecessary complexity, and unrelated modifications.
- Check dependency changes and relevant vulnerability advisories.
- Run applicable security scanners and review their findings (`npm audit`, Trivy, Gitleaks).
- Verify backward compatibility and migrations where relevant.
- Confirm that errors and failure paths are handled correctly.
- Report which checks passed, failed, were skipped, or could not be run.

> **Crucial Rule:** A check must never be reported as successful unless it was actually executed and its result was verified.

---

## 4. Continuous Feedback and Improvement Loop

The agent **MUST** use a structured feedback loop for every task:

$$\text{Understand} \longrightarrow \text{Inspect} \longrightarrow \text{Evaluate} \longrightarrow \text{Implement} \longrightarrow \text{Verify} \longrightarrow \text{Review} \longrightarrow \text{Learn}$$

### Step 1: Understand
Identify the requirement, acceptance criteria, constraints, and expected behavior.

### Step 2: Inspect
Examine the relevant code, existing utilities, architecture, tests, dependency manifests, and project conventions.

### Step 3: Evaluate
Compare the simplest viable solutions. Assess reuse, complexity, dependencies, compatibility, security, and maintenance cost.

### Step 4: Implement
Choose the smallest safe change that satisfies the requirement.

### Step 5: Verify
Run appropriate tests and quality checks. Investigate failures rather than hiding, bypassing, or weakening checks.

### Step 6: Review
Compare the final implementation with the original plan. Remove unnecessary code and address identified defects.

### Step 7: Learn
Capture recurring failures, confirmed fixes, architectural decisions, and useful project conventions in the appropriate project documentation, tests, or agent instructions. Avoid recording secrets or unverified assumptions.

Use feedback to improve subsequent changes. Do not repeat known mistakes, and do not automatically apply a previous fix when the current context differs.

---

## 5. Required Decision Record

For non-trivial changes, provide a concise summary of:

- **Simplicity:** Why the solution is not unnecessarily complex.
- **Reuse:** Which existing functionality was reused or why new functionality was needed.
- **Dependencies:** Why each new or materially changed dependency is justified.
- **Security:** What relevant security risks and vulnerability checks were considered.
- **Testing:** Which checks were actually run and their results.
- **Trade-offs:** Any unresolved limitations, compatibility concerns, or accepted risks.

For trivial changes, keep the record proportionate. Do not create unnecessary documentation for a one-line fix.

---

## 6. Non-Negotiable Rules

- **MUST** inspect before implementing.
- **MUST** prefer the simplest maintainable solution.
- **MUST** reuse existing functionality when appropriate.
- **MUST** justify new abstractions and dependencies.
- **MUST** verify dependency support, compatibility, and relevant security status.
- **MUST NOT** knowingly introduce unresolved, relevant vulnerabilities.
- **MUST NOT** perform blind dependency upgrades.
- **MUST NOT** bypass tests or security checks to force a passing result.
- **MUST NOT** claim unverified checks, fixes, or security guarantees.
- **MUST** preserve the project's established conventions unless a justified improvement is required.
- **MUST** communicate blockers, uncertainty, and residual risks honestly.
