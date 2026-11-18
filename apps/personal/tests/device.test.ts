import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DeviceImportSchema, DEVICE_TYPES } from '../src/modules/device/model';
import { recordKey } from '../src/modules/device/key';
const sample = {
  dataType: 'restingHeartRate' as const,
  value: 54,
  unit: 'bpm',
  startDate: '2026-11-17T06:00:00.000Z',
  endDate: '2026-11-17T06:00:00.000Z',
  sourceName: 'Montre',
  sourceId: 'abc',
};
test('données du téléphone : types limités, unité imposée sans conversion, plage de dates', () => {
  assert.deepEqual(
    [...DEVICE_TYPES],
    ['sleep', 'restingHeartRate', 'heartRateVariability', 'steps', 'distance'],
  );
  assert.ok(DeviceImportSchema.safeParse({ platform: 'healthkit', samples: [sample] }).success);
  for (const bad of [
    { unit: 'count' },
    { dataType: 'bloodGlucose' },
    { value: -1 },
    { value: Number.NaN },
    { endDate: '2026-11-16T06:00:00.000Z' },
    { startDate: 'hier' },
    { extra: true },
  ])
    assert.equal(
      DeviceImportSchema.safeParse({ platform: 'healthkit', samples: [{ ...sample, ...bad }] })
        .success,
      false,
      JSON.stringify(bad),
    );
  assert.equal(
    DeviceImportSchema.safeParse({ platform: 'garmin', samples: [sample] }).success,
    false,
  );
  assert.equal(DeviceImportSchema.safeParse({ platform: 'healthkit', samples: [] }).success, false);
  assert.equal(
    DeviceImportSchema.safeParse({ platform: 'healthkit', samples: Array(501).fill(sample) })
      .success,
    false,
  );
});
test('clé d’idempotence : stable, distincte par plateforme et par valeur', () => {
  const k = recordKey('healthkit', sample);
  assert.match(k, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(recordKey('healthkit', { ...sample }), k);
  assert.notEqual(recordKey('health-connect', sample), k);
  assert.notEqual(recordKey('healthkit', { ...sample, value: 55 }), k);
});
