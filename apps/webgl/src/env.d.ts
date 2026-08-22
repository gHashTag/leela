/**
 * The build-time environment, named so the compiler holds the spelling.
 *
 * `vite/client` — pulled in through `tsconfig`'s `types` — gives
 * `import.meta.env` an index signature, so a misspelt variable reads as `any`
 * and arrives as `undefined` at runtime without a word from anyone. Declaring
 * the one variable this page reads merges into that interface and turns the
 * misspelling into a type error.
 */
interface ImportMetaEnv {
  /**
   * The origin serving `/api/ask`, when it is not this page's own. The entry
   * writes it onto the page as `__leelaAsk`; absent or empty leaves the
   * relative default standing — page and route on one origin.
   */
  readonly VITE_ASK_ORIGIN?: string;
}
