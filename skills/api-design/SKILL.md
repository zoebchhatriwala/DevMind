---
name: api-design
description: >-
  Design or change REST, GraphQL, or RPC contracts, route handlers, pagination, error responses, idempotency, and webhooks. Use the established API style.
---

# API contracts

## 🚨 Pre-Flight Gate

Inspect callers, route registration, authentication, input schemas, response types, and API tests. A patch preserves existing wire contracts unless the requested fix requires a documented change. For a new API, resolve consumers, authority, compatibility, and failure semantics before choosing endpoints.

Inspect first: callers, existing helpers, dependencies, project instructions, and applicable tests. For a patch, infer stack decisions without an interview. For genuinely new architecture, ask only consequential unresolved questions with recommended defaults. Use `inspect.mjs <project> --json` from the installed skill's `scripts/`, the project's `.devmind/scripts/`, or this repository's root `scripts/`; verify the path first.

## ⚡ Golden Patterns

- Use resource-oriented HTTP methods and status codes for REST; retain typed procedures or schema conventions for RPC and GraphQL. Do not impose REST layers on another API style.
- Validate body, query, parameters, and headers at the boundary. Check identity, permission, and object ownership before mutation. Return an allowlisted response and client-safe errors using the existing problem-details convention.
- Bound page sizes and expensive filters. Use stable pagination ordering. Preserve the existing offset/cursor contract; do not migrate pagination styles without a requirement.
- For retryable side effects, scope idempotency to the authenticated actor and operation, bind the key to the request, handle concurrent attempts atomically, and define expiration and replay behavior.
- Verify webhook signatures over raw bytes before parsing or acting; defend against replay and duplicate delivery. Use existing schema-driven contract generation instead of duplicating types.

## Topic references

The gates above are sufficient for small changes. Read a reference only when the task needs its examples; search headings and read the relevant slice. Existing framework conventions and these gates take precedence over example scaffolding.

- [resources and errors](./references/api-design-resources-and-errors.md)
- [openapi](./references/api-design-openapi.md)
- [idempotency](./references/api-design-idempotency.md)
- [pagination](./references/api-design-pagination.md)
- [caching](./references/api-design-caching.md)
- [webhooks](./references/api-design-webhooks.md)
- [graphql](./references/api-design-graphql.md)

## 🔍 Anti-Amnesia Receipt

Print once in the initial implementation update, using checks actually inspected:

`🧠 [DevMind: api-design/<tier> | Checked: <three concrete checks>]`

## ✅ Post-Implementation Checklist

Check a valid request, invalid input, unauthorized access, and the relevant boundary or retry failure. Check existing callers and generated contracts for compatibility.

Run the existing relevant quality gates and a runnable check for changed non-trivial logic. Review the diff for extra abstractions, dependencies, duplicate state, and weakened controls. Use `verify.mjs <project> --json` as supporting evidence, not proof. Keep task/handover notes concise; finish with the outcome, actual check results, and material gaps.
