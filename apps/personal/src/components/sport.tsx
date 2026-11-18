'use client';
import { PhoneActivityPanel } from './phone-panels';
import { localDay, weekStart, zoneOf } from '@/modules/observations/time';
import { useState } from 'react';
import { Bike, Footprints, Waves, ArrowUpRight, Timer, Route, Mountain, Info } from 'lucide-react';
import type { PageProps } from './overview';
import { activitySummary, dateLabel } from '@/modules/observations/selectors';
import { Panel, Pill, SectionHeading, Notice, Empty } from './ui';
import { DataChart, type ChartSeries } from './chart';
import { number, duration } from './format';
const sports = {
  all: 'Tous les sports',
  running: 'Course à pied',
  cycling: 'Vélo',
  walking: 'Marche',
  swimming: 'Natation',
};
export function Sport({ record, period, openActivity }: PageProps) {
  const [sport, setSport] = useState<keyof typeof sports>('all');
  const [sort, setSort] = useState('recent');
  const summary = activitySummary(record, period);
  const selected = summary.rows.filter((a) => sport === 'all' || a.sport === sport);
  const totalDistance = selected.reduce((n, a) => n + a.distanceKm, 0),
    totalMinutes = selected.reduce((n, a) => n + a.durationMinutes, 0);
  const rows = selected.toSorted((a, b) =>
    sort === 'distance' ? b.distanceKm - a.distanceKm : b.date.localeCompare(a.date),
  );
  const chart: ChartSeries[] = (() => {
    const byWeek = new Map<string, number>();
    for (const a of selected) {
      const day = weekStart(localDay(a.date, zoneOf(record)));
      byWeek.set(day, (byWeek.get(day) || 0) + a.durationMinutes);
    }
    return [
      {
        name: 'Volume hebdomadaire',
        unit: 'min',
        color: '#88d6bc',
        type: 'bar',
        points: [...byWeek].sort().map(([date, value]) => ({ date, value })),
      },
    ];
  })();
  if (!record.activities.length)
    return (
      <>
        {record.device && <PhoneActivityPanel device={record.device} />}
        <Panel>
          <Empty
            title="Votre prochain mouvement commence ici"
            text="Aucune séance d’activité dans ce dossier. Pas et distance du téléphone s’affichent ci-dessus une fois importés depuis l’application mobile."
          />
        </Panel>
      </>
    );
  return (
    <>
      {record.device && <PhoneActivityPanel device={record.device} />}
      <div className="sport-hero">
        <div>
          <span className="eyebrow">CHAQUE MOUVEMENT COMPTE</span>
          <h2>Un rythme qui vous ressemble.</h2>
          <p>
            Observez votre régularité. Retrouvez vos séances.
            <br />
            Sans transformer chaque journée en compétition.
          </p>
          <Pill tone="teal">Capteur de démonstration · série A</Pill>
        </div>
        <div className="sport-motif" aria-hidden="true">
          <svg viewBox="0 0 380 180">
            <path d="M-20 160 C20 40 80 220 120 90 S210 110 240 40 S310 180 400 0" />
            <path d="M-20 175 C20 55 80 235 120 105 S210 125 240 55 S310 195 400 15" />
            <path d="M-20 190 C20 70 80 250 120 120 S210 140 240 70 S310 210 400 30" />
            <circle cx="241" cy="42" r="6" />
          </svg>
        </div>
      </div>
      <div className="sport-filter-row">
        <div className="chip-group">
          {(Object.entries(sports) as [keyof typeof sports, string][]).map(([key, name]) => (
            <button
              key={key}
              className={`filter-chip ${sport === key ? 'active' : ''}`}
              onClick={() => setSport(key)}
            >
              {key === 'cycling' ? (
                <Bike size={15} />
              ) : key === 'swimming' ? (
                <Waves size={15} />
              ) : key !== 'all' ? (
                <Footprints size={15} />
              ) : null}
              {name}
            </button>
          ))}
        </div>
        <span className="muted">{selected.length} activités sur la période</span>
      </div>
      <div className="sport-stats">
        <Panel>
          <span>
            <Route size={16} /> Distance cumulée
          </span>
          <strong>
            {number(totalDistance, 1)} <small>km</small>
          </strong>
          <p>Somme des activités affichées</p>
        </Panel>
        <Panel>
          <span>
            <Timer size={16} /> Temps en mouvement
          </span>
          <strong>{duration(totalMinutes)}</strong>
          <p>{selected.length} activités enregistrées</p>
        </Panel>
        <Panel>
          <span>
            <Mountain size={16} /> Dénivelé positif
          </span>
          <strong>
            {number(selected.reduce((n, a) => n + a.ascentM, 0))} <small>m</small>
          </strong>
          <p>Données du même capteur fictif</p>
        </Panel>
      </div>
      <div className="sport-chart-grid">
        <Panel>
          <SectionHeading
            eyebrow="LA RÉGULARITÉ AVANT LE SCORE"
            title="Votre volume, semaine après semaine"
            action={<Pill>Durée · min</Pill>}
          />
          {selected.length ? (
            <DataChart series={chart} height={230} zoom />
          ) : (
            <Empty
              title="Aucune séance dans ce sport"
              text="Choisissez un autre sport ou une autre période."
            />
          )}
        </Panel>
        <Panel className="distribution">
          <SectionHeading eyebrow="VOTRE ÉQUILIBRE" title="À chaque sport sa place" />
          {Object.entries(sports)
            .filter(([key]) => key !== 'all')
            .map(([key, label]) => {
              const min = summary.rows
                  .filter((a) => a.sport === key)
                  .reduce((n, a) => n + a.durationMinutes, 0),
                total = summary.durationMinutes;
              return (
                <div className={`distribution-item ${key}`} key={key}>
                  <div>
                    <span>{label}</span>
                    <b>{duration(min)}</b>
                  </div>
                  <div className="distribution-track">
                    <i style={{ width: `${total ? (100 * min) / total : 0}%` }} />
                  </div>
                </div>
              );
            })}
          <Notice>
            La charge et les zones d’effort ne sont pas calculées : seuils individuels et protocoles
            non disponibles.
          </Notice>
        </Panel>
      </div>
      <Panel>
        <SectionHeading
          eyebrow="LE CARNET D’ENTRAÎNEMENT"
          title="Retrouver une activité"
          action={
            <select
              aria-label="Trier les activités"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="recent">Les plus récentes</option>
              <option value="distance">Distance décroissante</option>
            </select>
          }
        />
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Activité</th>
                <th>Date</th>
                <th>Distance</th>
                <th>Durée</th>
                <th>FC moyenne</th>
                <th>Détail</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((a) => (
                <tr key={a.id}>
                  <td>
                    <span className="sport-table-label">
                      <span className={`activity-icon ${a.sport}`}>
                        {a.sport === 'cycling' ? (
                          <Bike size={16} />
                        ) : a.sport === 'swimming' ? (
                          <Waves size={16} />
                        ) : (
                          <Footprints size={16} />
                        )}
                      </span>
                      {a.title}
                    </span>
                  </td>
                  <td>{dateLabel(a.date, { day: 'numeric', month: 'short' })}</td>
                  <td className="numeric">{number(a.distanceKm, 1)} km</td>
                  <td className="numeric">{duration(a.durationMinutes)}</td>
                  <td className="numeric">
                    {a.avgHeartRate ? `${a.avgHeartRate} bpm` : 'Absente'}
                  </td>
                  <td>
                    <button
                      className="icon-button"
                      onClick={() => openActivity(a.id)}
                      aria-label={`Analyser ${a.title} du ${a.date.slice(0, 10)}`}
                    >
                      <ArrowUpRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <Info size={13} /> {Math.min(rows.length, 20)} activités affichées sur {rows.length}. Les
          valeurs sont synthétiques et ne servent pas à établir une aptitude sportive.
        </div>
      </Panel>
    </>
  );
}
