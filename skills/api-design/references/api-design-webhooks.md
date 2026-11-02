# API contracts: webhooks

Read for incoming or outgoing events. Reuse the provider SDK and existing event infrastructure. Signature verification authenticates bytes; schema validation, account/tenant authorization and duplicate prevention are separate controls.

## Receive raw bytes first

Use the provider's verification API with the exact raw request body, signature header and endpoint secret. Configure raw-body handling before JSON middleware, bound body/header sizes, keep secrets out of logs and support the provider's rotation procedure. Catch expected verification failures as a client-safe rejection; do not turn malformed headers into uncaught server errors. Follow the provider's timestamp policy rather than inventing a compatible-looking parser. See [Stripe's verification guidance](https://docs.stripe.com/events/manage-webhook-endpoints#signature-errors).

For a webhook protocol **you own**, the following narrow example defines exactly one timestamp and one SHA-256 signature as `t=<seconds>,v1=<64 hex digits>`. It is not a Stripe SDK replacement and intentionally rejects alternate header shapes. The transport must provide a bounded Buffer, never parsed-and-reserialized JSON.

```js
// example: owned-webhook-signature
import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * @param {Buffer} rawBody
 * @param {unknown} header
 * @param {string} secret
 * @param {number} nowSeconds
 */
export function verifyWebhookSignature(rawBody, header, secret, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!Buffer.isBuffer(rawBody) || typeof header !== 'string' || header.length > 100 ||
      typeof secret !== 'string' || secret.length === 0 || !Number.isSafeInteger(nowSeconds) || nowSeconds < 0) return false;
  const match = /^t=([0-9]{1,16}),v1=([a-fA-F0-9]{64})$/.exec(header);
  if (!match) return false;
  const timestamp = Number(match[1]);
  if (!Number.isSafeInteger(timestamp) || Math.abs(nowSeconds - timestamp) > 300) return false;

  const expected = createHmac('sha256', secret).update(`${match[1]}.`).update(rawBody).digest();
  const supplied = Buffer.from(match[2], 'hex');
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
```

The length/hex checks reject malformed input before [Node's equal-length constant-time comparison](https://nodejs.org/api/crypto.html#cryptotimingsafeequala-b). A timestamp limits replay age; the same signed event can still be delivered repeatedly within that window.

## Durable acceptance and duplicate delivery

After verification, validate the event schema and enforce allowed event types, provider account and tenant mapping from trusted server configuration. Never treat an event's arbitrary tenant/role/price field as authority. Scope the durable event ID to its provider and receiving account/endpoint; validate any object ownership before changing local state.

- Reuse an existing inbox/queue. A unique event receipt plus a domain update must commit atomically, or the receipt plus an outbox record must commit atomically for later processing. Do not mark an event complete before its effect commits.
- Return 2xx after durable acceptance (or after the short transaction completes). A detached promise is not durable acceptance. If enqueue/commit fails, use the provider's retry contract rather than reporting success.
- Concurrent duplicate deliveries must converge through a unique constraint. An already committed duplicate can receive 2xx without repeating its effect. Recover abandoned work using leases/reconciliation, not permanent in-memory flags.
- Events may arrive late or out of order. Use supported resource versions or retrieve the provider's authoritative state; do not overwrite newer state solely because an older webhook arrived last.

For crash windows, retries, dead letters and safe replay, apply the backend skill's logging-and-resilience reference when building workers. For downstream side effects, read [idempotency](./api-design-idempotency.md).

## Sending events

Give each event a stable ID, type/schema version, timestamp and allowlisted payload. Sign the exact bytes sent with the documented timestamp/header scheme; use HTTPS and keep signing keys scoped to the destination. Persist delivery intent with the local mutation when losing an event is unacceptable. Bound attempts/timeouts, back off with jitter, record delivery outcomes without sensitive payloads and provide controlled replay/dead-letter recovery.

## Behavior checks

Exercise a valid signature, altered bytes, wrong secret, missing/malformed/short/long/non-hex signature, duplicate fields, invalid timestamp, stale/future delivery and a rotated key under the provider's documented policy. Invalid signatures must reject without throwing from comparison. Test concurrent duplicates, crash after effect/before acknowledgment, failed durable acceptance, unknown event/account and out-of-order delivery against the actual persistence path.
