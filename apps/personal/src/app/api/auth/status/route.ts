import { identity, apiError } from '@/modules/identity/server';
import { authMode } from '@/modules/identity/oidc';
export async function GET() {
  try {
    const user = await identity();
    return Response.json(
      { mode: authMode(), authenticated: !!user, personId: user?.personId ?? null },
      { headers: { 'cache-control': 'no-store' } },
    );
  } catch (e) {
    return apiError(e);
  }
}
