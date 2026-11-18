import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deviceDaily, type DeviceRow } from '../src/modules/device/daily';
const row = (r: Partial<DeviceRow>): DeviceRow => ({
  platform: 'healthkit',
  type: 'sleep',
  start: '2026-11-16T22:00:00Z',
  end: '2026-11-17T05:00:00Z',
  value: 0,
  unit: 'minute',
  sleepState: 'asleep',
  aggregation: 'sample',
  sourceName: 'Montre',
  ...r,
});
test('sommeil : seul le temps endormi compte, chevauchements fusionnés, jour du réveil', () => {
  const d = deviceDaily(
    [
      // In bed for 8 h: never counted as sleep.
      row({ sleepState: 'inBed', start: '2026-11-16T21:30:00Z', end: '2026-11-17T05:30:00Z' }),
      // Watch and phone both record 23:00–05:00 Paris time: counted once.
      row({ start: '2026-11-16T22:00:00Z', end: '2026-11-17T04:00:00Z', sourceName: 'Montre' }),
      row({ start: '2026-11-16T23:00:00Z', end: '2026-11-17T04:00:00Z', sourceName: 'iPhone' }),
      // Awake 30 min then deep sleep 1 h.
      row({ sleepState: 'awake', start: '2026-11-17T04:00:00Z', end: '2026-11-17T04:30:00Z' }),
      row({ sleepState: 'deep', start: '2026-11-17T04:30:00Z', end: '2026-11-17T05:30:00Z' }),
    ],
    'Europe/Paris',
  )!;
  assert.deepEqual(d.sleepHours, [{ day: '2026-11-17', value: 7 }]);
});
test('pas et distance : total quotidien de la plateforme, jamais additionné deux fois', () => {
  const total = (value: number, type = 'steps', unit = 'count') =>
    row({
      type,
      unit,
      value,
      sleepState: null,
      aggregation: 'daily-total',
      start: '2026-11-16T23:00:00Z',
      end: '2026-11-17T23:00:00Z',
    });
  const d = deviceDaily(
    [
      total(4200),
      total(9800),
      total(7300, 'distance', 'meter'),
      // A raw sample is ignored for totals.
      row({ type: 'steps', unit: 'count', value: 500, sleepState: null }),
    ],
    'Europe/Paris',
  )!;
  assert.deepEqual(d.steps, [{ day: '2026-11-17', value: 9800 }]);
  assert.deepEqual(d.distanceKm, [{ day: '2026-11-17', value: 7.3 }]);
});
test('VFC : une série par méthode, jamais mélangées ; FC au repos moyenne du jour local', () => {
  const v = (
    platform: DeviceRow['platform'],
    value: number,
    start: string,
    type = 'heartRateVariability',
  ) =>
    row({
      platform,
      type,
      value,
      start,
      end: start,
      sleepState: null,
      unit: type === 'heartRateVariability' ? 'millisecond' : 'bpm',
    });
  const d = deviceDaily(
    [
      v('healthkit', 40, '2026-11-17T06:00:00Z'),
      v('healthkit', 50, '2026-11-17T20:00:00Z'),
      v('health-connect', 30, '2026-11-17T06:00:00Z'),
      v('healthkit', 52, '2026-11-17T22:30:00Z', 'restingHeartRate'),
      v('healthkit', 56, '2026-11-17T06:00:00Z', 'restingHeartRate'),
    ],
    'Europe/Paris',
  )!;
  assert.deepEqual(d.hrv, [
    { method: 'SDNN', values: [{ day: '2026-11-17', value: 45 }] },
    { method: 'RMSSD', values: [{ day: '2026-11-17', value: 30 }] },
  ]);
  // 22:30Z is 23:30 in Paris: still 17 Nov.
  assert.deepEqual(d.restingHeartRate, [{ day: '2026-11-17', value: 54 }]);
  assert.deepEqual(d.platforms, ['health-connect', 'healthkit']);
  assert.equal(deviceDaily([], 'Europe/Paris'), null);
});
