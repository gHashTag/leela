# Checkpoint

- Scope: NVIDIA Nemotron on all Leela companion server surfaces.
- External probe: supplied NVIDIA credential returned HTTP 200 with nonempty
  text, stop finish reason; saved through silent stdin to Railway without deploy.
- RED: shared companion selector test failed because module was absent.
- GREEN: 9 selector tests passed, preserving all legacy provider choices/pool.
- RED: standalone board server emitted empty completion with NVIDIA configured.
- GREEN: route now returns NVIDIA answer in the existing SSE envelope.
- Entry-point routing regression: PASS. No credential appears in repository files.

- Independent review found a Vite configuration loader failure caused by loading
  the AI package root from the development route. Reproduced with the WebGL
  workspace test command. Fixed using a dependency-free NVIDIA settings subpath;
  the full WebGL workspace now passes. The bot routing regression also passes.
- The first full gate exposed the source-test blanking requirement; the entry
  test now uses the repository's shared comment blanker.
- The new WebGL dependency exposed a missing AI watch path/test entry in the
  Pages workflow. Both were added; configuration audit and actionlint pass.
- Final local gate: full verification exit 0, 20 audits passed and 5,124 tests
  measured across 12 workspaces. ESLint, knip, depcruise and actionlint exit 0.
- Independent re-review: PASS, including production WebGL build, no credential
  markers in browser JS, routing regression and Pages dependency changes.
- Pending external gates: PR checks/merge, deployment and live AI/sync/serving
  verification. The stored NVIDIA credential is not active in the old release.
