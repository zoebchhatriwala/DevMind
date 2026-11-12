export const nodeCases = [
  {
    id: 'desktop-ipc-authority', runner: 'node',
    prompt: 'Repair createPreferencesHandler(trustedWebContents, store) in this existing dependency-free Node contract for a desktop host. Return an async handler(event, payload). Only event.sender === trustedWebContents and event.senderFrame === trustedWebContents.mainFrame with senderFrame.origin exactly app://devmind may call it. Reject missing frames and other windows/subframes even if their origins match. Validate payload as a non-array object with exactly one own key, theme, whose value is light, dark, or system. Reject denied/malformed input before calling store.setTheme(theme). For valid input await that method and return its result; propagate storage failure. Preserve exports and add no packages. This synthetic contract does not test actual Electron frame provenance, navigation configuration, or application packaging.',
    files: { 'operation.mjs': 'export function createPreferencesHandler(trustedWebContents, store) { return async (event, payload) => store.setTheme(payload.theme); }\n' },
    scenarios: [],
    review: ['Caller/frame authority and exact origin are checked before any side effect.', 'Payload shape and allowed values are validated in the host.', 'Storage failure is propagated; a synthetic contract is not native runtime verification.'],
    assertions: `const frame = {origin: 'app://devmind'};
const trusted = {mainFrame: frame};
const event = {sender: trusted, senderFrame: frame};
const calls = []; let fail = false;
const store = {setTheme: async theme => {calls.push(theme); if (fail) throw new Error('disk full'); return {theme};}};
const handler = operation.createPreferencesHandler(trusted, store);
for (const theme of ['light', 'dark', 'system']) assert.deepEqual(await handler(event, {theme}), {theme});
assert.deepEqual(calls, ['light', 'dark', 'system']); calls.length = 0;
for (const input of [null, {}, {sender: trusted}, {sender: {}, senderFrame: frame}, {sender: trusted, senderFrame: {origin: frame.origin}}, {sender: trusted, senderFrame: null}]) {
  await assert.rejects(handler(input, {theme: 'dark'})); assert.equal(calls.length, 0);
}
for (const origin of ['null', '', 'app://devmind.evil', 'https://evil.test/app://devmind']) {
  frame.origin = origin; await assert.rejects(handler(event, {theme: 'dark'})); assert.equal(calls.length, 0);
}
frame.origin = 'app://devmind';
for (const payload of [null, [], {}, {theme: null}, {theme: 1}, {theme: 'DARK'}, {theme: 'dark', path: '/private'}, {theme: 'dark', [Symbol('extra')]: true}, Object.defineProperty({theme: 'dark'}, 'path', {value: '/private'}), Object.create({theme: 'dark'})]) {
  await assert.rejects(handler(event, payload)); assert.equal(calls.length, 0);
}
fail = true; await assert.rejects(handler(event, {theme: 'dark'}), /disk full/); assert.deepEqual(calls, ['dark']);`,
  },
  {
    id: 'mobile-outbox-retry', runner: 'node',
    prompt: 'Repair async flushPending(queue, send) in an existing mobile sync module represented by a dependency-free Node contract. queue is the existing mutable array of already-validated {id, body} items owned by one worker. Send in order, passing each item unchanged, and remove it only after send resolves with a non-array object whose id exactly matches the item id. A rejection or invalid acknowledgment must reject the flush, leave that item and all later items queued, and stop sending. Earlier acknowledged items stay removed. Retry uses the original stable id/body, including when the server committed but its response was lost. Empty queues do not send. Preserve the export and use no new packages, sleeps, retry loops, or storage abstractions. This isolates queue ordering; actual durable storage, concurrent workers, native lifecycle, and server deduplication remain separate integration requirements.',
    files: { 'operation.mjs': 'export async function flushPending(queue, send) { while (queue.length) { const item = queue.shift(); await send(item); } }\n' },
    scenarios: [],
    review: ['Only a matching acknowledgment removes the pending item.', 'Lost responses preserve identity and stop dependent work until recovery.', 'The bounded single-worker fixture does not prove persistence or exactly-once production effects.'],
    assertions: `const original = [{id: 'op-1', body: {text: 'field note'}}, {id: 'op-2', body: {text: 'second note'}}];
const queue = structuredClone(original); const sent = []; const effects = new Map(); let loseResponse = true;
const send = async item => {
  sent.push(structuredClone(item));
  if (!effects.has(item.id)) effects.set(item.id, structuredClone(item.body));
  if (loseResponse) {loseResponse = false; throw new Error('response lost after commit');}
  return {id: item.id};
};
await assert.rejects(operation.flushPending(queue, send), /response lost/);
assert.deepEqual(queue, original); assert.deepEqual(sent, [original[0]]); assert.equal(effects.size, 1);
await operation.flushPending(queue, send);
assert.deepEqual(queue, []); assert.deepEqual(sent, [original[0], original[0], original[1]]); assert.equal(effects.size, 2);
for (const ack of [undefined, null, [], {}, {id: 'wrong-id'}, {id: 1}]) {
  const pending = structuredClone(original); const attempts = [];
  await assert.rejects(operation.flushPending(pending, async item => {attempts.push(item.id); return ack;}));
  assert.deepEqual(pending, original); assert.deepEqual(attempts, ['op-1']);
}
const pending = [...structuredClone(original), {id: 'op-3', body: {text: 'third note'}}]; const attempts = [];
await assert.rejects(operation.flushPending(pending, async item => {attempts.push(item.id); if(item.id === 'op-2') throw new Error('denied'); return {id: item.id};}), /denied/);
assert.deepEqual(pending, [original[1], {id: 'op-3', body: {text: 'third note'}}]); assert.deepEqual(attempts, ['op-1', 'op-2']);
await operation.flushPending([], async () => assert.fail('An empty queue must not send.'));`,
  },
  {
    id: 'api-pagination', runner: 'node',
    prompt: 'Fix normalizePage(query) in this existing dependency-free Node backend. Return {offset, limit}. Default to page 1 and limit 20 when omitted. Accept decimal digit strings or safe integers, with page >= 1 and limit 1..100. Reject fractions, signs, exponents in strings, arrays, null, unsafe integers, and an unsafe calculated offset. Reject invalid input before it can reach a database. Preserve the exported function and use the existing JavaScript stack without packages.',
    files: { 'operation.mjs': 'export function normalizePage(query) { const limit = Number(query.limit || 20); return {offset: (Number(query.page || 1) - 1) * limit, limit}; }\n' },
    scenarios: [],
    review: ['Input is validated before query construction.', 'Pagination is bounded without silently accepting malformed numbers.', 'Existing stack and export are preserved.'],
    assertions: `assert.deepEqual(operation.normalizePage({}), {offset: 0, limit: 20});
assert.deepEqual(operation.normalizePage({page: '5', limit: '20'}), {offset: 80, limit: 20});
assert.deepEqual(operation.normalizePage({page: 2, limit: 100}), {offset: 100, limit: 100});
for (const query of [null, [], {page: null}, {limit: null}, {page: 0}, {page: '-1'}, {page: '1.5'}, {page: '1e3'}, {page: '+1'}, {page: ' 1'}, {page: '1.0'}, {page: '1;DROP TABLE orders'}, {limit: 101}, {limit: 0}, {limit: []}, {limit: Infinity}, {page: Number.MAX_SAFE_INTEGER + 1}, {page: Number.MAX_SAFE_INTEGER, limit: 100}]) {
  assert.throws(() => operation.normalizePage(query));
}`,
  },
  {
    id: 'tenant-authorization', runner: 'node',
    prompt: 'Fix canEditDocument(actor, document) in this existing Node module. A signed-in owner or an admin can edit within their own tenant only. Tenant IDs, user IDs, and document owner IDs must be nonempty strings. Missing/malformed identity is denied. Cross-tenant access is denied even when IDs match or the actor is an admin. Return a boolean, preserve the export, and add no dependencies or identity provider.',
    files: { 'operation.mjs': 'export function canEditDocument(actor, document) { return actor?.role === "admin" || actor?.id === document?.ownerId; }\n' },
    scenarios: [],
    review: ['Authority is checked at the server operation.', 'Ownership and admin privileges never bypass tenant isolation.', 'Malformed identity is denied by default.'],
    assertions: `const document = {ownerId: 'u1', tenantId: 't1'};
assert.equal(operation.canEditDocument({id: 'u1', tenantId: 't1'}, document), true);
assert.equal(operation.canEditDocument({id: 'u2', tenantId: 't1', role: 'admin'}, document), true);
for (const actor of [null, {}, {id: 'u2', tenantId: 't1'}, {id: 'u1', tenantId: 't2'}, {id: 'u2', tenantId: 't2', role: 'admin'}, {id: '', tenantId: 't1', role: 'admin'}]) assert.equal(operation.canEditDocument(actor, document), false);
for (const target of [null, {}, {ownerId: '', tenantId: 't1'}, {ownerId: 'u1', tenantId: ''}]) assert.equal(operation.canEditDocument({id: 'u1', tenantId: 't1'}, target), false);`,
  },
  {
    id: 'atomic-transfer', runner: 'node',
    prompt: 'Fix async transferCredits(store, from, to, amount) in this existing Node module. Move a positive safe-integer amount between distinct nonempty account IDs. Reject insufficient balance or invalid input without changing balances. Use the existing store.transaction(async tx => ...) boundary so a failed credit rolls back the debit. tx.get(id) and tx.set(id, balance) are async. Reject an unsafe resulting balance. No new packages, retries, or storage abstraction. Preserve the export. The test store models rollback; production database isolation still needs separate review.',
    files: { 'operation.mjs': 'export async function transferCredits(store, from, to, amount) { await store.set(from, await store.get(from) - amount); await store.set(to, await store.get(to) + amount); }\n' },
    scenarios: [],
    review: ['Both writes occur inside the existing transaction.', 'Validation and insufficient funds preserve balances.', 'A failed credit rolls back the debit; real database concurrency remains a separate check.'],
    assertions: `let balances = {a: 100, b: 0}; let failCredit = false;
const methods = state => ({get: async id => state[id], set: async (id, value) => {if (failCredit && id === 'b') throw new Error('credit failed'); state[id] = value;}});
const store = {...methods(balances), transaction: async work => {const pending = {...balances}; await work(methods(pending)); Object.assign(balances, pending);}};
await operation.transferCredits(store, 'a', 'b', 30); assert.deepEqual(balances, {a: 70, b: 30});
failCredit = true;
await assert.rejects(operation.transferCredits(store, 'a', 'b', 20)); assert.deepEqual(balances, {a: 70, b: 30});
failCredit = false;
for (const args of [['a','b',0],['a','b',-1],['a','b',1.5],['a','b',1000],['a','a',1],['','b',1]]) {await assert.rejects(operation.transferCredits(store, ...args)); assert.deepEqual(balances, {a: 70, b: 30});}
balances.b = Number.MAX_SAFE_INTEGER;
await assert.rejects(operation.transferCredits(store, 'a', 'b', 1)); assert.deepEqual(balances, {a: 70, b: Number.MAX_SAFE_INTEGER});`,
  },
];
