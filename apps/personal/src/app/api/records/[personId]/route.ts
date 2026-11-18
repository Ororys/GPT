import { readPersonalRecord } from '@/modules/health-records/service';
import { apiError } from '@/modules/identity/server';
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personId: string }> },
) {
  try {
    return Response.json(await readPersonalRecord((await params).personId));
  } catch (e) {
    return apiError(e);
  }
}
