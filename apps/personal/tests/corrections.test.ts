import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CorrectionRequestSchema } from '../src/modules/health-records/corrections';
import { knownAt, valueKnownAt } from '../src/modules/observations/selectors';
import { baseRecord } from '../src/modules/health-records/fixtures';
import type { Observation } from '../src/modules/health-records/model';

test('correction : virgule française, motif obligatoire, aucune unité ni conversion acceptée', () => {
  const ok = CorrectionRequestSchema.parse({
    observationId: 'x',
    expectedVersion: 0,
    value: ' 9,15 ',
    reason: '  erreur de lecture  ',
  });
  assert.equal(ok.value, 9.15);
  assert.equal(ok.reason, 'erreur de lecture');
  for (const bad of [
    { value: '-1' },
    { value: '< 4' },
    { value: '1e3' },
    { value: '' },
    { reason: 'ok' },
    { expectedVersion: -1 },
    { unit: 'mmol/L' },
  ])
    assert.equal(
      CorrectionRequestSchema.safeParse({
        observationId: 'x',
        expectedVersion: 0,
        value: '9',
        reason: 'erreur de lecture',
        ...bad,
      }).success,
      false,
      JSON.stringify(bad),
    );
});
test('Time Machine : une correction n’apparaît qu’à partir du moment où elle est connue', () => {
  const record = baseRecord('demo-alpha');
  const o: Observation = {
    ...record.observations[0],
    value: 12,
    corrections: [
      {
        version: 1,
        value: 11,
        unit: 'u',
        reason: 'a',
        correctedBy: 's',
        correctedAt: '2026-11-20T10:00:00.000Z',
      },
      {
        version: 2,
        value: 12,
        unit: 'u',
        reason: 'b',
        correctedBy: 's',
        correctedAt: '2026-11-25T10:00:00.000Z',
      },
    ],
  };
  const original = o.evidence.originalValue;
  assert.equal(valueKnownAt(o, '2026-11-19T23:59:59Z').value, original);
  assert.equal(valueKnownAt(o, '2026-11-19T23:59:59Z').corrections, undefined);
  assert.equal(valueKnownAt(o, '2026-11-21T23:59:59Z').value, 11);
  assert.equal(valueKnownAt(o, '2026-11-21T23:59:59Z').corrections?.length, 1);
  assert.equal(valueKnownAt(o, '2026-12-01T00:00:00Z'), o);
  const view = knownAt({ ...record, observations: [o] }, '2026-11-21T23:59:59Z');
  assert.equal(view.observations[0]?.value, 11);
});
