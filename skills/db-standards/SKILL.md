---
name: db-standards
description: >-
  Design or modify database schemas, migrations, ORM models, indexes, queries, and transactions. Preserve the database engine and established migration workflow.
---

# Database changes

## 🚨 Pre-Flight Gate

Inspect the schema, migration history, query callers, tenant ownership, expected volume, and existing ORM helpers. For new storage architecture, resolve access patterns, consistency, retention, and deployment constraints before choosing a schema. Never infer that a migration is safe from its syntax alone.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Use the existing ORM/query builder or parameterized driver. Validate external values before queries and enforce authorization and tenant scope. Keep database credentials server-side; verify database policies when clients query directly.
- Put invariants in appropriate NOT NULL, UNIQUE, CHECK, and foreign-key constraints. Index actual access paths; inspect query plans and write costs before adding speculative indexes.
- For deployed data, prefer expand, backfill, switch, and contract phases. Inspect locking and old/new application compatibility. Destructive changes and production execution require the user's authorization.
- Keep related writes atomic and transactions short. Use atomic updates or concurrency control for contested state; handle uniqueness races and retries without duplicating effects.
- Avoid N+1 reads, unbounded results, and unnecessary columns. Preserve stable pagination and connection limits. Use a consistent numeric representation for money and timezone-aware date handling.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [schema and modeling](./references/db-standards-schema-and-modeling.md)
- [migrations](./references/db-standards-migrations.md)
- [queries and indexes](./references/db-standards-queries-and-indexes.md)
- [transactions](./references/db-standards-transactions.md)
- [connections and pagination](./references/db-standards-connections-and-pagination.md)
- [testing](./references/db-standards-testing.md)
- [security and operations](./references/db-standards-security-and-operations.md)

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: db-standards/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Run existing migration/schema checks against an isolated database where available. Exercise the changed query and a constraint or concurrency failure. Record untested locking, production volume, and rollback assumptions.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.
