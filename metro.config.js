/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

const { lookup } = require('mime-types')

/**
 * Every asset the bundler serves, labelled with what it is.
 *
 * Metro 0.72 does not label them. `Server.js` sets `Content-Type` in exactly
 * one place — `_rangeRequestMiddleware`, the branch that answers a `Range`
 * header with a 206 — and a plain `GET /assets/...` ends with `res.end(data)`
 * and no type at all. The command-line server layered above it adds
 * `X-Content-Type-Options: nosniff`, which tells the client it may *not* guess.
 *
 * So a debug build asks for an icon and is handed 350 KB of unnamed bytes it is
 * forbidden to identify. iOS has no decoder to choose and reports it as
 * `No suitable image URL loader found for http://.../1080@3x.png` — a message
 * that names the URL and thereby points at the network, at App Transport
 * Security, at the address of the packager: everywhere except the missing
 * header. The bytes arrive intact; `curl` confirms a valid 3240x3240 PNG.
 *
 * The name is derived from the extension, which is the same thing Metro's own
 * 206 branch does, so a ranged and an unranged request now agree.
 *
 * Here rather than in `node_modules`: this is supported configuration, it
 * survives every reinstall, and it is visible in the repository instead of
 * being a patch nobody remembers applying.
 */
module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true
      }
    })
  },
  server: {
    enhanceMiddleware: (metro) => (req, res, next) => {
      // The path without its query: the platform and hash ride in the query
      // string, and an extension lookup must not see them.
      const path = (req.url || '').split('?')[0]
      if (path.startsWith('/assets/')) {
        // Names may be percent-encoded; a malformed escape must not take the
        // whole packager down over a header.
        let named = path
        try {
          named = decodeURI(path)
        } catch {
          named = path
        }
        const type = lookup(named)
        // Set rather than written: Metro ends the response itself, and a
        // header set beforehand goes out with it. The 206 branch writes its
        // own and still wins, which is the behaviour it already had.
        if (type) res.setHeader('Content-Type', type)
      }
      return metro(req, res, next)
    }
  }
}
