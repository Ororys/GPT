import { requireIdentity, apiError } from '@/modules/identity/server';
import { readPersonalRecord } from '@/modules/health-records/service';
import { audit } from '@/modules/audit/server';
export async function GET() {
  try {
    const user = await requireIdentity();
    const record = await readPersonalRecord(user.personId);
    await audit(user.subject, 'export_record', user.personId);
    return new Response(JSON.stringify(record, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="convergence-dossier-synthetique.json"',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
