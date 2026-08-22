import { defineConfig, type Plugin } from 'vite';

import { askHandler } from './server/ask';

/**
 * The companion's route, while developing.
 *
 * The handler itself lives in `server/ask.ts`, because the app now ships the
 * board in its own bundle and asks a deployed server instead - and one route
 * written twice would answer differently within a week. Here it is only mounted.
 */
const askRoute = (): Plugin => ({
  name: 'leela-ask',
  // Both, or the route works while developing and vanishes in `vite preview`.
  configureServer: (server) => void server.middlewares.use(askHandler),
  configurePreviewServer: (server) => void server.middlewares.use(askHandler),
});

export default defineConfig({
  /*
   * Relative asset paths, so the same build runs from a web server *and* from
   * inside the phone.
   *
   * Vite's default writes `src="/assets/index-….js"` into `index.html`. Served
   * over http that is correct; opened as a `file://` URL inside the app it
   * points at the root of the device's filesystem, and the page loads as a
   * white rectangle with no error the player could report.
   *
   * The app ships the board in its bundle rather than fetching it: the game is
   * the board, and an app whose only screen needs a network is an app that is
   * blank on a train. It also removes the reason the `Info.plist` carried a
   * cleartext-HTTP exception for a developer's home network address.
   */
  base: './',
  plugins: [askRoute()],
});
