import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { blank } from '../../../scripts/lib/source.mjs';
import { liveAIExitCode, liveAIVerdict } from '../src/live-ai-monitor';

describe('the production companion canary', () => {
  it('passes only when a successful stream contains an answer delta', () => {
    const verdict = liveAIVerdict({
      status: 200,
      contentType: 'text/event-stream; charset=utf-8',
      body: 'data: {"thinking":"brief"}\n\ndata: {"text":"ready"}\n\ndata: {"done":true}\n\n',
    });

    expect(verdict).toEqual({ state: 'passing', why: 'the configured companion returned text' });
    expect(liveAIExitCode(verdict.state)).toBe(0);
  });

  it.each([
    ['a successful stream has no answer', { status: 200, contentType: 'text/event-stream', body: 'data: {"done":true}\n\n' }],
    ['the upstream is unavailable', { status: 502, contentType: 'application/json', body: '{"error":"private upstream detail"}' }],
    ['the route is not configured', { status: 503, contentType: 'application/json', body: '{}' }],
  ])('fails without echoing the response when %s', (_name, observation) => {
    const verdict = liveAIVerdict(observation);
    expect(verdict.state).toBe('failing');
    expect(verdict.why).not.toContain('private upstream detail');
    expect(liveAIExitCode(verdict.state)).toBe(1);
  });

  it('says unknown when production did not answer', () => {
    const verdict = liveAIVerdict(null);
    expect(verdict.state).toBe('unknown');
    expect(liveAIExitCode(verdict.state)).toBe(2);
  });
});

describe('the canary deployment contract', () => {
  it('ships the monitor and exposes one root command for it', () => {
    const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
    const monitor = blank(
      readFileSync(new URL('../../../scripts/monitor-live-ai.mjs', import.meta.url), 'utf8'),
    );
    const manifest = JSON.parse(
      readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
    );

    // Shipped by whatever mechanism the Dockerfile uses; see
    // every-monitor-reaches-the-image.test.ts for why the literal line went.
    expect(/^COPY\s+scripts\/monitor-(live-ai\.mjs|\*[\w.*-]*)\s/m.test(dockerfile)).toBe(true);
    expect(monitor).toContain("['ssh', 'bun', 'run', 'scripts/monitor-live-ai.mjs', '--inside']");
    expect(monitor).not.toContain('console.log(body)');
    expect(manifest.scripts?.['monitor:ai']).toBe('bun scripts/monitor-live-ai.mjs');
  });
});
