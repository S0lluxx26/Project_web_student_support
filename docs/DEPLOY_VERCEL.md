# Deploy to GitHub Pages and Vercel

Updated 2026-09-12. Both serve the same static `dist/` artifact. The developer's
laptop may be off after deployment; visitors' devices run OCR and optional LLM.

## Local preparation

Node 22+ and the committed lockfile:

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run assets:stamp
npm run build
npm run test:ocr
npm run test:browser
npm run serve
```

Preview at `http://127.0.0.1:8765/`. Add `--pages` for the repository sub-path,
`--prefix AnotherRepository` if its real name differs, or `--src` for source
preview. Rebuild before verifying `dist/` again. Do not double-click index.html.

The build runs five dependency-free suites, checks required OCR/LLM assets,
compares copied bytes and rejects root-relative HTML asset URLs. It publishes
only HTML, `.nojekyll`, LICENSE, `assets/` and `data/`. Keep private files out of
those public directories. The experimental runtime is available on demand;
GGUF weights are not in the artifact. `.vercelignore` separately lists allowed
CLI build inputs, including the package manifest, lockfile and build scripts.

## GitHub Pages

1. Repository Settings → Pages → Source: **GitHub Actions**.
2. Push reviewed changes to `main`.
3. **Test and deploy static site** validates data, builds, runs real OCR/browser
   checks, uploads `dist/` and deploys. Pull requests validate without deploying.
4. Open [the Pages site](https://s0lluxx26.github.io/Project_web_student_support/).

Do not use a branch-root deployment or `path: .`; that bypasses the artifact boundary.

## Vercel

Configuration is ready; account import remains a separate action.

1. Sign in to the intended Vercel account. Add New → Project.
2. Import `S0lluxx26/Project_web_student_support`; grant this repository access
   to the integration if requested by GitHub.
3. Framework: **Other**. Root Directory: repository root. Node: **22.x** or a
   supported version at least 22.
4. Keep settings from `vercel.json`:

   | Setting | Value |
   |---|---|
   | Install | `npm ci --ignore-scripts --no-audit --no-fund` |
   | Build | `node scripts/build-vercel.mjs` |
   | Output | `dist` |
   | Environment variables | None |

5. Deploy; record the actual `https://…vercel.app/` URL.
6. Verify paste, Korean OCR, language switching and redacted export. Confirm
   runtime requests return files, not fallback HTML.

Vercel's build runs unit/data checks. Full browser validation runs in GitHub
Actions; Vercel does not automatically wait for it. Check the GitHub result
before promoting untested changes. After account integration, pushes can deploy
both hosts independently. Revert a source commit and redeploy to roll back,
then check both origins.

[Vercel Git integration](https://vercel.com/docs/git) ·
[Project configuration](https://vercel.com/docs/project-configuration).

## Model/cache/header details

No COOP/COEP headers are enabled. Both default configurations use single-thread
CPU inference. Local `--isolated` testing is an experiment, not default Pages.
Pages and Vercel have separate browser caches; model removal affects only the
current origin. The same exact local GGUF can be selected on either site.

Vercel does not run this model as a server process. See
[the measured costs and limits](BROWSER_LLM_OPTIONS.md). Local processing works;
offline reload is not guaranteed because no service worker is installed.
