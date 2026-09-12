# Publishing to GitHub Pages and Vercel

One repository, one build, two hosts. Both serve the same `dist/` and neither
needs your laptop running.

```
repository
   ├── .github/workflows/deploy.yml  →  https://s0lluxx26.github.io/Project_web_student_support/
   └── vercel.json (Git integration) →  https://<project>.vercel.app/
```

## What is published

`scripts/build-vercel.mjs` stages `dist/`. It is an **allowlist** — `index.html`,
`.nojekyll`, `LICENSE`, `assets/`, `data/` — so adding a file to the repository
never publishes it by accident. Before this existed the Pages workflow uploaded
`path: .`, which would have published the test suites, the demo screenshots and
anything else sitting in the folder.

The build also:

- runs the analyzer, detector, data, OCR and LLM-adapter suites and **fails on
  any non-zero exit**;
- refuses to delete `dist` through a symlink or junction, or if it resolves
  outside the project;
- clears `dist` completely, so a stale generated file cannot survive a rebuild;
- compares every staged file's size against its source — a truncated wasm or
  language model is a blank screen for a user and nothing at all in the log;
- **rejects any root-relative URL in `index.html`**, because `/assets/...` works
  on Vercel and 404s on the Pages sub-path;
- skips the 8 MB browser-LLM runtime while `LLM.enabled` is false, so a disabled
  experiment costs both hosts nothing.

`dist/` is disposable output, never source. It is gitignored and rewritten on
every run.

## Local

Node 18+ (the plan asks for 22+; 18 is what the code actually needs).

```sh
node scripts/build-vercel.mjs
node scripts/serve-site.mjs                 # http://127.0.0.1:8765/
node scripts/serve-site.mjs --pages --prefix Project_web_student_support
node scripts/serve-site.mjs --src           # the source tree, no build
node scripts/serve-site.mjs --isolated      # COOP/COEP, for the LLM experiment
```

Rebuild after editing source. Do **not** test by double-clicking `index.html`:
`fetch` cannot read the data files from a `file://` page and a Web Worker cannot
start there, so OCR is untestable and the console is misleading.

`--prefix` matters. The Pages sub-path is the **repository** name, which is only
the folder name if nobody renamed the checkout; without it a renamed folder
makes every URL 404 for a reason that is invisible.

## Verifying before you publish

```sh
npm install --no-save playwright && npx playwright install chromium
node scripts/smoke-hosts.mjs
```

This drives `dist/` in a real browser at **both** URL shapes, takes each one
through the screenshot reader to a visible report, and asserts that every asset
the page requested was found. It also measures cross-origin isolation on and
off. It runs in CI before the artifact is uploaded.

It is not a deployment. Neither host is contacted.

## GitHub Pages

Already configured. `.github/workflows/deploy.yml` runs the suites, stages the
artifact, checks both layouts, then uploads `dist` and deploys. Settings → Pages
→ Source must be **GitHub Actions**.

## Vercel

Not yet connected. Remaining steps, all on Vercel's side:

1. Sign in to Vercel with the GitHub account that owns the repository.
2. **Add New → Project**, import `S0lluxx26/Project_web_student_support`.
3. Framework preset: **Other**. Root Directory: the repository root.
4. Leave the build settings alone — `vercel.json` supplies them:
   - Install Command: empty (there are no npm dependencies)
   - Build Command: `node scripts/build-vercel.mjs`
   - Output Directory: `dist`
5. No environment variables. The app has no API keys and no backend.
6. Deploy. Pushes to `main` become production; branches and PRs become previews.

Keep both hosts. One push deploys to each independently, which also means a
failure on one is visible against a working other.

**Check the plan.** Vercel's Hobby tier is for personal, non-commercial use. A
student project fits; a project run by an organisation does not.

### If you add a dependency

`.vercelignore` is an allowlist too, and four things have to change together or
the build breaks in a confusing way: the upload allowlist, the lockfile, the
install command (currently empty), and the build command.

## Both origins are separate

`https://…github.io/…` and `https://….vercel.app/` are different browser
origins. Caches, `localStorage` and any downloaded model are **per-origin**.
Someone who downloads a model on one site downloads it again on the other. Do
not tell users it is a one-time download across both.

## Cross-origin isolation

`COOP: same-origin` + `COEP: require-corp` are what multi-threaded WebAssembly
needs, via `SharedArrayBuffer`. Measured in `smoke-hosts.mjs`:

| headers | `crossOriginIsolated` | `SharedArrayBuffer` |
|---|---|---|
| off (the default) | `false` | absent |
| on | `true` | available |

They are **not** in `vercel.json`. Turning them on globally changes how every
third-party resource loads, and this app does not need them today. GitHub Pages
cannot send them at all, so whatever the experiment does must keep working
single-threaded — both hosts have to stay usable even if their acceleration
differs.

Test the behaviour with `node scripts/serve-site.mjs --isolated`. That flag
tests what the app does *when* isolation is on. It does not reproduce either
host's real headers, and combining it with `--pages` tests a path layout plus
experimental headers — not GitHub Pages.
