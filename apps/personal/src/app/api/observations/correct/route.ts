import { requireIdentity, requireSameOrigin, apiError } from '@/modules/identity/server';
import { CorrectionRequestSchema } from '@/modules/health-records/corrections';
import { correctObservation } from '@/modules/health-records/correction-server';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await requireIdentity();
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      throw Error('INVALID_FILE_TYPE');
    const text = await request.text();
    if (text.length > 4000) throw Error('PAYLOAD_TOO_LARGE');
    let data;
    try {
      data = CorrectionRequestSchema.parse(JSON.parse(text));
    } catch {
      throw Error('INVALID_CORRECTION');
    }
    return Response.json(await correctObservation(user.personId, user.subject, data));
  } catch (e) {
    return apiError(e);
  }
}
