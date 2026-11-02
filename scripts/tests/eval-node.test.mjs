import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { compareEvaluations, evaluateCase, loadCases, prepareCase, validateModelRun } from '../eval.mjs';
import { fixture } from './helpers.mjs';

const solutions = {
  'api-pagination': `export function normalizePage(query) {
    if (!query || typeof query !== 'object' || Array.isArray(query)) throw new Error('Invalid query');
    const number = (value, fallback) => {
      if (value === undefined) return fallback;
      if (typeof value === 'string' && !/^\\d+$/.test(value)) throw new Error('Invalid number');
      if (!['string','number'].includes(typeof value)) throw new Error('Invalid number');
      const parsed = Number(value);
      if (!Number.isSafeInteger(parsed) || parsed < 1) throw new Error('Out of range');
      return parsed;
    };
    const page=number(query.page,1), limit=number(query.limit,20), offset=(page-1)*limit;
    if(limit>100 || !Number.isSafeInteger(offset)) throw new Error('Out of range');
    return {offset,limit};
  }`,
  'tenant-authorization': `export function canEditDocument(actor, document) {
    if (![actor?.id, actor?.tenantId, document?.ownerId, document?.tenantId].every(value => typeof value === 'string' && value.length > 0)) return false;
    return actor.tenantId === document.tenantId && (actor.id === document.ownerId || actor.role === 'admin');
  }`,
  'atomic-transfer': `export async function transferCredits(store, from, to, amount) {
    if (![from,to].every(id => typeof id === 'string' && id.length > 0) || from === to || !Number.isSafeInteger(amount) || amount <= 0) throw new Error('Invalid transfer');
    await store.transaction(async tx => {
      const debit=await tx.get(from), credit=await tx.get(to);
      if (!Number.isSafeInteger(debit) || debit<amount || !Number.isSafeInteger(credit+amount)) throw new Error('Invalid balance');
      await tx.set(from,debit-amount); await tx.set(to,credit+amount);
    });
  }`,
};

test('server evaluation contracts reject broken seeds and pass real corrected behavior', async () => {
  await fixture({}, async directory => {
    for (const entry of (await loadCases()).filter(entry => entry.runner === 'node')) {
      const prepared = await prepareCase(entry.id, entry.id, directory);
      const baseline = await evaluateCase(entry.id, prepared.root);
      assert.equal(baseline.behaviorStatus, 'failed', `${entry.id}: broken seed unexpectedly passed`);
      await writeFile(join(prepared.root, 'operation.mjs'), solutions[entry.id]);
      const revised = await evaluateCase(entry.id, prepared.root);
      assert.equal(revised.behaviorStatus, 'passed', entry.id);
      assert.equal(revised.status, 'incomplete', 'Functional checks do not imply a reviewed model-quality result.');
      assert.match(compareEvaluations(baseline, revised).modelControl, /Unverified/);
      const without = { ...baseline, modelRun: { model: 'test-model', settings: { temperature: 0 }, condition: 'without-skill' } };
      const withSkill = { ...revised, modelRun: { model: 'test-model', settings: { temperature: 0 }, condition: 'with-skill', skillRevision: 'test-revision' } };
      assert.match(compareEvaluations(without, withSkill).modelControl, /Declared/);
      assert.throws(() => compareEvaluations(without, { ...withSkill, modelRun: { ...withSkill.modelRun, model: 'different-model' } }), /Model IDs/);
      assert.throws(() => compareEvaluations(without, { ...withSkill, modelRun: { ...withSkill.modelRun, settings: { temperature: 1 } } }), /settings/);
      assert.throws(() => compareEvaluations(without, revised), /Model run/);
    }
  });
});

test('model-run provenance requires explicit conditions, revisions, and valid observed metrics', () => {
  assert.throws(() => validateModelRun({ model: 'm', settings: {}, condition: 'with-skill' }), /revision/);
  assert.throws(() => validateModelRun({ model: 'm', settings: {}, condition: 'without-skill', metrics: { costUsd: -1 } }), /nonnegative/);
  assert.throws(() => validateModelRun({ model: 'm', settings: {}, condition: 'without-skill', metrics: { durationMs: Infinity } }), /finite/);
  assert.throws(() => validateModelRun({ model: 'm', settings: {}, condition: 'unknown' }), /condition/);
  assert.throws(() => validateModelRun({ model: 'm', settings: {}, condition: 'without-skill', metrics: { inputTokens: 1.5 } }), /integers/);
});
