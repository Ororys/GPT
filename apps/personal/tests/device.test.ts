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
    { sleepState: 'asleep' },
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

test('forme : pas et distance en total quotidien, sommeil avec son état', () => {
  const ok = (x: object) =>
    DeviceImportSchema.safeParse({ platform: 'health-connect', samples: [{ ...sample, ...x }] })
      .success;
  assert.equal(
    ok({ dataType: 'steps', unit: 'count', value: 8000, aggregation: 'daily-total' }),
    true,
  );
  assert.equal(ok({ dataType: 'steps', unit: 'count', value: 80 }), false, 'raw steps refused');
  assert.equal(ok({ dataType: 'sleep', unit: 'minute', value: 60, sleepState: 'deep' }), true);
  assert.equal(ok({ dataType: 'sleep', unit: 'minute', value: 60 }), false, 'sleep without state');
  assert.equal(ok({ dataType: 'restingHeartRate', aggregation: 'daily-total' }), false);
  assert.notEqual(
    recordKey('health-connect', {
      ...sample,
      dataType: 'sleep',
      unit: 'minute',
      sleepState: 'deep',
    }),
    recordKey('health-connect', {
      ...sample,
      dataType: 'sleep',
      unit: 'minute',
      sleepState: 'rem',
    }),
  );
});
