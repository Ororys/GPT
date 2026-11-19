/**
 * Test double for the OpenAI Responses endpoint (browser tests of sprint 24): returns a
 * fixed transcription. Never used outside tests; no network access, no key.
 */
import { createServer } from 'node:http';
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
    {
      label: 'Ferritine',
      value: '80',
      unit: 'µg/L',
      referenceText: '30 - 300',
      page: 1,
      catalogCode: 'FERRITIN',
      category: 'Statut martial',
    },
    {
      label: 'CRP',
      value: '< 0,5',
      unit: 'mg/L',
      referenceText: null,
      page: 2,
      catalogCode: 'NONE',
      category: 'Inflammation',
    },
  ],
};
createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const request = JSON.parse(body || '{}');
    if (req.url !== '/v1/responses' || request.store !== false) {
      res.writeHead(400).end('{}');
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({
        model: 'modele-de-test',
        output: [
          { type: 'message', content: [{ type: 'output_text', text: JSON.stringify(reading) }] },
        ],
      }),
    );
  });
}).listen(3400, '127.0.0.1', () => console.log('fake openai on 3400'));
