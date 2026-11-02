# API contracts: resources and errors

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 1 - Resource Modeling & Semantic URI Design (REST)

### 1.1 URI Hierarchy & Naming Conventions

1. **Nouns, never verbs**: URIs identify resources, not actions. HTTP methods dictate the action.
   - [NO] `POST /api/v1/getUser` $\rightarrow$ [YES] `GET /api/v1/users/:id`
   - [NO] `POST /api/v1/cancelOrder` $\rightarrow$ [YES] `POST /api/v1/orders/:id/cancellation` or `PATCH /api/v1/orders/:id`
2. **Plural nouns for collections**: `/api/v1/organizations`, `/api/v1/invoices`.
3. **Kebab-case for multi-word paths**: `/api/v1/payment-methods`, `/api/v1/audit-logs`.
4. **Sub-resource nesting (Maximum 2 levels deep)**:
   - [YES] `/api/v1/organizations/:orgId/members` (Relationship is strictly scoped to parent)
   - [NO] `/api/v1/organizations/:orgId/projects/:projectId/tasks/:taskId/comments` (Too deeply nested)
   - [YES] Flatten after top level: `/api/v1/tasks/:taskId/comments`

### 1.2 HTTP Methods & Semantic Intent

| Method | Idempotent | Safe | Request Body | Response on Success |
|--------|:----------:|:----:|:------------:|---------------------|
| **`GET`** | Yes | Yes | Prohibited | `200 OK` with resource or collection |
| **`POST`** | No | No | Required | `201 Created` with `Location` header, or `200 OK` |
| **`PUT`** | Yes | No | Required | `200 OK` or `204 No Content` (Complete entity replacement) |
| **`PATCH`** | No / Yes | No | Required | `200 OK` (Partial update; delta only) |
| **`DELETE`**| Yes | No | Rare / Optional | `204 No Content` (or `200 OK` with status) |
| **`HEAD`** | Yes | Yes | Prohibited | `200 OK` with headers only (No body) |
| **`OPTIONS`**| Yes | Yes | Prohibited | `204 No Content` with `Allow` headers (CORS) |

---

## 2 - HTTP Status Codes & Error Envelopes

### 2.1 Standard Status Codes

| Code | Meaning | When to Use |
|------|---------|-------------|
| **200 OK** | Success | Standard response for `GET`, `PATCH`, or `PUT` |
| **201 Created** | Resource Created | Successful `POST` creating an entity. Return `Location: /api/v1/users/123` |
| **202 Accepted** | Queued for Processing | Asynchronous background jobs (e.g., video rendering, CSV export) |
| **204 No Content** | Success, No Body | Successful `DELETE` or state action returning zero response body |
| **304 Not Modified** | Cache Valid | Conditional request matched ETag (`If-None-Match`); body omitted |
| **400 Bad Request** | Malformed Syntax | Invalid JSON syntax, unparseable headers |
| **401 Unauthorized** | Missing / Invalid Auth | Missing Bearer token, expired session cookie |
| **403 Forbidden** | Authenticated but Denied | Authenticated user lacks required permission or role |
| **404 Not Found** | Resource Missing | Non-existent URI or entity (or to mask entity existence for IDOR) |
| **409 Conflict** | State Conflict | Duplicate unique constraint, version mismatch (optimistic lock failure) |
| **422 Unprocessable** | Semantic Validation Failed | Zod schema validation errors (valid JSON, invalid domain values) |
| **429 Too Many Requests** | Rate Limit Exceeded | Exceeded allowed requests; include `Retry-After: 60` header |
| **500 Internal Error** | Server Crash | Unhandled exceptions; never leak stack traces to client |
| **503 Unavailable** | Maintenance / Overload | Database down or server shutting down |

### 2.2 RFC 7807 Problem Details (The Universal Error Standard)

All client and server errors must follow the **RFC 7807 / RFC 9457 Problem Details** specification with `Content-Type: application/problem+json`.

```json
{
  "type": "https://api.devmind.dev/errors/validation-error",
  "title": "Unprocessable Content",
  "status": 422,
  "detail": "The payload contains 2 invalid fields.",
  "instance": "/api/v1/organizations/org_99/members",
  "invalid_params": [
    {
      "name": "email",
      "reason": "Must be a valid email address with active domain"
    },
    {
      "name": "role",
      "reason": "Must be one of: 'admin', 'member', 'viewer'"
    }
  ]
}
```

```typescript
// src/presentation/http/errors/problem-details.ts
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  invalid_params?: Array<{ name: string; reason: string }>;
}
```

---
