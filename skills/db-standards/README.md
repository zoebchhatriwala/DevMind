# db-standards

> Database and Migration Standards for fullstack projects.

## What it does

When activated, this skill instructs the agent to:

1. **Interview you** for database engine (PostgreSQL, MySQL, SQLite, Mongo), ORM/data access layer, migration framework, tenancy model, and connection pooler.
2. Design schemas using **consistent naming conventions**, optimal primary keys (UUIDv7 or BigInt identity), and time-zone aware `TIMESTAMPTZ`.
3. Model soft deletes safely using **partial unique indexes** (`WHERE deleted_at IS NULL`) or append-only audit patterns.
4. **Never hand-type migrations when an auto-generating framework exists**: Always edit schema definitions first, run the framework generator (`drizzle-kit generate`, `prisma migrate dev --create-only`), and inspect the generated migration for safety.
5. Execute zero-downtime migrations following the **Expand-Contract pattern**, avoiding table locks on high-volume production tables.
6. Create indexes safely using `CREATE INDEX CONCURRENTLY` and design compound indexes according to the **Equality-Sort-Range (ESR)** rule.
7. Enforce **Keyset / Cursor pagination** for large lists, eliminating the $O(N)$ performance degradation and row skipping of `OFFSET`.
8. Prevent the **N+1 query problem** through explicit relational batching, joins, and DataLoader patterns.
9. Enforce transactional consistency with **proper isolation levels**, optimistic locking (`version` column), and lock-free job queues (`SKIP LOCKED`).
10. Prevent catastrophic connection pool exhaustion with **PgBouncer / RDS Proxy** configurations and serverless-safe adapters.
11. Implement **deterministic, idempotent database seeds** and isolated test databases using Docker Testcontainers.
12. Apply **least-privilege database user roles** (migration DDL owner vs runtime DML only vs read-only analytics).
13. Audit slow queries using `pg_stat_statements` and monitor table bloat / autovacuum health.

## Sections

| Sec | Topic |
|-----|-------|
| 0   | User interview (engine, ORM, migration tool, tenancy, pooler) |
| 1   | Schema architecture & data modeling (naming, PKs, timestamps, soft delete, JSONB, RLS multi-tenancy) |
| 2   | Safe schema evolution & zero-downtime migrations (Expand-Contract, CONCURRENTLY, batch backfills) |
| 3   | Indexing strategy & query optimization (B-Tree, GIN, BRIN, ESR rule, covering indexes, EXPLAIN ANALYZE) |
| 4   | Pagination & high-performance data fetching (keyset vs offset, eliminating N+1 queries) |
| 5   | Transactions, concurrency & locking (isolation levels, optimistic vs pessimistic, SKIP LOCKED, deadlock prevention) |
| 6   | Connection pooling, scalability & serverless (pool math, PgBouncer modes, edge/serverless, read replicas) |
| 7   | ORM & query builder standards (Drizzle ORM patterns, Prisma patterns, schema organization) |
| 8   | Data integrity, foreign keys & constraints (cascade rules, check constraints, math invariants) |
| 9   | Seeding, test isolation & fixtures (idempotent seeds, Testcontainers integration testing) |
| 10  | Database security, auditing & access control (least-privilege roles, audit logs, RLS) |
| 11  | Operations, maintenance & observability (pg_stat_statements, slow query profiling, autovacuum tuning) |
| 12  | Agent execution checklist (pre-DDL checklist, pre-query checklist) |

## Works well with

- `be-standards`  -  backend engineering; coordinates repository layer with database schema standards
- `security-standards`  -  all security rules; references for database encryption, secrets, and OWASP ASVS V8/V5
- `fe-standards`  -  frontend engineering; consumes cursor pagination contracts defined by the database layer
