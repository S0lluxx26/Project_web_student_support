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
        if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 12000000) {
          if (bitmap.close) bitmap.close();
          throw new Error('image-dimensions');
        }
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

    /* ------------------------------------------------------------ passes --- */

    /*
     * Two recognition passes, keeping whichever read more.
     *
     * Tesseract's page segmentation decides how the image is carved up before
     * a single character is read, and on chat screenshots it does not fail
     * gracefully — it fails totally. tesseract.js defaults to PSM 6 ("one
     * uniform block"), which is excellent on most captures and returned
     * NOTHING BUT THE DATE DIVIDERS on two of the demo screenshots, both of
     * them perfectly legible to a human. PSM 4 ("a single column of variable
     * sizes") never collapses but is a little worse where 6 works.
     *
     * Measured over 8 demo captures, counting recovery of 45 key phrases:
     *
     *     PSM 6 alone   30/45   (two total losses: 0/6 and 1/6)
     *     PSM 4 alone   36/45   (no collapse; worst case 3/6)
     *     both, richer  43/45
     *
     * So we run both and keep the richer read. It doubles recognition time —
     * about 2s to 4s per screenshot on a desktop — which is the right trade
     * for a check someone runs once before handing over a deposit, and far
     * better than a silent empty result telling a student their conversation
     * looks fine.
     *
     * The tie-break is deliberately dumb: count the letters. Any cleverer
     * scoring would be a quality judgement about text nobody has read yet.
     */
    PASSES: ['6', '4'],

    /** How much language a pass actually recovered. Higher wins. */
    scoreRead: function (result) {
      var t = String((result && result.text) || '');
      return (t.match(/[가-힣]/g) || []).length + (t.match(/[A-Za-z0-9]/g) || []).length;
    },

    /* ----------------------------------------------------------- engine --- */

    /*
     * Overridable seam. Anything with
     *   { recognize(input, { onProgress }) -> Promise<{ text, confidence, lines }> }
     * will do. `lines` entries carry { text, confidence, bbox }.
     */
    engine: null,

    _loadingScript: null,
    _enginePromise: null,
    _epoch: 0,
    _progress: null,

    /** Pull the vendored library in, once, on first use. */
    _script: function () {
      if (global.Tesseract) return Promise.resolve(global.Tesseract);
      if (this._loadingScript) return this._loadingScript;
      var src = this.VENDOR + 'tesseract.min.js';
      var self = this;
      this._loadingScript = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src;
        s.onload = function () {
          if (global.Tesseract) resolve(global.Tesseract);
          else reject(new Error(src + ': loaded but defined nothing'));
        };
        s.onerror = function () { reject(new Error(src + ': could not be loaded')); };
        document.head.appendChild(s);
      }).catch(function (error) { self._loadingScript = null; throw error; });
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
            if (self._progress) self._progress(m.status, typeof m.progress === 'number' ? m.progress : 0);
          }
        }).then(function (worker) {
          var currentPsm = null;
          var closed = false;
          return {
            recognize: function (input, opts) {
              if (closed) return Promise.reject(new Error('ocr-cancelled'));
              var psm = opts && opts.psm;
              /* setParameters is a round trip to the worker, so only pay for
                 it when the mode actually changes. */
              var ready = (psm && psm !== currentPsm)
                ? worker.setParameters({ tessedit_pageseg_mode: psm })
                    .then(function () { currentPsm = psm; })
                : Promise.resolve();
              return ready.then(function () {
                if (closed) throw new Error('ocr-cancelled');
                return worker.recognize(input);
              }).then(function (r) {
                return {
                  text: r.data.text || '',
                  confidence: r.data.confidence,
                  lines: (r.data.lines || []).map(function (l) {
                    return { text: l.text || '', confidence: l.confidence, bbox: l.bbox };
                  })
                };
              });
            },
            terminate: function () {
              if (closed) return Promise.resolve();
              closed = true;
              return worker.terminate();
            }
          };
        });
      });
    },

    _engine: function (onProgress) {
      this._progress = onProgress;
      if (this.engine) return Promise.resolve(this.engine);
      if (this._enginePromise) return this._enginePromise;
      var self = this;
      var epoch = this._epoch;
      var pending = this._realEngine(onProgress).then(function (e) {
        if (epoch !== self._epoch) {
          if (e.terminate) e.terminate();
          throw new Error('ocr-cancelled');
        }
        self.engine = e;
        return e;
      }).finally(function () { if (self._enginePromise === pending) self._enginePromise = null; });
      this._enginePromise = pending;
      return pending;
    },

    /** Drop the worker; the next run rebuilds it. */
    release: function () {
      this._epoch++;
      var e = this.engine;
      var pending = this._enginePromise;
      this.engine = null;
      this._enginePromise = null;
      this._progress = null;
      // If initialization has not returned its worker yet, its epoch check
      // disposes it immediately when it does. Active recognition is terminated.
      return Promise.all([
        Promise.resolve().then(function () { if (e && e.terminate) return e.terminate(); }).catch(function () {}),
        pending ? pending.catch(function () {}) : Promise.resolve()
      ]);
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

    /*
     * The same debris at the FRONT of a line: an avatar circle read as "_ _",
     * a bubble tail as "." or ",", a UI chevron as "<" or "|". Stripped only
     * while the leading token carries no language at all (the isNoiseLine
     * test), so "” 기" loses the quote mark and keeps the 기 — a misread
     * syllable is still something someone said, and deleting it is not ours to
     * do.
     */
    trimJunkHead: function (line) {
      var out = line;
      for (var i = 0; i < 4; i++) {
        var m = /^\s*(\S+)(\s+)/.exec(out);
        if (!m || !this.isNoiseLine(m[1])) break;
        out = out.slice(m[0].length);
      }
      return out;
    },

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
          var out = self.trimJunkHead(l).replace(self.TIME_TAIL, '');
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
    /*
     * Tesseract sometimes emits a fragment of a line as its own line, sitting
     * inside the box of the real one ("락드립" inside "건으로 연락드립니다").
     * Left in, it becomes a separate message of nonsense.
     */
    dropContained: function (lines) {
      return lines.filter(function (l, i) {
        return !lines.some(function (o, j) {
          if (i === j || !o.bbox) return false;
          var a = l.bbox, b = o.bbox;
          var inside = a.x0 >= b.x0 - 2 && a.x1 <= b.x1 + 2 &&
                       a.y0 >= b.y0 - 2 && a.y1 <= b.y1 + 2;
          /* Keep the bigger one: it is the one that read the whole line. */
          return inside && (b.x1 - b.x0) * (b.y1 - b.y0) > (a.x1 - a.x0) * (a.y1 - a.y0);
        });
      });
    },

    /*
     * A chat bubble wider than one line becomes several OCR lines, and treating
     * each as its own message splits sentences in half — "방을 못" / "보여드려요"
     * reads as two messages and the refusal it describes matches nothing. The
     * spacing separates them cleanly: measured on the demo captures, lines
     * inside one bubble sit ~12px apart while consecutive bubbles sit ~35px
     * apart, against a line height of ~25. Rejoining below 0.6 line-heights
     * puts the threshold in the middle of that gap and scales with the
     * screenshot's resolution instead of hard-coding pixels.
     */
    BUBBLE_GAP: 0.6,

    mergeBubbles: function (lines) {
      if (!lines.length) return [];
      var heights = lines.map(function (l) { return l.bbox.y1 - l.bbox.y0; })
                         .sort(function (a, b) { return a - b; });
      var unit = heights[Math.floor(heights.length / 2)] || 20;
      var limit = unit * this.BUBBLE_GAP;

      var out = [];
      lines.forEach(function (l) {
        var prev = out[out.length - 1];
        var tight = prev && prev.side === l.side && (l.bbox.y0 - prev.bbox.y1) < limit;
        if (tight) {
          prev.text += ' ' + l.text.trim();
          prev.bbox = { x0: Math.min(prev.bbox.x0, l.bbox.x0), y0: prev.bbox.y0,
                        x1: Math.max(prev.bbox.x1, l.bbox.x1), y1: l.bbox.y1 };
        } else {
          out.push({ text: l.text.trim(), side: l.side, bbox: l.bbox });
        }
      });
      return out;
    },

    sideSplit: function (lines) {
      var boxed = (lines || []).filter(function (l) {
        return l.bbox && typeof l.bbox.x0 === 'number' && (l.text || '').trim();
      });
      boxed = this.dropContained(boxed);
      boxed.sort(function (a, b) { return a.bbox.y0 - b.bbox.y0; });
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
      /* Trim each line's leading debris BEFORE merging. Afterwards the junk
         from a wrapped line sits in the middle of the joined sentence, where
         no line-based rule can reach it. */
      var self = this;
      var sided = boxed.map(function (l) {
        return { text: self.trimJunkHead(l.text).trim(), bbox: l.bbox,
                 side: l.bbox.x0 < boundary ? 'left' : 'right' };
      }).filter(function (l) { return l.text; });
      return {
        boundary: boundary,
        /* Which side is the user's is a question only the user can answer;
           we report the grouping and let the review pane ask. */
        groups: this.mergeBubbles(sided).map(function (g) {
          return { text: g.text, side: g.side };
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
      var epoch = this._epoch;
      var report = opts.onProgress || function () {};
      var floor = typeof opts.lowConfidence === 'number' ? opts.lowConfidence : 70;

      /* Outside a browser (the Node suites) there is no canvas to prepare on
         and the caller hands us something the engine already accepts. */
      var needsPrep = typeof document !== 'undefined' &&
        !(typeof HTMLCanvasElement !== 'undefined' && file instanceof HTMLCanvasElement);
      var input = needsPrep
        ? this.prepare(file)
        : Promise.resolve(file);

      var passes = opts.passes || this.PASSES;

      return input.then(function (prepared) {
        if (epoch !== self._epoch) throw new Error('ocr-cancelled');
        report('loading', 0);
        return self._engine(report).then(function (engine) {
          report('recognizing text', 0);
          /* Sequential, not parallel: there is one worker, and a phone has no
             spare core to waste on a second wasm instance anyway. */
          var best = null;
          return passes.reduce(function (chain, psm, i) {
            return chain.then(function () {
              if (epoch !== self._epoch) throw new Error('ocr-cancelled');
              return engine.recognize(prepared, { onProgress: report, psm: psm })
                .then(function (r) {
                  report('recognizing text', (i + 1) / passes.length);
                  if (!best || self.scoreRead(r) > self.scoreRead(best)) best = r;
                });
            });
          }, Promise.resolve()).then(function () { return best; });
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
