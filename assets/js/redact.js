/* ==========================================================================
   redact.js — best-effort removal of identifying details before sharing
   ==========================================================================

   The report quotes the user's own messages, which is the point — evidence
   without the quote is an assertion. But the moment a report leaves the
   device, those quotes may carry a phone number, an account number, an
   address, or a name, and the person sharing it is usually doing so in a
   hurry, to ask someone for help.

   So export is a separate, deliberate step: the user sees exactly what will
   leave, with the obvious identifiers already masked, and can edit it.

   This is BEST EFFORT and the UI says so. Pattern matching cannot reliably
   find a Korean personal name, and it will miss things. That is precisely
   why the preview is editable rather than automatic — the redaction is a
   head start, not a guarantee, and the user is the last check.
   ========================================================================== */

(function (global) {
  'use strict';

  var MASK = '■■■';

  var RULES = [
    {
      id: 'email',
      re: /[\w.+-]+@[\w-]+\.[\w.-]+/g,
      label: { ko: '이메일', en: 'email' }
    },
    {
      /* Korean mobile and landline, with or without separators. */
      id: 'phone',
      re: /\b0\d{1,2}[-. ]?\d{3,4}[-. ]?\d{4}\b/g,
      label: { ko: '전화번호', en: 'phone number' }
    },
    {
      /* Bank account numbers: long digit runs, optionally grouped. Placed
         after `phone` so a phone number is not caught here first. */
      id: 'account',
      re: /\b\d{2,6}[-]\d{2,6}[-]\d{2,8}\b|\b\d{10,16}\b/g,
      label: { ko: '계좌번호', en: 'account number' }
    },
    {
      /* 주민등록번호. Never shown even partially. */
      id: 'rrn',
      re: /\b\d{6}[-]\d{7}\b/g,
      label: { ko: '주민등록번호', en: 'resident registration number' }
    },
    {
      /* Korean road addresses: "월드컵로 12길 3, 302호", "테헤란로 123".
         The whole tail is consumed in one match, because masking only the
         road name and leaving "길 3, 302호" behind defeats the point. */
      id: 'address',
      re: /[가-힣A-Za-z0-9]{2,12}(?:대로|로|길)\s*\d+(?:번?길)?(?:\s*\d+)?(?:[-]\d+)?(?:\s*,?\s*\d+\s*동)?(?:\s*,?\s*\d+\s*호)?/g,
      label: { ko: '주소', en: 'address' }
    },
    {
      /* A bare unit number — "302호".
         No \b here: JavaScript word boundaries are ASCII-only, so \b after
         a Hangul syllable never matches and "302호입니다" was left intact.
         The lookahead keeps subway lines and similar counters out. */
      id: 'unit',
      re: /\d{1,5}\s*호(?!선|차|기|봉|주|실|텔)/g,
      label: { ko: '호수', en: 'unit number' }
    }
  ];

  var Redact = {

    mask: MASK,
    rules: RULES,

    /**
     * Mask identifiers in `text`.
     * Returns { text, found: [{ id, count }] } so the UI can say what was
     * masked — a silent redaction is impossible to check.
     */
    apply: function (text, disabled) {
      disabled = disabled || {};
      var out = String(text == null ? '' : text);
      var found = [];

      RULES.forEach(function (rule) {
        if (disabled[rule.id]) return;
        var count = 0;
        out = out.replace(rule.re, function (m) {
          count++;
          /* Keep a hint of shape so the reader can tell what was removed. */
          return MASK + (rule.id === 'unit' ? '호' : '');
        });
        if (count) found.push({ id: rule.id, count: count, label: rule.label });
      });

      return { text: out, found: found };
    },

    /** A dry run: what would be masked, without changing the text. */
    inspect: function (text) {
      return this.apply(text).found;
    }
  };

  global.Redact = Redact;
  if (typeof module !== 'undefined' && module.exports) module.exports = Redact;
})(typeof window !== 'undefined' ? window : globalThis);
