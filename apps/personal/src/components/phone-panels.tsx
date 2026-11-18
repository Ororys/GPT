'use client';
import { Smartphone } from 'lucide-react';
import type { DeviceDaily } from '@/modules/device/daily';
import { Panel, SectionHeading, Notice } from './ui';
import { DataChart, type ChartSeries } from './chart';
const source = (d: DeviceDaily) =>
  d.platforms.map((p) => (p === 'healthkit' ? 'Santé (iPhone)' : 'Health Connect')).join(', ');
/** Nights and heart measured by the phone: separate from the synthetic series, never merged. */
export function PhoneRestPanel({ device }: { device: DeviceDaily }) {
  const series: ChartSeries[] = [];
  if (device.sleepHours.length)
    series.push({
      name: 'Sommeil (téléphone)',
      unit: 'h',
      color: '#b8a0ec',
      points: device.sleepHours.map((v) => ({ date: v.day, value: v.value })),
    });
  if (device.restingHeartRate.length)
    series.push({
      name: 'FC au repos (téléphone)',
      unit: 'bpm',
      color: '#88d6bc',
      points: device.restingHeartRate.map((v) => ({ date: v.day, value: v.value })),
    });
  if (!series.length && !device.hrv.length) return null;
  return (
    <Panel className="phone-panel">
      <SectionHeading
        eyebrow="VOTRE TÉLÉPHONE"
        title="Nuits et cœur, tels que mesurés"
        action={<Smartphone size={16} />}
      />
      {series.length > 0 && <DataChart series={series.slice(0, 2)} height={220} />}
      {device.hrv.map((h) => (
        <p className="phone-hrv" key={h.method}>
          VFC ({h.method}) : {h.values.length} jour(s) mesuré(s), dernière valeur{' '}
          {h.values.at(-1)!.value.toLocaleString('fr-FR')} ms.
        </p>
      ))}
      <Notice>
        Source : {source(device)}. Sommeil = temps endormi seulement (au lit et éveils exclus),
        chevauchements entre appareils fusionnés. VFC SDNN (iPhone) et RMSSD (Android) ne sont pas
        comparables. Estimations des appareils, sans interprétation.
      </Notice>
    </Panel>
  );
}
export function PhoneActivityPanel({ device }: { device: DeviceDaily }) {
  if (!device.steps.length && !device.distanceKm.length) return null;
  const series: ChartSeries[] = [];
  if (device.steps.length)
    series.push({
      name: 'Pas (téléphone)',
      unit: 'pas',
      color: '#88d6bc',
      type: 'bar',
      points: device.steps.map((v) => ({ date: v.day, value: v.value })),
    });
  if (device.distanceKm.length)
    series.push({
      name: 'Distance (téléphone)',
      unit: 'km',
      color: '#85aafa',
      points: device.distanceKm.map((v) => ({ date: v.day, value: v.value })),
    });
  return (
    <Panel className="phone-panel">
      <SectionHeading
        eyebrow="VOTRE TÉLÉPHONE"
        title="Pas et distance au quotidien"
        action={<Smartphone size={16} />}
      />
      <DataChart series={series} height={220} />
      <Notice>
        Totaux quotidiens calculés par {source(device)}, qui dédoublonne téléphone et montre. Les
        jours sans donnée restent vides.
      </Notice>
    </Panel>
  );
}
