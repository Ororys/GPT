import { createHash, randomBytes } from 'node:crypto';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';
/**
 * OpenID Connect, authorization code + PKCE (RFC 7636). Pure helpers, testable without a
 * network: the caller supplies the key set. Multi-factor authentication is required through
 * the `amr` claim (RFC 8176), e.g. "mfa", "otp" or "hwk", as configured.
 */
export interface OidcSettings {
  issuer: string;
  clientId: string;
  clientSecret: string | null;
  redirectUri: string;
  /** At least one of these must appear in the ID token `amr` claim. */
  requiredAmr: string[];
}
export function readOidcSettings(env: Record<string, string | undefined>): OidcSettings {
  const issuer = env.HC_PERSONAL_OIDC_ISSUER,
    clientId = env.HC_PERSONAL_OIDC_CLIENT_ID,
    redirectUri = env.HC_PERSONAL_OIDC_REDIRECT_URI;
  if (!issuer || !clientId || !redirectUri) throw Error('OIDC_MISCONFIGURED');
  for (const u of [issuer, redirectUri]) {
    const url = new URL(u);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    // Plain HTTP only for a provider or callback on this machine (tests, local development).
    if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local))
      throw Error('OIDC_MISCONFIGURED');
  }
  const requiredAmr = (env.HC_PERSONAL_OIDC_REQUIRED_AMR || 'mfa')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  if (!requiredAmr.length) throw Error('OIDC_MISCONFIGURED');
  return {
    issuer: issuer.replace(/\/$/, ''),
    clientId,
    clientSecret: env.HC_PERSONAL_OIDC_CLIENT_SECRET || null,
    redirectUri,
    requiredAmr,
  };
}
export const randomToken = () => randomBytes(32).toString('base64url');
export const pkceChallenge = (verifier: string) =>
  createHash('sha256').update(verifier).digest('base64url');
/** Stable, non-reversible session subject: no raw provider identifier is stored. */
export function subjectFor(issuer: string, sub: string) {
  return 'oidc:' + createHash('sha256').update(`${issuer}\n${sub}`).digest('base64url');
}
export const OIDC_SUBJECT = /^oidc:[A-Za-z0-9_-]{43}$/;
export interface VerifiedLogin {
  subject: string;
  amr: string[];
}
export async function verifyIdToken(
  idToken: string,
  keys: JWTVerifyGetKey,
  settings: OidcSettings,
  nonce: string,
  now = Date.now(),
): Promise<VerifiedLogin> {
  let payload;
  try {
    ({ payload } = await jwtVerify(idToken, keys, {
      issuer: settings.issuer,
      audience: settings.clientId,
      algorithms: ['RS256', 'PS256', 'ES256', 'EdDSA'],
      currentDate: new Date(now),
      clockTolerance: 30,
      requiredClaims: ['sub', 'exp', 'iat', 'nonce'],
    }));
  } catch {
    throw Error('OIDC_INVALID_TOKEN');
  }
  if (payload.nonce !== nonce) throw Error('OIDC_INVALID_TOKEN');
  if (Array.isArray(payload.aud) && payload.aud.length > 1 && payload.azp !== settings.clientId)
    throw Error('OIDC_INVALID_TOKEN');
  const amr = Array.isArray(payload.amr) ? payload.amr.filter((x) => typeof x === 'string') : [];
  if (!settings.requiredAmr.some((a) => amr.includes(a))) throw Error('OIDC_MFA_REQUIRED');
  if (typeof payload.sub !== 'string' || !payload.sub || payload.sub.length > 255)
    throw Error('OIDC_INVALID_TOKEN');
  return { subject: subjectFor(settings.issuer, payload.sub), amr };
}
