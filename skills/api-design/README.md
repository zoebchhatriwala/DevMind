# api-design

> REST, GraphQL, and RPC API Architecture and Contract Design Standards.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for API paradigm (REST, GraphQL, tRPC), contract definition approach, versioning strategy, and error format.
2. Structure RESTful URIs with **semantic resource modeling** (plural nouns in kebab-case, proper HTTP method verbs, shallow sub-resource nesting).
3. Standardize on **RFC 7807 / RFC 9457 Problem Details** (`application/problem+json`) for all error responses.
4. Generate **OpenAPI 3.1 specifications code-first directly from Zod schemas** (`@asteasolutions/zod-to-openapi`), keeping schemas and documentation synchronized.
5. Implement the **IETF `Idempotency-Key` header** with atomic Redis locks and response caching to prevent duplicate mutating operations.
6. Enforce **mandatory pagination and filters on all dynamic lists** (offset-based or cursor-based per user ask; zero unbounded queries).
7. Support **weak ETags and conditional HTTP requests** (`If-None-Match` $\rightarrow$ `304 Not Modified`) for high-throughput read operations.
8. Implement **HMAC-SHA256 timestamped webhook signatures** with replay attack mitigation windows.
9. Enforce **Relay connection specifications** and query depth limits for GraphQL schemas.

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (paradigm, contract source, versioning, error format) |
| 1   | Resource modeling & semantic URI design (nouns not verbs, method semantics) |
| 2   | HTTP status codes & error envelopes (RFC 7807 Problem Details) |
| 3   | Code-first OpenAPI 3.1 generation from Zod (type-safe specs) |
| 4   | Idempotency & safe retries (Idempotency-Key header, Redis caching) |
| 5   | Dynamic lists: mandatory pagination & filtering (offset vs cursor schemas) |
| 6   | HTTP caching, ETags & conditional requests (304 Not Modified) |
| 7   | Webhooks & event notification standards (HMAC-SHA256 timestamped signatures) |
| 8   | GraphQL API architecture standards (Relay connections, depth limits) |
| 9   | Agent execution checklist (contract validation checklist) |

## Works well with

- `be-standards`  -  backend engineering; implements the controllers and routes conforming to API contracts
- `fe-standards`  -  frontend engineering; consumes OpenAPI specs to generate fully typed client SDKs
- `security-standards`  -  security compliance; verifies API transport security and OWASP API Top 10
- `db-standards`  -  database patterns; aligns cursor pagination query contracts with database index strategy
