import { createHmac, timingSafeEqual } from 'node:crypto';
import { PERSON_ALPHA, PERSON_BETA } from '../health-records/model';
export type DemoIdentity = { subject: string; personId: string; expires: number };
export function checkSessionSecret(secret: string): string {
  if (Buffer.byteLength(secret) < 32) throw Error('SERVER_MISCONFIGURED');
  return secret;
}
export function issueSession(personId: string, secret: string, now = Date.now()): string {
  checkSessionSecret(secret);
  if (![PERSON_ALPHA, PERSON_BETA].includes(personId)) throw Error('UNKNOWN_PERSONA');
  const payload = Buffer.from(
    JSON.stringify({ subject: `personal:${personId}`, personId, expires: now + 60 * 60 * 1000 }),
  ).toString('base64url');
  return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url');
}
export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): DemoIdentity | null {
  if (!token || token.length > 1000) return null;
  try {
    const [payload, sig, ...rest] = token.split('.');
    if (rest.length || !payload || !sig) return null;
    const a = createHmac('sha256', secret).update(payload).digest(),
      b = Buffer.from(sig, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as DemoIdentity;
    if (
      ![PERSON_ALPHA, PERSON_BETA].includes(value.personId) ||
      value.subject !== `personal:${value.personId}` ||
      !Number.isSafeInteger(value.expires) ||
      value.expires <= now
    )
      return null;
    return value;
  } catch {
    return null;
  }
}
export function authorize(identity: DemoIdentity | null, personId: string) {
  if (!identity) throw Error('UNAUTHENTICATED');
  if (identity.personId !== personId) throw Error('FORBIDDEN');
  return identity;
}
