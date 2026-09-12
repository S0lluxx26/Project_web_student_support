/* ==========================================================================
   detector.js — fuzzy sentence and phrase detection
   ==========================================================================

   The keyword engine in analyzer.js answers "does this text contain this
   phrase". That misses the way real scam messages are written: the same
   pressure tactic arrives a hundred different ways, and a scammer who
   rewrites one word defeats an exact match.

       corpus:  "오늘 가계약금 먼저 입금해주시면 방 잡아드릴게요"
       message: "오늘 안에 예약금만 넣어주시면 방 빼놓을게요"

   No keyword is shared, yet it is plainly the same sentence. This module
   scores that similarity the way plagiarism checkers do — by comparing sets
   of overlapping character n-grams ("shingles") rather than words, which
   suits Korean, where spacing is inconsistent and particles attach to stems
   so word tokens rarely line up.

   Two measures, used for different jobs:

     Jaccard    |A ∩ B| / |A ∪ B|   — how alike two sentences are overall.
                Symmetric, so it penalises length differences. Used to ask
                "is this the same sentence, rewritten?"

     Containment |A ∩ B| / |A|      — how much of the corpus sentence appears
                somewhere in the message. Asymmetric, so a short template is
                still found inside a long paragraph. Used to ask "is this
                tactic present anywhere in what they sent?"

   Both run on normalized text (case folded, whitespace and punctuation
   removed) so spacing variants collapse together.

   No dependencies, no network, no build step. Works in a browser and in
   Node (`module.exports` at the bottom) so it can be unit-tested.
   ========================================================================== */

