import { requireIdentity, requireSameOrigin, apiError } from '@/modules/identity/server';
import { ConsentRequestSchema } from '@/modules/consent/model';
import { readConsents, setConsent } from '@/modules/consent/server';
export async function GET() {
  try {
    const user = await requireIdentity();
    return Response.json(await readConsents(user.personId, user.subject));
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
    const text = await request.text();
    if (text.length > 1000) throw Error('PAYLOAD_TOO_LARGE');
    let data;
    try {
      data = ConsentRequestSchema.parse(JSON.parse(text));
    } catch {
      throw Error('INVALID_CONSENT');
    }
    return Response.json(
      await setConsent(
        user.personId,
        user.subject,
        data.source,
        data.expectedVersion,
        data.granted,
      ),
    );
  } catch (e) {
    return apiError(e);
  }
}
