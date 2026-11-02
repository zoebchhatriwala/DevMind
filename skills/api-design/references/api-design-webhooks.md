# API contracts: webhooks

Read only for this topic. These are adaptation examples, not a required stack or file structure. Follow the entrypoint's scope and the project's existing framework, tools, and authorization. Do not copy placeholders, add packages, or replace working architecture solely to match an example.

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
