# Install and run Student Housing Safety Assistant

**Maker: Bui Xuan Mai**

**Repository:** https://github.com/S0lluxx26/Project_web_student_support  
**Live website:** https://s0lluxx26.github.io/Project_web_student_support/  
**Illustrated Demo:** https://s0lluxx26.github.io/Project_web_student_support/demo.html

This guide is for a person or AI assistant setting up a local copy on a PC.
You do not need a GitHub account, SSH key, Vercel account, GPU or paid AI API
to download the public repository and run the checker.

## 1. Prompt to give another AI

Copy this prompt:

```text
Install and run this project on this PC:
https://github.com/S0lluxx26/Project_web_student_support

Read INSTALL.md in the repository and follow it.
Maker credit must remain Bui Xuan Mai.

First inspect the operating system, Git, Node.js and npm versions.
Use Node.js 22 or newer. Explain missing prerequisites and use their
official installers if installation is authorized.
Use HTTPS to clone the public repository into a new project folder.
If a checkout already exists, inspect its status and preserve local work.
Do not overwrite it, reset it, change its remote or delete files.

Install locked dependencies with npm ci --ignore-scripts.
Install the Playwright Chromium browser needed by the verification.
Run npm run verify:install and report the actual outcome.
Do not edit code simply to silence a failed check.
If verification fails, explain the failing step and correct the cause.

Start the built website with npm run serve and keep that process running.
Open http://127.0.0.1:8765/ and /demo.html in a browser.
Follow the Demo: download sample A, select it in the screenshot reader,
review its OCR text, confirm the correct message side and analyze.
Reset before sample B. Verify the pressure and ordinary examples differ.
Check that guide/PDF links load and mobile AI is disabled.
Do not automatically download the optional 397 MB model.
If I explicitly ask to test AI, explain download and memory costs first,
then use the existing opt-in controls; no GPU or cloud server is required.

Finish with the local folder, working URLs, actual checks and results,
any limitations, and how to stop/restart the local server.
Never claim the site is running if its server process has already exited.
```

## 2. Prerequisites

