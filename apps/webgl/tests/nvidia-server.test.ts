import { createServer } from 'node:http';
import { once } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { askHandler } from '../server/ask';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('serves NVIDIA answer events even while legacy Z.AI credentials remain', async () => {
  vi.stubEnv('NVIDIA_API_KEY', 'test-nvidia');
  vi.stubEnv('ZAI_API_KEY', 'test-retained');
  const original = globalThis.fetch;
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response('data: {"choices":[{"delta":{"content":"One step."}}]}\n\ndata: [DONE]\n\n', { headers: { 'content-type': 'text/event-stream' } }));
  vi.stubGlobal('fetch', upstream);
  const server = createServer((req, res) => { void askHandler(req, res, () => res.end()); });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('missing test address');
    const response = await original(`http://127.0.0.1:${address.port}/api/ask`, { method: 'POST', body: JSON.stringify({ question: 'What now?' }) });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(await response.text()).toContain('"text":"One step."');
    expect(upstream.mock.calls[0]?.[0]).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(JSON.parse(String(upstream.mock.calls[0]?.[1]?.body))).toMatchObject({ model: 'nvidia/nemotron-3-super-120b-a12b', chat_template_kwargs: { enable_thinking: false } });
  } finally { server.closeAllConnections(); await new Promise<void>((resolve) => server.close(() => resolve())); }
});
