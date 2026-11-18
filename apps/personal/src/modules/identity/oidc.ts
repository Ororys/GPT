import 'server-only';
import { createRemoteJWKSet } from 'jose';
import { readOidcSettings, type OidcSettings } from './oidc-core';
/** Short-lived login transaction (state, nonce, PKCE verifier). */
export const TX_COOKIE = 'hc_oidc_tx';
export const authMode = () => (process.env.HC_PERSONAL_AUTH === 'oidc' ? 'oidc' : 'demo');
interface Discovery {
  authorization_endpoint: string;
  token_endpoint: string;
  jwks_uri: string;
  end_session_endpoint?: string;
}
const state = globalThis as typeof globalThis & {
  oidcDiscovery?: Promise<{ discovery: Discovery; keys: ReturnType<typeof createRemoteJWKSet> }>;
};
export const oidcSettings = (): OidcSettings => readOidcSettings(process.env);
export function provider() {
  const settings = oidcSettings();
  state.oidcDiscovery ??= (async () => {
    const res = await fetch(`${settings.issuer}/.well-known/openid-configuration`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) throw Error('OIDC_UNAVAILABLE');
    const d = await res.json();
    // The discovery document must describe exactly the configured issuer.
    if (String(d.issuer).replace(/\/$/, '') !== settings.issuer) throw Error('OIDC_MISCONFIGURED');
    for (const k of ['authorization_endpoint', 'token_endpoint', 'jwks_uri'])
      if (typeof d[k] !== 'string') throw Error('OIDC_MISCONFIGURED');
    return { discovery: d as Discovery, keys: createRemoteJWKSet(new URL(d.jwks_uri)) };
  })().catch((e) => {
    state.oidcDiscovery = undefined;
    throw e;
  });
  return state.oidcDiscovery.then((p) => ({ ...p, settings }));
}
export async function exchangeCode(code: string, verifier: string) {
  const { discovery, settings } = await provider();
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: settings.redirectUri,
    client_id: settings.clientId,
    code_verifier: verifier,
  });
  const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
  if (settings.clientSecret)
    headers.authorization =
      'Basic ' +
      Buffer.from(
        `${encodeURIComponent(settings.clientId)}:${encodeURIComponent(settings.clientSecret)}`,
      ).toString('base64');
  const res = await fetch(discovery.token_endpoint, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw Error('OIDC_TOKEN_REFUSED');
  const json = await res.json();
  if (typeof json.id_token !== 'string') throw Error('OIDC_TOKEN_REFUSED');
  return json.id_token as string;
}
