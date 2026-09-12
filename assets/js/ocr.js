/*
 * ocr.js — read a chat screenshot into editable text.
 *
 * Design rules this module exists to enforce:
 *
 *   1. Nothing leaves the browser. The engine is vendored under
 *      assets/vendor/tesseract and runs in a Web Worker on the user's own
 *      machine. There is no upload and no third-party request, which is the
 *      only version of this feature that is honest to offer someone pasting a
 *      conversation with their landlord.
 *
 *   2. OCR output is a DRAFT, never an input. `recognize()` returns text plus
 *      the places it is unsure about; housing.js puts that in a review pane and
 *      the analyzer never sees it until the user has confirmed it. Recognition
 *      of Korean chat screenshots is good but not clean — see the measured
 *      notes below — and quietly feeding its mistakes into a risk check would
 *      manufacture findings out of nothing.
 *
 *   3. The engine is injectable (`OCR.engine`). Tests drive the integration
 *      with a mock; scripts/test-ocr-real.js drives it with the real thing.
 *
 * Measured on the fixtures in scripts/test-ocr-real.js (tesseract.js 5.1.1,
 * kor 4.0.0_best_int), which is why the preprocessing step is not optional:
 *
 *   - Raw KakaoTalk screenshot: the yellow outgoing bubbles were DROPPED
 *     ENTIRELY. Every one of the user's own lines vanished, while the white
 *     incoming bubbles read cleanly. Converting to greyscale first recovered
 *     all of them (7/7 lines, confidence 80 -> 84).
 *   - Upscaling 2x on top of greyscale recovered nothing further and cost ~20%
 *     more time, so we do not do it.
 *   - Timestamps set in small grey type ("오후 3:21") come back as junk
 *     (".5*=그", ".3*::", ".85:기") on EVERY line of a KakaoTalk capture.
 *     `clean()` removes tails still shaped like a time, and tails that are a
 *     short standalone token opening with punctuation — debris of the same
 *     timestamp, and a shape ordinary Korean chat does not produce. It stops
 *     there: half-read words are left exactly as read, because repairing those
 *     would mean editing the evidence the whole check rests on.
 */
