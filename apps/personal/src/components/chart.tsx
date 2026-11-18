'use client';
import { useEffect, useRef, useState } from 'react';
import { prepareChartData } from '@/modules/observations/chart-data';
import { DEFAULT_TIME_ZONE } from '@/modules/observations/time';
/** Calendar-day keys (YYYY-MM-DD) are already local; instants are shown in the dossier zone. */
const isDayKey = (d: string) => d.length === 10;
const at = (d: string) => Date.parse(isDayKey(d) ? d + 'T00:00:00Z' : d);
const label = (d: string, options: Intl.DateTimeFormatOptions) =>
  new Date(at(d)).toLocaleString('fr-FR', {
    ...options,
    timeZone: isDayKey(d) ? 'UTC' : DEFAULT_TIME_ZONE,
  });
import * as echarts from 'echarts/core';
import { LineChart, BarChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  AriaComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { Table2, ChartNoAxesCombined } from 'lucide-react';
echarts.use([
  LineChart,
  BarChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  LegendComponent,
  AriaComponent,
  CanvasRenderer,
]);
export interface ChartSeries {
  name: string;
  unit: string;
  color: string;
  points: { date: string; value: number | null; id?: string }[];
  type?: 'line' | 'bar';
}
export function DataChart({
  series,
  height = 240,
  zoom = false,
  onPoint,
  compact = false,
}: {
  series: ChartSeries[];
  height?: number;
  zoom?: boolean;
  onPoint?: (id: string) => void;
  compact?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const click = useRef(onPoint);
  const [table, setTable] = useState(false);
  const [tableLimit, setTableLimit] = useState(250);
  const prepared = prepareChartData(series);
  useEffect(() => {
    click.current = onPoint;
  }, [onPoint]);
  useEffect(() => {
    if (!root.current || table) return;
    const element = root.current;
    const chart = echarts.init(element, undefined, { renderer: 'canvas' });
    const { dates, lookups, intraday } = prepareChartData(series);
    const dark = document.documentElement.dataset.theme !== 'light';
    const text = dark ? '#9eafae' : '#536967';
    const grid = dark ? '#ffffff0b' : '#143c3510';
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const multiYear = dates.length > 1 && new Set(dates.map((d) => d.slice(0, 4))).size > 1;
    const dayKeys = dates.some(isDayKey);
    // Axis labels: ms from the time axis back to a readable local date or time.
    const tick = (ms: number) => {
      const iso = new Date(ms).toISOString();
      return intraday
        ? label(iso, { hour: '2-digit', minute: '2-digit' })
        : label(dayKeys ? iso.slice(0, 10) : iso, {
            day: 'numeric',
            month: 'short',
            ...(multiYear ? { year: '2-digit' as const } : {}),
          });
    };
    chart.setOption({
      animation: !reduced,
      animationDuration: 500,
      aria: { enabled: true },
      grid: {
        top: compact ? 8 : 24,
        right: series.length > 1 ? 40 : 15,
        bottom: zoom ? 55 : 28,
        left: compact ? 5 : 42,
        containLabel: false,
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: dark ? '#1d302e' : '#fff',
        borderColor: dark ? '#3e5753' : '#d1dfda',
        textStyle: { color: dark ? '#eff6f2' : '#1d3330', fontFamily: 'Inter Variable' },
        valueFormatter: (value: unknown) => {
          const v = Array.isArray(value) ? value[1] : value;
          return typeof v === 'number'
            ? v.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
            : 'Donnée absente';
        },
      },
      // Time axis: spacing is proportional to elapsed time, so a one-year gap looks like one.
      xAxis: {
        type: 'time',
        // Daily data: never two ticks within the same day (otherwise labels repeat the date).
        ...(dayKeys && !intraday ? { minInterval: 86_400_000 } : {}),
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisPointer: { label: { formatter: (p: { value: number }) => tick(p.value) } },
        axisLabel: {
          show: !compact,
          color: text,
          fontSize: 10,
          margin: 14,
          hideOverlap: true,
          formatter: (ms: number) => tick(ms),
        },
      },
      yAxis: series.map((s, i) => ({
        type: 'value',
        position: i === 0 ? 'left' : 'right',
        scale: true,
        name: compact ? '' : s.unit,
        nameTextStyle: { color: text, fontSize: 10, align: 'left' },
        axisLabel: { show: !compact, color: text, fontSize: 10 },
        splitLine: { show: !compact && i === 0, lineStyle: { color: grid, type: 'dashed' } },
        splitNumber: 3,
      })),
      dataZoom: zoom
        ? [
            { type: 'inside', start: 0, end: 100 },
            {
              type: 'slider',
              height: 15,
              bottom: 0,
              borderColor: 'transparent',
              backgroundColor: 'transparent',
              fillerColor: dark ? '#83d5bc16' : '#247a6615',
              dataBackground: { lineStyle: { color: '#63827a' } },
              handleStyle: { color: '#79bba5', borderWidth: 0 },
              textStyle: { color: text },
              showDetail: false,
            },
          ]
        : [],
      series: series.map((s, i) => ({
        name: `${s.name} (${s.unit})`,
        type: s.type || 'line',
        yAxisIndex: i,
        data: dates.map((date) => {
          const p = lookups[i].get(date);
          return { value: [at(date), p?.value ?? null], id: p?.id };
        }),
        connectNulls: false,
        smooth: 0.25,
        showSymbol: s.points.length < 15,
        symbol: 'circle',
        symbolSize: 7,
        sampling: 'lttb',
        large: s.type === 'bar',
        barMaxWidth: 20,
        itemStyle: { color: s.color, borderRadius: s.type === 'bar' ? [4, 4, 0, 0] : undefined },
        lineStyle: { width: 2, color: s.color },
        areaStyle:
          s.type === 'bar'
            ? undefined
            : {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: s.color + '25' },
                  { offset: 1, color: s.color + '00' },
                ]),
              },
        emphasis: { focus: 'series' },
      })),
    });
    chart.on('click', (event) => {
      const data = event.data as { id?: string };
      if (data?.id) click.current?.(data.id);
    });
    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(element);
    const mutation = new MutationObserver(() => {
      const isDark = document.documentElement.dataset.theme !== 'light';
      const c = isDark ? '#9eafae' : '#536967';
      chart.setOption({
        xAxis: { axisLabel: { color: c } },
        yAxis: series.map(() => ({
          axisLabel: { color: c },
          nameTextStyle: { color: c },
          splitLine: { lineStyle: { color: isDark ? '#ffffff0b' : '#143c3510' } },
        })),
        tooltip: {
          backgroundColor: isDark ? '#1d302e' : '#fff',
          textStyle: { color: isDark ? '#eff6f2' : '#1d3330' },
        },
      });
    });
    mutation.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => {
      observer.disconnect();
      mutation.disconnect();
      chart.dispose();
    };
  }, [series, zoom, table, compact]);
  return (
    <div className="chart-container">
      {!compact && (
        <div className="chart-access">
          <button
            className="text-button"
            onClick={() => setTable(!table)}
            aria-label={
              table
                ? 'Graphique : revenir au graphique'
                : 'Tableau accessible : afficher les données'
            }
          >
            {table ? <ChartNoAxesCombined size={13} /> : <Table2 size={13} />}{' '}
            {table ? 'Graphique' : 'Tableau accessible'}
          </button>
        </div>
      )}
      {table ? (
        <div key="table" className="chart-table" style={{ height }}>
          <table>
            <caption>
              Données du graphique, heure de Paris. Une case vide indique une donnée absente.
            </caption>
            <thead>
              <tr>
                <th>Date</th>
                {series.map((s) => (
                  <th key={s.name}>
                    {s.name} · {s.unit}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {prepared.dates.slice(0, tableLimit).map((d) => (
                <tr key={d}>
                  <td>
                    {isDayKey(d)
                      ? d
                      : label(d, {
                          year: 'numeric',
                          month: '2-digit',
                          day: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                  </td>
                  {series.map((s, i) => (
                    <td key={s.name}>
                      {prepared.lookups[i].get(d)?.value?.toLocaleString('fr-FR') ?? '—'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          {prepared.dates.length > tableLimit && (
            <button className="button small" onClick={() => setTableLimit((v) => v + 250)}>
              Afficher 250 points supplémentaires ({tableLimit} sur {prepared.dates.length})
            </button>
          )}
        </div>
      ) : (
        <div
          key="canvas"
          ref={root}
          className="echart"
          style={{ height }}
          role="img"
          aria-label={series
            .map(
              (s) =>
                `${s.name} en ${s.unit}, ${s.points.filter((p) => p.value !== null).length} mesures`,
            )
            .join('. ')}
        />
      )}
      {!compact && (
        <div className="chart-legend">
          {series.map((s) => (
            <span key={s.name}>
              <i style={{ background: s.color }} />
              {s.name} <small>{s.unit}</small>
            </span>
          ))}
          <span className="chart-note">
            Heure de Paris · temps proportionnel · lacunes conservées
          </span>
        </div>
      )}
    </div>
  );
}
