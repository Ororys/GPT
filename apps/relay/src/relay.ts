import {
  AI_CATEGORIES,
  AI_INSTRUCTIONS,
  AI_JSON_SCHEMA,
  AI_NOTICE_VERSION,
  AI_PROVIDER,
  AiReadingSchema,
  MAX_AI_PDF_BYTES,
  type AiReadingResponse,
} from '../../personal/src/modules/ai/contract.ts';
/**
 * Stateless relay between the mobile app and OpenAI (sprint 24). Its only reasons to exist:
 * keep the OpenAI key out of the app, and enforce what may be sent.
 *
 * - Nothing is stored: no database, no file, no log of the PDF or of the answer. Only error
 *   codes are logged. OpenAI is called with `store: false`.
 * - The app must state the consent version shown to the person for this sending.
 * - The answer is validated against the transcription schema before being returned; the
 *   app checks it again.
 *
 * Written against the Web standard Request/Response: runs on Node (src/server.ts) or on a
 * serverless platform. Hosting is a founder decision (cost, location, legal review).
 */
export interface RelayConfig {
  apiKey: string;
  model: string;
  /** Exact origins of the app's web view (e.g. https://localhost, capacitor://localhost). */
  allowedOrigins: string[];
  /** Defaults to https://api.openai.com/v1; the EU endpoint if the project is in Europe. */
  baseUrl?: string;
  /** Sendings per client address and hour (abuse and cost control). */
  hourlyLimit?: number;
}
export const CONSENT_HEADER = 'x-convergence-consent';
export const consentValue = `ai-reading;${AI_NOTICE_VERSION}`;
function base64(bytes: Uint8Array) {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000)
    text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
export function createRelay(
  config: RelayConfig,
  deps = { fetch: globalThis.fetch, now: Date.now },
) {
  if (!config.apiKey || !config.model) throw Error('RELAY_NOT_CONFIGURED');
  const base = (config.baseUrl ?? 'https://api.openai.com/v1').replace(/\/$/, '');
  const limit = config.hourlyLimit ?? 20;
  const hits = new Map<string, number[]>();
  const cors = (origin: string): Record<string, string> => ({
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'POST',
    'access-control-allow-headers': `content-type, ${CONSENT_HEADER}`,
    'access-control-max-age': '600',
    vary: 'Origin',
  });
  const reply = (status: number, body: unknown, origin?: string) =>
    new Response(JSON.stringify(body), {
      status,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
        ...(origin ? cors(origin) : {}),
      },
    });
  return async function handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get('origin') ?? '';
    const allowed = config.allowedOrigins.includes(origin);
    if (url.pathname !== '/v1/transcribe') return reply(404, { error: 'NOT_FOUND' });
    if (request.method === 'OPTIONS')
      return allowed
        ? new Response(null, { status: 204, headers: cors(origin) })
        : reply(403, { error: 'FORBIDDEN' });
    if (request.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
    if (!allowed) return reply(403, { error: 'FORBIDDEN' });
    if (request.headers.get(CONSENT_HEADER) !== consentValue)
      return reply(403, { error: 'CONSENT_REQUIRED' }, origin);
    if (!(request.headers.get('content-type') ?? '').startsWith('application/pdf'))
      return reply(415, { error: 'INVALID_PDF' }, origin);
    if (Number(request.headers.get('content-length') ?? 0) > MAX_AI_PDF_BYTES)
      return reply(413, { error: 'PAYLOAD_TOO_LARGE' }, origin);
    const client =
      request.headers.get('cf-connecting-ip') ??
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
      'unknown';
    const now = deps.now();
    const recent = (hits.get(client) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= limit) return reply(429, { error: 'RATE_LIMITED' }, origin);
    hits.set(client, [...recent, now]);
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > MAX_AI_PDF_BYTES)
      return reply(413, { error: 'PAYLOAD_TOO_LARGE' }, origin);
    if (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-')
      return reply(415, { error: 'INVALID_PDF' }, origin);
    let upstream: Response;
    try {
      upstream = await deps.fetch(`${base}/responses`, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${config.apiKey}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          store: false,
          instructions: AI_INSTRUCTIONS,
          input: [
            {
              role: 'user',
              content: [
                {
                  type: 'input_file',
                  filename: 'document.pdf',
                  file_data: `data:application/pdf;base64,${base64(bytes)}`,
                },
                {
                  type: 'input_text',
                  text: `Rubriques possibles : ${AI_CATEGORIES.join(', ')}. Recopie les résultats imprimés.`,
                },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'transcription',
              strict: true,
              schema: AI_JSON_SCHEMA,
            },
          },
        }),
      });
    } catch {
      console.error('relay: AI_UNAVAILABLE');
      return reply(502, { error: 'AI_UNAVAILABLE' }, origin);
    }
    if (!upstream.ok) {
      // Status only: the upstream body may echo the request.
      console.error(`relay: AI_ERROR ${upstream.status}`);
      return reply(502, { error: 'AI_ERROR' }, origin);
    }
    try {
      const data = (await upstream.json()) as {
        model?: string;
        output?: {
          type: string;
          content?: { type: string; text?: string }[];
        }[];
      };
      const text = data.output
        ?.filter((o) => o.type === 'message')
        .flatMap((o) => o.content ?? [])
        .find((c) => c.type === 'output_text')?.text;
      if (!text) throw Error('NO_TEXT');
      const reading = AiReadingSchema.parse(JSON.parse(text));
      const body: AiReadingResponse = {
        provider: AI_PROVIDER,
        model: data.model ?? config.model,
        reading,
      };
      return reply(200, body, origin);
    } catch {
      console.error('relay: AI_INVALID_OUTPUT');
      return reply(502, { error: 'AI_INVALID_OUTPUT' }, origin);
    }
  };
}
