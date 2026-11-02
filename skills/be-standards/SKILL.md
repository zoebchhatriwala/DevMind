---
name: be-standards
description: >-
  Implement or review backend services, business logic, jobs, queues, caching, and server errors. Preserve the existing runtime and framework architecture.
---

# Backend changes

## 🚨 Pre-Flight Gate

Trace the caller, domain operation, data access, and error path. Identify the existing validator, logger, and tests. CLI scripts use standard output for results and standard error for diagnostics; do not add server middleware or logging packages to a CLI.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Keep HTTP concerns at the transport boundary and business rules testable. In Next.js actions, Remix, Hono, or tRPC, prefer the existing colocated handler. In layered servers, follow their current controller/service boundaries. Add a repository only when it removes real duplication or isolates an existing data boundary.
- Validate external input before use with the existing runtime schema tools. Keep strict types, bound dynamic lists and work queues, and parameterize queries. Do not hide unsafe data behind assertions.
- Use the existing structured logger with correlation IDs and secret redaction. Return client-safe errors; handle rejected work and preserve retry/cancellation behavior. Bound timeouts, retries, concurrency, and shutdown work.
- For durable jobs and events, define commit/acknowledgment, duplicate delivery, abandoned-work recovery, and terminal failure behavior using the existing queue or database. Add an outbox only when database writes and event publication must survive a partial failure together.
- Reuse runtime and framework primitives before packages. Do not require classes, DTO wrappers, a named constant for every literal, or extra interfaces for a single implementation.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [architecture](./references/be-standards-architecture.md)
- [validation and config](./references/be-standards-validation-and-config.md)
- [http and errors](./references/be-standards-http-and-errors.md)
- [auth and security](./references/be-standards-auth-and-security.md)
- [data and pagination](./references/be-standards-data-and-pagination.md)
- [logging, retries, and durable jobs/events](./references/be-standards-logging-and-resilience.md)
- [tests and documentation](./references/be-standards-tests-and-documentation.md)

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: be-standards/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Exercise the changed operation and one meaningful failure or boundary case. For shared functions, verify the affected callers. Run relevant existing lint/type/test checks and inspect emitted errors for private data.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.
