import { readPdfBytes } from '@/modules/extraction/server';
import { createHash } from 'node:crypto';
import { requireIdentity, apiError } from '@/modules/identity/server';
import { readPersonalRecord } from '@/modules/health-records/service';
import { documentPdf } from '@/modules/documents/pdf';
import { audit } from '@/modules/audit/server';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const user = await requireIdentity();
    const record = await readPersonalRecord(user.personId);
    const id = (await params).documentId;
    const doc = record.documents.find((d) => d.id === id);
    if (!doc) throw Error('NOT_FOUND');
    const pdf = doc.id.startsWith('pdf-')
      ? await readPdfBytes(user.personId, user.subject, doc.id.slice(4))
      : await documentPdf(record, doc);
    await audit(user.subject, 'read_document', doc.id);
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${doc.id}.pdf"`,
        'X-Document-SHA256': createHash('sha256').update(pdf).digest('hex'),
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
