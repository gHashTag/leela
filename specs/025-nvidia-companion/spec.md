# NVIDIA companion

The owner requests NVIDIA Nemotron on every Leela agent surface. Existing Z.AI
keys return 429/1310; a minimal NVIDIA Nemotron 3 Super request returned 200
with nonempty answer text. The authorized key is stored only in Railway.

## Contract

- A nonblank NVIDIA_API_KEY selects NVIDIA before retained legacy providers.
- Bot reports, initiatives, outreach, revenue health probes and production
  /api/ask use the selected companion. A retained Z.AI key must not divert
  Mini App requests away from NVIDIA.
- The standalone/development board server supports the same NVIDIA selection.
- Nemotron 3 Super uses NVIDIA's documented endpoint and disables thinking
  for concise answers. Credentials remain server-side; no provider response
  body or key appears in errors sent to the client.
- Missing NVIDIA configuration preserves the legacy provider order and Z.AI
  Coding Plan selection. Game rules, payments and stored progress are unchanged.

## Plan and verification

Specify and reproduce provider routing in failing tests; implement a shared
environment selector and NVIDIA adapter; verify HTTP and SSE answer contracts;
run repository checks and independent review; merge via PR and verify Railway,
signed game sync and actual AI answer text. Checkpoints record observed results.

Source: https://build.nvidia.com/nvidia/nemotron-3-super-120b-a12b
