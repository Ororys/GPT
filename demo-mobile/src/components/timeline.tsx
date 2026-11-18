'use client';
import { useMemo, useState } from 'react';
import {
  CalendarClock,
  FlaskConical,
  Activity,
  FileText,
  Leaf,
  Moon,
  ArrowUpRight,
  Clock3,
} from 'lucide-react';
import type { PageProps } from './overview';
import { timeline } from '@/modules/timeline/selectors';
import { knownAt, dateLabel, withinPeriod } from '@/modules/observations/selectors';
import { Panel, Pill, Notice, Empty } from './ui';
const kinds = {
  all: 'Tout le parcours',
  biology: 'Biologie',
  sport: 'Sport',
  sleep: 'Sommeil',
  life: 'Événements de vie',
  document: 'Documents',
};
export function Timeline({ record, period, openDocument, openActivity }: PageProps) {
  const [kind, setKind] = useState('all');
  const [machine, setMachine] = useState(false);
  const [date, setDate] = useState('2026-11-06');
  const view = machine ? knownAt(record, date + 'T23:59:59Z') : record;
  const items = useMemo(
    () =>
      [
        ...timeline(view),
        ...view.sleep
          .filter((_, i) => i % 7 === 0)
          .map((s) => ({
            id: s.id,
            date: s.date,
            knownAt: s.knownAt,
            title: 'Une nuit dans votre histoire',
            detail: `${Math.round(s.durationHours * 60)} min · estimation de la montre · SDNN distinct du RMSSD`,
            kind: 'sleep' as const,
            documentId: undefined,
            activityId: undefined,
          })),
      ]
        .filter(
          (e) =>
            withinPeriod(e.date, period, view.asOf) &&
            (kind === 'all' || e.kind === kind || (kind === 'life' && e.kind === 'declared')),
        )
        .sort((a, b) => b.date.localeCompare(a.date)),
    [view, period, kind],
  );
  const [visible, setVisible] = useState(18);
  return (
    <>
      <div className="timeline-intro">
        <div>
          <span className="eyebrow">LIFEGRAPH / LE FIL COMMUN</span>
          <h2>Une histoire, plusieurs perspectives.</h2>
          <p>
            Les faits, les sources et le contexte. Reliés dans le temps, sans inventer de causalité.
          </p>
        </div>
        <button
          className={`button ${machine ? 'primary' : ''}`}
          onClick={() => setMachine(!machine)}
        >
          <CalendarClock size={17} />
          {machine ? 'Quitter la Time Machine' : 'Ouvrir la Time Machine'}
        </button>
      </div>
      {machine && (
        <Panel className="time-machine">
          <div>
            <CalendarClock size={26} />
            <span>
              <strong>Ce que votre dossier permettait de connaître</strong>
              <small>
                La date de l’événement ET la date de connaissance sont prises en compte.
              </small>
            </span>
          </div>
          <label>
            Connu au
            <input
              type="date"
              value={date}
              min="2024-01-01"
              max="2026-11-18"
              onChange={(e) => {
                if (e.target.value) setDate(e.target.value);
              }}
            />
          </label>
          <Pill tone="teal">{view.documents.length} documents connus</Pill>
        </Panel>
      )}
      <div className="chip-group timeline-filters">
        {Object.entries(kinds).map(([key, label]) => (
          <button
            className={`filter-chip ${key === kind ? 'active' : ''}`}
            key={key}
            onClick={() => {
              setKind(key);
              setVisible(18);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {items.length ? (
        <div className="timeline-feed">
          {items.slice(0, visible).map((e, i) => {
            const month = dateLabel(e.date, { month: 'long', year: 'numeric' }),
              prior =
                items[i - 1] && dateLabel(items[i - 1].date, { month: 'long', year: 'numeric' });
            return (
              <div key={e.id}>
                {month !== prior && (
                  <div className="timeline-month">
                    <span>{month}</span>
                    <i />
                  </div>
                )}
                <article className={`timeline-entry ${e.kind}`}>
                  <time dateTime={e.date}>
                    <b>{dateLabel(e.date, { day: '2-digit' })}</b>
                    <small>{dateLabel(e.date, { month: 'short' })}</small>
                  </time>
                  <span className="timeline-entry-icon">
                    {e.kind === 'biology' ? (
                      <FlaskConical size={18} />
                    ) : e.kind === 'sport' ? (
                      <Activity size={18} />
                    ) : e.kind === 'sleep' ? (
                      <Moon size={18} />
                    ) : e.kind === 'document' ? (
                      <FileText size={18} />
                    ) : (
                      <Leaf size={18} />
                    )}
                  </span>
                  <div>
                    <div className="timeline-entry-title">
                      <h3>{e.title}</h3>
                      <Pill
                        tone={
                          e.kind === 'biology' ? 'purple' : e.kind === 'sport' ? 'teal' : 'neutral'
                        }
                      >
                        {e.kind === 'biology'
                          ? 'Biologie'
                          : e.kind === 'sport'
                            ? 'Sport'
                            : e.kind === 'sleep'
                              ? 'Estimation appareil'
                              : e.kind === 'document'
                                ? 'Document'
                                : 'Déclaré'}
                      </Pill>
                    </div>
                    <p>{e.detail}</p>
                    <small>
                      <Clock3 size={11} /> Événement :{' '}
                      {dateLabel(e.date, { day: 'numeric', month: 'short', year: 'numeric' })} ·
                      connu le{' '}
                      {dateLabel(e.knownAt, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </small>
                  </div>
                  {(e.documentId || e.activityId) && (
                    <button
                      className="icon-button"
                      aria-label={`Ouvrir ${e.title}`}
                      onClick={() =>
                        e.documentId
                          ? openDocument(e.documentId)
                          : e.activityId && openActivity(e.activityId)
                      }
                    >
                      <ArrowUpRight size={18} />
                    </button>
                  )}
                </article>
              </div>
            );
          })}
          {visible < items.length && (
            <button className="button load-more" onClick={() => setVisible((v) => v + 18)}>
              Afficher la suite · {items.length - visible} repères
            </button>
          )}
        </div>
      ) : (
        <Panel>
          <Empty
            title="Aucun repère sur cette période"
            text="Modifiez la date, la période ou les catégories. Une information importée plus tard n’apparaît pas rétroactivement comme connue."
          />
        </Panel>
      )}
      <Notice>
        La Time Machine reconstitue les informations disponibles dans le jeu synthétique. Elle ne
        reconstitue pas un état de santé médical et ne déduit aucun lien causal.
      </Notice>
    </>
  );
}
