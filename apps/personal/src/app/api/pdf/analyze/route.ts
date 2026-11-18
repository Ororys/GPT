import { requireIdentity, requireSameOrigin, apiError } from '@/modules/identity/server';
import { stagePdf } from '@/modules/extraction/server';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireIdentity();
    if (!request.headers.get('content-type')?.startsWith('application/pdf'))
      throw Error('INVALID_FILE_TYPE');
    if (Number(request.headers.get('content-length') || 0) > 500000)
      throw Error('PAYLOAD_TOO_LARGE');
    const reader = request.body?.getReader();
    if (!reader) throw Error('INVALID_PDF');
    let n = 0;
    const chunks: Uint8Array[] = [];
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      n += part.value.length;
      if (n > 500000) {
        await reader.cancel();
        throw Error('PAYLOAD_TOO_LARGE');
      }
      chunks.push(part.value);
    }
    return Response.json(await stagePdf(Buffer.concat(chunks), user.personId, user.subject));
  } catch (e) {
    return apiError(e);
  }
}
