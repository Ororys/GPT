import { test } from 'node:test';
import assert from 'node:assert/strict';
import { baseRecord } from '../src/modules/health-records/fixtures';
import { longestGap, qualityPassport } from '../src/modules/quality/passport';
import type { HealthRecord } from '../src/modules/health-records/model';

test('période sans donnée : jours calendaires, bornes incluses, fin de fenêtre comptée', () => {
  const asOf = '2026-11-18T12:00:00Z';
  assert.equal(longestGap(['2026-11-18', '2026-11-17', '2026-11-16'], asOf, 3), null);
  assert.deepEqual(longestGap(['2026-11-16T22:00:00Z'], asOf, 3), {
    from: '2026-11-17',
    to: '2026-11-18',
    days: 2,
  });
  assert.deepEqual(longestGap([], asOf, 5), { from: '2026-11-14', to: '2026-11-18', days: 5 });
  assert.deepEqual(longestGap(['2026-11-14', '2026-11-18'], asOf, 5), {
    from: '2026-11-15',
    to: '2026-11-17',
    days: 3,
  });
});

test('passeport : provenance, couverture et notes techniques sans lecture médicale', () => {
  const record = baseRecord('demo-alpha');
  const p = qualityPassport(record);
  const total = p.biology.reduce((n, b) => n + b.count, 0);
  assert.equal(total, record.observations.length);
  for (const b of p.biology.filter((b) => b.count)) {
    assert.ok(b.first! <= b.last!);
    assert.equal(
      b.acquisition.reduce((n, a) => n + a.count, 0),
      b.count,
    );
    assert.ok(b.units.length >= 1 && b.laboratories.length >= 1);
  }
  const rhr = p.daily.find((d) => d.id === 'resting-heart-rate')!;
  const nights = new Set(
    record.sleep
      .filter((n) => Date.parse(n.date) > Date.parse(record.asOf) - 90 * 86400000)
      .map((n) => n.date.slice(0, 10)),
  ).size;
  assert.equal(rhr.daysWithData, nights);
  assert.ok(rhr.daysWithData <= rhr.windowDays);
  assert.ok(rhr.notes.includes('MANUFACTURER_ESTIMATE'));
  assert.ok(p.daily.find((d) => d.id === 'hrv')!.notes.includes('HRV_METHOD_SPECIFIC'));
  assert.equal(p.daily.find((d) => d.id === 'activities')!.longestGap, null);
});

test('passeport : unités, laboratoires et appareils multiples signalés ; dossier vide honnête', () => {
  const record = baseRecord('demo-alpha');
  const [a, b] = record.observations.filter((o) => o.code === 'LDL_C');
  const changed: HealthRecord = {
    ...record,
    observations: record.observations.map((o) =>
      o.id === a.id
        ? {
            ...o,
            unit: 'mmol/L',
            reference: { low: 1, high: 4, unit: 'mmol/L', laboratory: 'Autre labo' },
          }
        : o,
    ),
    sleep: record.sleep.map((n, i) => (i === 0 ? { ...n, device: 'Autre montre' } : n)),
  };
  const p = qualityPassport(changed);
  const ldl = p.biology.find((x) => x.code === 'LDL_C')!;
  assert.ok(ldl.notes.includes('MIXED_UNITS'));
  assert.ok(ldl.notes.includes('SEVERAL_LABORATORIES'));
  assert.ok(b);
  assert.ok(p.daily.find((d) => d.id === 'sleep-duration')!.notes.includes('SEVERAL_DEVICES'));
  const empty = qualityPassport(baseRecord('demo-beta'));
  assert.ok(empty.biology.every((x) => x.count === 0 && x.first === null));
  const rhr = empty.daily.find((d) => d.id === 'resting-heart-rate')!;
  assert.equal(rhr.daysWithData, 0);
  assert.deepEqual(rhr.notes, []);
  assert.equal(rhr.longestGap?.days, 90);
});

test('passeport : mesures du centre avec protocole déclaré, changement de protocole signalé', () => {
  const record = baseRecord('demo-alpha');
  const waist = qualityPassport(record).biology.find((b) => b.code === 'WAIST')!;
  assert.equal(waist.category, 'Mesures du centre');
  assert.equal(waist.count, 2);
  assert.equal(waist.protocols.length, 1);
  assert.match(waist.protocols[0], /protocole fictif/);
  assert.ok(!waist.notes.includes('SEVERAL_PROTOCOLS'));
  const changed: HealthRecord = {
    ...record,
    observations: record.observations.map((o) =>
      o.id === 'WAIST-2025-10-22' ? { ...o, method: 'Autre mètre ruban (protocole fictif)' } : o,
    ),
  };
  const after = qualityPassport(changed).biology.find((b) => b.code === 'WAIST')!;
  assert.ok(after.notes.includes('SEVERAL_PROTOCOLS'));
});

test('passeport : séries du téléphone avec couverture locale et notes de méthode', () => {
  const record = baseRecord('demo-alpha');
  record.device = {
    steps: [
      { day: '2026-11-16', value: 8000 },
      { day: '2026-11-18', value: 9000 },
    ],
    distanceKm: [],
    sleepHours: [],
    restingHeartRate: [],
    hrv: [{ method: 'SDNN', values: [{ day: '2026-11-18', value: 40 }] }],
    platforms: ['healthkit'],
    sources: [],
  };
  const p = qualityPassport(record, 3);
  const steps = p.phone.find((x) => x.label === 'Pas (téléphone)')!;
  assert.equal(steps.daysWithData, 2);
  assert.deepEqual(steps.longestGap, { from: '2026-11-17', to: '2026-11-17', days: 1 });
  assert.ok(steps.notes.includes('PLATFORM_DAILY_TOTAL'));
  assert.ok(
    p.phone.find((x) => x.label === 'VFC SDNN (téléphone)')!.notes.includes('HRV_METHOD_SPECIFIC'),
  );
  assert.deepEqual(qualityPassport(baseRecord('demo-alpha')).phone, []);
});
