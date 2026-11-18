import { cookies } from 'next/headers';
import { COOKIE, apiError, identity, requireSameOrigin } from '@/modules/identity/server';
import { audit } from '@/modules/audit/server';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const user = await identity();
    (await cookies()).delete({ name: COOKIE, path: '/' });
    if (user) await audit(user.subject, 'logout', user.personId);
    return Response.json({ signedOut: true });
  } catch (e) {
    return apiError(e);
  }
}
