---
name: api-design
description: >-
  REST, GraphQL, and RPC API Architecture and Contract Design Standards.
  Activate when designing endpoints, authoring OpenAPI specifications, or structuring client/server contracts.
  Covers: semantic URI design (nouns, kebab-case, HTTP methods), RFC 7807 Problem Details error envelopes,
  code-first OpenAPI 3.1 generation from Zod, IETF Idempotency-Key header implementation with Redis caching,
  filtering, sorting, and keyset cursor query parameters, weak ETags (304 Not Modified),
  and timestamped HMAC-SHA256 webhook signatures.
trigger: model_decision
---

# API Architecture & Contract Design Standards

> **Scope**: External and internal web APIs — RESTful JSON, GraphQL, and typed RPC contracts.
> **Audience**: Coding agents authoring route handlers, OpenAPI schemas, client SDKs, or webhook integrations.
> **Standards Baseline**: Grounded in **OpenAPI 3.1**, **RFC 7807 (Problem Details for HTTP APIs)**, **RFC 7396 (JSON Merge Patch)**, and **IETF Draft Idempotency-Key**.
> **Cross-Reference**: Transport security, rate limiting, and token verification reference `security-standards` and `auth-patterns`.

---

## 0 - Before You Write: Interview the User

Before defining routes, designing schemas, or drafting API documentation, resolve contract requirements with the user in a single turn. Skip any item already answered by existing repository endpoints.

| # | Topic | ASK | Recommended Default |
|---|-------|-----|---------------------|
| 1 | API Paradigm | RESTful JSON, GraphQL (Pothos/Apollo), tRPC, or Hybrid? | RESTful JSON with OpenAPI 3.1 |
| 2 | Contract Definition | Code-first (Zod to OpenAPI), Spec-first (OpenAPI YAML), or Schema-first (GraphQL SDL)? | Code-first via Zod (`@asteasolutions/zod-to-openapi`) |
| 3 | Versioning Strategy | URL path (`/v1/`), Custom Header (`Accept-Version`), or Date-based (Stripe style)? | URL path prefix (`/api/v1/`) |
| 4 | Error Format | RFC 7807 Problem Details (`application/problem+json`) or standard envelope (`{ error }`)? | RFC 7807 Problem Details |
| 5 | Mutation Idempotency | Support `Idempotency-Key` header on critical write operations (billing, orders)? | Yes, on all payment and mutating state endpoints |
| 6 | Dynamic List Pagination & Filters | Offset-based (?page=1&pageSize=20) or Cursor-based (?cursor=...&limit=20)? What filters are required? | Offset-based for page-number UIs; Cursor-based for high-scale/infinite-scroll streams. Both require search/attribute filters. |
| 7 | Caching & Conditional Requests | HTTP ETags (`If-None-Match` returning `304 Not Modified`) or Cache-Control headers? | Weak ETags on high-traffic GET endpoints |

Echo back an **API architecture summary** for user confirmation before authoring route schemas.

---

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

## 3 - Code-First OpenAPI 3.1 Generation from Zod

Never manually hand-edit large OpenAPI YAML files. Derive OpenAPI specifications directly from your application's single source of truth: **Zod schemas**.

```typescript
// src/presentation/http/schemas/user-api.schema.ts
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
import { z } from 'zod';

extendZodWithOpenApi(z);

export const UserResponseDtoSchema = z.object({
  id: z.string().uuid().openapi({ example: '01927e1b-85d7-7000-8000-000000000001' }),
  email: z.string().email().openapi({ example: 'alex@example.com' }),
  fullName: z.string().min(2).openapi({ example: 'Alex Developer' }),
  role: z.enum(['admin', 'member', 'viewer']).openapi({ example: 'member' }),
  createdAt: z.string().datetime().openapi({ example: '2026-10-14T10:00:00.000Z' }),
}).openapi('UserResponseDto');

export const CreateUserRequestSchema = z.object({
  email: z.string().email().openapi({ example: 'sarah@example.com' }),
  fullName: z.string().min(2).openapi({ example: 'Sarah Connor' }),
  role: z.enum(['admin', 'member', 'viewer']).default('member'),
}).openapi('CreateUserRequest');
```

