'use client';
import { useState } from 'react';
import {
  FileText,
  Play,
  Upload,
  Download,
  LoaderCircle,
  CheckCircle2,
  TriangleAlert,
  ArrowUpRight,
} from 'lucide-react';
import type {
  CandidateIssue,
  CandidateNote,
  PdfOverlap,
  PdfProposal,
} from '@/modules/extraction/native';
import { PDF_FIXTURES, type FixtureId } from '@/modules/extraction/corpus';
import { Pill, Notice } from './ui';
const message = (code: string) =>
  code === 'CONSENT_REQUIRED'
    ? 'Import de documents PDF désactivé : l’autorisation a été retirée dans Paramètres. Rien n’a été enregistré.'
    : code === 'FORBIDDEN'
      ? 'Le profil du document ne correspond pas au dossier ouvert.'
      : code === 'INVALID_DEMO_PDF'
        ? 'Seuls les PDF synthétiques fournis sont acceptés. Aucun document personnel ne doit être envoyé.'
        : code === 'PAYLOAD_TOO_LARGE'
          ? 'PDF trop volumineux : 500 Ko maximum.'
          : code === 'PDF_REQUIRES_POSTGRES'
            ? 'Ce parcours PDF nécessite le mode PostgreSQL de l’application.'
            : code === 'REVIEW_CONFLICT'
              ? 'Ce document a déjà été revu avec une autre sélection.'
              : 'Le PDF n’a pas pu être traité. Aucun résultat n’a été ajouté.';
const issueLabel: Record<CandidateIssue, string> = {
  UNIT_MISMATCH_NO_CONVERSION: 'unité incompatible, non convertie',
  MEASUREMENT_DATE_MISSING: 'date de prélèvement absente',
  MEASUREMENT_DATE_INVALID: 'date de prélèvement invalide',
  MEASUREMENT_DATE_AMBIGUOUS: 'plusieurs dates de prélèvement',
  PATIENT_NOT_IDENTIFIED: 'dossier non identifié',
  INVALID_VALUE: 'valeur invalide',
  VALUE_QUALIFIER_NOT_SUPPORTED: 'valeur précédée d’un signe, non interprétée',
  VALUE_NOT_NUMERIC: 'valeur non numérique',
  DUPLICATE_IN_DOCUMENT: 'paramètre présent plusieurs fois',
};
const noteLabel: Record<CandidateNote, string> = {
  REFERENCE_ABSENT: 'Aucune référence de laboratoire sur la ligne.',
  REFERENCE_NOT_STRUCTURED: 'Référence conservée dans le texte source, non structurée.',
  ROW_RECONSTRUCTED_FROM_COLUMNS: 'Ligne reconstituée à partir de colonnes alignées.',
};
const blockedReason = (issues: CandidateIssue[]) =>
  'Non ajouté : ' + issues.map((i) => issueLabel[i] ?? 'à vérifier').join(', ');
