import { cookies } from 'next/headers';
import { z } from 'zod';
import { COOKIE, sessionSecret, requireSameOrigin, apiError } from '@/modules/identity/server';
import { issueSession } from '@/modules/identity/token';
import { PERSON_ALPHA, PERSON_BETA } from '@/modules/health-records/model';
import { audit } from '@/modules/audit/server';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const text = await request.text();
    if (text.length > 200) throw Error('INVALID_REQUEST');
    let body: unknown;
    try {
      body = JSON.parse(text);
    } catch {
      throw Error('INVALID_JSON');
    }
    const value = z.strictObject({ personId: z.enum([PERSON_ALPHA, PERSON_BETA]) }).safeParse(body);
    if (!value.success) throw Error('INVALID_PERSONA');
    const token = issueSession(value.data.personId, sessionSecret);
    (await cookies()).set(COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.HC_PERSONAL_SECURE_COOKIE === 'true',
      path: '/',
      maxAge: 3600,
    });
    await audit(`personal:${value.data.personId}`, 'demo_session', value.data.personId);
    return Response.json({ personId: value.data.personId, mode: 'synthetic-demo' });
  } catch (e) {
    return apiError(e);
  }
}
