'use client';
import { useEffect, useState } from 'react';
import { Smartphone, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { DEVICE_LABEL, type DeviceSeries } from '@/modules/device/model';
import { isNativeApp, importPhoneHealth } from '@/modules/device/bridge';
import { dateLabel } from '@/modules/observations/selectors';
import { Pill } from './ui';
const message = (code: string) =>
  code === 'CONSENT_REQUIRED'
    ? 'Autorisez d’abord « Données santé du téléphone » ci-dessus.'
    : code === 'HEALTH_UNAVAILABLE'
      ? 'Santé ou Health Connect n’est pas disponible sur ce téléphone.'
      : 'L’import n’a pas abouti. Rien n’a été modifié dans votre dossier.';
export function DeviceHealth({ enabled }: { enabled: boolean }) {
  const [series, setSeries] = useState<DeviceSeries[]>([]);
  const [native, setNative] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value = isNativeApp();
      const rows = enabled
        ? ((await (
            await fetch('/api/device-imports', { cache: 'no-store' })
          ).json()) as DeviceSeries[])
        : [];
      if (!cancelled) {
        setNative(value);
        setSeries(Array.isArray(rows) ? rows : []);
      }
    })().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [enabled, result]);
  async function run() {
    setBusy(true);
    setError('');
    setResult('');
    try {
      const r = await importPhoneHealth(30);
      setResult(
        `${r.read} enregistrement(s) lu(s) · ${r.inserted} ajouté(s) · ${r.duplicates} déjà présent(s).`,
      );
    } catch (e) {
      setError(message(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="device-health" aria-labelledby="device-title">
      <h3 id="device-title">Données santé du téléphone</h3>
      {!enabled ? (
        <p>Nécessite le mode PostgreSQL.</p>
      ) : (
        <>
          <div className="source-setting">
            <Smartphone size={20} />
            <div>
              <strong>
                {native ? 'Application mobile' : 'Depuis l’application mobile uniquement'}
              </strong>
              <small>
                {native
                  ? 'Lecture des 30 derniers jours, après votre accord dans Santé ou Health Connect. Rien n’est écrit sur le téléphone.'
                  : 'La lecture de Santé (iPhone) et Health Connect (Android) se fait dans l’application Convergence, pas dans un navigateur.'}
              </small>
            </div>
            {native ? (
              <button className="button" disabled={busy} onClick={() => void run()}>
                {busy ? 'Import…' : 'Importer'}
              </button>
            ) : (
              <Pill>Application mobile</Pill>
            )}
          </div>
          {result && (
            <div className="feedback success" role="status">
              <CheckCircle2 size={16} />
              {result}
            </div>
          )}
          {error && (
            <div className="feedback error" role="alert">
              <TriangleAlert size={16} />
              {error}
            </div>
          )}
          {series.length > 0 && (
            <ul className="device-series">
              {series.map((s) => (
                <li key={s.platform + s.type}>
                  {DEVICE_LABEL[s.type]} · {s.count} enregistrement(s) ·{' '}
                  {dateLabel(s.first, { day: 'numeric', month: 'short' })} →{' '}
                  {dateLabel(s.last, { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                  {s.platform === 'healthkit' ? 'Santé (iPhone)' : 'Health Connect'}
                </li>
              ))}
            </ul>
          )}
          <p className="consent-note">
            Ces données sont conservées telles que reçues, avec leur source. Leur affichage dans les
            pages Sport et Vue d’ensemble sera ajouté séparément, sans mélange avec le jeu
            synthétique.
          </p>
        </>
      )}
    </section>
  );
}
