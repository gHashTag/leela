/**
 * Vite turns an imported asset into its final URL. TypeScript needs telling;
 * `vite/client` would do it, but pulling the whole ambient bundle in for one
 * declaration brings a DOM lib this package already has from `tsconfig`.
 */
declare module '*.webp' {
  const url: string;
  export default url;
}