#### Generating the OpenAPI Registry & Spec
```typescript
// src/presentation/http/openapi-registry.ts
import { OpenAPIRegistry, OpenApiGeneratorV31 } from '@asteasolutions/zod-to-openapi';
import { UserResponseDtoSchema, CreateUserRequestSchema } from './schemas/user-api.schema';

export const registry = new OpenAPIRegistry();

// Register Security Scheme
registry.registerComponent('securitySchemes', 'CookieAuth', {
  type: 'apiKey',
  in: 'cookie',
  name: 'sid',
});

// Register Endpoint Route
registry.registerPath({
  method: 'post',
  path: '/api/v1/users',
  summary: 'Create a new user',
  description: 'Registers a new user within the organization and sends invitation.',
  security: [{ CookieAuth: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreateUserRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'User successfully created',
      content: {
        'application/json': {
          schema: UserResponseDtoSchema,
        },
      },
    },
    422: {
      description: 'Validation failed',
    },
  },
});

export function generateOpenApiSpec() {
  const generator = new OpenApiGeneratorV31(registry.definitions);
  return generator.generateDocument({
    openapi: '3.1.0',
    info: {
      title: 'DevMind Core API',
      version: '1.0.0',
      description: 'Production REST API specification generated from typed Zod definitions.',
    },
    servers: [{ url: 'https://api.example.com' }],
  });
}
```

---

## 4 - Idempotency & Safe Retries (`Idempotency-Key`)

Clients on mobile or unreliable networks frequently retry `POST` requests when a network timeout occurs, risking duplicate charges or double orders.

### 4.1 IETF Idempotency-Key Standard Workflow

```
Client                                      API Server / Redis
  |                                                  |
  |-- 1. POST /api/v1/payments --------------------->|
  |      (Idempotency-Key: d4a3-48b1)                |-- 2. Atomic check in Redis:
  |                                                  |      SET lock:d4a3-48b1 "PROCESSING" NX EX 120
  |                                                  |-- 3. Lock acquired: Execute payment logic
  |                                                  |-- 4. Store final status & body in Redis (24h)
  |<-- 5. 201 Created (Payment DTO) -----------------|
  |                                                  |
  |-- 6. Network drops! Client retries: ------------>|
  |      POST /api/v1/payments                       |-- 7. Key exists with cached response!
  |      (Idempotency-Key: d4a3-48b1)                |-- 8. Bypass business logic completely
  |<-- 9. 201 Created (Cached response replayed) ---|
```

### 4.2 Production Idempotency Middleware Implementation

```typescript
// src/presentation/http/middleware/idempotency.ts
import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../../../infrastructure/cache/redis';

export function idempotencyMiddleware(ttlSeconds = 86400) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to mutating requests with an Idempotency-Key header
    const key = req.headers['idempotency-key'] as string;
    if (!key || req.method !== 'POST') {
      return next();
    }

    const redisKey = `idempotency:${req.user?.id || 'anon'}:${key}`;

    // 1. Check if cached response exists
    const cached = await redisClient.get(redisKey);
    if (cached) {
      if (cached === 'PROCESSING') {
        // Request currently executing in another concurrent thread
        return res.status(409).json({
          title: 'Conflict',
          detail: 'A request with this idempotency key is actively being processed. Please retry in a few seconds.',
          retry_after: 2,
        });
      }

      // Replay cached response
      const { statusCode, headers, body } = JSON.parse(cached);
      res.set(headers);
      res.set('X-Cache-Lookup', 'HIT-IDEMPOTENT');
      return res.status(statusCode).send(body);
    }

    // 2. Acquire lock (NX = only set if not exists, EX = auto-expire in 2 minutes if crash occurs)
    const acquired = await redisClient.set(redisKey, 'PROCESSING', 'EX', 120, 'NX');
    if (!acquired) {
      return res.status(409).json({
        title: 'Conflict',
        detail: 'Concurrent request detected for this idempotency key.',
      });
    }

    // 3. Intercept response to cache on completion
    const originalSend = res.send.bind(res);
    res.send = (body: any) => {
      // Restore original send
      const result = originalSend(body);

      // Only cache successful or client validation outcomes (2xx, 4xx)
      if (res.statusCode < 500) {
        const payloadToCache = {
          statusCode: res.statusCode,
          headers: { 'content-type': res.get('content-type') },
          body: body.toString(),
        };
        redisClient.set(redisKey, JSON.stringify(payloadToCache), 'EX', ttlSeconds).catch(console.error);
      } else {
        // Server crashed: delete key so client can retry cleanly
        redisClient.del(redisKey).catch(console.error);
      }

      return result;
    };

    next();
  };
}
```

---

## 5 - Dynamic Lists: Mandatory Pagination & Filtering

