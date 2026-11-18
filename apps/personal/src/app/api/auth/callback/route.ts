import { cookies } from 'next/headers';
import { COOKIE, apiError, sessionSecret } from '@/modules/identity/server';
import { TX_COOKIE, authMode, exchangeCode, oidcSettings, provider } from '@/modules/identity/oidc';
import { verifyIdToken } from '@/modules/identity/oidc-core';
import { issueOidcSession, openValue } from '@/modules/identity/token';
import { enrolledPerson } from '@/modules/identity/login';
import { audit } from '@/modules/audit/server';
/**
 * Outcome shown on the home page; never echoes provider data. The target is built from the
 * configured public redirect URI, not from request.url: behind Next's server the request URL
 * can carry an internal host (localhost), which would drop the session cookie's host.
 */
const back = (_request: Request, outcome: string) =>
  Response.redirect(new URL(`/?auth=${outcome}`, oidcSettings().redirectUri), 302);
export async function GET(request: Request) {
  try {
    if (authMode() !== 'oidc') throw Error('NOT_FOUND');
    const jar = await cookies();
    const tx = openValue<{ state: string; nonce: string; verifier: string; expires: number }>(
      jar.get(TX_COOKIE)?.value,
      sessionSecret,
    );
    jar.delete({ name: TX_COOKIE, path: '/api/auth' });
    const params = new URL(request.url).searchParams;
    const code = params.get('code'),
      state = params.get('state');
    if (!tx || !code || !state || state !== tx.state || code.length > 2000)
      return back(request, 'invalid');
    const { keys, settings } = await provider();
    let login;
    try {
      login = await verifyIdToken(await exchangeCode(code, tx.verifier), keys, settings, tx.nonce);
    } catch (e) {
      const reason = e instanceof Error && e.message === 'OIDC_MFA_REQUIRED' ? 'mfa' : 'invalid';
      await audit('oidc:unverified', 'oidc_denied', reason).catch(() => undefined);
      return back(request, reason);
    }
    const personId = await enrolledPerson(login.subject);
    if (!personId) return back(request, 'not_enrolled');
    jar.set(COOKIE, issueOidcSession(login.subject, personId, sessionSecret), {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.HC_PERSONAL_SECURE_COOKIE === 'true',
      path: '/',
      maxAge: 3600,
    });
    return back(request, 'ok');
  } catch (e) {
    return apiError(e);
  }
}