- Windows, macOS or Linux with a current desktop browser.
- [Git](https://git-scm.com/downloads).
- [Node.js](https://nodejs.org/en/download) version 22 or newer, including npm.
- Internet for downloading the repository, dependencies and browser once.
- Enough disk space for dependencies and the Playwright Chromium download.

Check:

```sh
git --version
node --version
npm --version
```

Python is **not** needed to run the website, Demo, OCR or optional browser
LLM. Python is only needed to regenerate the PDF or redraw fixture images.
The published PDF and sample images are already in the repository.

## 3. Download into a new folder

In PowerShell, Terminal or another shell, navigate to a directory where you
keep projects, then run:

```sh
git clone https://github.com/S0lluxx26/Project_web_student_support.git
cd Project_web_student_support
npm ci --ignore-scripts
npx playwright install chromium
```

If that folder already exists, choose a different folder name or inspect
the existing checkout. Do not delete or overwrite an existing project.

On Linux, if Playwright reports missing system libraries, install the
dependencies using its documented command:

```sh
npx playwright install --with-deps chromium
```

This may request system administrator privileges for package installation.
On Windows, if PowerShell blocks npm.ps1, use npm.cmd and npx.cmd in the same
commands instead. Do not disable execution policy for the entire machine.

## 4. Verify the installation

```sh
npm run verify:install
```

This command:

1. Runs the unit/data checks and builds the public site in dist/.
2. Runs the vendored real OCR engine against fictional fixtures.
3. Runs browser checks for input, OCR, cancellation, reset, exports and
   root/sub-path hosting.
4. Checks the Demo's samples, images, Markdown/PDF links, language controls
   and desktop/mobile AI policy.
5. Verifies the report's contents links and that its committed Mermaid
   figures and PDF match the reviewed Markdown. No report renderer is needed.

**Pass condition:** command exits with code 0 and all suites pass.
No GGUF model is downloaded. Mock model tests verify the controls and error
handling, not the quality of a real language model. Browsers and web servers
opened by the automated checks close when those checks finish.

Do not regenerate the guide, fixtures or asset version just to install.
Those are source-maintenance tasks, not prerequisites for normal use.

## 5. Start the website and Demo

```sh
npm run serve
```

Keep that terminal open. Visit:

- Website: http://127.0.0.1:8765/
- Demo/manual: http://127.0.0.1:8765/demo.html
- Safety help and 12 practice screenshots: http://127.0.0.1:8765/help.html
- Markdown guide: http://127.0.0.1:8765/manual/PROJECT_GUIDE.md
- PDF guide: http://127.0.0.1:8765/manual/project-guide.pdf

Press Ctrl+C in the server terminal to stop it. Run npm run serve again
from the project folder to restart. The local preview is for this computer;
it is not a public deployment.

If port 8765 is occupied:

```sh
npm run serve -- --port 9000
```

Use http://127.0.0.1:9000/ and the same page paths.

To reproduce the GitHub Pages URL layout:

```sh
npm run serve -- --pages --prefix Project_web_student_support
```

Open http://127.0.0.1:8765/Project_web_student_support/demo.html.
Do not open index.html directly from the filesystem.

## 6. Follow the manual and confirm the behavior

| Action | Expected result |
|---|---|
| Open Demo / guide | Seven illustrated steps, fictional examples and project downloads |
| Toggle English/Korean | Instructions change language without loading OCR/LLM |
| Open Safety help | Four teaching categories, independent checks and 12 downloadable fictional images |
| Toggle Dark mode | Theme changes and persists when moving between checker, Demo and help |
| Download sample A | A fictional KakaoTalk JPG is saved |
| Open checker in a new tab | Home screen has pasted-text and screenshot input |
| Select sample A for OCR | Progress, then editable text and original-image review |
| Confirm right side in this sample | Your messages are labeled; owner/agent role may still be unknown |
| Review text, then Add and check now | Recorded edition: strong warning signals, 4 scored signals |
| Reset, repeat with sample B | Recorded edition: no known signals, 0 scored signals |
| Open copy/share/print | Editable masking preview before the final action |
| Read a completed report | Sections 1-6 lead from summary and coverage to evidence, actions, export and AI |
| Open AI panel on PC | Opt-in is available; no model loads automatically |
| Enable the experiment | Separate load and generate steps; warning about long waits is visible |
| Open on phone/tablet | AI enable is disabled with an explanation; OCR remains available |
| Open project downloads | Markdown and PDF name Bui Xuan Mai and include the repository address |

Exact OCR wording and counts may change with future versions, image quality
or text corrections. Read the warnings and evidence instead of treating a
number as a fraud verdict. The committed record is assets/manual/cases.json.
The 12 additional help examples use assets/examples/cases.json for reviewed
expectations and observations.json for actual OCR results. Reset between cases.
All 12 reached the intended outcomes without corrections in the recorded run;
this is fixture verification, not a measured real-world accuracy rate.

The Demo page displays captured results; to run recognition yourself, download
a sample and select it in the actual checker's file picker.

## 7. Optional AI experiment

The main checker and OCR work without the LLM. On a desktop report with a
warning, expand the helper, opt in, then explicitly load the model.

The pinned Qwen3 0.6B Q4_K_M model downloads about 397 MB. On the measured
desktop, browser working set was around 1.7 GB and explanations took 24-62
seconds. A different PC may be slower or fail. Inference uses the browser CPU;
no GPU is required. It works with the same static site on Pages or Vercel.

The explicit load button first reuses a verified model cache when available.
If the cache is missing or removed by the browser, it downloads the pinned file.
You can instead select the exact downloaded GGUF file from disk. The panel
shows whether the active model came from a download, cache or local file.
Inference runs from those bytes on this computer; no hosting migration is
needed. Cache storage belongs to each site origin, not every website you visit.
Read the wait warning before Generate explanation draft. A laptop may take
several minutes or fail; the rule report stays usable and Cancel stops generation.

Model drafts can be wrong, cannot change the assessment and are not exported.
Use Cancel, Unload model or Remove cached model as needed. For exact model
download, checksum and measurements, read [the model notes](docs/BROWSER_LLM_OPTIONS.md).

## 8. Troubleshooting and updates

- **npm ci fails:** verify Node version, network access and the checkout's
  package-lock.json. Keep the lockfile; do not replace installation with
  arbitrary unpinned versions.
- **Browser test fails to launch:** install Playwright Chromium and, on Linux,
  its required system libraries.
- **Page fails from a file path:** use npm run serve over HTTP.
- **Server says address already in use:** choose another port.
- **OCR is empty:** try the original Korean sample or paste reviewed text.
  English-only OCR and contract OCR are not provided.
- **PDF regeneration fails:** normal installation does not require it. The
  committed PDF is ready to view. See the project guide for optional Python/fonts.
- **Local code was edited:** preserve changes before updating. For a clean
  checkout, git pull --ff-only, npm ci --ignore-scripts and npm run verify:install
  update and recheck it.

For implementation, prompts and architecture, read
[PROJECT_GUIDE.md](manual/PROJECT_GUIDE.md).
For deployment settings, read [DEPLOY_VERCEL.md](docs/DEPLOY_VERCEL.md).
