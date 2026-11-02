# Database changes: transactions

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

## 6 - Connection Pooling, Scalability & Serverless

### 6.1 Connection Pool Mathematics & Sizing

> [!CAUTION]
> Setting database connection pool size to 100 on each application container will exhaust PostgreSQL memory, degrade CPU cache efficiency, and cause connection queue thundering herds.

PostgreSQL uses a process-per-connection model. Each connection consumes ~10MB RAM plus work buffers. Optimal pool formula from PostgreSQL core team:
$$\text{Max Connections} = (\text{CPU Cores} \times 2) + \text{Disk Spindle Count}$$

For a 4-core database server with SSD storage:
$$\text{Optimal Active Connections} = (4 \times 2) + 1 = 9 \text{ to } 15 \text{ concurrent connections}$$

### 6.2 PgBouncer Configuration Modes

When running containerized or serverless microservices, place PgBouncer or AWS RDS Proxy in front of PostgreSQL.

| Mode | Behavior | Prepared Statements | Session Variables (`SET LOCAL`) | Best For |
|------|----------|---------------------|-----------------------------------|----------|
| **Transaction Mode** (Default standard) | Connection returned to pool after each `COMMIT`/`ROLLBACK` | Requires named prepared statements disabled or PgBouncer 1.21+ | Supported only inside explicit transactions | 99% of web applications & serverless functions |
| **Session Mode** | Connection tied to client for entire lifecycle of TCP socket | Full support | Full support | Long-lived stateful monoliths with low client counts |
| **Statement Mode** | Connection returned after every single SQL statement | No | No | Read-only analytics (Never use with multi-statement transactions) |

### 6.3 Serverless / Edge Database Patterns

When running on Vercel, AWS Lambda, or Cloudflare Workers:
1. **Never establish direct TCP connections** without a connection pooler. 1,000 concurrent serverless invocations will crash the database with `FATAL: remaining connection slots are reserved for non-replication superuser connections`.
2. Use HTTP / WebSocket database adapters designed for serverless environments (e.g., `@neondatabase/serverless`, `@planetscale/database`, Supabase Transaction Pooler on port 6543).
3. If using standard TCP drivers, configure `max: 1` or `max: 2` per serverless container and set aggressive idle timeouts (`idleTimeoutMillis: 5000`).

### 6.4 Read Replicas & Replication Lag

When splitting traffic between Primary (Read/Write) and Replicas (Read-Only):
- **The Read-Your-Own-Writes Problem**: If a user updates their profile and the subsequent redirect reads from a replica that is 50ms behind, the user sees their old profile data and thinks the edit failed.
- **Enforce Session Stickiness**: Route reads to Primary for 2–5 seconds after any write operation initiated by that user session, or track PostgreSQL Log Sequence Numbers (LSN).

---
