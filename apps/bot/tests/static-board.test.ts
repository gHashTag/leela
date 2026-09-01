import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { staticCandidatesFor, staticFileFor } from '../src/serve';

describe('the board served beside the bot', () => {
  it('maps the root and built assets into one explicit directory', () => {
    expect(staticFileFor('/app/apps/webgl/dist', '/')).toBe('/app/apps/webgl/dist/index.html');
    expect(staticFileFor('/app/apps/webgl/dist/', '/assets/main.js')).toBe(
      '/app/apps/webgl/dist/assets/main.js',
    );
    expect(staticFileFor('/app/apps/webgl/dist', '/docs/ru/')).toBe(
      '/app/apps/webgl/dist/docs/ru/index.html',
    );
  });

  it('refuses every spelling of a path outside the artifact', () => {
    for (const path of ['/../token', '/%2e%2e/token', '/docs/../../token', '/%00token', 'assets/x']) {
      expect(staticFileFor('/app/apps/webgl/dist', path), path).toBeNull();
    }
  });

  it('answers a missing path with the game page and keeps its legacy ways back useful', () => {
    expect(staticCandidatesFor('/app/apps/webgl/dist', '/missing')).toEqual([
      { path: '/app/apps/webgl/dist/missing', status: 200 },
      { path: '/app/apps/webgl/dist/404.html', status: 404 },
    ]);
    expect(staticCandidatesFor('/app/apps/webgl/dist', '/leela/')[0]).toEqual({
      path: '/app/apps/webgl/dist/index.html',
      status: 200,
    });
    expect(staticCandidatesFor('/app/apps/webgl/dist', '/leela/docs/')[0]).toEqual({
      path: '/app/apps/webgl/dist/docs/index.html',
      status: 200,
    });
  });

  it('the production image builds and copies the board before it starts', () => {
    const dockerfile = readFileSync(new URL('../Dockerfile', import.meta.url), 'utf8');
    expect(dockerfile).toContain('FROM manifests AS web-builder');
    expect(dockerfile).toContain('bun run --cwd apps/webgl build');
    expect(dockerfile).toContain('COPY --from=web-builder /app/apps/webgl/dist apps/webgl/dist');
    expect(dockerfile).toContain('ENV LEELA_WEB_ROOT=/app/apps/webgl/dist');
  });
});
