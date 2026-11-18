'use client';
import { useState } from 'react';
import {
  Upload,
  Download,
  FileJson,
  CheckCircle2,
  LoaderCircle,
  TriangleAlert,
} from 'lucide-react';
import { PdfImportForm } from './pdf-import-form';
import { Modal, Notice } from './ui';
export function ImportModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
}) {
  const [kind, setKind] = useState<'pdf' | 'json'>('pdf');
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  async function submit() {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (file.size > 100_000) throw Error('Fichier trop volumineux : 100 Ko maximum.');
      const text = await file.text();
      const res = await fetch('/api/imports', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: text,
      });
      const data = await res.json();
      if (!res.ok)
        throw Error(
          data.error === 'CONSENT_REQUIRED'
            ? 'Import structuré désactivé : l’autorisation a été retirée dans Paramètres. Rien n’a été enregistré.'
            : data.error === 'FORBIDDEN'
              ? 'Ce fichier appartient au profil fictif Alex.'
              : data.error === 'PAYLOAD_TOO_LARGE'
                ? 'Fichier trop volumineux.'
                : 'Seul le fichier synthétique fourni est accepté, sans modification. Aucun contenu n’a été enregistré.',
        );
      await onImported();
      setMessage(
        data.inserted
          ? '1 résultat importé, relié au document et à la timeline. Statut : à vérifier.'
          : 'Ce fichier est déjà présent. Aucun doublon créé.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) {
          onClose();
          setMessage('');
          setError('');
          setFile(null);
        }
      }}
      title="Une nouvelle pièce de votre histoire"
      description="PDF natif ou JSON synthétique · aucune donnée réelle acceptée."
      wide={kind === 'pdf'}
    >
      <div className="import-kind-tabs" role="tablist" aria-label="Type d’import">
        <button role="tab" aria-selected={kind === 'pdf'} onClick={() => setKind('pdf')}>
          PDF biologique
        </button>
        <button role="tab" aria-selected={kind === 'json'} onClick={() => setKind('json')}>
          Import JSON
        </button>
      </div>
      {kind === 'pdf' ? (
        <PdfImportForm onImported={onImported} />
      ) : (
        <>
          <ol className="import-steps">
            <li>
              <span>01</span>
              <div>
                <strong>Téléchargez le bilan synthétique</strong>
                <p>Un résultat de ferritine, son unité et ses références documentaires.</p>
                <a className="button small" href="/api/imports" download>
                  <Download size={14} /> Télécharger le fichier démo
                </a>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <strong>Ajoutez ce même fichier</strong>
                <p>Empreinte vérifiée côté serveur. Tout fichier modifié est refusé.</p>
              </div>
            </li>
          </ol>
          <label className={`upload-zone ${busy ? 'busy' : ''}`}>
            <FileJson size={28} />
            <strong>{file?.name || 'Choisir le fichier de démonstration'}</strong>
            <span>JSON synthétique · 100 Ko maximum</span>
            <input
              type="file"
              accept=".json,application/json"
              aria-label="Fichier de démonstration"
              disabled={busy}
              onChange={(e) => {
                setFile(e.target.files?.[0] || null);
                setError('');
                setMessage('');
              }}
            />
          </label>
          {error && (
            <div className="feedback error" role="alert">
              <TriangleAlert size={18} />
              {error}
            </div>
          )}
          {message && (
            <div className="feedback success" role="status">
              <CheckCircle2 size={18} />
              {message}
            </div>
          )}
          <Notice>
            Le texte natif des PDF synthétiques est pris en charge dans l’onglet PDF biologique.
            Aucun OCR ni modèle IA ne sont exécutés.
          </Notice>
          <div className="modal-actions">
            <button className="button primary" onClick={submit} disabled={!file || busy}>
              {busy ? <LoaderCircle className="spin" size={16} /> : <Upload size={16} />}{' '}
              {busy ? 'Vérification et enregistrement…' : 'Vérifier et importer'}
            </button>
            <button className="button" disabled={busy} onClick={onClose}>
              Fermer
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
