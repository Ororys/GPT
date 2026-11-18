'use client';
import { useMemo } from 'react';
import { DataChart, type ChartSeries } from './chart';
export function ChartBenchmark() {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        name: 'Série technique synthétique',
        unit: 'bpm',
        color: '#88d6bc',
        points: Array.from({ length: 10000 }, (_, i) => ({
          date: new Date(Date.parse('2026-11-10T00:00:00Z') + i * 60000).toISOString(),
          value: i % 211 === 0 ? null : 60 + 8 * Math.sin(i / 170),
          id: String(i),
        })),
      },
    ],
    [],
  );
  return (
    <main style={{ maxWidth: 1000, margin: '40px auto', padding: 24 }}>
      <h1>Banc graphique · 10 000 points synthétiques</h1>
      <p>Page technique. Aucun patient, aucune promesse de performance ou interprétation.</p>
      <DataChart series={series} zoom height={400} />
    </main>
  );
}
