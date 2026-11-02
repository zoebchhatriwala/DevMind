# Database changes: migrations

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 3 - Indexing Strategy & Query Optimization

Indexes accelerate read queries at the expense of write throughput (`INSERT`, `UPDATE`, `DELETE`) and disk storage. Every index must be justified by production query patterns.

### 3.1 Index Types & Selection Guide

| Index Type | Engine Support | Best For | Example Use Case |
|------------|----------------|----------|------------------|
| **B-Tree** (Default) | All (PG, MySQL, SQLite) | Equality (`=`), Range (`<`, `<=`, `>`, `>=`), Sorting (`ORDER BY`) | Primary keys, foreign keys, timestamps, emails |
| **GIN** (Generalized Inverted) | PostgreSQL | Arrays, Full-text search, JSONB containment (`@>`) | `tags text[]`, `payload jsonb`, `to_tsvector` |
| **BRIN** (Block Range Index) | PostgreSQL | Append-only massive tables sorted naturally by physical disk order | Millions of time-series event logs (`created_at`) |
| **Hash** | PostgreSQL, MySQL | Exact equality matches only (`=`) | Rare: B-Tree is usually preferable due to range support |
| **Partial Index** | PostgreSQL, SQLite | Filtering on a common query subset | `WHERE deleted_at IS NULL`, `WHERE status = 'FAILED'` |
| **Covering Index** (`INCLUDE`) | PostgreSQL | Index-Only Scans avoiding table heap lookups | Fetching `status`, `name` without touching table data |

### 3.2 The Golden Rules of Index Design

#### Rule 1: The Equality-First Compound Index Rule (ESR)
When creating a multi-column compound index for a query with equality filters, sorting, and range filters, order the index columns as:
1. **Equality columns** first (`status = 'PENDING'`)
2. **Sort columns** second (`ORDER BY created_at DESC`)
3. **Range columns** last (`price BETWEEN 10 AND 50`)

```sql
-- Query:
SELECT id, total_amount FROM orders
WHERE store_id = '123'
  AND created_at >= '2026-01-01'
ORDER BY created_at DESC;

-- OPTIMAL COMPOUND INDEX: (equality column first, then sort/range column)
CREATE INDEX idx_orders_store_created
ON orders (store_id, created_at DESC);

-- INEFFICIENT (Range column first prevents index from being used for equality filter on store_id):
-- CREATE INDEX idx_orders_created_store ON orders (created_at DESC, store_id);
```

#### Rule 2: Use Covering Indexes with `INCLUDE` to Achieve Index-Only Scans
If a query runs millions of times per hour, avoid hitting the table heap entirely by including the fetched columns inside the index leaf nodes:

```sql
-- Query fetches id, user_id, and total_cents filtered by status
SELECT id, user_id, total_cents
FROM transactions
WHERE status = 'SETTLED' AND processed_at >= '2026-10-01';

-- COVERING INDEX:
-- Key columns (status, processed_at) are ordered in B-tree;
-- Payload columns (user_id, total_cents) are stored in leaves without increasing B-tree depth
CREATE INDEX idx_tx_status_processed_covering
ON transactions (status, processed_at)
INCLUDE (user_id, total_cents);
```

#### Rule 3: Use Partial Indexes for Skewed Distributions
Never index millions of rows if only 1% are queried:

```sql
-- If 99% of jobs are 'COMPLETED' and only 1% are 'PENDING' or 'FAILED':
CREATE INDEX idx_jobs_pending_or_failed
ON background_jobs (scheduled_at)
WHERE status IN ('PENDING', 'RETRYING');
-- Index size is 99% smaller, inserts on completed jobs do not update the index!
```

### 3.3 Query Anti-Patterns & Diagnosing with `EXPLAIN (ANALYZE, BUFFERS)`

Always run `EXPLAIN (ANALYZE, BUFFERS)` on slow queries before guessing.

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM users WHERE LOWER(email) = 'alex@example.com';
```

**What to look for in the execution plan**:
- ? **Seq Scan (Sequential Scan)** on large tables: Indicates a missing index or an un-indexable predicate.
- ? **High Shared Hit / Read Buffers**: Database is reading thousands of 8KB disk pages from memory or storage.
- ? **Filter removed rows (e.g., Rows Removed by Filter: 994820)**: Scanned an entire table or index only to discard almost everything.
- ? **Index Only Scan**: Fetched data purely from RAM index pages; zero heap reads.
- ? **Bitmap Index Scan + Bitmap Heap Scan**: Efficiently combined multiple indexes or ranged lookups.

#### Common Anti-Patterns and Fixes:
```sql
-- ANTI-PATTERN 1: Function call wrapping the indexed column
-- Breaks standard B-Tree index on 'email'
SELECT id FROM users WHERE LOWER(email) = 'user@company.com';

-- FIX: Create an expression index
CREATE INDEX idx_users_lower_email ON users (LOWER(email));


-- ANTI-PATTERN 2: Leading wildcard in text search (Forces full table scan)
SELECT id FROM products WHERE sku LIKE '%9481';

-- FIX: Use reverse text index, full-text search (tsvector), or trigram index (pg_trgm)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_products_sku_trgm ON products USING GIN (sku gin_trgm_ops);


-- ANTI-PATTERN 3: Implicit Type Coercion
-- If user_id is a VARCHAR/TEXT, passing an integer forces database to cast every row
SELECT * FROM accounts WHERE account_number = 100482; -- Slow seq scan
SELECT * FROM accounts WHERE account_number = '100482'; -- Fast index scan
```

---
