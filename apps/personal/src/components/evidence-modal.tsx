'use client';
import { ExternalLink, FileText, Check, Info } from 'lucide-react';
import type { HealthRecord } from '@/modules/health-records/model';
import { dateLabel } from '@/modules/observations/selectors';
import { Modal, Pill, Notice } from './ui';
import { number } from './format';
export function EvidenceModal({
  record,
  selection,
  onClose,
}: {
  record: HealthRecord;
  selection: { documentId: string; observationId?: string } | null;
  onClose: () => void;
}) {
  const doc = record.documents.find((d) => d.id === selection?.documentId);
  const observation = record.observations.find((o) => o.id === selection?.observationId);
  const rows = record.observations.filter((o) => o.sourceId === doc?.id);
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
              <strong>{doc.date.slice(0, 10)}</strong>
            </div>
            <div>
              <span>Connue dans le dossier</span>
              <strong>{doc.knownAt.slice(0, 10)}</strong>
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
                    <th>Valeur originale</th>
                    <th>Référence de ce laboratoire</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className={o.id === observation?.id ? 'highlight-row' : ''}>
                      <td>{record.biomarkers.find((b) => b.code === o.code)?.shortLabel}</td>
                      <td>
                        {number(
                          o.value,
                          record.biomarkers.find((b) => b.code === o.code)?.decimals,
                        )}{' '}
                        {o.unit}
                      </td>
                      <td>
                        {o.reference
                          ? `${o.reference.low}–${o.reference.high} ${o.unit}`
                          : 'Non fournie'}
                      </td>
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
