'use client';
import { useState } from 'react';
import { Sparkles, TriangleAlert, CheckCircle2, Send } from 'lucide-react';
import {
  AI_NOTICE_VERSION,
  AI_PROVIDER,
  AiReadingSchema,
  MAX_AI_PDF_BYTES,
} from '@/modules/ai/contract';
import { aiCandidates, BLOCK_LABEL, type AiCandidate } from '@/modules/ai/candidates';
import { deviceStore } from '@/modules/local/session';
import type { HealthDocument, HealthRecord } from '@/modules/health-records/model';
import { dateLabel } from '@/modules/observations/selectors';
import { Modal, Notice, Pill } from './ui';
/** Relay address fixed at build time; without it the feature is shown as not configured. */
export const AI_RELAY_URL = process.env.NEXT_PUBLIC_HC_AI_RELAY_URL ?? '';
const message = (code: string) =>
  ({
    CONSENT_REQUIRED: `Autorisez d’abord « Lecture des PDF par une IA (${AI_PROVIDER}) » dans Paramètres.`,
    PAYLOAD_TOO_LARGE: 'Ce PDF dépasse 10 Mo : il ne peut pas être envoyé.',
    RATE_LIMITED: 'Trop d’envois récents. Réessayez dans une heure.',
    INVALID_SELECTION: 'Sélection invalide. Rien n’a été ajouté.',
  })[code] ?? 'La lecture n’a pas abouti. Rien n’a été ajouté à votre dossier.';
export function AiReadModal({
  record,
  document,
  open,
  onClose,
  onAdded,
}: {
  record: HealthRecord;
  document: HealthDocument;
  open: boolean;
  onClose: () => void;
  onAdded: () => Promise<void>;
}) {
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [result, setResult] = useState<{
    model: string;
    printedDate: string | null;
    laboratory: string | null;
    candidates: AiCandidate[];
  } | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  async function send() {
    setBusy(true);
    setError('');
    try {
      const consent = (await deviceStore().consents()).find((c) => c.source === 'ai-reading');
      if (!consent?.granted) throw Error('CONSENT_REQUIRED');
      const bytes = await deviceStore().pdfBytes(document.id);
      if (bytes.byteLength > MAX_AI_PDF_BYTES) throw Error('PAYLOAD_TOO_LARGE');
      const res = await fetch(`${AI_RELAY_URL.replace(/\/$/, '')}/v1/transcribe`, {
        method: 'POST',
        headers: {
          'content-type': 'application/pdf',
          'x-convergence-consent': `ai-reading;${AI_NOTICE_VERSION}`,
        },
        body: bytes as BodyInit,
      });
      const data = await res.json();
      if (!res.ok) throw Error(data.error || 'AI_ERROR');
      // The app does not trust the relay either: same contract checked again here.
      const reading = AiReadingSchema.parse(data.reading);
      const candidates = aiCandidates(reading, record.biomarkers, document.laboratory);
      setResult({
        model: String(data.model ?? ''),
        printedDate: reading.printedDate,
        laboratory: reading.laboratory,
        candidates,
      });
      setSelected(candidates.filter((c) => !c.blocked).map((c) => c.id));
    } catch (e) {
      setError(message(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!result) return;
    setBusy(true);
    setError('');
    try {
      const r = await deviceStore().addAiObservations({
        documentId: document.id,
        candidates: result.candidates,
        selected,
        model: result.model,
      });
      await onAdded();
      setDone(
        `${r.inserted} valeur(s) ajoutée(s) à votre dossier, à vérifier${r.duplicates ? ` · ${r.duplicates} déjà présente(s)` : ''}.`,
      );
      setResult(null);
    } catch (e) {
      setError(message(e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <Modal
      open={open}
      onOpenChange={(v) => !v && onClose()}
      title="Lire les valeurs avec l’IA"
      description={`${document.title} · transcription par ${AI_PROVIDER}, sans interprétation`}
      wide
    >
      <div className="device-gate-form">
        {!result && !done && (
          <>
            <Notice>
              <Sparkles size={16} /> Le PDF va être envoyé, par le relais de Convergence, à{' '}
              {AI_PROVIDER}. L’IA recopie seulement ce qui est imprimé (paramètre, valeur, unité,
              références) et le range par rubrique. Elle ne donne aucun avis. Le relais ne garde
              rien ; la conservation chez {AI_PROVIDER} dépend du contrat conclu avec lui. Vous
              choisissez ensuite ce qui est ajouté.
            </Notice>
            <label className="check">
              <input
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
              J’accepte l’envoi de ce document à {AI_PROVIDER}.
            </label>
            <div className="device-actions">
              <button
                className="button primary"
                disabled={!agreed || busy}
                onClick={() => void send()}
              >
                <Send size={16} /> {busy ? 'Lecture en cours…' : 'Envoyer et lire'}
              </button>
              <button className="button" onClick={onClose}>
                Annuler
              </button>
            </div>
          </>
        )}
        {result && (
          <>
            <p>
              Date du document retenue :{' '}
              <strong>
                {dateLabel(document.date, { day: 'numeric', month: 'long', year: 'numeric' })}
              </strong>
              {result.printedDate && <> · date imprimée lue par l’IA : « {result.printedDate} »</>}
              {result.laboratory && <> · {result.laboratory}</>}
            </p>
            {result.candidates.length === 0 ? (
              <Notice>Aucun résultat n’a été recopié depuis ce document.</Notice>
            ) : (
              <ul className="ai-candidates">
                {result.candidates.map((c) => (
                  <li key={c.id} className={c.blocked ? 'blocked' : ''}>
                    <label className="check">
                      <input
                        type="checkbox"
                        disabled={!!c.blocked}
                        checked={selected.includes(c.id)}
                        onChange={() => toggle(c.id)}
                        aria-label={`Ajouter ${c.label}`}
                      />
                      <span>
                        <strong>{c.label}</strong> · {c.printedValue} {c.originalUnit}
                        {c.referenceText && <small> · réf. imprimée : {c.referenceText}</small>}
                        <small>
                          {' '}
                          · page {c.page} · {c.category}
                          {c.newBiomarker ? ' · nouvelle série' : ''}
                        </small>
                      </span>
                    </label>
                    {c.blocked && <Pill tone="amber">{BLOCK_LABEL[c.blocked]}</Pill>}
                  </li>
                ))}
              </ul>
            )}
            <Notice>
              Comparez avec le PDF avant d’ajouter : l’IA peut se tromper en recopiant. Les valeurs
              ajoutées restent marquées « à vérifier ».
            </Notice>
            <div className="device-actions">
              <button
                className="button primary"
                disabled={!selected.length || busy}
                onClick={() => void confirm()}
              >
                <CheckCircle2 size={16} /> Ajouter {selected.length} valeur(s)
              </button>
              <button className="button" onClick={onClose}>
                Ne rien ajouter
              </button>
            </div>
          </>
        )}
        {done && (
          <p className="feedback success" role="status">
            <CheckCircle2 size={16} /> {done}
          </p>
        )}
        {error && (
          <p className="feedback error">
            <TriangleAlert size={16} /> {error}
          </p>
        )}
      </div>
    </Modal>
  );
}
