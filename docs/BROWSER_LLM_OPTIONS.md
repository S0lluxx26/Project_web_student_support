# Browser LLM: implementation and measured limits

Updated 2026-09-12. **Real inference works under Pages restrictions. This model
failed the quality gate for ordinary product use.**

## Hosting versus computation

[GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
serves static files. [Wllama](https://github.com/ngxson/wllama) is a WebAssembly
binding of llama.cpp. Native `llama.cpp.exe` cannot run on Pages; the browser
build can run on the visitor's device.

Vercel serves the same static files here. It does not run the model on a server.
A future cloud endpoint requires its own provider/backend, privacy decisions,
usage controls and budget. [Vercel Functions have separate limits](https://vercel.com/docs/functions/limitations).
Importing this repo does not create a cloud inference endpoint.

Both current configurations use single-thread CPU inference without COOP/COEP.
The adapter can select up to four threads on an isolated origin, but no default
deployment performance improvement is claimed. WebGPU availability is reported;
GPU acceleration is not selected.

## Exact candidate

| Property | Value |
|---|---|
| Runtime | `@wllama/wllama@3.6.1`, vendored ESM/WASM |
| Streaming SHA-256 | `hash-wasm@4.12.0` |
| Model | Qwen3 0.6B Q4_K_M GGUF, Apache-2.0 |
| Repository | [unsloth/Qwen3-0.6B-GGUF](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF) |
| Revision | `50968a4468ef4233ed78cd7c3de230dd1d61a56b` |
| Filename | `Qwen3-0.6B-Q4_K_M.gguf` |
| Bytes | **396705472** (~396.7 MB / 378.3 MiB) |
| SHA-256 | `ac2d97712095a558e31573f62f466a3f9d93990898b0ec79d7c974c1780d524a` |
| Context/output | 4096 tokens / maximum 256 generated tokens |

[Download the exact file](https://huggingface.co/unsloth/Qwen3-0.6B-GGUF/resolve/50968a4468ef4233ed78cd7c3de230dd1d61a56b/Qwen3-0.6B-Q4_K_M.gguf).
Different versions/quantizations fail verification, even with similar filenames.
Weights are ignored by Git and excluded from the site artifact.

## Measurements

Windows x64, **i7-14700KF**, 28 logical CPUs, approximately 32 GiB RAM, Chromium
153.0.8010.12. This is a desktop-class test machine, **not a measured laptop or
phone**. The local server used `/Project_web_student_support/`, no isolation
headers, no SharedArrayBuffer and one CPU thread. This tests Pages constraints;
verification of the public deployment is a separate check.

| Measurement | Observed |
|---|---|
| Local-file verification + load | 2.68 s |
| Fresh browser download + verification + load | 12.85 s on this connection |
| Verified-cache reload | 2.48 s |
| 20 synthetic explanations | 24.27–62.02 s; median 34.89 s |
| Separate Korean example | 41.96 s; first content at 18.95 s |
| Memory after load | 1.72 GB aggregate browser working set; 1.86 GB private commit |
| Real cancel and cache deletion | Passed |

Memory is a Windows process-group snapshot, not peak RAM or exact model memory;
it includes browser overhead and may double-count shared pages. Some regression
tests ran alongside the 20-case evaluation, so those timings are indicative,
not controlled performance measurements. The separate download/cache/cancel run
had no other model benchmark running. Download speed depends on the connection.

[20-case records](benchmarks/llm-pages-20.json) ·
[Download/cache/cancel records](benchmarks/llm-pages-download.json).
Inputs were the first ten patterns' guidance at commit `6512447`, each in Korean
and English. No real rental transcript was used.

**Public Pages verification:** the real deployed runtime at commit `1c01155`
also loaded the exact local GGUF (3.45 s), generated a Korean explanation
(44.86 s), and canceled another generation successfully, with one CPU thread,
no isolation and no page errors. [Live-origin record](benchmarks/llm-pages-live.json).
This verifies real Pages execution; it does not change the quality decision.

## Quality decision

The validator accepted 19/20 outputs. **This is not 95% accuracy.** Inspection
found errors among the accepted answers: case 14 altered the mortgage/deposit
condition; case 15 produced contradictory trust-ownership wording; case 16
copied placeholder wording. Several Korean questions were actually instructions.
Case 13 used English instead of Korean and was rejected.

The model can reduce guidance quality while adding latency. It remains an
explicit experiment. This evaluation measures neither real fraud detection nor
legal accuracy, false-positive rates or adversarial robustness.

## Try the experiment

1. Add `?experiment=llm` before the URL hash, e.g.
   `http://127.0.0.1:8765/?experiment=llm`.
2. Analyze text producing a warning, open the experimental panel below the
   report and read the limitation/download disclosures.
3. Opt in, then choose Download or the exact local GGUF. Merely opting in does
   not download it. Selecting a local file does not upload it.
4. Choose one finding and generate. Compare with the original guidance.
   Cancel/unload releases the worker; Remove downloaded model clears this app's
   model directory on this origin.

The ordinary URL hides the panel. The URL is a usability gate, not an access
control: there are no privileged services or secrets behind it.

## Implementation boundaries

- `llm-ui.js`: opt-in, progress, selection, cancel/unload and draft rendering.
- `llm.js`: pinned metadata, job identity, input bounds and output validation.
- `llm-worker.js`: streaming download/hash, OPFS cache and real inference.
- The UI supplies one rule's guidance, **no transcript, screenshot or identifier**.
  Input is structured JSON. A conservative UTF-8 byte bound reserves template
  and output space; oversized input is rejected, not silently truncated. This
  is an upper-bound check, not a separate public tokenizer API.
- Generation uses a JSON schema, then checks shape, known finding IDs, lengths,
  obvious wrong language and limited reassurance phrases. These checks cannot
  establish meaning or factual correctness.
- Invalid/failed output leaves the rule report usable. Drafts render as text
  nodes, cannot change the assessment and are excluded from exports.
- File size and SHA-256 are checked on download, local-file load and cache reuse.
  Partial/corrupt cache files are never trusted as complete models.
- Worker teardown cancels inference and discards prompt/KV state. Cache removal
  deletes only `student-support-models-v1` on this origin. Browser eviction or a
  different host may require another download.
- OCR is released before model loading; starting OCR unloads the LLM.

## Reproduce

```sh
npm ci --ignore-scripts
npx playwright install chromium
npm run bench:llm -- --model tmp/models/Qwen3-0.6B-Q4_K_M.gguf --cases 20
npm run bench:llm -- --download --cases 1 --cancel-check
```

Results go to ignored `tmp/`. Review synthetic records before committing them.
`--isolated` tests optional headers, not default Pages. Before broader release,
repeat on real target devices, review Korean meaning, test failure/cache-eviction
paths and compare usefulness with the existing explanation. Larger weights or
Vercel hosting alone do not establish better results.
