'use client';
import { useState } from 'react';
import { FileUp, TriangleAlert, CheckCircle2 } from 'lucide-react';
import { deviceStore } from '@/modules/local/session';
import { MAX_PDF_BYTES } from '@/modules/local/store';
import { localDay } from '@/modules/observations/time';
import { Modal, Notice } from './ui';
const message = (code: string) =>
  ({
    CONSENT_REQUIRED: 'Autorisez d’abord « Documents PDF » dans Paramètres.',
    INVALID_PDF: 'Ce fichier n’est pas un PDF.',
    PAYLOAD_TOO_LARGE: 'Ce PDF dépasse 20 Mo.',
    INVALID_DATE: 'Date du document invalide.',
    INVALID_TITLE: 'Donnez un nom au document.',
  })[code] ?? 'Le document n’a pas pu être rangé. Rien n’a été modifié.';
/** Page count only, read on the phone; the values of the document are not read. */
async function countPages(bytes: Uint8Array) {
  try {
    const { getDocumentProxy } = await import('unpdf');
    const pdf = await getDocumentProxy(bytes.slice());
    return pdf.numPages;
  } catch {
    return 0;
  }
}
export function PdfAddModal({
  open,
  onClose,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'biology' | 'report'>('biology');
  const [date, setDate] = useState(() => localDay(new Date().toISOString()));
  const [origin, setOrigin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  async function save() {
    if (!file) return;
    setBusy(true);
    setError('');
    setDone('');
    try {
      if (file.size > MAX_PDF_BYTES) throw Error('PAYLOAD_TOO_LARGE');
      const bytes = new Uint8Array(await file.arrayBuffer());
      const r = await deviceStore().addPdf({
        bytes,
        title,
        kind,
        date,
        origin,
        pages: await countPages(bytes),
      });
      setDone(
        r.duplicate
          ? `Ce PDF est déjà rangé (« ${r.document.title} »).`
          : `« ${r.document.title} » est rangé dans vos documents.`,
      );
      setFile(null);
      setTitle('');
      setOrigin('');
      await onAdded();
    } catch (e) {
      setError(message(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Ranger un document PDF"
      description="Le PDF est conservé tel quel, chiffré sur ce téléphone."
    >
      <div className="device-gate-form">
        <label className="field">
          <span>Fichier PDF</span>
          <input
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              if (f && !title) setTitle(f.name.replace(/\.pdf$/i, '').slice(0, 120));
            }}
          />
        </label>
        <label className="field">
          <span>Nom du document</span>
          <input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="field">
          <span>Type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as 'biology' | 'report')}>
            <option value="biology">Bilan biologique</option>
            <option value="report">Compte rendu</option>
          </select>
        </label>
        <label className="field">
          <span>Date du document</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="field">
          <span>Origine (laboratoire, centre…), facultatif</span>
          <input value={origin} maxLength={120} onChange={(e) => setOrigin(e.target.value)} />
        </label>
        {error && (
          <p className="feedback error" role="alert">
            <TriangleAlert size={16} /> {error}
          </p>
        )}
        {done && (
          <p className="feedback success" role="status">
            <CheckCircle2 size={16} /> {done}
          </p>
        )}
        <div className="device-actions">
          <button
            className="button primary"
            disabled={!file || !title.trim() || busy}
            onClick={() => void save()}
          >
            <FileUp size={16} /> {busy ? 'Rangement…' : 'Ranger le document'}
          </button>
          <button className="button" onClick={onClose}>
            Fermer
          </button>
        </div>
        <Notice>
          Les valeurs du document ne sont pas lues automatiquement pour l’instant : le PDF est rangé
          et consultable, avec la date et l’origine que vous indiquez.
        </Notice>
      </div>
    </Modal>
  );
}
