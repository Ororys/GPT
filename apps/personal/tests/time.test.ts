import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addDays, dayOf, localDay, weekStart } from '../src/modules/observations/time';
import { longestGap } from '../src/modules/quality/passport';

test('jour local (C-01) : fuseau du dossier, minuit et changement d’heure', () => {
  assert.equal(localDay('2026-10-24T22:30:00Z'), '2026-10-25', 'heure d’été, UTC+2');
  assert.equal(localDay('2026-10-25T22:30:00Z'), '2026-10-25', 'heure d’hiver, UTC+1');
  assert.equal(localDay('2026-10-25T23:30:00Z'), '2026-10-26');
  assert.equal(localDay('2026-11-17T02:00:00Z', 'America/New_York'), '2026-11-16');
  assert.throws(() => localDay('2026-11-17T02:00:00Z', 'Mars/Olympus'));
});
test('valeur connue au jour près : date calendaire jamais décalée', () => {
  const lab = { measuredAt: '2026-11-17T00:00:00Z', measuredPrecision: 'day' as const };
  assert.equal(dayOf(lab, 'America/New_York'), '2026-11-17');
  assert.equal(dayOf({ measuredAt: '2026-11-17T00:00:00Z' }, 'America/New_York'), '2026-11-16');
});
test('arithmétique calendaire indépendante du fuseau', () => {
  assert.equal(addDays('2026-10-24', 2), '2026-10-26');
  assert.equal(addDays('2026-03-01', -1), '2026-02-28');
  assert.equal(weekStart('2026-11-18'), '2026-11-16');
  assert.equal(weekStart('2026-11-16'), '2026-11-16');
});
test('passeport : une nuit à 23 h 30 UTC appartient au lendemain à Paris', () => {
  const asOf = '2026-10-26T12:00:00Z';
  // Night recorded 2026-10-25 23:30Z = 26 Oct 00:30 Paris: 26 is covered, 25 is missing.
  assert.deepEqual(longestGap(['2026-10-25T23:30:00Z', '2026-10-24T05:00:00Z'], asOf, 3), {
    from: '2026-10-25',
    to: '2026-10-25',
    days: 1,
  });
  assert.deepEqual(longestGap(['2026-10-25T23:30:00Z', '2026-10-24T05:00:00Z'], asOf, 3, 'UTC'), {
    from: '2026-10-26',
    to: '2026-10-26',
    days: 1,
  });
});
