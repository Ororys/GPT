import { requireIdentity, apiError } from '@/modules/identity/server';
import { PDF_FIXTURES, fixturePdf, type FixtureId } from '@/modules/extraction/corpus';
export async function GET(request: Request) {
  try {
    await requireIdentity('demo-alpha');
    const id = new URL(request.url).searchParams.get('id');
    if (!id) return Response.json(PDF_FIXTURES);
    if (!PDF_FIXTURES.some((f) => f.id === id)) throw Error('NOT_FOUND');
    return new Response(Buffer.from(await fixturePdf(id as FixtureId)), {
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `inline; filename="bilan-synthetique-${id}.pdf"`,
      },
    });
  } catch (e) {
    return apiError(e);
  }
}
