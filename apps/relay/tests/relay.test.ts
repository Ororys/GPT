import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRelay, CONSENT_HEADER, consentValue } from '../src/relay.ts';
// Test double for OpenAI: records what is sent, returns a scripted answer. No network.
const ORIGIN = 'https://localhost';
const pdf = new TextEncoder().encode('%PDF-1.4 test');
const reading = {
  printedDate: '02/03/2026',
  laboratory: 'Laboratoire de test',
  results: [
    {
      label: 'Glycémie à jeun',
      value: '5,2',
      unit: 'mmol/L',
      referenceText: '3,9 - 5,5',
      page: 1,
      catalogCode: 'NONE',
      category: 'Glycémie',
    },
  ],
};
function fakeOpenAI(answer: unknown = reading, status = 200) {
  const calls: { url: string; body: Record<string, unknown>; auth: string }[] = [];
  const fetch = (async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(init.body as string),
      auth: new Headers(init.headers).get('authorization') ?? '',
    });
    return new Response(
      JSON.stringify({
        model: 'model-test',
        output: [
          {
            type: 'message',
            content: [{ type: 'output_text', text: JSON.stringify(answer) }],
          },
        ],
      }),
      { status },
    );
  }) as typeof globalThis.fetch;
  return { calls, fetch };
}
const config = {
  apiKey: 'sk-test',
  model: 'model-test',
  allowedOrigins: [ORIGIN],
  hourlyLimit: 2,
};
const post = (headers: Record<string, string> = {}, body: Uint8Array = pdf) =>
  new Request('https://relay.test/v1/transcribe', {
    method: 'POST',
    headers: {
      origin: ORIGIN,
      'content-type': 'application/pdf',
      [CONSENT_HEADER]: consentValue,
      'x-forwarded-for': '203.0.113.7',
      ...headers,
    },
    body: body as BodyInit,
  });
test('envoi accepté : PDF transmis sans stockage, transcription validée et renvoyée', async () => {
  const ai = fakeOpenAI();
  const handle = createRelay(config, { fetch: ai.fetch, now: () => 0 });
  const res = await handle(post());
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), ORIGIN);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  const body = await res.json();
  assert.deepEqual(body, { provider: 'OpenAI', model: 'model-test', reading });
  const sent = ai.calls[0]!;
  assert.equal(sent.url, 'https://api.openai.com/v1/responses');
  assert.equal(sent.auth, 'Bearer sk-test');
  assert.equal(sent.body.store, false, 'aucune conservation demandée côté OpenAI');
  assert.match(String(sent.body.instructions), /Tu ne l'interprètes jamais/);
  const format = (sent.body.text as { format: { type: string; strict: boolean } }).format;
  assert.equal(format.type, 'json_schema');
  assert.equal(format.strict, true);
  const file = (sent.body.input as { content: { type: string; file_data?: string }[] }[])[0]!
    .content[0]!;
  assert.equal(file.type, 'input_file');
  assert.equal(file.file_data, `data:application/pdf;base64,${btoa('%PDF-1.4 test')}`);
});
test('refus : origine inconnue, consentement absent ou périmé, pas un PDF', async () => {
  const ai = fakeOpenAI();
  const handle = createRelay(config, { fetch: ai.fetch, now: () => 0 });
  assert.equal((await handle(post({ origin: 'https://evil.test' }))).status, 403);
  assert.equal((await handle(post({ [CONSENT_HEADER]: 'ai-reading;2020-01-01' }))).status, 403);
  assert.equal((await handle(post({ 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await handle(post({}, new TextEncoder().encode('<html>')))).status, 415);
  assert.equal(
    (await handle(new Request('https://relay.test/v1/transcribe', { method: 'GET' }))).status,
    405,
  );
  assert.equal((await handle(new Request('https://relay.test/autre'))).status, 404);
  assert.equal(ai.calls.length, 0, 'rien n’est envoyé à OpenAI');
});
test('pré-vérification CORS limitée aux origines de l’application', async () => {
  const handle = createRelay(config, {
    fetch: fakeOpenAI().fetch,
    now: () => 0,
  });
  const ok = await handle(
    new Request('https://relay.test/v1/transcribe', {
      method: 'OPTIONS',
      headers: { origin: ORIGIN },
    }),
  );
  assert.equal(ok.status, 204);
  assert.match(ok.headers.get('access-control-allow-headers') ?? '', /x-convergence-consent/);
  const ko = await handle(
    new Request('https://relay.test/v1/transcribe', {
      method: 'OPTIONS',
      headers: { origin: 'https://evil.test' },
    }),
  );
  assert.equal(ko.status, 403);
});
test('limite d’envois par adresse et par heure', async () => {
  let now = 0;
  const handle = createRelay(config, {
    fetch: fakeOpenAI().fetch,
    now: () => now,
  });
  assert.equal((await handle(post())).status, 200);
  assert.equal((await handle(post())).status, 200);
  assert.equal((await handle(post())).status, 429);
  assert.equal((await handle(post({ 'x-forwarded-for': '198.51.100.1' }))).status, 200);
  now = 3_600_001;
  assert.equal((await handle(post())).status, 200);
});
test('réponse de l’IA hors contrat (champ en plus, interprétation) : rejetée', async () => {
  const withComment = {
    ...reading,
    results: [{ ...reading.results[0], interpretation: 'normal' }],
  };
  for (const answer of [withComment, { results: 'rien' }]) {
    const handle = createRelay(config, {
      fetch: fakeOpenAI(answer).fetch,
      now: () => 0,
    });
    const res = await handle(post());
    assert.equal(res.status, 502);
    assert.deepEqual(await res.json(), { error: 'AI_INVALID_OUTPUT' });
  }
  const failing = createRelay(config, {
    fetch: fakeOpenAI(reading, 500).fetch,
    now: () => 0,
  });
  assert.deepEqual(await (await failing(post())).json(), { error: 'AI_ERROR' });
});
test('configuration obligatoire : pas de clé ou de modèle, pas de relais', () => {
  assert.throws(() => createRelay({ ...config, apiKey: '' }), /RELAY_NOT_CONFIGURED/);
  assert.throws(() => createRelay({ ...config, model: '' }), /RELAY_NOT_CONFIGURED/);
});
