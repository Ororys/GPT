import 'server-only';
import { databaseCall } from '../storage/postgres';
import { storageMode } from '../storage/mode';
import { extractSyntheticPdf, type PdfProposal } from './native';
export async function stagePdf(bytes: Uint8Array, personId: string, subject: string) {
  if (storageMode() !== 'postgres') throw Error('PDF_REQUIRES_POSTGRES');
  const proposal = await extractSyntheticPdf(bytes, personId);
  const r = await databaseCall<{ status: string; proposal: PdfProposal; reviewed: boolean }>(
    'SELECT personal.api_stage_pdf($1,$2,$3,$4,$5::jsonb) AS result',
    [
      subject,
      personId,
      proposal.sha256,
      Buffer.from(bytes).toString('hex'),
      JSON.stringify(proposal),
    ],
  );
  if (r.status !== 'ok') throw Error(r.status === 'forbidden' ? 'FORBIDDEN' : 'INVALID_PDF');
  return r;
}
export async function confirmPdf(
  personId: string,
  subject: string,
  sha: string,
  selected: string[],
) {
  if (storageMode() !== 'postgres') throw Error('PDF_REQUIRES_POSTGRES');
  const r = await databaseCall<{ status: string; inserted: number; duplicates: number }>(
    'SELECT personal.api_confirm_pdf($1,$2,$3,$4::text[]) AS result',
    [subject, personId, sha, selected],
  );
  if (r.status !== 'ok')
    throw Error(
      r.status === 'forbidden'
        ? 'FORBIDDEN'
        : r.status === 'conflict'
          ? 'REVIEW_CONFLICT'
          : 'INVALID_SELECTION',
    );
  return r;
}
export async function readPdfBytes(personId: string, subject: string, sha: string) {
  const r = await databaseCall<{ status: string; hex: string }>(
    'SELECT personal.api_pdf_intake($1,$2,$3,true) AS result',
    [subject, personId, sha],
  );
  if (r.status !== 'ok') throw Error(r.status === 'forbidden' ? 'FORBIDDEN' : 'NOT_FOUND');
  return Buffer.from(r.hex, 'hex');
}
