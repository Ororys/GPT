'use client';
import { useState } from 'react';
import { ExternalLink, FileText, Check, Info, PencilLine, TriangleAlert } from 'lucide-react';
import type { HealthRecord, Observation } from '@/modules/health-records/model';
import { dateLabel } from '@/modules/observations/selectors';
import { localDay, zoneOf } from '@/modules/observations/time';
import { Modal, Pill, Notice } from './ui';
import { number } from './format';
export function EvidenceModal({
  record,
  selection,
  onClose,
  onCorrected,
}: {
  record: HealthRecord;
  selection: { documentId: string; observationId?: string } | null;
  onClose: () => void;
  onCorrected?: () => Promise<void>;
}) {
  const doc = record.documents.find((d) => d.id === selection?.documentId);
  const observation = record.observations.find((o) => o.id === selection?.observationId);
  const rows = record.observations.filter((o) => o.sourceId === doc?.id);
  const [editing, setEditing] = useState<string | null>(null);
  const [done, setDone] = useState('');
  // Only values read from a stored PDF can be corrected, and only with PostgreSQL history.
  const correctable = (o: Observation) =>
    record.storage === 'postgresql' && o.evidence.method === 'native-pdf' && !!onCorrected;
  const label = (code: string) => record.biomarkers.find((b) => b.code === code)?.shortLabel;
  const decimals = (code: string) => record.biomarkers.find((b) => b.code === code)?.decimals;
  const corrected = rows.filter((o) => o.corrections?.length);
  // Provenance view: exact values, never rounded to the display convention.
  const exact = (v: number) => v.toLocaleString('fr-FR', { maximumFractionDigits: 6 });
  const target = rows.find((o) => o.id === editing);
  return (
    <Modal
      open={!!selection}
      onOpenChange={(v) => !v && onClose()}
      title={doc?.title || 'Source documentaire'}
      description="Evidence Engine · source synthétique consultable, sans extraction IA."
      wide
    >
      {doc ? (
        <>
          <div className="evidence-banner">
            <span className="file-icon">
              <FileText size={26} />
            </span>
            <div>
              <strong>{doc.laboratory}</strong>
              <small>
                Mesure le {dateLabel(doc.date, { day: 'numeric', month: 'long', year: 'numeric' })}{' '}
                · {doc.pages} page
              </small>
            </div>
            <Pill tone={doc.status === 'needs-review' ? 'amber' : 'teal'}>
              {doc.status === 'needs-review' ? 'À vérifier' : 'Jeu synthétique'}
            </Pill>
          </div>
          {observation && (
            <div className="selected-evidence">
              <span className="eyebrow">LE POINT QUE VOUS AVEZ SÉLECTIONNÉ</span>
              <strong>{observation.evidence.sourceText}</strong>
              <div>
                <Pill>Page {observation.evidence.page}</Pill>
                <Pill tone="purple">
                  {observation.evidence.method === 'native-pdf'
                    ? 'Texte PDF natif'
                    : observation.evidence.method === 'structured-import'
                      ? 'Import structuré'
                      : 'Fixture synthétique'}
                </Pill>
              </div>
              <p>
                Valeur originale : {observation.evidence.originalValue}{' '}
                {observation.evidence.originalUnit} · aucune conversion d’unité
              </p>
            </div>
          )}
          <div className="evidence-grid">
            <div>
              <span>Date de mesure</span>
              <strong>
                {doc.datePrecision === 'day'
                  ? doc.date.slice(0, 10)
                  : localDay(doc.date, zoneOf(record))}
              </strong>
            </div>
            <div>
              <span>Connue dans le dossier</span>
              <strong>{localDay(doc.knownAt, zoneOf(record))}</strong>
            </div>
            <div>
              <span>Identifiant de source</span>
              <strong className="mono">{doc.id}</strong>
            </div>
            <div>
              <span>Confiance IA</span>
              <strong>Non applicable · aucun modèle</strong>
            </div>
          </div>
          <div className="evidence-results">
            {rows.length ? (
              <table>
                <caption>Résultats présents dans ce document synthétique</caption>
                <thead>
                  <tr>
                    <th>Paramètre</th>
                    <th>Valeur</th>
                    <th>Référence de ce laboratoire</th>
                    {rows.some(correctable) && <th>Revue</th>}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className={o.id === observation?.id ? 'highlight-row' : ''}>
                      <td>{label(o.code)}</td>
                      <td>
                        {o.corrections?.length ? exact(o.value) : number(o.value, decimals(o.code))}{' '}
                        {o.unit}
                        {!!o.corrections?.length && (
                          <small className="correction-mark">
                            {' '}
                            · corrigée v{o.corrections.length} · lu{' '}
                            {exact(o.evidence.originalValue)}
                          </small>
                        )}
                      </td>
                      <td>
                        {o.reference
                          ? `${o.reference.low}–${o.reference.high} ${o.unit}`
                          : o.method.includes('protocole')
                            ? `Sans référence · ${o.method}`
                            : 'Non fournie'}
                      </td>
                      {rows.some(correctable) && (
                        <td>
                          {correctable(o) && (
                            <button
                              className="text-button"
                              aria-label={`Corriger ${label(o.code)}`}
                              onClick={() => {
                                setDone('');
                                setEditing(o.id);
                              }}
                            >
                              <PencilLine size={13} />
                              Corriger
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p>
                Document sans résultats structurés dans ce sprint. Aucune information médicale n’a
                été extraite automatiquement.
              </p>
            )}
          </div>
          {target && (
            <CorrectionForm
              key={target.id + ':' + (target.corrections?.length ?? 0)}
              observation={target}
              label={label(target.code) ?? target.code}
              onCancel={() => setEditing(null)}
              onSaved={async (version) => {
                await onCorrected?.();
                setEditing(null);
                setDone(
                  `Correction v${version} enregistrée pour ${label(target.code)}. La valeur lue dans le PDF reste conservée.`,
                );
              }}
            />
          )}
          {done && (
            <div className="feedback success" role="status">
              <Check size={17} />
              {done}
            </div>
          )}
          {corrected.length > 0 && (
            <details className="correction-history">
              <summary>Historique des corrections ({corrected.length})</summary>
              {corrected.map((o) => (
                <div key={o.id}>
                  <strong>{label(o.code)}</strong>
                  <ol>
                    <li>
                      Lu dans le PDF : {exact(o.evidence.originalValue)} {o.evidence.originalUnit} ·
                      « {o.evidence.sourceText} »
                    </li>
                    {o.corrections!.map((c) => (
                      <li key={c.version}>
                        v{c.version} : {exact(c.value)} {c.unit} · « {c.reason} » ·{' '}
                        {dateLabel(c.correctedAt, {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}{' '}
                        · {c.correctedBy}
                      </li>
                    ))}
                  </ol>
                </div>
              ))}
            </details>
          )}
          <Notice>
            {doc.id.startsWith('pdf-')
              ? 'Le PDF original téléversé est conservé avec son empreinte.'
              : 'Le PDF est généré à partir du même jeu de données.'}{' '}
            Ces références fictives ne sont pas des normes universelles. Une donnée « à vérifier »
            n’est jamais considérée comme validée médicalement.
          </Notice>
          <div className="modal-actions">
            <a
              className="button primary"
              href={`/api/documents/${doc.id}#page=${observation?.evidence.page || 1}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              Ouvrir le PDF · page {observation?.evidence.page || 1}
            </a>
            <button className="button" onClick={onClose}>
              <Check size={16} />
              Fermer la source
            </button>
          </div>
        </>
      ) : (
        <Notice>
          <Info size={16} />
          Cette source ne fait pas partie de ce dossier.
        </Notice>
      )}
    </Modal>
  );
}

const correctionError = (code: string) =>
  code === 'CORRECTION_CONFLICT'
    ? 'Ce résultat a été corrigé entre-temps. Rechargez la source avant de corriger à nouveau.'
    : code === 'CORRECTION_REQUIRES_POSTGRES'
      ? 'La correction versionnée nécessite le mode PostgreSQL.'
      : code === 'FORBIDDEN'
        ? 'Ce résultat n’appartient pas au dossier ouvert.'
        : 'Correction refusée : valeur numérique différente de la valeur actuelle et motif de 3 à 300 caractères requis.';
function CorrectionForm({
  observation,
  label,
  onCancel,
  onSaved,
}: {
  observation: Observation;
  label: string;
  onCancel: () => void;
  onSaved: (version: number) => Promise<void>;
}) {
  const [value, setValue] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/observations/correct', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          observationId: observation.id,
          expectedVersion: observation.corrections?.length ?? 0,
          value,
          reason,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(correctionError(data.error));
      await onSaved(data.version);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Correction impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <form className="correction-form" onSubmit={submit}>
      <strong>Corriger {label}</strong>
      <p className="source-quote">
        « {observation.evidence.sourceText} » · page {observation.evidence.page}
      </p>
      <div className="correction-fields">
        <label>
          Nouvelle valeur ({observation.unit})
          <input
            inputMode="decimal"
            required
            maxLength={16}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={String(observation.value).replace('.', ',')}
          />
        </label>
        <label>
          Motif de la correction
          <input
            required
            minLength={3}
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ex. : erreur de lecture du tableau"
          />
        </label>
      </div>
      <small>
        Même unité, aucune conversion. La valeur lue et chaque version restent conservées ; la
        correction ne vaut pas validation médicale et le résultat reste « à vérifier ».
      </small>
      {error && (
        <div className="feedback error" role="alert">
          <TriangleAlert size={16} />
          {error}
        </div>
      )}
      <div className="modal-actions">
        <button className="button primary" type="submit" disabled={busy}>
          <Check size={15} />
          Enregistrer la correction
        </button>
        <button className="button" type="button" onClick={onCancel} disabled={busy}>
          Annuler
        </button>
      </div>
    </form>
  );
}
