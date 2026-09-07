import { describe, expect, it, vi } from 'vitest';
import { companionFromEnvironment } from '../src/companion-config';

const reply = () => new Response(JSON.stringify({ choices: [{ message: { content: 'One small step.' }, finish_reason: 'stop' }] }));

describe('one configured companion across surfaces', () => {
  it('chooses NVIDIA over retained keys and sends the documented non-thinking request', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply());
    const selected = companionFromEnvironment({ NVIDIA_API_KEY: '  test-nvidia  ', ZAI_API_KEY: 'test-zai', OPENAI_API_KEY: 'test-openai' }, { fetch: fetcher });
    expect(selected?.provider).toBe('NVIDIA');
    expect(await selected?.model.complete([{ role: 'user', content: 'Help me reflect.' }])).toBe('One small step.');
    const [url, init] = fetcher.mock.calls[0]!;
    expect(url).toBe('https://integrate.api.nvidia.com/v1/chat/completions');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer test-nvidia' });
    expect(JSON.parse(String(init?.body))).toMatchObject({ model: 'nvidia/nemotron-3-super-120b-a12b', chat_template_kwargs: { enable_thinking: false }, max_tokens: 800 });
    expect(selected?.model.id).not.toContain('test-nvidia');
  });

  it('supports a NVIDIA model override and propagates cancellation', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply());
    const signal = new AbortController().signal;
    const selected = companionFromEnvironment({ NVIDIA_API_KEY: 'test', NVIDIA_MODEL: 'nvidia/another-nemotron' }, { fetch: fetcher });
    await selected?.model.complete([{ role: 'user', content: 'Hi' }], { maxTokens: 90, signal });
    expect(fetcher.mock.calls[0]?.[1]?.signal).toBe(signal);
    expect(JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body))).toMatchObject({ model: 'nvidia/another-nemotron', max_tokens: 90 });
  });

  it.each([
    ['OPENAI', { OPENAI_API_KEY: 'test', ZAI_API_KEY: 'retained' }, 'https://api.openai.com/v1/chat/completions'],
    ['DEEPSEEK', { DEEPSEEK_API_KEY: 'test', ZAI_API_KEY: 'retained' }, 'https://api.deepseek.com/v1/chat/completions'],
    ['ZAI', { ZAI_API_KEY: 'test', ZAI_PLAN: 'coding' }, 'https://api.z.ai/api/coding/paas/v4/chat/completions'],
    ['OPENROUTER', { OPENROUTER_API_KEY: 'test' }, 'https://openrouter.ai/api/v1/chat/completions'],
  ])('preserves %s when NVIDIA is blank', async (provider, env, url) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(reply());
    const selected = companionFromEnvironment({ ...env, NVIDIA_API_KEY: '  ' }, { fetch: fetcher });
    expect(selected?.provider).toBe(provider);
    await selected?.model.complete([{ role: 'user', content: 'Hi' }]);
    expect(fetcher.mock.calls[0]?.[0]).toBe(url);
  });

  it('keeps the Z.AI pool working', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValueOnce(new Response('{}', { status: 401 })).mockResolvedValueOnce(reply());
    const selected = companionFromEnvironment({ ZAI_API_KEY: 'test-one', ZAI_API_KEY_2: 'test-two', ZAI_PLAN: 'coding' }, { fetch: fetcher });
    expect(await selected?.model.complete([{ role: 'user', content: 'Hi' }])).toBe('One small step.');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('keeps provider bodies out of NVIDIA errors', async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(new Response(JSON.stringify({ error: { message: 'private upstream detail' } }), { status: 401 }));
    const selected = companionFromEnvironment({ NVIDIA_API_KEY: 'test' }, { fetch: fetcher });
    await expect(selected?.model.complete([{ role: 'user', content: 'Hi' }])).rejects.toThrow('401');
  });

  it('is unconfigured with no credentials', () => {
    expect(companionFromEnvironment({})).toBeUndefined();
  });
});
