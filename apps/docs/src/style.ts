/**
 * The book's stylesheet, as a string.
 *
 * Inlined rather than copied from a file so the build has no asset step and
 * cannot ship a page whose stylesheet is missing.
 */

export const STYLE = `
:root {
  --text: #1c1c1e;
  --muted: #6b6b70;
  --link: #2a6ba0;
  --rule: #e4e4e8;
  --surface: #f6f6f8;
  --measure: 34rem;
}

@media (prefers-color-scheme: dark) {
  :root {
    --text: #e8e8ea;
    --muted: #9a9aa0;
    --link: #7fb3dd;
    --rule: #2c2c30;
    --surface: #1a1a1c;
  }
  body { background: #121214; }
}

* { box-sizing: border-box; }

body {
  margin: 0;
  color: var(--text);
  font: 17px/1.6 Georgia, 'Iowan Old Style', 'Times New Roman', serif;
  -webkit-text-size-adjust: 100%;
}

main {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 1.5rem 1.25rem 4rem;
}

/* Aligned to where the line starts, which is what "right" was reaching for.
   A logical value needs no dir-scoped companion rule to be correct, and a
   companion rule is a thing to forget when a second alignment is added. */
main { text-align: start; }

header.site {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  max-width: var(--measure);
  margin: 0 auto;
  padding: 0.9rem 1.25rem;
  border-bottom: 1px solid var(--rule);
  font-family: system-ui, sans-serif;
  font-size: 0.85rem;
}

a { color: var(--link); }
a:hover { text-decoration: none; }

h1 {
  margin: 0.6rem 0 0.4rem;
  font-size: 1.7rem;
  line-height: 1.25;
  font-weight: 600;
}

h2 {
  margin: 2rem 0 0.6rem;
  font-size: 1.15rem;
  font-weight: 600;
}

h3 { margin: 1.4rem 0 0.4rem; font-size: 1.02rem; }

p { margin: 0 0 1rem; }

.subtitle {
  margin: 0 0 1.5rem;
  color: var(--muted);
  font-style: italic;
}

/* --- contents ------------------------------------------------------------ */

ol.plans, ul.chapters {
  margin: 0;
  padding: 0;
  list-style: none;
}

ol.plans li, ul.chapters li { border-bottom: 1px solid var(--rule); }

ol.plans a, ul.chapters a {
  display: flex;
  gap: 0.7rem;
  padding: 0.5rem 0.2rem;
  text-decoration: none;
  color: var(--text);
}

ol.plans a:hover, ul.chapters a:hover { background: var(--surface); }

.n {
  min-width: 2ch;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
  /* Toward the title it labels, in either direction. A physical right put the
     numbers against the far edge of an Arabic page, the gap in the middle. */
  text-align: end;
}

/* --- reading ------------------------------------------------------------- */

main ol:not(.plans), main ul:not(.chapters) {
  margin: 0 0 1rem;
  padding-inline-start: 1.4rem;
}

main li { margin-bottom: 0.4rem; }

code {
  padding: 0.1em 0.3em;
  border-radius: 3px;
  background: var(--surface);
  font-size: 0.9em;
}

.pager {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 2.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
}

/* --- languages ----------------------------------------------------------- */

footer {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 0 1.25rem 3rem;
}

.languages {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem 0.9rem;
  padding-top: 1rem;
  border-top: 1px solid var(--rule);
  font-family: system-ui, sans-serif;
  font-size: 0.85rem;
}

.languages .current { color: var(--muted); }

.root {
  max-width: var(--measure);
  margin: 0 auto;
  padding: 4rem 1.25rem;
  text-align: center;
}

.root .languages { justify-content: center; border-top: 0; }

a.play {
  display: inline-block;
  margin-top: 1.5rem;
  font-family: system-ui, sans-serif;
}
`;
