import { createHmac, timingSafeEqual } from 'node:crypto';
import { PERSON_ALPHA, PERSON_BETA } from '../health-records/model';
import { OIDC_SUBJECT } from './oidc-core';
export type DemoIdentity = {
  subject: string;
  personId: string;
  expires: number;
  /** Absent on demo sessions issued before 0.12. */
  auth?: 'demo' | 'oidc';
};
const SESSION_MS = 60 * 60 * 1000;
const sign = (payload: string, secret: string) =>
  createHmac('sha256', secret).update(payload).digest('base64url');
/** Signed, expiring JSON value (session or short-lived login transaction). */
export function sealValue(value: object, secret: string) {
  checkSessionSecret(secret);
  const payload = Buffer.from(JSON.stringify(value)).toString('base64url');
  return payload + '.' + sign(payload, secret);
}
export function openValue<T extends { expires: number }>(
  token: string | undefined,
  secret: string,
  now = Date.now(),
): T | null {
  if (!token || token.length > 2000) return null;
  try {
    const [payload, sig, ...rest] = token.split('.');
    if (rest.length || !payload || !sig) return null;
    const a = Buffer.from(sign(payload, secret), 'base64url'),
      b = Buffer.from(sig, 'base64url');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const value = JSON.parse(Buffer.from(payload, 'base64url').toString()) as T;
    if (!Number.isSafeInteger(value.expires) || value.expires <= now) return null;
    return value;
  } catch {
    return null;
  }
}
export function issueOidcSession(
  subject: string,
  personId: string,
  secret: string,
  now = Date.now(),
): string {
  if (!OIDC_SUBJECT.test(subject) || !/^[a-z0-9-]{1,64}$/.test(personId))
    throw Error('INVALID_SESSION');
  return sealValue({ subject, personId, expires: now + SESSION_MS, auth: 'oidc' }, secret);
}
export function checkSessionSecret(secret: string): string {
  if (Buffer.byteLength(secret) < 32) throw Error('SERVER_MISCONFIGURED');
  return secret;
}
export function issueSession(personId: string, secret: string, now = Date.now()): string {
  checkSessionSecret(secret);
  if (![PERSON_ALPHA, PERSON_BETA].includes(personId)) throw Error('UNKNOWN_PERSONA');
  return sealValue(
    { subject: `personal:${personId}`, personId, expires: now + SESSION_MS, auth: 'demo' },
    secret,
  );
}
export function verifySession(
  token: string | undefined,
  secret: string,
  now = Date.now(),
  mode: 'demo' | 'oidc' = 'demo',
): DemoIdentity | null {
  const value = openValue<DemoIdentity>(token, secret, now);
  if (!value) return null;
  const auth = value.auth ?? 'demo';
  // A session is only valid in the mode that issued it.
  if (auth !== mode) return null;
  if (auth === 'demo')
    return [PERSON_ALPHA, PERSON_BETA].includes(value.personId) &&
      value.subject === `personal:${value.personId}`
      ? value
      : null;
  return OIDC_SUBJECT.test(value.subject) && /^[a-z0-9-]{1,64}$/.test(value.personId)
    ? value
    : null;
}
export function authorize(identity: DemoIdentity | null, personId: string) {
  if (!identity) throw Error('UNAUTHENTICATED');
  if (identity.personId !== personId) throw Error('FORBIDDEN');
  return identity;
}
