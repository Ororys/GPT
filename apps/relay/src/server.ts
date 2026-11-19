/**
 * Node adapter for the relay. Configuration from the environment only, never committed:
 * OPENAI_API_KEY, OPENAI_MODEL, RELAY_ALLOWED_ORIGINS (comma-separated), optional
 * OPENAI_BASE_URL (EU endpoint), RELAY_HOURLY_LIMIT, PORT.
 * Must run behind HTTPS (the hosting platform's TLS) when used by the app.
 */
import { createServer } from 'node:http';
import { createRelay } from './relay.ts';
const handle = createRelay({
  apiKey: process.env.OPENAI_API_KEY ?? '',
  model: process.env.OPENAI_MODEL ?? '',
  allowedOrigins: (process.env.RELAY_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
  ...(process.env.OPENAI_BASE_URL ? { baseUrl: process.env.OPENAI_BASE_URL } : {}),
  ...(process.env.RELAY_HOURLY_LIMIT
    ? { hourlyLimit: Number(process.env.RELAY_HOURLY_LIMIT) }
    : {}),
});
const port = Number(process.env.PORT || 8787);
createServer(async (req, res) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
  const forwarded = req.socket.remoteAddress;
  if (forwarded && !headers.has('x-forwarded-for')) headers.set('x-forwarded-for', forwarded);
  const response = await handle(
    new Request(`http://${req.headers.host ?? 'relay'}${req.url}`, {
      method: req.method,
      headers,
      ...(req.method === 'POST' ? { body: Buffer.concat(chunks) } : {}),
    }),
  );
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(port, () => console.log(`relay on ${port}`));
