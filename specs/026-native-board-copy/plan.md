# Plan

Reuse the existing validated ReactNativeWebView host detection. Centralize every
chat-status DOM write in a tested presentation function which clears and hides
the status for native hosts, while preserving the exact text elsewhere.

Prove RED on native status rendering; cover every chat catalogue key/language
and test that main has no bypass. Run the repository gate, independent review,
PR checks and merge, then rebuild the native release from this shared source.