(function (global) {
  'use strict';

  var HANGUL = /[가-힣ᄀ-ᇿ㄰-㆏]/;
  var LETTER = /[A-Za-z]/;
  var DIGIT  = /[0-9]/;

  var OCR = {

    /* ------------------------------------------------------------ flag --- */

    /*
     * OCR ships off until a real browser has run it end to end. A mock test
     * passing proves the wiring, not the engine, and the engine is the part
     * that can be wrong in ways no mock reproduces: a worker that will not
     * start under the page's origin, a wasm build the browser refuses, a
     * language file served with the wrong type.
     *
     * true here is a claim that scripts/smoke-ocr.mjs has been run against this
     * build and passed. It has: Chromium 1194, the real worker, the vendored
     * wasm and model, the committed KakaoTalk fixture — all seven bubbles read,
     * no page errors, the reviewed text reaching a real verdict. Set it back to
     * false rather than shipping a change to this module, to the vendored
     * files, or to the step-2 markup that you have not re-smoked.
     */
    enabled: true,

    VENDOR: 'assets/vendor/tesseract/',
    LANG: 'kor',

    /**
     * Why OCR cannot run here, or null if it can. Checked before the button is
     * shown, so the user is never offered a control that will fail.
     */
    unavailable: function () {
      if (!this.enabled) return 'disabled';
      if (typeof WebAssembly !== 'object') return 'no-wasm';
      if (typeof Worker === 'undefined') return 'no-worker';
      if (typeof global.createImageBitmap !== 'function' &&
          typeof global.FileReader === 'undefined') return 'no-image';
      return null;
    },

    available: function () { return this.unavailable() === null; },

    /* ------------------------------------------------------- preprocess --- */

    /*
     * Greyscale, at original size. See the header: this is what stops the
     * outgoing bubbles from disappearing. Tesseract binarises with a single
     * global threshold, so a yellow bubble and a blue-grey page background land
     * on the same side of it and the dark text inside the bubble is lost with
     * them; on the luminance channel the bubble and the background separate.
     *
     * Uses the ITU-R BT.601 coefficients rather than a CSS filter so the result
     * is identical in every browser and reproducible in the Node tests.
     */
    toGreyscale: function (imageData) {
      var d = imageData.data;
      for (var i = 0; i < d.length; i += 4) {
        var y = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000;
        d[i] = d[i + 1] = d[i + 2] = y;
      }
      return imageData;
    },

    /** Decode a File/Blob and return a greyscale canvas. Browser only. */
    prepare: function (file) {
      var self = this;
      return this._decode(file).then(function (bitmap) {
        var c = document.createElement('canvas');
        c.width = bitmap.width;
        c.height = bitmap.height;
        var ctx = c.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(bitmap, 0, 0);
        if (bitmap.close) bitmap.close();
        var img = ctx.getImageData(0, 0, c.width, c.height);
        ctx.putImageData(self.toGreyscale(img), 0, 0);
        return c;
      });
    },

    _decode: function (file) {
      if (typeof createImageBitmap === 'function') return createImageBitmap(file);
      /* Safari 14 and older: no createImageBitmap for Blobs. */
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(file);
        var im = new Image();
        im.onload = function () { URL.revokeObjectURL(url); resolve(im); };
        im.onerror = function () {
          URL.revokeObjectURL(url);
          reject(new Error('image-decode'));
        };
        im.src = url;
      });
    },

    /* ----------------------------------------------------------- engine --- */

    /*
     * Overridable seam. Anything with
     *   { recognize(input, { onProgress }) -> Promise<{ text, confidence, lines }> }
     * will do. `lines` entries carry { text, confidence, bbox }.
     */
    engine: null,

    _loadingScript: null,

    /** Pull the vendored library in, once, on first use. */
    _script: function () {
      if (global.Tesseract) return Promise.resolve(global.Tesseract);
      if (this._loadingScript) return this._loadingScript;
      var src = this.VENDOR + 'tesseract.min.js';
      this._loadingScript = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = function () {
          if (global.Tesseract) resolve(global.Tesseract);
          else reject(new Error(src + ': loaded but defined nothing'));
        };
        s.onerror = function () { reject(new Error(src + ': could not be loaded')); };
        document.head.appendChild(s);
      });
      return this._loadingScript;
    },

    /**
     * Build the real engine. Every path is local: a CDN would mean telling the
     * user their screenshot stays private while quietly announcing to a third
     * party that they are running it.
     */
    _realEngine: function (onProgress) {
      var self = this;
      return this._script().then(function (T) {
        return T.createWorker(self.LANG, 1, {
          workerPath: self.VENDOR + 'worker.min.js',
          corePath: self.VENDOR,
          langPath: self.VENDOR + 'lang',
          /* The model is vendored UNCOMPRESSED and gzip is off on purpose.
             A static host that decides to serve a .gz with
             `Content-Encoding: gzip` makes the browser inflate it in transit,
             and the worker — told to expect gzip — then tries to inflate it a
             second time and fails with nothing useful in the console. Shipping
             the plain file costs 0.6 MB in the repo (the host still compresses
             it on the wire) and removes the failure mode. */
          gzip: false,
          logger: function (m) {
            if (onProgress) onProgress(m.status, typeof m.progress === 'number' ? m.progress : 0);
          }
        }).then(function (worker) {
          return {
            recognize: function (input) {
              return worker.recognize(input).then(function (r) {
                return {
                  text: r.data.text || '',
                  confidence: r.data.confidence,
                  lines: (r.data.lines || []).map(function (l) {
                    return { text: l.text || '', confidence: l.confidence, bbox: l.bbox };
                  })
                };
              });
            },
            terminate: function () { return worker.terminate(); }
          };
        });
      });
    },

    _engine: function (onProgress) {
      if (this.engine) return Promise.resolve(this.engine);
      var self = this;
      return this._realEngine(onProgress).then(function (e) {
        self.engine = e;
        return e;
      });
    },

    /** Drop the worker; the next run rebuilds it. */
    release: function () {
      var e = this.engine;
      this.engine = null;
      if (e && e.terminate) { try { e.terminate(); } catch (err) {} }
    },

    /* ------------------------------------------------------------ clean --- */

    /*
     * Only two edits, both reversible by eye in the review pane:
     *
     *   - a trailing chat timestamp, when it is still recognisably a time;
     *   - a line that carries no Korean, no letters and at most one digit,
     *     which is read-noise from an avatar, an icon or a bubble edge.
     *
     * Everything else is left exactly as recognised. A cleaner that guessed at
     * half-read words would be rewriting the conversation the whole check rests
     * on, and the user cannot audit what they never see.
     */
    TIME_TAIL: /[\s.,]*(오전|오후|AM|PM|am|pm)?\s*\d{1,2}\s*[:：]\s*\d{2}\s*$/,

    /*
     * What is left of the timestamp once it is too mangled to look like a time:
     * a short standalone token that OPENS with punctuation (".5*=그", ".3*::",
     * ",533"). Requiring the leading punctuation and the space before it is
     * what keeps this off real text — Korean chat does not end a line with a
     * separate word beginning with a full stop or a comma, while the small
     * grey clock does it on every single line of a KakaoTalk capture. Sentence
     * punctuation attached to the preceding word ("보내주세요.") is not a
     * standalone token and is untouched.
     */
    JUNK_TAIL: /\s[.,;:]\S{0,7}$/,

    isNoiseLine: function (line) {
      var s = line.trim();
      if (!s) return false;
      if (HANGUL.test(s) || LETTER.test(s)) return false;
      var digits = (s.match(/[0-9]/g) || []).length;
      return digits <= 1;
    },

    clean: function (raw) {
      var self = this;
      var out = String(raw || '')
        .split(/\r?\n/)
        .map(function (l) {
          var out = l.replace(self.TIME_TAIL, '');
          /* Only when something is left to keep: a line that IS the junk is
             the noise filter's job, not this one. */
          var trimmed = out.replace(self.JUNK_TAIL, '');
          if (trimmed.trim()) out = trimmed;
          return out.replace(/\s+$/, '');
        })
        .filter(function (l) { return !self.isNoiseLine(l); });

      /* Collapse runs of blank lines; tesseract emits one per bubble gap. */
      var collapsed = [];
      out.forEach(function (l) {
        if (!l.trim() && (!collapsed.length || !collapsed[collapsed.length - 1].trim())) return;
        collapsed.push(l);
      });
      while (collapsed.length && !collapsed[collapsed.length - 1].trim()) collapsed.pop();
      return collapsed.join('\n');
    },

    /* ------------------------------------------------------------ sides --- */

    /*
     * Chat apps put your own messages on one side and theirs on the other, and
     * the engine gives us each line's box, so the split is recoverable — which
     * matters because the analyzer discounts the user's own words and would
     * otherwise treat every OCR'd line as the counterparty's.
     *
     * Recovered only when it is unambiguous: at least two lines on each side,
     * and a gap between the two groups wider than either group is itself.
     * Anything blurrier returns null and the user labels the lines by hand.
     * A wrong guess here silently attributes the landlord's pressure to the
     * tenant, or the reverse, so "no answer" is the right answer more often
     * than a confident one.
     */
    sideSplit: function (lines) {
      var boxed = (lines || []).filter(function (l) {
        return l.bbox && typeof l.bbox.x0 === 'number' && (l.text || '').trim();
      });
      if (boxed.length < 4) return null;

      var lefts = boxed.map(function (l) { return l.bbox.x0; }).sort(function (a, b) { return a - b; });
      var bestGap = 0, cut = -1;
      for (var i = 1; i < lefts.length; i++) {
        var gap = lefts[i] - lefts[i - 1];
        if (gap > bestGap) { bestGap = gap; cut = i; }
      }
      if (cut < 2 || lefts.length - cut < 2) return null;

      var spreadA = lefts[cut - 1] - lefts[0];
      var spreadB = lefts[lefts.length - 1] - lefts[cut];
      if (bestGap <= Math.max(spreadA, spreadB)) return null;

      var boundary = (lefts[cut - 1] + lefts[cut]) / 2;
      return {
        boundary: boundary,
        /* Which side is the user's is a question only the user can answer;
           we report the grouping and let the review pane ask. */
        groups: boxed.map(function (l) {
          return { text: l.text.trim(), side: l.bbox.x0 < boundary ? 'left' : 'right' };
        })
      };
    },

    /* -------------------------------------------------------- recognize --- */

    /**
     * Run one image. Resolves with the cleaned draft, the lines the engine was
     * least sure of, and the side grouping when it could be recovered.
     *
     * @param {File|Blob|HTMLCanvasElement} file
     * @param {{onProgress?: function(string, number), lowConfidence?: number}} opts
     */
    recognize: function (file, opts) {
      opts = opts || {};
      var self = this;
      var report = opts.onProgress || function () {};
      var floor = typeof opts.lowConfidence === 'number' ? opts.lowConfidence : 70;

      /* Outside a browser (the Node suites) there is no canvas to prepare on
         and the caller hands us something the engine already accepts. */
      var needsPrep = typeof document !== 'undefined' &&
        !(typeof HTMLCanvasElement !== 'undefined' && file instanceof HTMLCanvasElement);
      var input = needsPrep
        ? this.prepare(file).catch(function () { return file; })
        : Promise.resolve(file);

      return input.then(function (prepared) {
        report('loading', 0);
        return self._engine(report).then(function (engine) {
          report('recognizing text', 0);
          return engine.recognize(prepared, { onProgress: report });
        });
      }).then(function (result) {
        var lines = result.lines || [];
        return {
          text: self.clean(result.text),
          raw: result.text || '',
          confidence: result.confidence,
          uncertain: lines.filter(function (l) {
            return typeof l.confidence === 'number' && l.confidence < floor &&
                   (l.text || '').trim() && !self.isNoiseLine(l.text);
          }).map(function (l) {
            return { text: l.text.trim(), confidence: Math.round(l.confidence) };
          }),
          sides: self.sideSplit(lines)
        };
      });
    }
  };

  global.OCR = OCR;
  if (typeof module !== 'undefined' && module.exports) module.exports = OCR;
})(typeof window !== 'undefined' ? window : globalThis);
