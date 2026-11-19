'use client';
import { useCallback, useEffect, useState } from 'react';
import {
  Download,
  FileText,
  LockKeyhole,
  ShieldCheck,
  Smartphone,
  Trash2,
  TriangleAlert,
  CheckCircle2,
} from 'lucide-react';
import { CONSENT_LABEL } from '@/modules/consent/model';
import { deviceStore, eraseEverything, lock } from '@/modules/local/session';
import type { LocalConsentState, LocalSource } from '@/modules/local/store';
import { AI_PROVIDER } from '@/modules/ai/contract';
import { isNativeApp, importPhoneHealth } from '@/modules/device/bridge';
import { dateLabel } from '@/modules/observations/selectors';
import { consultationSummary } from '@/modules/summary/model';
import { consultationSummaryPdf } from '@/modules/summary/pdf';
import type { HealthRecord } from '@/modules/health-records/model';
import { NoticeText } from './device-gate';
import { Panel, Pill, Notice } from './ui';
const LABEL: Record<LocalSource, { title: string; detail: string }> = {
  'device-health': CONSENT_LABEL['device-health'],
  'pdf-documents': {
    title: 'Documents PDF',
    detail: 'Ranger vos PDF sur ce téléphone, chiffrés, tels que vous les ajoutez.',
  },
  'ai-reading': {
    title: `Lecture des PDF par une IA (${AI_PROVIDER})`,
    detail: `Quand vous le demandez pour un document, le PDF est envoyé à ${AI_PROVIDER}, qui recopie ses valeurs sans les interpréter. Vous choisissez ensuite ce qui est ajouté. Rien n’est envoyé sans votre accord à chaque envoi.`,
  },
};
/** Saves a file through the browser; on a phone, behaviour depends on the WebView. */
function saveFile(bytes: BlobPart, type: string, name: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
export function DeviceSettings({
  record,
  onChanged,
}: {
  record: HealthRecord;
  onChanged: () => Promise<void>;
}) {
  const [consents, setConsents] = useState<LocalConsentState[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [summaryPeriod, setSummaryPeriod] = useState(365);
  const [confirmText, setConfirmText] = useState('');
  // Rendered only after unlocking, in the browser: no server render to match.
  const [native] = useState(isNativeApp);
  const load = useCallback(async () => setConsents(await deviceStore().consents()), []);
  useEffect(() => {
    let alive = true;
    deviceStore()
      .consents()
      .then(
        (value) => alive && setConsents(value),
        () => alive && setError('Autorisations indisponibles.'),
      );
    return () => {
      alive = false;
    };
  }, []);
  async function run(task: () => Promise<string | void>) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const message = await task();
      if (message) setInfo(message);
    } catch (e) {
      const code = e instanceof Error ? e.message : '';
      setError(
        code === 'CONSENT_REQUIRED'
          ? 'Autorisez d’abord « Données santé du téléphone » ci-dessus.'
          : code === 'HEALTH_UNAVAILABLE'
            ? 'Santé ou Health Connect n’est pas disponible sur ce téléphone.'
            : code === 'CONSENT_CONFLICT'
              ? 'Cette autorisation a changé entre-temps. Affichage actualisé.'
              : 'L’opération n’a pas abouti. Rien n’a été modifié.',
      );
    } finally {
      await load().catch(() => undefined);
      setBusy(false);
    }
  }
  const decide = (c: LocalConsentState, granted: boolean, erase = false) =>
    run(async () => {
      await deviceStore().setConsent(c.source as LocalSource, c.version, granted, erase);
      await onChanged();
      return erase ? 'Autorisation retirée et données de cette source effacées.' : undefined;
    });
  return (
    <div className="settings-grid">
      <Panel>
        <h2>Vos données restent sur ce téléphone</h2>
        <p>Chiffrées avec votre code. Aucun serveur, aucun compte, aucune mesure d’audience.</p>
        <details>
          <summary>Relire l’information</summary>
          <NoticeText />
        </details>
        <div className="device-actions">
          <button className="button" onClick={lock}>
            <LockKeyhole size={16} /> Verrouiller maintenant
          </button>
        </div>
        <h3>Exporter mes données</h3>
        <p>
          Fichier complet (JSON) : documents PDF inclus, autorisations, données du téléphone. C’est
          aussi votre sauvegarde : gardez-le en lieu sûr, il n’est pas chiffré.
        </p>
        <button
          className="button"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const data = await deviceStore().exportAll();
              saveFile(
                JSON.stringify(data, null, 2),
                'application/json',
                'convergence-export.json',
              );
              return 'Export prêt.';
            })
          }
        >
          <Download size={16} /> Exporter
        </button>
        <h3>Préparer une consultation</h3>
        <p>Résumé PDF factuel, sans interprétation ni score.</p>
        <div className="summary-export">
          <select
            aria-label="Période du résumé"
            value={summaryPeriod}
            onChange={(e) => setSummaryPeriod(Number(e.target.value))}
          >
            <option value={90}>90 derniers jours</option>
            <option value={365}>12 derniers mois</option>
            <option value={730}>24 derniers mois</option>
          </select>
          <button
            className="button"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const pdf = await consultationSummaryPdf(
                  consultationSummary(record, summaryPeriod),
                  { name: record.profile.firstName, personId: record.personId },
                );
                saveFile(
                  pdf as BlobPart,
                  'application/pdf',
                  `convergence-resume-${summaryPeriod}j.pdf`,
                );
              })
            }
          >
            <FileText size={16} /> Télécharger le résumé
          </button>
        </div>
      </Panel>
      <Panel className="settings-sources">
        <h2>Ce que vous autorisez</h2>
        {consents.map((c) => (
          <div className="source-setting" key={c.source}>
            <ShieldCheck size={20} />
            <div>
              <strong>{LABEL[c.source as LocalSource].title}</strong>
              <small>{LABEL[c.source as LocalSource].detail}</small>
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
                        })}
                      </li>
                    ))}
                  </ol>
                </details>
              )}
            </div>
            <Pill tone={c.granted ? 'teal' : 'amber'}>
              {c.granted ? 'Autorisé' : c.version === 0 ? 'Non autorisé' : 'Retiré'}
            </Pill>
            {c.granted ? (
              <div className="device-actions">
                <button
                  className="button"
                  disabled={busy}
                  onClick={() => void decide(c, false)}
                  aria-label={`Retirer : ${LABEL[c.source as LocalSource].title}`}
                >
                  Retirer
                </button>
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('Retirer l’autorisation et effacer les données de cette source ?'))
                      void decide(c, false, true);
                  }}
                  aria-label={`Retirer et effacer : ${LABEL[c.source as LocalSource].title}`}
                >
                  Retirer et effacer
                </button>
              </div>
            ) : (
              <button
                className="button"
                disabled={busy}
                onClick={() => void decide(c, true)}
                aria-label={`Autoriser : ${LABEL[c.source as LocalSource].title}`}
              >
                Autoriser
              </button>
            )}
          </div>
        ))}
        <div className="source-setting">
          <Smartphone size={20} />
          <div>
            <strong>Importer depuis Santé ou Health Connect</strong>
            <small>
              {native
                ? '30 derniers jours, après votre accord dans Santé ou Health Connect. Rien n’est écrit sur le téléphone.'
                : 'Disponible dans l’application Android ou iPhone.'}
            </small>
          </div>
          {native ? (
            <button
              className="button"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  const r = await importPhoneHealth(30, (batch) =>
                    deviceStore().importDevice(batch),
                  );
                  await onChanged();
                  return `${r.read} enregistrement(s) lu(s) · ${r.inserted} ajouté(s) · ${r.duplicates} déjà présent(s).`;
                })
              }
            >
              {busy ? 'Import…' : 'Importer'}
            </button>
          ) : (
            <Pill>Application mobile</Pill>
          )}
        </div>
        {info && (
          <p className="feedback success" role="status">
            <CheckCircle2 size={16} /> {info}
          </p>
        )}
        {error && (
          <p className="feedback error" role="alert">
            <TriangleAlert size={16} /> {error}
          </p>
        )}
        <p className="consent-note">
          « Retirer » arrête les nouveaux ajouts depuis cette source et garde ce qui est déjà rangé.
          « Retirer et effacer » supprime aussi ces données.
        </p>
      </Panel>
      <Panel>
        <h2>Supprimer toutes mes données</h2>
        <p>
          Efface de ce téléphone tous vos documents, données, autorisations et votre code.{' '}
          <strong>C’est définitif</strong> : exportez d’abord si vous voulez garder une copie.
        </p>
        <label className="field">
          <span>Tapez SUPPRIMER pour confirmer</span>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} />
        </label>
        <button
          className="button danger"
          disabled={confirmText !== 'SUPPRIMER' || busy}
          onClick={() => void eraseEverything()}
        >
          <Trash2 size={16} /> Supprimer toutes mes données
        </button>
        <Notice>Aucune conformité HDS, RGPD ou MDR n’est revendiquée.</Notice>
      </Panel>
    </div>
  );
}
