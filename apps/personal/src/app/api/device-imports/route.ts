import { requireIdentity, requireSameOrigin, apiError } from '@/modules/identity/server';
import { DeviceImportSchema } from '@/modules/device/model';
import { deviceSummary, importDeviceRecords } from '@/modules/device/server';
export async function GET() {
  try {
    const user = await requireIdentity();
    return Response.json(await deviceSummary(user.personId, user.subject));
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
    if (text.length > 300_000) throw Error('PAYLOAD_TOO_LARGE');
    let data;
    try {
      data = DeviceImportSchema.parse(JSON.parse(text));
    } catch {
      throw Error('INVALID_DEVICE_DATA');
    }
    return Response.json(await importDeviceRecords(user.personId, user.subject, data));
  } catch (e) {
    return apiError(e);
  }
}
