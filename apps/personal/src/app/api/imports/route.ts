import { audit } from '@/modules/audit/server';
import { storageMode } from '@/modules/storage/mode';
import { requireIdentity, requireSameOrigin, apiError } from '@/modules/identity/server';
import { importDemo } from '@/modules/health-records/repository';
import { TEMPLATE_TEXT } from '@/modules/documents/import-contract';
export async function GET() {
  try {
    await requireIdentity();
    return new Response(TEMPLATE_TEXT, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="bilan-synthetique-demo.json"',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireIdentity();
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw Error('INVALID_FILE_TYPE');
    const declared = Number(request.headers.get('content-length') || 0);
    if (declared > 100_000) throw Error('PAYLOAD_TOO_LARGE');
    const reader = request.body?.getReader();
    if (!reader) throw Error('INVALID_FILE');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > 100_000) {
        await reader.cancel();
        throw Error('PAYLOAD_TOO_LARGE');
      }
      chunks.push(part.value);
    }
    const text = Buffer.concat(chunks).toString('utf8');
    const result = await importDemo(text, user.personId, user.subject);

    if (storageMode() === 'local') await audit(user.subject, 'import_demo', user.personId);
    return Response.json(result, { status: result.inserted ? 201 : 200 });
  } catch (e) {
    return apiError(e);
  }
}
