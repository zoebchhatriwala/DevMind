# Database changes: transactions

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 5 - Transactions, Concurrency & Locking

### 5.1 Isolation Levels: Practical Application

| Isolation Level | Dirty Read | Non-Repeatable Read | Phantom Read | Serialization Anomaly | Default In | Best For |
|-----------------|------------|---------------------|--------------|-----------------------|------------|----------|
| **Read Committed** | Prevented | Allowed | Allowed | Allowed | PostgreSQL, Oracle, SQL Server | 95% of standard web OLTP queries |
| **Repeatable Read** | Prevented | Prevented | Prevented (in PG snapshot) | Allowed | MySQL InnoDB | Accurate multi-query reporting snapshots |
| **Serializable** | Prevented | Prevented | Prevented | Prevented | None (must opt-in) | Critical financial ledger debits / credit balances |

> [!IMPORTANT]
> If using `SERIALIZABLE` isolation in PostgreSQL, the application tier **must** catch 40001 serialization failure errors and automatically retry the transaction with jittered exponential backoff.

### 5.2 Optimistic Locking vs Pessimistic Locking

#### Pattern A: Optimistic Locking (High concurrency, low conflict rate)
Use an incrementing `version` integer column. No locks are held during user thinking time.

```sql
-- Table schema has version integer
ALTER TABLE products ADD COLUMN version INT NOT NULL DEFAULT 1;

-- Update only succeeds if version matches what client read:
UPDATE products
SET stock_count = stock_count - 1,
    version = version + 1
WHERE id = 'prod_123'
  AND version = 4;

-- If rows affected == 0, another user modified the record!
-- Application throws ConcurrencyConflictException (HTTP 409).
```

#### Pattern B: Pessimistic Locking (`SELECT FOR UPDATE`)
Use when conflict rate is high and immediate reservation is mandatory (e.g., ticket booking, seat reservation).

```sql
BEGIN;

-- Acquires exclusive row lock on this specific customer wallet
SELECT balance_cents
FROM customer_wallets
WHERE customer_id = 'cust_789'
FOR UPDATE;

-- Update balance with certainty that no concurrent thread read the old balance
UPDATE customer_wallets
SET balance_cents = balance_cents - 5000
WHERE customer_id = 'cust_789';

COMMIT;
```

#### Pattern C: High-Throughput Queue Processing (`FOR UPDATE SKIP LOCKED`)
Prevents worker thread contention when multiple workers pull jobs from a database queue table:

```sql
-- Atomically claim 1 pending job without blocking other workers:
WITH next_job AS (
    SELECT id
    FROM job_queue
    WHERE status = 'PENDING'
      AND run_at <= CURRENT_TIMESTAMP
    ORDER BY run_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
)
UPDATE job_queue jq
SET status = 'PROCESSING',
    locked_at = CURRENT_TIMESTAMP,
    locked_by = 'worker-node-42'
FROM next_job
WHERE jq.id = next_job.id
RETURNING jq.id, jq.payload;
```

This query claims pending work only. Durable workers also need expired-claim recovery, a unique claim token checked on renewal and completion, idempotent effects, and bounded failed-job handling. The `locked_at` and `locked_by` fields alone do not implement that recovery protocol.

### 5.3 Deadlock Prevention Rules

1. **Lock in Consistent Alphabetical / Primary Key Order**:
   If Process A updates Account 1 then Account 2, Process B must **never** update Account 2 then Account 1. Always sort ID arrays before executing batch updates (`ids.sort()`).
2. **Never Execute Network Calls Inside a DB Transaction**:
   Never invoke Stripe API, send an email, or call an external HTTP microservice while holding an open database transaction. If the external network call stalls for 15 seconds, database connection pools exhaust and row locks cascade across the entire cluster.
3. **Set Aggressive Lock Timeouts**:
   Never let a transaction wait forever on a lock.

```sql
-- Set local lock timeout in Postgres before running critical operations
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '10s';
```

---