### 5.0 Cardinal Rule: Dynamic List Endpoints Contract

**Any endpoint providing or querying a dynamically growing list or collection (e.g., users, transactions, audit logs, comments, events, messages, products) MUST support pagination and filters. Unbounded queries (`SELECT *` without limit or filtering) are strictly forbidden.**

The pagination strategy must be chosen based on the user's requirements:

| Strategy | When to Choose (User Ask) | Query Parameters | Response Envelope Structure | Trade-offs |
|----------|---------------------------|------------------|-----------------------------|------------|
| **Offset-based** | User needs page navigation (jump to page $N$), total row count (`totalPages`), and dataset size is small-to-medium. | `?page=1&pageSize=20` | `{ data: [...], pagination: { page: 1, pageSize: 20, total: 142, totalPages: 8 } }` | High ergonomics for UI pagination controls; performance degrades at large offsets ($> 50,000$ rows). |
| **Cursor-based (Keyset)** | User needs infinite scroll, real-time appending streams, or high-volume datasets where deep offset performance is critical. | `?cursor=eyJpZCI6...&limit=20` | `{ data: [...], pagination: { nextCursor: "...", hasMore: true } }` | Maximum query performance; immune to page drift; cannot jump to arbitrary page numbers. |

### 5.1 Query Parameter Syntax Standards

Every collection endpoint must define its supported filter and pagination parameters explicitly in its OpenAPI specification:

| Feature | Query Parameter Format | SQL / Processing Equivalent |
|---------|------------------------|-----------------------------|
| **Filtering (Attribute)** | `?status=active&role=admin` or `?filter[status]=active` | `WHERE status = 'active' AND role = 'admin'` |
| **Search Filter** | `?search=term` or `?q=term` | Full-text / ILIKE query over index-backed text columns |
| **Date Range Filter** | `?from=2026-01-01&to=2026-03-31` | `WHERE created_at BETWEEN :from AND :to` |
| **Sorting** | `?sort=-created_at,priority` | `ORDER BY created_at DESC, priority ASC` (minus prefix = DESC) |
| **Offset Pagination** | `?page=1&pageSize=20` | `OFFSET (page - 1) * pageSize LIMIT pageSize` (capped at max 100) |
| **Cursor Pagination** | `?cursor=eyJpZCI6MTIzfQ&limit=20` | `WHERE (created_at, id) < (:cursorCreatedAt, :cursorId) LIMIT 21` (via `db-standards`) |
| **Sparse Fieldsets** | `?fields=id,email,fullName` | `SELECT id, email, full_name` (avoids over-fetching) |
| **Relationship Embeds** | `?include=organization,profile` | Joins or batch loads associated child records |

### 5.2 Schemas & Response Contracts (Offset vs Cursor)

#### Option A: Offset-based Pagination Contract (When User Requests Page Numbers)

```typescript
import { z } from 'zod';

// Request query schema with mandatory pagination bounds and filters
export const OffsetListQuerySchema = z.object({
  page:     z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
  search:   z.string().trim().max(100).optional(),
  status:   z.enum(['active', 'archived', 'pending']).optional(),
  sort:     z.string().regex(/^-?[a-zA-Z_]+$/).default('-createdAt'),
});

export type OffsetListQuery = z.infer<typeof OffsetListQuerySchema>;

// Response envelope
export interface OffsetPaginatedResponse<T> {
  data: T[];
  pagination: {
    page:       number;
    pageSize:   number;
    total:      number;
    totalPages: number;
  };
}
```

#### Option B: Cursor-based Pagination Contract (When User Requests Streams / High-Scale)

```typescript
import { z } from 'zod';

// Request query schema with opaque cursor and filters
export const CursorListQuerySchema = z.object({
  cursor: z.string().trim().optional(), // base64url encoded keyset token
  limit:  z.coerce.number().int().positive().max(100).default(20),
  search: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'archived', 'pending']).optional(),
});

export type CursorListQuery = z.infer<typeof CursorListQuerySchema>;

// Response envelope
export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    hasMore:    boolean;
  };
}
```

---

## 6 - HTTP Caching, ETags & Conditional Requests

Every read-heavy API endpoint should support conditional HTTP requests to conserve bandwidth and minimize server compute.

