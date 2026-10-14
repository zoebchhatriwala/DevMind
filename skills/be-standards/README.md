# be-standards

> Backend Engineering Standards for fullstack projects.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for runtime, framework, ORM, API style, auth, testing, and logging decisions.
2. Scaffold a **clean architecture** (router / controller / service / repository) with enforced dependency direction.
3. Validate all input through **Zod middleware** at every route entry point.
4. Wire a **typed error hierarchy** with a global error handler that never leaks internals.
5. Return all responses as **explicit DTOs**  -  no raw ORM objects.
6. Paginate all list endpoints with a **shared PaginationQuerySchema**.
7. Add **authenticate + authorize + validate** middleware on every route, in the correct order.
8. Set up **structured logging (pino)** with secret redaction and correlation IDs.
9. Write **co-located Vitest + Supertest tests** against a real test database, covering all HTTP status codes and authorization boundaries.
10. Generate an **OpenAPI spec** from Zod schemas for every endpoint.
11. Apply the **backend security checklist** and reference security-standards for cross-cutting controls.

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (tech-stack selection) |
| 1   | Project and file structure (clean architecture) |
| 2   | Standardized code (TypeScript, naming, style) |
| 3   | Configuration (Zod-validated, fail-fast) |
| 4   | Validation (Zod at every entry point) |
| 5   | Routing and controllers |
| 6   | Service layer (business logic, DTOs) |
| 7   | Repository layer (data access only) |
| 8   | Typed error system and global error handler |
| 9   | Authentication and authorization middleware |
| 10  | Pagination |
| 11  | Structured logging (pino) |
| 12  | Database patterns (migrations, transactions) |
| 13  | Testing (Vitest + Supertest + real DB) |
| 14  | OpenAPI documentation |
| 15  | Code documentation |
| 16  | Resilience patterns |
| 17  | Clean code standards |
| 18  | Security (references security-standards) |

## Works well with

- security-standards  -  all security rules; this skill references it throughout
- fe-standards  -  frontend counterpart; shares Zod schemas for type-safe client/server contracts
- `db-standards`  -  database schema design, index strategy, migration patterns
- `api-design`  -  REST and GraphQL API contract design
