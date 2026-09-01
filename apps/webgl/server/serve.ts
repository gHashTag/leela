import { createServer } from 'node:http';

import { askHandler } from './ask';

/**
 * The companion's route, as a server anybody can deploy.
 *
 * The board used to be fetched from a Vite dev server and asked it directly, so
 * both lived on one laptop. The board now ships inside the app - it works on a
 * train, with no network at all - and this is the only piece left that cannot:
 * the model needs a key, and a key handed to a page is a key given away.
 *
 * Deliberately small. It answers `/api/ask` with `server/ask.ts`, the same
 * handler the dev server mounts, and `/health` with a word, so a platform can
 * tell whether it is up without spending a token.
 *
 * Configuration, all from the environment and none of it in the repository:
 *
 *   ZAI_KEY | ZAI_API_KEY | OPEN_AI_KEY   the model key (any one of the three)
 *   ZAI_PLAN=coding                       for a coding-plan key, which the
 *                                         default host rejects
 *   ZAI_MODEL                             to override glm-4.6
 *   PORT                                  set by most platforms
 *
 * With no key it still starts and answers 503, which the board treats as its
 * offline mode: the plan text is in the bundle and readable either way. A
 * service that refuses to boot over a missing secret is a service that is down.
 */

const PORT = Number(process.env.PORT ?? 8080);

const server = createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('leela ask: up\n');
    return;
  }

  // `next` is what the dev server passes for "not my route". Here there is
  // nothing after this, so it is a 404.
  void askHandler(req, res, () => {
    res.statusCode = 404;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'not found' }));
  });
});

server.listen(PORT, () => {
  // Whether a key was found, without printing it. A service that is up and
  // silently unconfigured looks identical to one that works until somebody
  // asks it a question.
  const configured = Boolean(
    (process.env.ZAI_KEY ?? process.env.ZAI_API_KEY ?? process.env.OPEN_AI_KEY ?? '').trim(),
  );
  console.log(`leela ask listening on ${PORT}, model key ${configured ? 'present' : 'MISSING'}`);
});
