'use client';
import { useMemo, useState } from 'react';
import {
  Search,
  ArrowUpRight,
  FlaskConical,
  Download,
  FileCheck2,
  Filter,
  Info,
} from 'lucide-react';
import { latest, dateLabel, withinPeriod } from '@/modules/observations/selectors';
import type { PageProps } from './overview';
import { Panel, Pill, SectionHeading, SourceButton, Notice, Empty } from './ui';
import { DataChart, type ChartSeries } from './chart';
import { number } from './format';
export function Biology({ record, period, openDocument }: PageProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Tous');
  const [selected, setSelected] = useState('FERRITIN');
  const [compare, setCompare] = useState(false);
  const [allHistory, setAllHistory] = useState(true);
  const rows = record.biomarkers.filter(
    (b) =>
      (category === 'Tous' || b.category === category) &&
      `${b.label} ${b.shortLabel}`.toLowerCase().includes(query.toLowerCase()),
  );
  const definition = record.biomarkers.find((b) => b.code === selected)!;
  const observed = record.observations
    .filter((o) => o.code === selected && (allHistory || withinPeriod(o.measuredAt, period)))
    .toSorted((a, b) => a.measuredAt.localeCompare(b.measuredAt));
  const last = observed.at(-1);
  const chartSeries = useMemo<ChartSeries[]>(
    () =>
      [selected, ...(compare && selected !== 'LDL_C' ? ['LDL_C'] : [])].map((code) => {
        const b = record.biomarkers.find((b) => b.code === code)!;
        return {
          name: b.shortLabel,
          unit: b.unit,
          color: b.color,
          points: record.observations
            .filter((o) => o.code === code && (allHistory || withinPeriod(o.measuredAt, period)))
            .map((o) => ({ date: o.measuredAt, value: o.value, id: o.id })),
        };
      }),
    [selected, compare, record, period, allHistory],
  );
  if (!record.observations.length)
    return (
      <Panel>
        <Empty
          title="Vos bilans trouveront leur place ici"
          text="Aucun résultat biologique dans ce dossier fictif."
        />
      </Panel>
    );
  const csv = () => {
    const text = [
      'date,parametre,valeur,unite,document',
      ...observed.map((o) => `${o.measuredAt},${o.code},${o.value},${o.unit},${o.sourceId}`),
    ].join('\n');
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected}-synthetique.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <div className="page-insight">
        <span className="page-insight-icon purple">
          <FlaskConical size={23} />
        </span>
        <div>
          <strong>Vos résultats. Leur histoire. Leurs sources.</strong>
          <p>
            {record.documents.filter((d) => d.kind === 'biology').length} bilans fictifs ·{' '}
            {record.biomarkers.length} paramètres · aucune interprétation médicale
          </p>
        </div>
        <Pill tone="purple">
          <FileCheck2 size={12} /> Provenance documentée
        </Pill>
      </div>
      <div className="biology-layout">
        <Panel className="biomarker-directory">
          <SectionHeading title="Vos biomarqueurs" action={<Filter size={16} />} />
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Rechercher un biomarqueur"
              placeholder="Rechercher un paramètre…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <label className="select-label">
            Catégorie
            <select
              aria-label="Catégorie biologique"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {['Tous', ...new Set(record.biomarkers.map((b) => b.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="biomarker-list">
            {rows.length ? (
              rows.map((b) => {
                const o = latest(record.observations, b.code);
                return (
                  <button
                    className={`biomarker-option ${selected === b.code ? 'selected' : ''}`}
                    key={b.code}
                    onClick={() => setSelected(b.code)}
                  >
                    <span className="biomarker-dot" style={{ background: b.color }} />
                    <div>
                      <strong>{b.shortLabel}</strong>
                      <small>{b.category}</small>
                    </div>
                    <span className="bio-number">
                      {o ? number(o.value, b.decimals) : '—'}
                      <small>{b.unit}</small>
                    </span>
                  </button>
                );
              })
            ) : (
              <Empty
                title="Aucun paramètre trouvé"
                text="Essayez un autre nom ou une autre catégorie."
              />
            )}
          </div>
          <p className="subtle-note directory-note">
            Les catégories organisent vos données. Elles ne constituent pas des profils de risque.
          </p>
        </Panel>
        <div className="biology-main">
          <Panel>
            <SectionHeading
              eyebrow={definition.category.toUpperCase()}
              title={definition.label}
              action={
                <button className="button small" onClick={csv}>
                  <Download size={14} /> Exporter CSV
                </button>
              }
            />
            <div className="biology-value-row">
              <div className="large-value">
                {last ? number(last.value, definition.decimals) : '—'}{' '}
                <small>{definition.unit}</small>
                <span>
                  {last
                    ? dateLabel(last.measuredAt, { day: 'numeric', month: 'long', year: 'numeric' })
                    : 'Aucune mesure dans cette période'}
                </span>
              </div>
              <div className="biology-controls">
                <label>
                  <input
                    type="checkbox"
                    checked={allHistory}
                    onChange={(e) => setAllHistory(e.target.checked)}
                  />
                  Tout l’historique
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={compare}
                    onChange={(e) => setCompare(e.target.checked)}
                  />
                  Comparer au LDL <small>(axe distinct)</small>
                </label>
              </div>
            </div>
            {observed.length ? (
              <DataChart
                series={chartSeries}
                zoom
                height={280}
                onPoint={(id) => {
                  const o = record.observations.find((o) => o.id === id);
                  if (o) openDocument(o.sourceId, o.id);
                }}
              />
            ) : (
              <Empty
                title="Aucune mesure sur cette période"
                text="Activez tout l’historique pour retrouver les bilans précédents."
              />
            )}
            <Notice>
              Cliquez sur un point pour retrouver sa source. Les deux unités restent sur des axes
              distincts ; aucune association médicale n’est calculée.
            </Notice>
          </Panel>
          {last && !last.reference && definition.category === 'Mesures du centre' && (
            <div className="reference-card">
              <Info size={19} />
              <div>
                <strong>Protocole de la mesure sélectionnée</strong>
                <p>{last.method}</p>
                <small>
                  Mesure du centre, sans plage de référence. Un changement de protocole ou
                  d’appareil rend les valeurs non directement comparables.
                </small>
              </div>
              <SourceButton onClick={() => openDocument(last.sourceId, last.id)} />
            </div>
          )}
          {last?.reference && (
            <div className="reference-card">
              <Info size={19} />
              <div>
                <strong>Référence du bilan sélectionné</strong>
                <p>
                  {last.reference.low}–{last.reference.high} {last.reference.unit} ·{' '}
                  {last.reference.laboratory}
                </p>
                <small>
                  Plage fictive propre à ce document, sans norme universelle ni interprétation
                  clinique.
                </small>
              </div>
              <SourceButton onClick={() => openDocument(last.sourceId, last.id)} />
            </div>
          )}
          <Panel>
            <SectionHeading
              title="Chaque valeur a une origine"
              action={<Pill>{observed.length} résultats</Pill>}
            />
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date de mesure</th>
                    <th>Résultat</th>
                    <th>Unité originale</th>
                    <th>Statut</th>
                    <th>Document source</th>
                  </tr>
                </thead>
                <tbody>
                  {observed.toReversed().map((o) => (
                    <tr key={o.id}>
                      <td>
                        {dateLabel(o.measuredAt, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="numeric strong">{number(o.value, definition.decimals)}</td>
                      <td>{o.evidence.originalUnit}</td>
                      <td>
                        <Pill tone={o.quality === 'needs-review' ? 'amber' : 'teal'}>
                          {o.quality === 'needs-review' ? 'À vérifier' : 'Fixture vérifiée'}
                        </Pill>
                      </td>
                      <td>
                        <button
                          className="source-button"
                          onClick={() => openDocument(o.sourceId, o.id)}
                        >
                          Bilan source <ArrowUpRight size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
