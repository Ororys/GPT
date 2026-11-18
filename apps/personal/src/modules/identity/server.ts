import 'server-only';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { authorize, verifySession, checkSessionSecret, type DemoIdentity } from './token';
import { authMode } from './oidc';
const globalIdentity = globalThis as typeof globalThis & { personalDemoSecret?: string };
export const sessionSecret = checkSessionSecret(
  (globalIdentity.personalDemoSecret ??=
    process.env.HC_PERSONAL_SESSION_SECRET || randomBytes(32).toString('hex')),
);
export const COOKIE = 'hc_personal_demo';
export async function identity(): Promise<DemoIdentity | null> {
  return verifySession((await cookies()).get(COOKIE)?.value, sessionSecret, Date.now(), authMode());
}
export async function requireIdentity(personId?: string) {
  const value = await identity();
  if (!value) throw Error('UNAUTHENTICATED');
  if (personId) authorize(value, personId);
  return value;
}
export function requireSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host || origin !== `${new URL(request.url).protocol}//${host}`)
    throw Error('FORBIDDEN');
}
export function apiError(error: unknown) {
  const code = error instanceof Error ? error.message : 'INTERNAL_ERROR';
  const status = ['DATABASE_UNAVAILABLE', 'UNSAFE_DATABASE_ROLE', 'OIDC_UNAVAILABLE'].includes(code)
    ? 503
    : code === 'UNAUTHENTICATED'
      ? 401
      : code === 'FORBIDDEN' || code === 'CONSENT_REQUIRED' || code === 'DEMO_AUTH_DISABLED'
        ? 403
        : code === 'NOT_FOUND'
          ? 404
          : code === 'PAYLOAD_TOO_LARGE'
            ? 413
            : code.endsWith('_CONFLICT') || code.endsWith('_REQUIRES_POSTGRES')
              ? 409
              : code.startsWith('INVALID')
                ? 422
                : 500;
  return Response.json({ error: status === 500 ? 'INTERNAL_ERROR' : code }, { status });
}
