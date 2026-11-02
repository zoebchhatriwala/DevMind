export const nodeCases = [
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
