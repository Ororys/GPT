'use client';
import { useState } from 'react';
import {
  Search,
  FileText,
  ArrowUpRight,
  Upload,
  FolderOpen,
  CheckCircle2,
  Clock3,
  Layers,
} from 'lucide-react';
import type { PageProps } from './overview';
import { dateLabel, withinPeriod } from '@/modules/observations/selectors';
import { Panel, Pill, Notice, Empty } from './ui';
export function Documents({
  record,
  period,
  openDocument,
  onImport,
}: { onImport: () => void } & PageProps) {
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('all');
  const [status, setStatus] = useState('all');
  const documents = record.documents
    .filter(
      (d) =>
        withinPeriod(d.date, period) &&
        `${d.title} ${d.laboratory}`.toLowerCase().includes(query.toLowerCase()) &&
        (kind === 'all' || d.kind === kind) &&
        (status === 'all' || d.status === status),
    )
    .toSorted((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <section className="documents-hero">
        <span className="document-stack" aria-hidden="true">
          <FileText />
          <FileText />
          <FileText />
        </span>
        <div>
          <span className="eyebrow">LA MÉMOIRE DE VOTRE DOSSIER</span>
          <h2>Des documents. Pas des silos.</h2>
          <p>
            Chaque résultat reste relié à son origine.
            <br />
            Retrouvez le document derrière chaque point de votre histoire.
          </p>
        </div>
        <button className="button primary" onClick={onImport}>
          <Upload size={17} /> {record.synthetic ? 'Importer une démo' : 'Ajouter un PDF'}
        </button>
      </section>
      <div className="document-stats">
        <div>
          <FolderOpen size={17} />
          <strong>{record.documents.length}</strong>
          <span>{record.synthetic ? 'documents synthétiques' : 'documents'}</span>
        </div>
        <div>
          <Layers size={17} />
          <strong>{record.observations.length}</strong>
          <span>résultats reliés à une source</span>
        </div>
        <div>
          <Clock3 size={17} />
          <strong>{record.documents.filter((d) => d.status === 'needs-review').length}</strong>
          <span>document(s) à vérifier</span>
        </div>
      </div>
      <Panel>
        <div className="document-toolbar">
          <label className="search-input grow">
            <Search size={16} />
            <input
              aria-label="Rechercher un document"
              placeholder="Rechercher un document, un laboratoire…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value)}
            aria-label="Type de document"
          >
            <option value="all">Tous les types</option>
            <option value="biology">Bilans biologiques</option>
            <option value="report">Comptes rendus</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            aria-label="Statut du document"
          >
            <option value="all">Tous les statuts</option>
            <option value="available">Disponibles</option>
            <option value="needs-review">À vérifier</option>
            <option value="error">Erreur d’extraction</option>
          </select>
        </div>
        {documents.length ? (
          <div className="document-grid">
            {documents.map((d) => (
              <button className="document-card" key={d.id} onClick={() => openDocument(d.id)}>
                <div className="document-top">
                  <span className={`file-icon ${d.kind}`}>
                    <FileText size={26} />
                  </span>
                  <Pill tone={d.status === 'available' ? 'teal' : 'amber'}>
                    {d.status === 'available' ? <CheckCircle2 size={11} /> : <Clock3 size={11} />}{' '}
                    {d.status === 'available' ? 'Disponible' : 'À vérifier'}
                  </Pill>
                </div>
                <h3>{d.title}</h3>
                <p>{d.laboratory}</p>
                <div className="doc-meta">
                  <span>
                    {dateLabel(d.date, { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
                    {d.pages} page
                  </span>
                  <ArrowUpRight size={17} />
                </div>
                <div className="doc-evidence">
                  {d.synthetic
                    ? `${record.observations.filter((o) => o.sourceId === d.id).length} résultats reliés · PDF synthétique`
                    : 'PDF rangé · valeurs non lues'}
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Empty
            title="Aucun document ne correspond"
            text="Modifiez la recherche, le statut ou la période. Aucun contenu n’est inventé pour compléter votre dossier."
            action={
              <button
                className="button"
                onClick={() => {
                  setQuery('');
                  setKind('all');
                  setStatus('all');
                }}
              >
                Effacer les filtres
              </button>
            }
          />
        )}
      </Panel>
      <Notice>
        {record.synthetic
          ? 'Ces PDF sont générés depuis le jeu synthétique. Aucun OCR ni service IA n’est exécuté. L’import accepte uniquement les PDF et le JSON synthétiques fournis, jamais un vrai document médical.'
          : 'Vos PDF sont conservés tels quels, chiffrés sur ce téléphone. Leurs valeurs ne sont pas lues automatiquement pour l’instant.'}
      </Notice>
    </>
  );
}
