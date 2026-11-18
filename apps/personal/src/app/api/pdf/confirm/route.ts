import { requireIdentity, requireSameOrigin, apiError } from '@/modules/identity/server';
import { confirmPdf } from '@/modules/extraction/server';
import { PdfSelectionSchema } from '@/modules/extraction/native';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireIdentity();
    const text = await request.text();
    if (text.length > 10000) throw Error('PAYLOAD_TOO_LARGE');
    let data;
    try {
      data = PdfSelectionSchema.parse(JSON.parse(text));
    } catch {
      throw Error('INVALID_SELECTION');
    }
    return Response.json(
      await confirmPdf(user.personId, user.subject, data.sha256, data.selectedIds),
    );
  } catch (e) {
    return apiError(e);
  }
}
