# Native board copy

The owner rejects Telegram-specific status messages in the mobile application.
The iOS 7.1 (9) simulator rendered the shared board's outside-Telegram banner.

## Contract

- A React Native hosted board renders no Telegram connection/adoption status,
  including accessible text, in any catalogue language.
- Browser and Telegram status diagnostics remain unchanged for every outcome.
- This is a presentation boundary, not authentication or an entitlement grant.
  Game rules, persistence, signed chat adoption, payments and companion stay intact.
- Rebuild the shared board into the native candidate and verify on the simulator.
  The observed build 9 is superseded for release by this requested correction.
