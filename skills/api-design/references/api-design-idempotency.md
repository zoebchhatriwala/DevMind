# API contracts: idempotency

Read for retryable side effects. Adapt to the existing datastore and operation; an HTTP response interceptor or expiring cache lock cannot make a payment atomic.

## Request identity and replay

Authenticate, authorize the operation and validate its input before claiming a key. On every retry, enforce current access before returning a stored response. For operations requiring a key, reject missing/malformed keys rather than silently executing without protection. Bound key length using the established API contract; keys must not contain secrets or personal data.

Scope a unique receipt to **tenant, authenticated actor, named operation/version, and client key**. Bind it to all validated inputs that affect the result. Do not scope unrelated anonymous callers together. Public operations need their own authenticated capability or other explicit isolation design.

This payment-specific example takes an already validated, normalized DTO. The fixed tuple avoids property-order differences; add every new result-affecting field when changing the command. It is not a general JSON canonicalizer.

```js
// example: payment-request-identity
import { createHash } from 'node:crypto';

/**
 * @param {string} tenantId
 * @param {string} actorId
 * @param {string} key
 * @param {{ amountCents: number, currency: string, destinationId: string }} command
 */
export function paymentRequestIdentity(tenantId, actorId, key, command) {
  const operation = 'payments.create:v1';
  return {
    scope: [tenantId, actorId, operation, key],
    fingerprint: createHash('sha256')
      .update(JSON.stringify([operation, command.amountCents, command.currency, command.destinationId]))
      .digest('hex'),
  };
}

/**
 * @param {{ fingerprint: string, state: 'pending' | 'complete' | 'unknown', status: number | null, body: string | null }} receipt
 * @param {string} fingerprint
 * @returns {{ action: 'mismatch' | 'retry-later' | 'reconcile' } | { action: 'replay', status: number, body: string }}
 */
export function receiptDecision(receipt, fingerprint) {
  if (receipt.fingerprint !== fingerprint) return { action: 'mismatch' };
  if (receipt.state === 'unknown') return { action: 'reconcile' };
  if (receipt.state === 'pending') return { action: 'retry-later' };
  if (receipt.status === null || !Number.isInteger(receipt.status) || receipt.status < 200 || receipt.status > 499 || typeof receipt.body !== 'string') {
    throw new Error('Incomplete idempotency receipt');
  }
  return { action: 'replay', status: receipt.status, body: receipt.body };
}
```

Map a mismatched request to the established client error contract (for example, 409). A pending attempt returns a documented conflict/retry response; an uncertain external outcome requires reconciliation, not blind execution. Store the exact allowlisted response body/status; never replay cookies, authorization headers, or arbitrary response headers. Error caching is operation-specific: a 5xx is not evidence that a side effect failed. This example stores only completed 2xx/4xx outcomes; adapt the receipt schema if the existing contract also persists terminal server errors.

## Database-only effects: one transaction

Reuse the database and transaction helper already present. For a PostgreSQL implementation, the receipt needs a unique constraint on `(tenant_id, actor_id, operation, key)`, a request fingerprint, and completed status/body. Use bound parameters throughout.

1. Begin a transaction. Atomically `INSERT ... ON CONFLICT DO NOTHING RETURNING ...` for the receipt; a separate cache GET followed by SET is a race.
2. If the receipt exists, lock/read it inside the transaction, compare the fingerprint, and replay only its committed complete result. With PostgreSQL READ COMMITTED, a follow-up SELECT sees the winning committed row; higher isolation may instead require a bounded retry of a serialization failure. A lock timeout is a retryable conflict, not permission to execute.
3. If this transaction owns the new receipt, perform the authorized domain mutation using **the same transaction**. Save the final allowlisted response in the receipt before commit.
4. Await commit, then send the response. A failure before commit rolls back both the mutation and receipt. A disconnect after commit is recovered by replaying that receipt.

No `res.send` monkey patch, fire-and-forget receipt write, or independent Redis TTL can close the database commit/response crash window. For this pattern, an uncommitted receipt disappears on rollback; it is not a durable orphaned `PROCESSING` flag. Verify the unique constraint and transaction isolation against the actual database.

## External effects and expired ownership

A database transaction cannot roll back a charge at another provider. Use the provider's idempotency support with a stable operation key and persist the operation identity before dispatch. A transactional outbox is appropriate when the local write must reliably schedule external work; it still allows duplicate delivery and needs an idempotent consumer. Apply the backend skill's logging-and-resilience reference when implementing workers.

If a worker dies after dispatch but before recording the result, mark/reconcile the outcome using the provider operation ID or the same provider key. Do not delete the receipt and issue a fresh charge. A lease expiring means ownership may be recovered, not that the effect did not happen. Prevent a previous worker from completing after reassignment using the existing datastore's ownership/fencing mechanism where supported; otherwise reconcile before repeating irreversible work.

Document retention relative to client retries and provider deduplication windows. Pruning a completed receipt can allow the same key to execute again; preserve business uniqueness constraints or reject stale operation IDs where repeating the effect is unacceptable. Do not present a universal 24-hour TTL as a correctness guarantee.

## Behavior checks

- Same scope/key and identical normalized request: one effect, same response. Different amount, currency, or destination: mismatch, no new effect.
- Concurrent attempts: the unique claim permits one owner; the other replays the committed result or receives a bounded retry response.
- Crash before commit: no domain write or completed receipt. Crash after commit/before response: replay without another write.
- External success followed by a lost response: reconcile/reuse the same provider key. Expired lease, slow original worker, and expiry of the provider window must not silently authorize a new effect.
- Revoked access, cross-tenant keys, stale receipts and persistence failures follow the documented denial/recovery contract.

Provider semantics vary; [Stripe's idempotency documentation](https://docs.stripe.com/api/idempotent_requests) is an example, not a universal status-code or retention standard.
