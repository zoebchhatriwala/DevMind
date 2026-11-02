import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';

async function loadExample(path, marker) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), 'utf8');
  const blocks = [...source.matchAll(/^```js\r?\n([\s\S]*?)^```/gm)]
    .map(match => match[1]).filter(code => code.includes(`// example: ${marker}`));
  assert.equal(blocks.length, 1, `Expected one runnable ${marker} example`);
  return import(`data:text/javascript;base64,${Buffer.from(blocks[0]).toString('base64')}`);
}

test('documented cookie API policy rejects hostile origins and unprotected mutations', async () => {
  const { allowsCookieApiRequest } = await loadExample('skills/auth-patterns/references/auth-patterns-session-hardening.md', 'cookie-api-csrf');
  const trusted = 'https://app.example.com';
  const request = { method: 'POST', origin: trusted, csrfHeader: '1' };
  assert.equal(allowsCookieApiRequest(request, trusted), true);
  assert.equal(allowsCookieApiRequest({ method: 'POST', referer: `${trusted}/settings`, csrfHeader: '1' }, trusted), true);
  for (const origin of ['https://evilapp.example.com', 'https://app.example.com.attacker.test', 'https://attacker.test/app.example.com', 'http://app.example.com', `${trusted}:444`, 'null', '', undefined]) {
    assert.equal(allowsCookieApiRequest({ ...request, origin }, trusted), false, `origin: ${origin}`);
  }
  for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
    assert.equal(allowsCookieApiRequest({ ...request, method, csrfHeader: undefined }, trusted), false);
    assert.equal(allowsCookieApiRequest({ ...request, method, origin: 'https://attacker.test', referer: `${trusted}/settings` }, trusted), false);
  }
  for (const csrfHeader of ['', 'true', ['1']]) assert.equal(allowsCookieApiRequest({ ...request, csrfHeader }, trusted), false);
  for (const referer of ['not a URL', 'https://attacker.test/path', undefined]) {
    assert.equal(allowsCookieApiRequest({ method: 'POST', csrfHeader: '1', referer }, trusted), false);
  }
  for (const method of ['GET', 'HEAD', 'OPTIONS']) assert.equal(allowsCookieApiRequest({ method }, trusted), true);
});

test('documented webhook verifier binds raw bytes, timestamp and secret', async () => {
  const { verifyWebhookSignature } = await loadExample('skills/api-design/references/api-design-webhooks.md', 'owned-webhook-signature');
  const secret = 'test-only-signing-secret';
  const now = 1800000000;
  const body = Buffer.from('{ "id": "evt_1", "label": "café" }');
  const sign = (timestamp, payload = body) => `t=${timestamp},v1=${createHmac('sha256', secret).update(`${timestamp}.`).update(payload).digest('hex')}`;
  assert.equal(verifyWebhookSignature(body, sign(now), secret, now), true);
  assert.equal(verifyWebhookSignature(body, sign(now - 300), secret, now), true);
  assert.equal(verifyWebhookSignature(body, sign(now + 300), secret, now), true);
  assert.equal(verifyWebhookSignature(body, sign(now - 301), secret, now), false);
  assert.equal(verifyWebhookSignature(body, sign(now + 301), secret, now), false);
  assert.equal(verifyWebhookSignature(Buffer.from(JSON.stringify(JSON.parse(body.toString()))), sign(now), secret, now), false);
  assert.equal(verifyWebhookSignature(body, sign(now), 'wrong-secret', now), false);
  assert.equal(verifyWebhookSignature(Buffer.from('tampered'), sign(now), secret, now), false);
  assert.equal(verifyWebhookSignature(body, sign(Math.floor(Date.now() / 1000)), secret), true);
});

test('documented webhook verifier safely rejects malformed attacker-controlled input', async () => {
  const { verifyWebhookSignature } = await loadExample('skills/api-design/references/api-design-webhooks.md', 'owned-webhook-signature');
  const body = Buffer.from('{}'), secret = 'test-secret', now = 1800000000;
  const hex = 'a'.repeat(64);
  for (const header of [undefined, null, [], '', 'v1=abc', `t=${now},v1=a`, `t=${now},v1=${hex}aa`, `t=${now},v1=${'z'.repeat(64)}`, `t=NaN,v1=${hex}`, `t=${now}garbage,v1=${hex}`, `t=1e9,v1=${hex}`, `t=-1,v1=${hex}`, `t=9007199254740992,v1=${hex}`, `t=${now},v1=${hex},v1=${hex}`, `t=${now},t=${now},v1=${hex}`]) {
    assert.equal(verifyWebhookSignature(body, header, secret, now), false);
  }
  for (const clock of [NaN, Infinity, -1, 1.5]) assert.equal(verifyWebhookSignature(body, `t=${now},v1=${hex}`, secret, clock), false);
  assert.equal(verifyWebhookSignature('{}', `t=${now},v1=${hex}`, secret, now), false);
  assert.equal(verifyWebhookSignature(body, `t=${now},v1=${hex}`, '', now), false);
});

test('documented payment identity scopes callers and binds every normalized command field', async () => {
  const { paymentRequestIdentity } = await loadExample('skills/api-design/references/api-design-idempotency.md', 'payment-request-identity');
  const command = { amountCents: 4200, currency: 'USD', destinationId: 'merchant_1' };
  const original = paymentRequestIdentity('tenant_1', 'user_1', 'key_1', command);
  const reordered = paymentRequestIdentity('tenant_1', 'user_1', 'key_1', { destinationId: 'merchant_1', currency: 'USD', amountCents: 4200 });
  assert.deepEqual(original, reordered);
  for (const changed of [{ ...command, amountCents: 4201 }, { ...command, currency: 'EUR' }, { ...command, destinationId: 'merchant_2' }]) {
    const identity = paymentRequestIdentity('tenant_1', 'user_1', 'key_1', changed);
    assert.deepEqual(identity.scope, original.scope);
    assert.notEqual(identity.fingerprint, original.fingerprint);
  }
  for (const args of [['tenant_2', 'user_1', 'key_1'], ['tenant_1', 'user_2', 'key_1'], ['tenant_1', 'user_1', 'key_2']]) {
    assert.notDeepEqual(paymentRequestIdentity(...args, command).scope, original.scope);
  }
});

test('documented receipt decisions separate replay, conflicts and uncertain effects', async () => {
  const { receiptDecision } = await loadExample('skills/api-design/references/api-design-idempotency.md', 'payment-request-identity');
  const receipt = { fingerprint: 'request-1', state: 'complete', status: 201, body: '{"id":"payment-1"}' };
  assert.deepEqual(receiptDecision(receipt, 'request-1'), { action: 'replay', status: 201, body: receipt.body });
  assert.deepEqual(receiptDecision(receipt, 'different-request'), { action: 'mismatch' });
  for (const [state, action] of [['pending', 'retry-later'], ['unknown', 'reconcile']]) {
    assert.deepEqual(receiptDecision({ ...receipt, state, status: null, body: null }, 'request-1'), { action });
    assert.deepEqual(receiptDecision({ ...receipt, state }, 'different-request'), { action: 'mismatch' });
  }
  for (const status of [null, 199, 500, 200.5, NaN]) assert.throws(() => receiptDecision({ ...receipt, status }, 'request-1'));
  assert.throws(() => receiptDecision({ ...receipt, body: null }, 'request-1'));
});
