'use client';
import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Heart,
  FlaskConical,
  Moon,
  Footprints,
  MoveUpRight,
  FileText,
  Link2,
  Check,
  Activity,
  CalendarDays,
} from 'lucide-react';
import type { HealthRecord, Period, View } from '@/modules/health-records/model';
import {
  activitySummary,
  sleepSummary,
  latest,
  dateLabel,
  withinPeriod,
} from '@/modules/observations/selectors';
import { timeline } from '@/modules/timeline/selectors';
import { addDays, localDay, zoneOf } from '@/modules/observations/time';
import { Panel, Pill, SectionHeading, SourceButton, Notice, Empty } from './ui';
import { DataChart, type ChartSeries } from './chart';
import { QualityPassportModal } from './quality-passport';
import { number, hours, duration } from './format';
export interface PageProps {
  record: HealthRecord;
  period: Period;
  navigate: (view: View) => void;
  openDocument: (id: string, observationId?: string) => void;
  openActivity: (id: string) => void;
}
export function Overview({ record, period, navigate, openDocument, openActivity }: PageProps) {
  const [metric, setMetric] = useState<'restingHeartRate' | 'durationHours'>('restingHeartRate');
  const [compare, setCompare] = useState(false);
  const [passportOpen, setPassportOpen] = useState(false);
  const sport = activitySummary(record, 30);
  const sleep = sleepSummary(record, 7);
  const lastSleep = record.sleep.toSorted((a, b) => b.date.localeCompare(a.date))[0];
  const latestDoc = record.documents
    .filter((d) => d.kind === 'biology')
    .toSorted((a, b) => b.date.localeCompare(a.date))[0];
  const events = timeline(record)
    .filter((t) => t.kind !== 'sport')
    .slice(0, 3);
  const series = useMemo(() => {
    const days = period === 0 ? 90 : Math.min(period, 90);
    const zone = zoneOf(record);
    const today = localDay(record.asOf, zone);
    const allDays = Array.from({ length: days }, (_, i) => addDays(today, -(days - i - 1)));
    const byDay = new Map(record.sleep.map((s) => [localDay(s.date, zone), s]));
    const forMetric = (key: 'restingHeartRate' | 'durationHours'): ChartSeries => ({
      name: key === 'restingHeartRate' ? 'FC au repos' : 'Durée du sommeil',
      unit: key === 'restingHeartRate' ? 'bpm' : 'h',
      color: key === 'restingHeartRate' ? '#88d6bc' : '#b8a0ec',
      points: allDays.map((d) => ({
        date: d,
        value: byDay.get(d)?.[key] ?? null,
      })),
    });
    return compare
      ? [forMetric('restingHeartRate'), forMetric('durationHours')]
      : [forMetric(metric)];
  }, [record, period, metric, compare]);
  if (!record.observations.length && !record.activities.length)
    return (
      <Panel>
        <Empty
          title={`Bienvenue dans votre espace, ${record.profile.firstName}.`}
          text="Ce profil fictif est volontairement vide. Choisissez le profil Alex dans les paramètres pour explorer le dossier de démonstration."
          action={
            <button className="button primary" onClick={() => navigate('settings')}>
              Choisir un profil <ArrowRight size={16} />
            </button>
          }
        />
      </Panel>
    );
  return (
    <>
      <section className="welcome-panel">
        <div className="welcome-copy">
          <span className="eyebrow">
            <span className="live-dot" /> VOTRE MÉMOIRE PERSONNELLE
          </span>
          <h2>
            Tout se relie.
            <br />
            <span>À votre rythme.</span>
          </h2>
          <p>
            Vos bilans, vos activités, vos nuits.
            <br />
            Une histoire qui vous appartient.
          </p>
          <div className="welcome-foot">
            <span className="avatar small">{record.profile.initials}</span>
            <div>
              <strong>Le dossier d’{record.profile.firstName}</strong>
              <small>Historique synthétique depuis février 2024</small>
            </div>
          </div>
        </div>
        <div className="history-art" aria-hidden="true">
          <div className="orbit orbit-1" />
          <div className="orbit orbit-2" />
          <div className="orbit orbit-3" />
          <div className="art-line" />
          <span className="art-point p1">
            <FlaskConical size={18} />
          </span>
          <span className="art-point p2">
            <Activity size={19} />
          </span>
          <span className="art-point p3">
            <Moon size={17} />
          </span>
          <div className="art-center">
            <span className="brand-mark">
              <i />
              <i />
              <i />
            </span>
            <small>VOTRE HISTOIRE</small>
            <strong>Un même fil.</strong>
          </div>
          <span className="art-label a1">Biologie</span>
          <span className="art-label a2">Mouvement</span>
          <span className="art-label a3">Quotidien</span>
        </div>
        <div className="history-summary">
          <div>
            <span>LE RECUL POUR MIEUX VOIR</span>
            <strong>
              2 <small>ans</small> 9 <small>mois</small>
            </strong>
            <p>D’historique documenté</p>
          </div>
          <div className="summary-rule" />
          <div className="summary-item">
            <span>
              <FileText size={15} /> Documents
            </span>
            <b>{record.documents.length}</b>
          </div>
          <div className="summary-item">
            <span>
              <Link2 size={15} /> Types de sources
            </span>
            <b>3</b>
          </div>
          <Pill tone="teal">
            <Check size={12} /> Données 100 % fictives
          </Pill>
        </div>
      </section>
      <div className="metric-grid">
        <Metric
          icon={<Heart size={18} />}
          label="FC au repos"
          value={lastSleep ? number(lastSleep.restingHeartRate, 1) : '—'}
          unit="bpm"
          color="teal"
          note="Dernière estimation de la montre"
          detail={lastSleep ? dateLabel(lastSleep.date) : 'Absente'}
          points={record.sleep
            .slice(0, 18)
            .toReversed()
            .map((s) => ({ date: s.date, value: s.restingHeartRate }))}
        />
        <Metric
          icon={<Moon size={18} />}
          label="Sommeil moyen"
          value={hours(sleep.hours)}
          color="purple"
          note={`${sleep.count} nuits disponibles sur 7 jours`}
          detail="Estimation de la montre"
          points={record.sleep
            .slice(0, 18)
            .toReversed()
            .map((s) => ({ date: s.date, value: s.durationHours }))}
        />
        <Metric
          icon={<Footprints size={18} />}
          label="En mouvement"
          value={number(sport.distanceKm, 1)}
          unit="km"
          color="blue"
          note={`${sport.count} activités · ${duration(sport.durationMinutes)}`}
          detail="Sur les 30 derniers jours"
          points={sport.rows
            .slice(0, 18)
            .toReversed()
            .map((a) => ({ date: a.date, value: a.distanceKm }))}
        />
        <Metric
          icon={<FlaskConical size={18} />}
          label="Dernier bilan"
          value={latestDoc ? dateLabel(latestDoc.date, { day: 'numeric', month: 'short' }) : '—'}
          color="amber"
          note={`${record.observations.filter((o) => o.sourceId === latestDoc?.id).length} paramètres documentés`}
          detail="Source PDF disponible"
          action={() => navigate('biology')}
        />
      </div>
      <div className="overview-main-grid">
        <Panel className="trend-panel">
          <SectionHeading
            eyebrow="OBSERVER, SANS INTERPRÉTER"
            title="Le rythme de vos derniers mois"
            action={
              <div className="chart-selector">
                <button
                  className={metric === 'restingHeartRate' ? 'active' : ''}
                  onClick={() => setMetric('restingHeartRate')}
                >
                  FC au repos
                </button>
                <button
                  className={metric === 'durationHours' ? 'active' : ''}
                  onClick={() => setMetric('durationHours')}
                >
                  Sommeil
                </button>
              </div>
            }
          />
          <div className="trend-meta">
            <strong>
              {metric === 'restingHeartRate'
                ? number(
                    sleepSummary(record, Math.min(period || 90, 90) as Period).restingHeartRate ??
                      0,
                    1,
                  )
                : hours(sleepSummary(record, Math.min(period || 90, 90) as Period).hours)}
              <small>{metric === 'restingHeartRate' ? ' bpm' : ' / nuit'}</small>
            </strong>
            <span>
              Moyenne des mesures disponibles · {Math.min(period || 90, 90)} jours maximum
            </span>
            <label className="compare-toggle">
              <input
                type="checkbox"
                checked={compare}
                onChange={(e) => setCompare(e.target.checked)}
              />
              Comparer sommeil et FC
            </label>
          </div>
          <DataChart series={series} zoom height={230} />
          <Notice>
            Des évolutions simultanées ne prouvent pas un lien causal. Les jours sans mesure restent
            vides.
          </Notice>
        </Panel>
        <Panel className="last-biology">
          <SectionHeading
            eyebrow="BIOLOGIE"
            title="Votre dernier bilan"
            action={
              <button
                className="icon-button"
                onClick={() => navigate('biology')}
                aria-label="Explorer la biologie"
              >
                <ArrowUpRight size={18} />
              </button>
            }
          />
          <div className="lab-date">
            <span className="lab-icon">
              <FlaskConical size={24} />
            </span>
            <div>
              <strong>
                {latestDoc
                  ? dateLabel(latestDoc.date, { day: 'numeric', month: 'long', year: 'numeric' })
                  : 'Aucun bilan'}
              </strong>
              <small>{latestDoc?.laboratory}</small>
            </div>
          </div>
          {['FERRITIN', 'LDL_C', 'HBA1C'].map((code) => {
            const o = latest(
                record.observations.filter((o) => o.sourceId === latestDoc?.id),
                code,
              ),
              b = record.biomarkers.find((b) => b.code === code);
            return o && b ? (
              <button
                className="bio-preview"
                key={code}
                onClick={() => openDocument(o.sourceId, o.id)}
              >
                <span>
                  <i style={{ background: b.color }} />
                  {b.shortLabel}
                </span>
                <strong>
                  {number(o.value, b.decimals)} <small>{o.unit}</small>
                </strong>
                <MoveUpRight size={13} />
              </button>
            ) : null;
          })}
          <p className="subtle-note">Valeurs et références propres au document d’origine.</p>
          {latestDoc && (
            <SourceButton
              onClick={() => openDocument(latestDoc.id)}
              label="Consulter le document"
            />
          )}
        </Panel>
      </div>
      <div className="lower-grid">
        <Panel>
          <SectionHeading
            eyebrow="SPORT & MOUVEMENT"
            title="Vos dernières activités"
            action={
              <button className="text-button" onClick={() => navigate('sport')}>
                Tout voir <ArrowRight size={14} />
              </button>
            }
          />
          <div className="activity-list">
            {record.activities
              .filter((a) => withinPeriod(a.date, period))
              .slice(0, 3)
              .map((a) => (
                <button className="activity-row" key={a.id} onClick={() => openActivity(a.id)}>
                  <span className={`activity-icon ${a.sport}`}>
                    <Activity size={19} />
                  </span>
                  <span className="grow">
                    <strong>{a.title}</strong>
                    <small>
                      {dateLabel(a.date, { weekday: 'long', day: 'numeric', month: 'short' })} ·{' '}
                      {duration(a.durationMinutes)}
                    </small>
                  </span>
                  <span className="activity-distance">
                    {number(a.distanceKm, 1)} <small>km</small>
                  </span>
                  <ArrowUpRight size={15} />
                </button>
              ))}
          </div>
        </Panel>
        <Panel>
          <SectionHeading
            eyebrow="LE FIL DE VOTRE PARCOURS"
            title="Quelques repères"
            action={
              <button className="text-button" onClick={() => navigate('timeline')}>
                Timeline <ArrowRight size={14} />
              </button>
            }
          />
          <div className="mini-timeline">
            {events.map((e) => (
              <button
                key={e.id}
                className="mini-event"
                onClick={() => (e.documentId ? openDocument(e.documentId) : navigate('timeline'))}
              >
                <span className={`event-dot ${e.kind}`} />
                <span>
                  <small>{dateLabel(e.date, { day: 'numeric', month: 'long' })}</small>
                  <strong>{e.title}</strong>
                  <span>{e.detail}</span>
                </span>
                <ArrowUpRight size={14} />
              </button>
            ))}
          </div>
        </Panel>
      </div>
      <div className="quality-strip">
        <span className="quality-icon">
          <CalendarDays size={20} />
        </span>
        <div>
          <strong>La qualité commence par la transparence.</strong>
          <p>
            {record.sleep.filter((n) => withinPeriod(n.date, 90, record.asOf)).length} nuits sur 90
            jours · {new Set(record.observations.map((o) => o.code)).size} paramètres suivis ·
            références rattachées à chaque bilan.
          </p>
        </div>
        <button className="text-button" onClick={() => setPassportOpen(true)}>
          Passeport de qualité <ArrowUpRight size={15} />
        </button>
        <button className="text-button" onClick={() => navigate('documents')}>
          Explorer les sources <ArrowUpRight size={15} />
        </button>
      </div>
      <QualityPassportModal
        record={record}
        open={passportOpen}
        onClose={() => setPassportOpen(false)}
      />
    </>
  );
}
function Metric({
  icon,
  label,
  value,
  unit,
  color,
  note,
  detail,
  points,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  unit?: string;
  color: string;
  note: string;
  detail: string;
  points?: { date: string; value: number }[];
  action?: () => void;
}) {
  const chart = useMemo<ChartSeries[]>(
    () => [
      {
        name: label,
        unit: unit || '',
        color: color === 'purple' ? '#b8a0ec' : color === 'blue' ? '#8aaef3' : '#88d6bc',
        points: points || [],
      },
    ],
    [points, label, unit, color],
  );
  return (
    <Panel className={`metric-card ${color}`}>
      <div className="metric-label">
        <span>{icon}</span>
        {label}
        {action && (
          <button className="icon-button" onClick={action} aria-label={`Voir ${label}`}>
            <ArrowUpRight size={14} />
          </button>
        )}
      </div>
      <div className="metric-value">
        {value}
        <span>{unit}</span>
      </div>
      <div className="metric-foot">
        <div>
          <p>{note}</p>
          <small>{detail}</small>
        </div>
        {points && (
          <div className="mini-spark">
            <DataChart compact series={chart} height={45} />
          </div>
        )}
      </div>
    </Panel>
  );
}