```
Client                                                  API Gateway
  |                                                          |
  |-- 1. GET /api/v1/users/me ------------------------------>|
  |<-- 2. 200 OK (Body: {...}, ETag: W/"4f8a-9812") --------| (Stores ETag in local cache)
  |                                                          |
  |-- 3. GET /api/v1/users/me ------------------------------>|
  |      If-None-Match: W/"4f8a-9812"                        |-- 4. Calculate hash: unchanged!
  |<-- 5. 304 Not Modified (ZERO BODY) ---------------------| (Fastest possible response)
```

```typescript
// src/presentation/http/middleware/etag.ts
import crypto from 'node:crypto';
import { Request, Response, NextFunction } from 'express';

export function weakEtagMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return next();
  }

  const originalSend = res.send.bind(res);
  res.send = (body: any) => {
    if (res.statusCode === 200 && typeof body === 'string') {
      const hash = crypto.createHash('sha1').update(body).digest('hex');
      const etag = `W/"${hash.substring(0, 16)}"`;
      res.setHeader('ETag', etag);

      if (req.headers['if-none-match'] === etag) {
        res.status(304);
        return originalSend('');
      }
    }
    return originalSend(body);
  };

  next();
}
```

---

## 7 - Webhooks & Event Notification Standards

When emitting webhooks to external customers or receiving incoming webhooks:

### 7.1 Webhook Payload Standard
```json
{
  "id": "evt_01927e1b-85d7-7000-8000-000000000001",
  "event": "invoice.payment_succeeded",
  "created_at": "2026-10-14T11:00:00.000Z",
  "data": {
    "invoice_id": "inv_9841",
    "amount_cents": 4900,
    "currency": "USD",
    "customer_id": "cust_123"
  }
}
```

### 7.2 Cryptographic HMAC-SHA256 Signatures

Sign webhooks using a timestamped HMAC-SHA256 signature to protect against tampering and replay attacks (Stripe standard):

```typescript
// src/infrastructure/webhooks/webhook-signer.ts
import crypto from 'node:crypto';

export class WebhookSigner {
  static signPayload(payloadJson: string, secret: string): string {
    const timestamp = Math.floor(Date.now() / 1000);
    const signaturePayload = `${timestamp}.${payloadJson}`;
    const hmac = crypto
      .createHmac('sha256', secret)
      .update(signaturePayload)
      .digest('hex');

    return `t=${timestamp},v1=${hmac}`;
  }

  static verifySignature(payloadJson: string, header: string, secret: string, toleranceSeconds = 300): boolean {
    const parts = header.split(',');
    const timestampPart = parts.find((p) => p.startsWith('t='))?.split('=')[1];
    const signaturePart = parts.find((p) => p.startsWith('v1='))?.split('=')[1];

    if (!timestampPart || !signaturePart) return false;

    // 1. Replay attack verification (5-minute tolerance window)
    const timestamp = parseInt(timestampPart, 10);
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - timestamp) > toleranceSeconds) {
      return false;
    }

    // 2. Compute expected HMAC
    const expected = crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${payloadJson}`)
      .digest('hex');

    // 3. Constant-time comparison
    return crypto.timingSafeEqual(Buffer.from(signaturePart), Buffer.from(expected));
  }
}
```

---

## 8 - GraphQL API Architecture Standards

If building GraphQL APIs:
1. **Relay Connection Specification**: Structure paginated queries using `edges`, `node`, and `pageInfo` with opaque cursor strings.
2. **Dedicated Mutation Input and Payload Types**:
   Never accept loose arguments in mutations. Always require a single input argument (e.g. `updateUser(input: UpdateUserInput!): UpdateUserPayload!`).
3. **Query Complexity & Depth Limiting**: Protect against recursive query DoS attacks using `graphql-depth-limit` (Max depth: 6).

---

## 9 - Agent Execution Checklist

Before completing an API contract, route handler, or client SDK:

- [ ] All URIs use plural nouns in kebab-case; verbs eliminated from paths.
- [ ] Correct HTTP methods used (`GET` safe & idempotent; `PATCH` for partial; `PUT` for complete).
- [ ] Errors conform strictly to **RFC 7807 Problem Details** format (`application/problem+json`).
- [ ] Mutating operations (payment/orders) support the `Idempotency-Key` header with Redis caching.
- [ ] Any endpoint providing a dynamic growing list supports pagination and filtering (offset-based or cursor-based per user ask); zero unbounded queries.
- [ ] OpenAPI 3.1 specification automatically generated from Zod schemas.
- [ ] Webhooks signed with timestamped HMAC-SHA256; verification protects against 5-minute replay attacks.
- [ ] No stack traces or internal database column errors leaked to clients.
