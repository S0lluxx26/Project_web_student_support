# 학생 주거 안전 도우미 · Student Housing Safety Assistant

A free, static web tool that helps students renting in Korea avoid housing fraud.
Everything runs in the browser — no server, no accounts, no data leaves your device.

**Live site:** https://s0lluxx26.github.io/Project_web_student_support/

## What it does

On entry you pick one of two paths.

**독립 주거 / Independent housing (원룸 · 오피스텔 · 빌라).** A guided checklist of the
documents that actually protect you — 등기부등본 first, then 건축물대장, the landlord's ID,
the agent's licence, tax clearance and the resident registry — each with what to look for and
where to get it. You can attach files locally (they never leave the browser) and tick the red
flags that apply to you. Then you paste the conversation you had with the agent or landlord,
and a rule engine scans it against a catalogue of known Korean rental-fraud patterns,
returning a risk score, the exact sentences that triggered each signal, why each one matters,
what to do about it, and the questions to ask next.

**고시원 / Goshiwon.** The tool insists on an in-person visit first and gives you the
checklist to take with you. If you genuinely cannot visit, it asks what you need — budget,
window type, private bathroom, meals, quiet, gender-separated floors, transport — and builds
a tailored list of questions to send the manager. Only after that does it show how to send a
deposit safely.

Both flows are bilingual (Korean default, English toggle) and printable to PDF.

## How the analysis works

`data/patterns.json` is a hand-curated knowledge base of rental-scam patterns. Each entry has
a severity, Korean and English keyword sets, an explanation of the underlying legal risk, and
a recommended action. `assets/js/analyzer.js` normalizes the pasted text (case and spacing
collapsed so Korean spacing variants still match), matches every pattern, quotes the sentence
that triggered it, and sums severity-weighted points along with the document red flags you
ticked and your deposit-to-value ratio. Thresholds map the total onto four levels: no signals,
caution, high risk, very high risk.

This is deliberately deterministic rather than a model: it is free to run, works offline,
leaks nothing, and anyone can audit or extend it by editing JSON. See
[`docs/SCAM_PATTERNS.md`](docs/SCAM_PATTERNS.md) for the catalogue and
[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) for how to add a pattern.

## Running it locally

No build step. Serve the folder over HTTP (the `fetch` calls for the JSON data need a server,
so opening `index.html` from the filesystem will not work):

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

## Project layout

```
index.html              single-page shell, all views
assets/css/style.css    design system, light and dark
assets/js/i18n.js       language loading and DOM translation
assets/js/analyzer.js   rule engine
assets/js/housing.js    independent-housing flow and report
assets/js/goshiwon.js   goshiwon flow and question generator
assets/js/app.js        data loading, hash router, step navigation
data/*.json             patterns, documents, goshiwon questions, UI strings
docs/                   pattern catalogue and contribution guide
PLAN.md                 full design and implementation plan
```

## Deployment

The repository root is the site, so no build step is needed. In the repo, set Settings →
Pages → Source to "Deploy from a branch", branch `main`, folder `/ (root)`. Every push to
`main` republishes. `.nojekyll` keeps Jekyll from ignoring files.

Alternatively, add the provided `.github/workflows/deploy.yml` and set the Pages source to
"GitHub Actions" — that variant also validates every JSON data file before deploying.

## Disclaimer

This is an informational tool, not legal advice. It cannot see the property, verify anyone's
identity, or guarantee that a listing is genuine — it only helps you ask the right questions
and check the right documents. For a real dispute, contact the police (112), free legal aid
(132), or the HUG lease-fraud support centre (1566-9009).

## License

MIT — see [LICENSE](LICENSE).
