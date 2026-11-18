'use client';
import { useMemo } from 'react';
import type { Activity } from '@/modules/health-records/model';
import { dateLabel } from '@/modules/observations/selectors';
import { Modal, Pill, Notice } from './ui';
import { DataChart, type ChartSeries } from './chart';
import { number, duration } from './format';
export function ActivityModal({
  activity,
  onClose,
}: {
  activity: Activity | undefined;
  onClose: () => void;
}) {
  const series = useMemo<ChartSeries[]>(
    () =>
      activity
        ? [
            {
              name: 'Fréquence cardiaque',
              unit: 'bpm',
              color: '#b8a0ec',
              points: activity.samples.map((s) => ({
                date: new Date(Date.parse(activity.date) + s.minute * 60_000).toISOString(),
                value: s.heartRate,
              })),
            },
            {
              name: 'Vitesse',
              unit: 'km/h',
              color: '#88d6bc',
              points: activity.samples.map((s) => ({
                date: new Date(Date.parse(activity.date) + s.minute * 60_000).toISOString(),
                value: s.speedKmh,
              })),
            },
          ]
        : [],
    [activity],
  );
  return (
    <Modal
      open={!!activity}
      onOpenChange={(v) => !v && onClose()}
      title={activity?.title || 'Activité'}
      description="Analyse descriptive d’une activité synthétique · axes distincts et temps synchronisé."
      wide
    >
      {activity && (
        <>
          <div className="activity-modal-meta">
            <Pill tone="teal">
              {dateLabel(activity.date, { day: 'numeric', month: 'long', year: 'numeric' })}
            </Pill>
            <span>{number(activity.distanceKm, 1)} km</span>
            <span>{duration(activity.durationMinutes)}</span>
            <span>{activity.ascentM} m D+</span>
          </div>
          {activity.avgHeartRate ? (
            <DataChart series={series} zoom height={290} />
          ) : (
            <Notice>
              La fréquence cardiaque est absente de cette séance. Aucune courbe de FC n’est
              présentée.
            </Notice>
          )}
          <Notice>
            Échantillons synthétiques générés, et non fichier FIT/GPX importé. {activity.device}.
            Aucune zone d’effort personnalisée ni estimation de charge clinique.
          </Notice>
        </>
      )}
    </Modal>
  );
}
