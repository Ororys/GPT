/**
 * Minimal OpenID provider for tests only: discovery, authorize (code + PKCE S256), token,
 * JWKS. The next signed-in user, and whether MFA happened, are set through /test/next.
 * Never used by the application at runtime.
 */
import http from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
export async function startOidcProvider(port: number, clientId: string, clientSecret: string) {
  const issuer = `http://127.0.0.1:${port}`;
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256', use: 'sig' };
  let next = { sub: 'alex-real', amr: ['pwd', 'otp', 'mfa'], audience: clientId };
  const codes = new Map<
    string,
    { challenge: string; nonce: string; redirect: string; user: typeof next }
  >();
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url!, issuer);
    const send = (status: number, body: unknown, headers: Record<string, string> = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers });
      res.end(JSON.stringify(body));
    };
    const body = async () => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      return Buffer.concat(chunks).toString();
    };
    if (url.pathname === '/.well-known/openid-configuration')
      return send(200, {
        issuer,
        authorization_endpoint: `${issuer}/authorize`,
        token_endpoint: `${issuer}/token`,
        jwks_uri: `${issuer}/jwks`,
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
        id_token_signing_alg_values_supported: ['RS256'],
      });
    if (url.pathname === '/jwks') return send(200, { keys: [jwk] });
    if (url.pathname === '/test/next' && req.method === 'POST') {
      next = { ...next, ...JSON.parse(await body()) };
      return send(200, next);
    }
    if (url.pathname === '/authorize') {
      const p = url.searchParams;
      if (
        p.get('response_type') !== 'code' ||
        p.get('client_id') !== clientId ||
        p.get('code_challenge_method') !== 'S256' ||
        !p.get('code_challenge') ||
        !p.get('nonce') ||
        !p.get('state')
      )
        return send(400, { error: 'invalid_request' });
      const code = randomBytes(16).toString('hex');
      codes.set(code, {
        challenge: p.get('code_challenge')!,
        nonce: p.get('nonce')!,
        redirect: p.get('redirect_uri')!,
        user: next,
      });
      const back = new URL(p.get('redirect_uri')!);
      back.searchParams.set('code', code);
      back.searchParams.set('state', p.get('state')!);
      res.writeHead(302, { location: back.href });
      return res.end();
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      const auth = Buffer.from((req.headers.authorization || '').replace(/^Basic /, ''), 'base64')
        .toString()
        .split(':')
        .map(decodeURIComponent);
      const form = new URLSearchParams(await body());
      const entry = codes.get(form.get('code') || '');
      codes.delete(form.get('code') || '');
      if (auth[0] !== clientId || auth[1] !== clientSecret)
        return send(401, { error: 'invalid_client' });
      if (
        !entry ||
        form.get('redirect_uri') !== entry.redirect ||
        createHash('sha256')
          .update(form.get('code_verifier') || '')
          .digest('base64url') !== entry.challenge
      )
        return send(400, { error: 'invalid_grant' });
      const id_token = await new SignJWT({ nonce: entry.nonce, amr: entry.user.amr })
        .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
        .setIssuer(issuer)
        .setSubject(entry.user.sub)
        .setAudience(entry.user.audience)
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(privateKey);
      return send(200, { id_token, token_type: 'Bearer', expires_in: 300 });
    }
    send(404, { error: 'not_found' });
  });
  await new Promise<void>((r) => server.listen(port, '127.0.0.1', r));
  return { issuer, close: () => new Promise<void>((r) => server.close(() => r())) };
}
