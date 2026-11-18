'use client';
import { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, TriangleAlert } from 'lucide-react';
import { CONSENT_LABEL, type ConsentState } from '@/modules/consent/model';
import { dateLabel } from '@/modules/observations/selectors';
import { Pill } from './ui';
export function ConsentSettings({ enabled }: { enabled: boolean }) {
  const [consents, setConsents] = useState<ConsentState[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    const res = await fetch('/api/consents', { cache: 'no-store' });
    if (!res.ok) throw Error('Autorisations indisponibles.');
    setConsents(await res.json());
  }, []);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      const res = await fetch('/api/consents', { cache: 'no-store' });
      if (!res.ok) throw Error('Autorisations indisponibles.');
      const value = (await res.json()) as ConsentState[];
      if (!cancelled) setConsents(value);
    })().catch((e: Error) => {
      if (!cancelled) setError(e.message);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  async function toggle(c: ConsentState) {
    setBusy(true);
    setError('');
    try {
      const res = await fetch('/api/consents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ source: c.source, expectedVersion: c.version, granted: !c.granted }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw Error(
          data.error === 'CONSENT_CONFLICT'
            ? 'Cette autorisation a changé entre-temps. Affichage actualisé.'
            : 'Modification impossible.',
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Modification impossible.');
    } finally {
      await load().catch(() => undefined);
      setBusy(false);
    }
  }
  return (
    <section className="consent-settings" aria-labelledby="consent-title">
      <h3 id="consent-title">Ce que vous autorisez</h3>
      {!enabled ? (
        <p>Les autorisations versionnées nécessitent le mode PostgreSQL.</p>
      ) : (
        <>
          {consents?.map((c) => (
            <div className="source-setting" key={c.source}>
              <ShieldCheck size={20} />
              <div>
                <strong>{CONSENT_LABEL[c.source].title}</strong>
                <small>{CONSENT_LABEL[c.source].detail}</small>
                {c.history.length > 0 && (
                  <details>
                    <summary>Historique ({c.history.length})</summary>
                    <ol>
                      {c.history.map((h) => (
                        <li key={h.version}>
                          v{h.version} · {h.granted ? 'autorisé' : 'retiré'} ·{' '}
                          {dateLabel(h.decidedAt, {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}{' '}
                          · {h.decidedBy}
                        </li>
                      ))}
                    </ol>
                  </details>
                )}
              </div>
              <Pill tone={c.granted ? 'teal' : 'amber'}>{c.granted ? 'Autorisé' : 'Retiré'}</Pill>
              <button
                className="button"
                disabled={busy}
                onClick={() => void toggle(c)}
                aria-label={`${c.granted ? 'Retirer' : 'Autoriser'} : ${CONSENT_LABEL[c.source].title}`}
              >
                {c.granted ? 'Retirer' : 'Autoriser'}
              </button>
            </div>
          ))}
          {error && (
            <div className="feedback error" role="alert">
              <TriangleAlert size={16} />
              {error}
            </div>
          )}
          <p className="consent-note">
            Retirer une autorisation bloque les nouveaux ajouts depuis cette entrée, contrôlé par la
            base. Les données déjà ajoutées restent : leur effacement relève de règles de
            conservation non encore arrêtées. Chaque décision est versionnée et journalisée.
          </p>
        </>
      )}
    </section>
  );
}
