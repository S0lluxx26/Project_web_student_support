# Vendored OCR engine

Self-hosted so the screenshot reader works with no third-party request. Nothing
here is loaded until the user actually opens the screenshot reader, and the
image never leaves the browser — recognition runs in a Web Worker on the
user's own machine.

| file | what it is | source |
|---|---|---|
| `tesseract.min.js` | tesseract.js 5.1.1 main thread API | npm `tesseract.js@5.1.1`, `dist/tesseract.min.js` |
| `worker.min.js` | its Web Worker half | npm `tesseract.js@5.1.1`, `dist/worker.min.js` |
| `tesseract-core-simd-lstm.wasm.js` | LSTM-only engine, WASM SIMD build | npm `tesseract.js-core@5.1.1` |
| `tesseract-core-lstm.wasm.js` | same engine without SIMD, for Safari < 16.4 | npm `tesseract.js-core@5.1.1` |
| `lang/kor.traineddata` | Korean model, `4.0.0_best_int`, **decompressed** | npm `@tesseract.js-data/kor` |

Licences: tesseract.js and tesseract.js-core are Apache-2.0 (see
`tesseract.min.js.LICENSE.txt`); the traineddata is Apache-2.0 from the
`tessdata_best` project. Both notices travel with the files.

The `_best_int` model was chosen over `4.0.0` (6.6 MB) because it is 1.5 MB and
scored identically on the fixtures in `scripts/test-ocr-real.js`.

The model is stored **decompressed**, and `ocr.js` passes `gzip: false`. A
static host that serves a `.gz` with `Content-Encoding: gzip` makes the browser
inflate it in transit; the worker, told to expect gzip, then inflates it again
and fails with nothing useful in the console. 2.1 MB on disk instead of 1.5 MB
buys away that whole class of deployment bug — and the host still compresses it
on the wire.

## Refreshing

    npm install tesseract.js@5 @tesseract.js-data/kor
    cp node_modules/tesseract.js/dist/{tesseract,worker}.min.js assets/vendor/tesseract/
    cp node_modules/tesseract.js-core/tesseract-core{-simd,}-lstm.wasm.js assets/vendor/tesseract/
    gunzip -c node_modules/@tesseract.js-data/kor/4.0.0_best_int/kor.traineddata.gz \
      > assets/vendor/tesseract/lang/kor.traineddata

Then re-run `node scripts/test-ocr-real.js` and the browser smoke test before
shipping: a version bump has changed recognition quality before.
