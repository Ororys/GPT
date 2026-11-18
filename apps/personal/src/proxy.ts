import { NextRequest, NextResponse } from 'next/server';
export function proxy(request: NextRequest) {
  const host = request.headers.get('host') || '';
  let hostname = '';
  try {
    hostname = new URL(`http://${host}`).hostname;
  } catch {
    return NextResponse.json({ error: 'MISDIRECTED_REQUEST' }, { status: 421 });
  }
  const allowed = (process.env.HC_PERSONAL_ALLOWED_HOSTS || 'localhost,127.0.0.1,[::1]').split(',');
  if (!allowed.includes(hostname))
    return NextResponse.json({ error: 'MISDIRECTED_REQUEST' }, { status: 421 });
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const dev = process.env.NODE_ENV !== 'production';
  const csp = `default-src 'self'; script-src 'self' 'nonce-${nonce}'${dev ? " 'unsafe-eval'" : ''}; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'${dev ? ' ws:' : ''}; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; frame-src 'self' blob:; form-action 'self'`;
  const headers = new Headers(request.headers);
  headers.set('x-nonce', nonce);
  headers.set('Content-Security-Policy', csp);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'] };
