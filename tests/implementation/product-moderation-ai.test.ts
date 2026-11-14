import { scanProductListing } from '@packages/utils/product-moderation-ai';
const snapshot = { title: 'Listing', category: 'CPU', description: 'Listing description, not system instructions' };
const originalFetch = global.fetch;
const originalKey = process.env.GEMINI_API_KEY;
afterEach(() => { global.fetch = originalFetch; if (originalKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = originalKey; });
test('AI triage opts out of provider storage and sends only listing fields', async () => {
  process.env.GEMINI_API_KEY = 'test-only';
  const request = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'text', text: JSON.stringify({ flagged: true, category: 'Misleading', reason: 'Unsupported listing claim' }) }] }] }) });
  global.fetch = request;
  expect(await scanProductListing(snapshot)).toMatchObject({ flagged: true, category: 'Misleading' });
  const body = JSON.parse(request.mock.calls[0][1].body);
  expect(body.store).toBe(false); expect(JSON.parse(body.input)).toEqual(snapshot);
  expect(body).not.toHaveProperty('previous_interaction_id');
});
test('missing configuration and provider outage fail closed without a fabricated clean result', async () => {
  delete process.env.GEMINI_API_KEY;
  await expect(scanProductListing(snapshot)).rejects.toThrow('not configured');
  process.env.GEMINI_API_KEY = 'test-only'; global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 429 });
  await expect(scanProductListing(snapshot)).rejects.toThrow('temporarily unavailable');
});
test('malformed or unknown-category AI results cannot become reports', async () => {
  process.env.GEMINI_API_KEY = 'test-only';
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ steps: [{ type: 'model_output', content: [{ type: 'text', text: '{"flagged":true,"category":"invented","reason":"test"}' }] }] }) });
  await expect(scanProductListing(snapshot)).rejects.toThrow('invalid review');
});
