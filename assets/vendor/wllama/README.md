# Wllama 3.6.1

Copied from the exact `@wllama/wllama@3.6.1` npm package:

- `esm/index.js` → `wllama.esm.js`
- `esm/wasm/wllama.wasm` → `wllama.wasm`

Upstream: https://github.com/ngxson/wllama · MIT; see LICENSE.
The package version/integrity is pinned by the repository's package-lock.json.
Refresh from an intentional dependency update and rerun the real model and
browser tests. The local adapter does not use the package's CDN path constants.
The GGUF weights are separately versioned and hash-verified by llm-worker.js;
they are not bundled here.
