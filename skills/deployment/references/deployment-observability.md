# Deployment and infrastructure: observability

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

Use this reference when a production change affects detection, reliability commitments, or recovery of persisted state. Inspect existing signals, owners, and runbooks first; do not introduce a telemetry stack or disaster-recovery program for an unrelated patch. The [security testing and operations reference](https://github.com/zoebchhatriwala/DevMind/blob/main/skills/security-standards/references/security-standards-testing-and-operations.md) covers shared security controls; the decisions below remain usable without that skill installed.

## 7 - Production Observability & Monitoring

### 7.1 Service signals and actionable alerts

Start from a user-visible operation. Define a service-level indicator (SLI) as a measurable result with a clear numerator/denominator or distribution, source, and exclusions. Examples include successful eligible requests, requests completed within a useful latency, and scheduled jobs completed before their deadline. Process uptime alone may miss broken user journeys.

Where the service needs an explicit reliability commitment, agree a service-level objective (SLO): the target and measurement window for that indicator. Reuse existing objectives and data. Missing telemetry is unknown, not success. Choose targets from user needs and operating constraints rather than copying a universal error percentage or percentile threshold. [Google's SLO guidance](https://sre.google/workbook/implementing-slos/) describes this selection process.

For each alert, record the condition/window, affected user operation, owner or escalation destination, dashboard/query, and a concrete runbook action. Page for an actionable risk that needs immediate response; route lower-urgency work appropriately. For SLO-managed services, consider sustained error-budget consumption rather than paging on every transient failure. Check low-traffic and absent-data behavior. Use existing alert-test facilities or an isolated synthetic signal to verify delivery and recovery; do not deliberately break production. [Alerting on SLOs](https://sre.google/workbook/alerting-on-slos/) explains the trade-offs.

Keep telemetry bounded and useful: reuse correlation context across existing service boundaries, avoid raw user identifiers as metric labels, and retain redaction. Do not add distributed tracing to a local tool solely to match an example.

### 7.2 Structured Standard Output (stdout) Logging

Containers are ephemeral. Applications must **never write logs to local disk files** inside the container.
- Emit structured JSON directly to `stdout`.
- The container runtime / daemon (Docker, Kubernetes, AWS FireLens) captures stdout and ships logs to centralized aggregators (Datadog, Grafana Loki, AWS CloudWatch).

```typescript
// Fastify / Pino structured output
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.secret'],
    remove: true,
  },
});
```

### 7.3 Recovery of persisted state

For changes that put production state at risk, identify the state owner and tolerated interruption/data loss. Record recovery time objective (RTO) and recovery point objective (RPO) when needed; reuse established targets. Check the actual backup source, retention, access to required keys/configuration, and the supported restoration method. Application rollback may not reverse a destructive data change.

Within the authorized environment, restore a representative backup to an isolated target. Check that application reads and relevant integrity checks succeed; a completed backup job or running database is insufficient evidence. Record backup timestamp/recovery point, restore start/end, measured recovery time and recoverable data gap, validation results, and the runbook revision. Compare these with the agreed objectives. [AWS's recovery-testing guidance](https://docs.aws.amazon.com/wellarchitected/latest/reliability-pillar/rel_backing_up_data_periodic_recovery_testing_data.html) describes this evidence independently of which provider the project uses.

If credentials, backups, or a safe target are unavailable, report restoration as not exercised and identify the missing prerequisite. Preparing this plan does not authorize production restoration or failover. Keep a runnable recovery procedure and responsible owner proportional to the service's actual risk.
