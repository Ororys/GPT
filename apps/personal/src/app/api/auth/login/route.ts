import { cookies } from 'next/headers';
import { apiError, sessionSecret } from '@/modules/identity/server';
import { TX_COOKIE, authMode, provider } from '@/modules/identity/oidc';
import { pkceChallenge, randomToken } from '@/modules/identity/oidc-core';
import { sealValue } from '@/modules/identity/token';
export async function GET() {
  try {
    if (authMode() !== 'oidc') throw Error('NOT_FOUND');
    const { discovery, settings } = await provider();
    const tx = { state: randomToken(), nonce: randomToken(), verifier: randomToken() };
    // Lax, not Strict: the provider redirects back with a cross-site top-level GET.
    (await cookies()).set(
      TX_COOKIE,
      sealValue({ ...tx, expires: Date.now() + 10 * 60 * 1000 }, sessionSecret),
      {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.HC_PERSONAL_SECURE_COOKIE === 'true',
        path: '/api/auth',
        maxAge: 600,
      },
    );
    const url = new URL(discovery.authorization_endpoint);
    url.search = new URLSearchParams({
      response_type: 'code',
      client_id: settings.clientId,
      redirect_uri: settings.redirectUri,
      scope: 'openid',
      state: tx.state,
      nonce: tx.nonce,
      code_challenge: pkceChallenge(tx.verifier),
      code_challenge_method: 'S256',
    }).toString();
    return Response.redirect(url, 302);
  } catch (e) {
    return apiError(e);
  }
}