export function PdfImportForm({ onImported }: { onImported: () => Promise<void> }) {
  const [fixture, setFixture] = useState<FixtureId>('standard');
  const [proposal, setProposal] = useState<PdfProposal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [overlaps, setOverlaps] = useState<PdfOverlap[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reviewed, setReviewed] = useState(false);
  async function analyze(bytes: ArrayBuffer) {
    setBusy(true);
    setError('');
    setSuccess('');
    setProposal(null);
    setReviewed(false);
    try {
      if (bytes.byteLength > 500000) throw Error('PDF trop volumineux : 500 Ko maximum.');
      const response = await fetch('/api/pdf/analyze', {
        method: 'POST',
        headers: { 'content-type': 'application/pdf' },
        body: bytes,
      });
      const result = await response.json();
      if (!response.ok) throw Error(message(result.error));
      const p = result.proposal as PdfProposal;
      const found = (result.overlaps ?? []) as PdfOverlap[];
      setProposal(p);
      setOverlaps(found);
      // A value already present that day from another document starts unselected: adding it
      // stays possible, but only by an explicit choice.
      setSelected(
        p.candidates
          .filter((c) => c.eligible && !found.some((o) => o.candidateId === c.id))
          .map((c) => c.id),
      );
      setReviewed(result.reviewed);
      if (result.reviewed) setSuccess('Ce document a déjà été ajouté. Aucun doublon ne sera créé.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Analyse impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function demo() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/pdf/fixtures?id=${fixture}`);
      if (!response.ok) {
        const data = await response.json();
        throw Error(message(data.error));
      }
      await analyze(await response.arrayBuffer());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Téléchargement impossible.');
    } finally {
      setBusy(false);
    }
  }
  async function confirm() {
    if (!proposal) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/pdf/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sha256: proposal.sha256, selectedIds: selected }),
      });
      const data = await response.json();
      if (!response.ok) throw Error(message(data.error));
      await onImported();
      setReviewed(true);
      setSuccess(
        data.inserted
          ? `${data.inserted} résultat(s) ajouté(s), relié(s) au PDF source. Aucune validation médicale n’est revendiquée.`
          : 'Déjà présent : aucun doublon créé.',
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ajout impossible.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="pdf-import-form">
      <div className="pdf-intro">
        <span className="file-icon">
          <FileText size={26} />
        </span>
        <div>
          <strong>Du PDF à une donnée vérifiable.</strong>
          <p>Lecture du texte natif, page par page. Sans OCR, sans modèle IA.</p>
        </div>
      </div>
      <div className="pdf-demo-actions">
        <label>
          Exemple synthétique
          <select
            aria-label="Exemple PDF"
            value={fixture}
            disabled={busy}
            onChange={(e) => setFixture(e.target.value as FixtureId)}
          >
            {PDF_FIXTURES.map((f) => (
              <option value={f.id} key={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <button className="button primary" onClick={demo} disabled={busy}>
          {busy ? <LoaderCircle className="spin" size={16} /> : <Play size={16} />}Essayer ce PDF
        </button>
        <a
          className="text-button"
          href={`/api/pdf/fixtures?id=${fixture}`}
          target="_blank"
          rel="noreferrer"
        >
          <Download size={14} />
          Ouvrir le fichier
        </a>
      </div>
      <label className="pdf-file-picker">
        <Upload size={15} />
        <span>Ou choisir le PDF de démonstration téléchargé</span>
        <input
          type="file"
          accept="application/pdf,.pdf"
          aria-label="PDF synthétique à analyser"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              if (file.size > 500000) {
                setError('PDF trop volumineux : 500 Ko maximum.');
                return;
              }
              void file.arrayBuffer().then(analyze);
            }
          }}
        />
      </label>
      {error && (
        <div className="feedback error" role="alert">
          <TriangleAlert size={17} />
          {error}
        </div>
      )}
      {busy && (
        <p className="notice" role="status">
          Lecture et vérification du document…
        </p>
      )}
      {proposal && (
        <>
          <div className="pdf-review-heading">
            <div>
              <h3>Vérifier avant d’ajouter</h3>
              <p>
                {proposal.pages} page(s) · {proposal.candidates.length} résultat(s) retrouvé(s)
              </p>
            </div>
            <Pill tone={proposal.status === 'ocr-required' ? 'amber' : 'purple'}>
              {proposal.status === 'ocr-required' ? 'OCR nécessaire' : 'Texte natif lu'}
            </Pill>
          </div>
          {proposal.status !== 'ocr-required' &&
            proposal.warnings.map((w) => (
              <div className="feedback error" role="status" key={w}>
                <TriangleAlert size={18} />
                {w}
              </div>
            ))}
          {proposal.status === 'ocr-required' ? (
            <div className="feedback error" role="status">
              <TriangleAlert size={18} />
              Ce PDF ne contient pas de texte exploitable. Aucun résultat n’a été inventé ; aucun
              OCR n’est exécuté.
            </div>
          ) : (
            <div className="pdf-candidates">
              {proposal.candidates.map((c) => (
                <article className={`pdf-candidate ${!c.eligible ? 'blocked' : ''}`} key={c.id}>
                  <label>
                    <input
                      type="checkbox"
                      aria-label={`Ajouter ${c.label}`}
                      disabled={!c.eligible || busy || reviewed}
                      checked={selected.includes(c.id)}
                      onChange={(e) =>
                        setSelected((ids) =>
                          e.target.checked ? [...ids, c.id] : ids.filter((id) => id !== c.id),
                        )
                      }
                    />
                    <span>
                      <strong>{c.label}</strong>
                      <small>
                        Page {c.page} ·{' '}
                        {c.eligible ? 'À vérifier par vous' : blockedReason(c.issues)}
                      </small>
                      {overlaps
                        .find((o) => o.candidateId === c.id)
                        ?.matches.map((m) => (
                          <small className="pdf-overlap" key={m.observationId}>
                            Déjà dans le dossier le même jour : {m.value.toLocaleString('fr-FR')}{' '}
                            {m.unit} · {m.documentTitle} ·{' '}
                            {m.value === c.value && m.unit === c.observation?.unit
                              ? 'valeur identique'
                              : 'valeur différente'}
                            . Non coché par défaut ; rien n’est fusionné.
                          </small>
                        ))}
                    </span>
                    <b>
                      {c.value === null ? '—' : c.value.toLocaleString('fr-FR')}{' '}
                      <small>{c.unit}</small>
                    </b>
                  </label>
                  <details>
                    <summary>Voir le texte source et la provenance</summary>
                    <p className="source-quote">{c.originalText}</p>
                    <small>
                      Page {c.page} · zone PDF x={Math.round(c.bounds.x)}, y=
                      {Math.round(c.bounds.y)} · confiance non calibrée : aucune valeur annoncée.
                    </small>
                    {c.notes?.map((n) => (
                      <small key={n}>{noteLabel[n] ?? n}</small>
                    ))}
                  </details>
                </article>
              ))}
            </div>
          )}
          {!!proposal.unrecognized?.length && (
            <details className="pdf-unrecognized">
              <summary>{proposal.unrecognized.length} ligne(s) lue(s) mais non reprise(s)</summary>
              <p>
                Paramètre non pris en charge ou format non reconnu : rien n’est déduit de ces
                lignes.
              </p>
              {proposal.unrecognized.map((l, i) => (
                <p className="source-quote" key={i}>
                  Page {l.page} · {l.text}
                </p>
              ))}
            </details>
          )}
          <Notice>
            La date du prélèvement est connue au jour près ; aucune heure n’est déduite. Les valeurs
            décochées ou incompatibles ne seront pas ajoutées. Les unités ne sont pas converties. «
            µ » et « μ » sont seulement harmonisés typographiquement ; l’unité lue est conservée.
            Les résultats ajoutés gardent le statut « à vérifier ».
          </Notice>
          {proposal.candidates.length > 0 && (
            <div className="modal-actions">
              <button
                className="button primary"
                disabled={busy || reviewed || selected.length === 0}
                onClick={confirm}
              >
                {busy ? <LoaderCircle className="spin" size={15} /> : <CheckCircle2 size={15} />}
                Ajouter {selected.length} résultat(s) sélectionné(s)
              </button>
              <a
                className="text-button"
                href={`/api/pdf/fixtures?id=${proposal.fixtureId}`}
                target="_blank"
                rel="noreferrer"
              >
                Source PDF <ArrowUpRight size={14} />
              </a>
            </div>
          )}
        </>
      )}
      {success && (
        <div className="feedback success" role="status">
          <CheckCircle2 size={18} />
          {success}
        </div>
      )}
      <Notice>
        Uniquement les fichiers synthétiques de ce prototype, sous forme de tableau contrôlé (lignes
        à séparateurs ou colonnes alignées). Les autres formats de laboratoire, scans, documents
        réels et corrections de valeur ne sont pas pris en charge dans cet incrément.
      </Notice>
    </div>
  );
}
