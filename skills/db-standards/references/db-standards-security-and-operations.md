# Database changes: security and operations

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 10 - Database Security, Auditing & Access Control

> Full threat modeling and crypto rules are detailed in `security-standards`. This section establishes the structural database enforcement rules.

### 10.1 Principle of Least Privilege Roles

Production databases must never run application queries as the superuser or table owner. Use three distinct roles:

```sql
-- 1. Migration Role (Runs CI/CD migrations, owns DDL schema)
CREATE ROLE migration_user WITH LOGIN PASSWORD 'strong_secret_pwd';
GRANT ALL ON SCHEMA public TO migration_user;

-- 2. Application Runtime Role (DML only, zero DDL permissions)
CREATE ROLE app_runtime_user WITH LOGIN PASSWORD 'app_secret_pwd';
GRANT CONNECT ON DATABASE app_prod TO app_runtime_user;
GRANT USAGE ON SCHEMA public TO app_runtime_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_runtime_user;
-- Revoke DDL creation: app cannot alter or drop tables
REVOKE CREATE ON SCHEMA public FROM app_runtime_user;

-- 3. Read-Only Analytics / Backup Role
CREATE ROLE analytics_ro_user WITH LOGIN PASSWORD 'analytics_secret_pwd';
GRANT CONNECT ON DATABASE app_prod TO analytics_ro_user;
GRANT USAGE ON SCHEMA public TO analytics_ro_user;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO analytics_ro_user;
```

### 10.2 Audit Logging Table Pattern

For compliance-sensitive entities (orders, payouts, role changes), track changes via a generic audit log:

```sql
CREATE TABLE audit_logs (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    table_name VARCHAR(64) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(10) NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    actor_id UUID NULL,
    old_data JSONB NULL,
    new_data JSONB NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_table_record ON audit_logs (table_name, record_id);
CREATE INDEX idx_audit_created ON audit_logs (created_at DESC);
```

---

## 11 - Operations, Maintenance & Observability

### 11.1 Slow Query Profiling with `pg_stat_statements`

Enable `pg_stat_statements` in `postgresql.conf` to identify query bottlenecks before users report outages.

```sql
-- Query to locate the top 10 most time-consuming queries across the entire database:
SELECT
    substring(query, 1, 100) AS short_query,
    calls,
    round(total_exec_time::numeric, 2) AS total_time_ms,
    round(mean_exec_time::numeric, 2) AS avg_time_ms,
    round((100 * total_exec_time / sum(total_exec_time) OVER ())::numeric, 2) AS percentage_overall_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;
```

### 11.2 Table Bloat & Autovacuum Tuning

PostgreSQL MVCC leaves dead row versions on disk during `UPDATE` and `DELETE`.
- Ensure autovacuum is **never** turned off.
- For high-write tables (e.g. `user_sessions`, `job_queue`), lower the vacuum threshold:

```sql
ALTER TABLE job_queue SET (
    autovacuum_vacuum_scale_factor = 0.05, -- Trigger vacuum after 5% row changes instead of 20%
    autovacuum_vacuum_cost_limit = 1000
);
```

---
