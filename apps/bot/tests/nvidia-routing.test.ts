import { readFileSync } from 'node:fs';
import { companionFromEnvironment } from '@leela/ai';
import { expect, it, vi } from 'vitest';
import { askRoute } from '../src/serve';
import { blank } from '../../../scripts/lib/source.mjs';

it('the entry point never bypasses NVIDIA for a retained Z.AI streaming key', async () => {
  // Exercise the actual stream selector from the executable entry point. A
  // separately restated condition would pass while production still used Z.AI.
  const entry = blank(readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8'));
  const expression = entry.slice(entry.indexOf('serveAsk({')).match(/^\s*stream: (.+),$/m)?.[1];
  expect(expression).toBeDefined();
  const selectStream = new Function('aiProvider', 'process', 'zaiStream', `return (${expression});`);
  const env = { NVIDIA_API_KEY: 'test-nvidia', ZAI_API_KEY: 'test-retained' };
  const upstream = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: 'Reflect on this plan.' } }] })));
  const companion = companionFromEnvironment(env, { fetch: upstream })!;
  const legacy = vi.fn(() => { throw new Error('must not choose retained Z.AI'); });
  const stream = selectStream(companion.provider, { env }, legacy);
  expect(stream).toBeUndefined();
  const route = askRoute({ model: companion.model, stream });
  const response = await route(new Request('https://leela.test/api/ask', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://t27.ai' }, body: JSON.stringify({ question: 'What now?', system: 'Be brief.' }) }));
  expect(response.status).toBe(200);
  expect(await response.text()).toContain('"text":"Reflect on this plan."');
  expect(legacy).not.toHaveBeenCalled();
  expect(upstream.mock.calls[0]?.[0]).toContain('integrate.api.nvidia.com');
  const zai = vi.fn(() => 'legacy-stream');
  expect(selectStream('ZAI', { env }, zai)).toBe('legacy-stream');
});
