import { z } from 'zod';
/** Health data the mobile app may read (data minimisation: nothing else is requested). */
export const DEVICE_TYPES = [
  'sleep',
  'restingHeartRate',
  'heartRateVariability',
  'steps',
  'distance',
] as const;
export type DeviceType = (typeof DEVICE_TYPES)[number];
/** Unit fixed per type, as returned by the plugin; anything else is refused, never converted. */
export const DEVICE_UNIT: Record<DeviceType, string> = {
  sleep: 'minute',
  restingHeartRate: 'bpm',
  heartRateVariability: 'millisecond',
  steps: 'count',
  distance: 'meter',
};
export const DEVICE_LABEL: Record<DeviceType, string> = {
  sleep: 'Sommeil',
  restingHeartRate: 'FC au repos',
  heartRateVariability: 'VFC',
  steps: 'Pas',
  distance: 'Distance',
};
const iso = z.iso.datetime({ offset: true });
export const SLEEP_STATES = ['inBed', 'asleep', 'awake', 'rem', 'deep', 'light'] as const;
/** States that count as time asleep; in bed and awake never do. */
export const ASLEEP: readonly string[] = ['asleep', 'rem', 'deep', 'light'];
/** Steps and distance: only the platform's own daily totals (deduplicated across devices). */
export const DAILY_TOTAL_TYPES: readonly DeviceType[] = ['steps', 'distance'];
export const DeviceSampleSchema = z
  .strictObject({
    dataType: z.enum(DEVICE_TYPES),
    value: z.number().finite().min(0).max(1e7),
    unit: z.string().max(20),
    startDate: iso,
    endDate: iso,
    sourceName: z.string().max(100).optional(),
    sourceId: z.string().max(200).optional(),
    sleepState: z.enum(SLEEP_STATES).optional(),
    aggregation: z.enum(['sample', 'daily-total']).default('sample'),
  })
  .refine((s) => s.unit === DEVICE_UNIT[s.dataType], { message: 'UNIT' })
  .refine((s) => Date.parse(s.endDate) >= Date.parse(s.startDate), { message: 'RANGE' })
  .refine((s) => DAILY_TOTAL_TYPES.includes(s.dataType) === (s.aggregation === 'daily-total'), {
    message: 'AGGREGATION',
  })
  .refine((s) => (s.dataType === 'sleep') === (s.sleepState !== undefined), {
    message: 'SLEEP_STATE',
  });
export const DeviceImportSchema = z.strictObject({
  platform: z.enum(['healthkit', 'health-connect']),
  samples: z.array(DeviceSampleSchema).min(1).max(500),
});
export type DeviceImport = z.infer<typeof DeviceImportSchema>;
export type DeviceSampleInput = z.input<typeof DeviceSampleSchema>;
export interface DeviceSeries {
  platform: 'healthkit' | 'health-connect';
  type: DeviceType;
  count: number;
  first: string;
  last: string;
  receivedAt: string;
}