(function (global) {
  'use strict';

  var Detector = {

    /* Tunables. Raised thresholds mean fewer, more confident matches. */
    defaults: {
      n: 3,                  /* shingle size in characters */
      jaccard: 0.34,         /* whole-sentence rewrite */
      containment: 0.62,     /* template found inside a longer message */
      minLength: 6           /* ignore corpus entries too short to be meaningful */
    },

    /**
     * Fold away everything that varies without changing meaning: case,
     * spacing, and punctuation. Korean spacing in particular is wildly
     * inconsistent in chat messages, so it cannot be trusted as a boundary.
     */
    normalize: function (s) {
      return String(s == null ? '' : s)
        .toLowerCase()
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/[\s.,!?~…·∙"'"'()\[\]{}<>「」『』【】-]/g, '');
    },

    /** Overlapping character n-grams, as a de-duplicated set. */
    shingles: function (text, n) {
      n = n || this.defaults.n;
      var s = this.normalize(text);
      var set = Object.create(null);
      if (s.length < n) {
        if (s.length) set[s] = true;
        return set;
      }
      for (var i = 0; i <= s.length - n; i++) set[s.slice(i, i + n)] = true;
      return set;
    },

    _size: function (set) { return Object.keys(set).length; },

    _intersectionSize: function (a, b) {
      var keys = Object.keys(a), hits = 0;
      for (var i = 0; i < keys.length; i++) if (b[keys[i]]) hits++;
      return hits;
    },

    /** Symmetric similarity: are these the same sentence? */
    jaccard: function (a, b, n) {
      var A = this.shingles(a, n), B = this.shingles(b, n);
      var sizeA = this._size(A), sizeB = this._size(B);
      if (!sizeA || !sizeB) return 0;
      var inter = this._intersectionSize(A, B);
      return inter / (sizeA + sizeB - inter);
    },

    /** Asymmetric: how much of `needle` appears inside `haystack`? */
    containment: function (needle, haystack, n) {
      var A = this.shingles(needle, n), B = this.shingles(haystack, n);
      var sizeA = this._size(A);
      if (!sizeA || !this._size(B)) return 0;
      return this._intersectionSize(A, B) / sizeA;
    },

    /**
     * Levenshtein distance, two-row variant (O(min(a,b)) memory).
     * Used only as a tie-breaker on short strings, where n-grams are too
     * coarse to separate "보증금" from "보증서".
     */
    editDistance: function (a, b) {
      a = this.normalize(a); b = this.normalize(b);
      if (a === b) return 0;
      if (!a.length) return b.length;
      if (!b.length) return a.length;
      if (a.length > b.length) { var t = a; a = b; b = t; }

      var prev = new Array(a.length + 1), cur = new Array(a.length + 1);
      for (var i = 0; i <= a.length; i++) prev[i] = i;
      for (var j = 1; j <= b.length; j++) {
        cur[0] = j;
        for (var k = 1; k <= a.length; k++) {
          cur[k] = Math.min(
            prev[k] + 1,                                     /* deletion */
            cur[k - 1] + 1,                                  /* insertion */
            prev[k - 1] + (a[k - 1] === b[j - 1] ? 0 : 1)    /* substitution */
          );
        }
        var swap = prev; prev = cur; cur = swap;
      }
      return prev[a.length];
    },

    /** Edit distance expressed as 0..1 similarity. */
    editSimilarity: function (a, b) {
      var la = this.normalize(a).length, lb = this.normalize(b).length;
      var max = Math.max(la, lb);
      if (!max) return 0;
      return 1 - (this.editDistance(a, b) / max);
    },

    /**
     * Split text into sentences. Shares the deliberate no-lookbehind
     * approach used in analyzer.js — lookbehind is a parse-time syntax
     * error in Safari below 16.4, which would break the whole file.
     */
    sentences: function (text) {
      var src = String(text || ''), out = [], start = 0;
      for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        var isBreak = ch === '\n' || ch === '\r';
        var isStop = '.!?。？！'.indexOf(ch) !== -1;
        var endsHere = isBreak || (isStop && (i + 1 >= src.length || /\s/.test(src[i + 1])));
        if (!endsHere) continue;
        var piece = src.slice(start, isBreak ? i : i + 1).trim();
        if (piece) out.push(piece);
        start = i + 1;
      }
      var tail = src.slice(start).trim();
      if (tail) out.push(tail);
      return out;
    },

    /**
     * Compare every sentence of `text` against every corpus entry.
     *
     * corpus: [{ id, patternId, text, severity, note }]
     * opts:   { n, jaccard, containment, limit }
     *
     * Returns matches sorted by confidence:
     *   [{ entry, sentence, jaccard, containment, score, how }]
     * where `how` is 'rewrite' (whole sentence matched) or 'contains'
     * (template found inside a longer sentence).
     */
    scan: function (text, corpus, opts) {
      opts = opts || {};
      var n = opts.n || this.defaults.n;
      var jMin = opts.jaccard === undefined ? this.defaults.jaccard : opts.jaccard;
      var cMin = opts.containment === undefined ? this.defaults.containment : opts.containment;
      var self = this;

      var sents = this.sentences(text);
      if (!sents.length) return [];

      /* Shingle each sentence once rather than per corpus entry. */
      var prepared = sents.map(function (s) {
        return { raw: s, set: self.shingles(s, n) };
      });

      var out = [];
      (corpus || []).forEach(function (entry) {
        var entryText = entry.text || '';
        if (self.normalize(entryText).length < self.defaults.minLength) return;
        var entrySet = self.shingles(entryText, n);
        var entrySize = self._size(entrySet);
        if (!entrySize) return;

        var best = null;
        prepared.forEach(function (p) {
          var sentSize = self._size(p.set);
          if (!sentSize) return;
          var inter = self._intersectionSize(entrySet, p.set);
          if (!inter) return;

          var jac = inter / (entrySize + sentSize - inter);
          var con = inter / entrySize;
          var how = null;

          if (jac >= jMin) how = 'rewrite';
          else if (con >= cMin) how = 'contains';
          if (!how) return;

          /* Prefer the interpretation that scores higher. */
          var score = Math.max(jac, con);
          if (!best || score > best.score) {
            best = { entry: entry, sentence: p.raw, jaccard: jac,
                     containment: con, score: score, how: how };
          }
        });

        if (best) out.push(best);
      });

      out.sort(function (a, b) {
        var sev = (b.entry.severity || 0) - (a.entry.severity || 0);
        return sev !== 0 ? sev : b.score - a.score;
      });
      return opts.limit ? out.slice(0, opts.limit) : out;
    },


    /* ======================================================================
       CONCEPT MATCHING
       ----------------------------------------------------------------------
       Measured on real pairs, n-gram similarity scores a genuine Korean
       paraphrase at about 0.06 — no better than unrelated text:

         spacing changed only ....... 1.00
         sentence ending changed .... 0.73
         template inside a message .. 1.00 (containment)
         genuinely reworded ......... 0.06   <-- misses

       So shingles catch a copy-pasted script, not a rewritten one. For
       rewrites the unit of meaning is the TACTIC, not the wording: "오늘
       안에 입금" and "지금 바로 쏴주시면" are one concept pair (urgency +
       payment) wearing different words.

       A rule therefore names concepts, and the lexicon lists the surface
       forms of each. Adding a new slang term for "pay" improves every rule
       that mentions PAY, which is why this scales where keyword lists do not.
       ====================================================================== */

    /** Which concepts appear in one sentence. Returns {CONCEPT: [hits]}. */
    conceptsIn: function (sentence, lexicon) {
      var norm = this.normalize(sentence);
      var found = {};
      Object.keys(lexicon || {}).forEach(function (concept) {
        var hits = [];
        lexicon[concept].forEach(function (form) {
          var f = String(form).toLowerCase().replace(/\s+/g, '');
          if (f && norm.indexOf(f) !== -1) hits.push(form);
        });
        if (hits.length) found[concept] = hits;
      });
      return found;
    },

    /**
     * Evaluate concept rules against each sentence.
     *
     * rule: { id, severity, all: [...], any: [...], none: [...] }
     *   all  — every concept must be present in the same sentence
     *   any  — at least one must be present (optional)
     *   none — none may be present; used to suppress the inverted form,
     *          e.g. "전입신고 꼭 하세요" must not fire the delay rule
     *
     * Returns [{ rule, sentence, concepts, terms }].
     */
    matchRules: function (text, lexicon, rules) {
      var self = this;
      var sents = this.sentences(text);
      var out = [];

      (rules || []).forEach(function (rule) {
        for (var i = 0; i < sents.length; i++) {
          var present = self.conceptsIn(sents[i], lexicon);

          if ((rule.none || []).some(function (c) { return present[c]; })) continue;
          if (!(rule.all || []).every(function (c) { return present[c]; })) continue;
          if ((rule.any || []).length &&
              !rule.any.some(function (c) { return present[c]; })) continue;

          var terms = [];
          (rule.all || []).concat(rule.any || []).forEach(function (c) {
            (present[c] || []).forEach(function (t) {
              if (terms.indexOf(t) === -1) terms.push(t);
            });
          });

          out.push({ rule: rule, sentence: sents[i],
                     concepts: Object.keys(present), terms: terms });
          break; /* one hit per rule is enough */
        }
      });

      out.sort(function (a, b) {
        return (b.rule.severity || 0) - (a.rule.severity || 0);
      });
      return out;
    },

    /**
     * Both engines at once: concept rules for rewrites, shingles for
     * copy-pasted scripts. `corpus` and `rules` are each optional.
     */
    analyze: function (text, opts) {
      opts = opts || {};
      return {
        rules: this.matchRules(text, opts.lexicon || {}, opts.rules || []),
        similar: this.scan(text, opts.corpus || [], opts)
      };
    },

    /**
     * Locate `needle` inside `haystack` even when spacing differs, and
     * return the character range in the ORIGINAL string.
     *
     * Matching happens on normalized text, so the matched substring often
     * does not literally occur in the original; an index map translates the
     * offsets back. Returns null when the needle is not present verbatim
     * (after normalization) — fuzzy matches have no exact span to point at.
     */
    locate: function (haystack, needle) {
      var src = String(haystack || '');
      var norm = '', map = [];
      for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        if (/[\s.,!?~…·∙"'"'()\[\]{}<>「」『』【】-]/.test(ch)) continue;
        if (/[\u200b-\u200d\ufeff]/.test(ch)) continue;
        norm += ch.toLowerCase();
        map.push(i);
      }
      var target = this.normalize(needle);
      if (!target) return null;
      var at = norm.indexOf(target);
      if (at === -1) return null;
      return { start: map[at], end: map[at + target.length - 1] + 1 };
    }
  };

  global.Detector = Detector;
  if (typeof module !== 'undefined' && module.exports) module.exports = Detector;
})(typeof window !== 'undefined' ? window : globalThis);
