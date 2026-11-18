import { requireIdentity, apiError } from '@/modules/identity/server';
import { readPersonalRecord } from '@/modules/health-records/service';
import { audit } from '@/modules/audit/server';
import { databaseCall } from '@/modules/storage/postgres';
import { storageMode } from '@/modules/storage/mode';
/**
 * Right of access / portability. The record as displayed, plus everything else stored for
 * this dossier (identities, permissions, PDF intakes and reviews, receipts, raw phone data,
 * activity log). Same shape as before at the top level; the rest lives under `export`.
 */
export async function GET() {
  try {
    const user = await requireIdentity();
    const record = await readPersonalRecord(user.personId);
    let extras: Record<string, unknown> = {
      note: 'Mode fichiers local : seules les données du dossier sont exportées.',
    };
    if (storageMode() === 'postgres') {
      const r = await databaseCall<{ status: string } & Record<string, unknown>>(
        'SELECT personal.api_export_extras($1,$2) AS result',
        [user.subject, user.personId],
      );
      if (r.status !== 'ok') throw Error('FORBIDDEN');
      const { status: _status, ...rest } = r;
      extras = rest;
    }
    await audit(user.subject, 'export_record', user.personId);
    const body = {
      ...record,
      export: {
        format: 'convergence-export',
        version: 1,
        generatedAt: new Date().toISOString(),
        ...extras,
      },
    };
    return new Response(JSON.stringify(body, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="convergence-dossier-export.json"',
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
