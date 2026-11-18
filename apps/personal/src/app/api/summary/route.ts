import { requireIdentity, apiError } from '@/modules/identity/server';
import { readPersonalRecord } from '@/modules/health-records/service';
import { audit } from '@/modules/audit/server';
import { consultationSummary, SUMMARY_PERIODS } from '@/modules/summary/model';
import { consultationSummaryPdf } from '@/modules/summary/pdf';
export async function GET(request: Request) {
  try {
    const user = await requireIdentity();
    const period = Number(new URL(request.url).searchParams.get('period') ?? 365);
    if (!(SUMMARY_PERIODS as readonly number[]).includes(period)) throw Error('INVALID_PERIOD');
    const record = await readPersonalRecord(user.personId);
    const pdf = await consultationSummaryPdf(consultationSummary(record, period), {
      name: record.profile.firstName,
      personId: record.personId,
    });
    await audit(user.subject, 'export_summary', user.personId);
    return new Response(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="convergence-resume-${period}j.pdf"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
