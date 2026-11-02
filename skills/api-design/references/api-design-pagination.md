# API contracts: pagination

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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
