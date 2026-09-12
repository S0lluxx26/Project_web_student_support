/* analyzer.js — rule-based scam-signal engine (runs entirely in the browser) */
(function (global) {
  'use strict';

  /* Follow-up questions suggested per category of detected signal. */
  var NEXT_QUESTIONS = {
    payment_pressure: {
      ko: [
        '등기부등본을 제가 직접 발급해 확인한 뒤에 입금하겠습니다. 계약일을 하루 뒤로 미뤄도 괜찮을까요?',
        '입금 계좌의 예금주 성명이 등기부등본상 소유자와 같은지 확인할 수 있을까요?',
        '가계약금을 보내기 전에 주소, 보증금, 입주일, 미계약 시 전액 반환 조건을 문자로 보내주실 수 있나요?'
      ],
      en: [
        'I will transfer once I have issued and read the property register myself — can we sign one day later?',
        'Can you confirm the bank account holder name is identical to the registered owner?',
        'Before I send a holding deposit, can you text me the address, deposit, move-in date and a full-refund condition if we do not sign?'
      ]
    },
    identity: {
      ko: [
        '등기부등본상 소유자분과 직접 영상통화로 계약 의사를 확인할 수 있을까요?',
        '신분증 원본과 등기부등본을 나란히 확인하고 사진을 찍어도 될까요?',
        '(대리인이라면) 위임장 원본과 3개월 이내 발급된 인감증명서를 보여주실 수 있나요?',
        '중개사무소 등록번호와 공제증서를 확인할 수 있을까요?'
      ],
      en: [
        'Can I confirm the lease directly with the registered owner on a video call?',
        'May I see the original ID next to the property register and photograph both?',
        'If you are a proxy, can you show the original power of attorney and a seal certificate issued within three months?',
        'Can I see the agency registration number and indemnity certificate?'
      ]
    },
    register_risk: {
      ko: [
        '을구의 근저당 채권최고액이 정확히 얼마인가요? 등기부등본으로 확인하고 싶습니다.',
        '근저당을 잔금일에 말소하신다면, "잔금일까지 말소, 미이행 시 계약 무효 및 전액 반환"을 특약에 넣어주실 수 있나요?',
        '신탁등기가 있다면 신탁원부와 신탁회사의 서면 동의서를 받을 수 있을까요?',
        '이 집의 최근 실거래가나 감정평가 자료를 보여주실 수 있나요?'
      ],
      en: [
        'What exactly is the maximum lien amount in section 을구? I would like to verify it on the register.',
        'If the mortgage will be cleared on the final payment date, can we add a clause voiding the contract with a full refund if it is not?',
        'If the property is in trust, can I get the trust deed and written consent from the trust company?',
        'Can you show recent transaction or appraisal data for this property?'
      ]
    },
    contract: {
      ko: [
        '국토교통부 주택임대차 표준계약서로 작성해주실 수 있나요? 서명 전에 파일로 먼저 보고 싶습니다.',
        '이사 당일 전입신고와 확정일자를 받는 데 동의하시나요? 특약에 명시해주실 수 있나요?',
        '전세보증보험(HUG 또는 SGI) 가입이 가능한 집인가요? 불가 시 계약 무효 조건을 넣을 수 있을까요?',
        '말씀하신 내용(수리, 옵션, 관리비)을 특약사항에 적어주실 수 있나요?'
      ],
      en: [
        'Can we use the MOLIT standard lease form? I would like to read the file before signing.',
        'Do you agree to my registering the move-in and getting the fixed-date stamp on moving day, written into the special terms?',
        'Is this property insurable under HUG or SGI deposit guarantee? Can we add a clause voiding the contract if it is not?',
        'Can the promises you made about repairs, appliances and fees be written into the special terms?'
      ]
    },
    too_good: {
      ko: [
        '이 가격이 주변 시세보다 낮은 이유가 무엇인가요?',
        '정확한 주소와 호수를 알려주실 수 있나요? 직접 방문하고 싶습니다.',
        '오늘 날짜가 보이게 방 내부 영상을 찍어 보내주실 수 있나요?'
      ],
      en: [
        'Why is this priced below the surrounding market?',
        'Can you give me the exact address and unit number? I would like to visit.',
        'Can you send a video of the room interior with today’s date visible?'
      ]
    },
    goshiwon: {
      ko: [
        '방 호수를 알려주시고 지금 실시간 영상통화로 그 방을 보여주실 수 있나요?',
        '사업자등록증을 보여주실 수 있나요? 입금 계좌 예금주가 사업자명과 같나요?',
        '보증금 환불 규정(입실 전 취소, 중도 퇴실)을 문자로 보내주실 수 있나요?'
      ],
      en: [
        'Which room number is it, and can you show me that room on a live video call now?',
        'Can you show your business registration? Is the bank account in the same business name?',
        'Can you text me the refund policy for cancelling before move-in and for leaving early?'
      ]
    },
    agent_behaviour: {
      ko: [
        '처음 광고된 매물의 주소와 호수를 알려주실 수 있나요?',
        '중개보수 요율표를 보여주시고, 현금영수증을 발행해주실 수 있나요?',
        '오늘은 결정하지 않고 비교해본 뒤 연락드리겠습니다. 괜찮으시죠?'
      ],
      en: [
        'Can you give me the address and unit number of the listing I originally saw?',
        'Can you show the official fee schedule and issue a cash receipt?',
        'I will not decide today — I will compare and get back to you. Is that all right?'
      ]
    }
  };

  var Analyzer = {
    data: null,

    load: function (data) { this.data = data; return this; },

    /** Collapse whitespace and case so spacing variants still match. */
    normalize: function (s) {
      return String(s == null ? '' : s)
        .toLowerCase()
        .replace(/[\u200b-\u200d\ufeff]/g, '')
        .replace(/\s+/g, '');
    },

    /**
     * Split text into sentences for quoting the matched line.
     *
     * Written as a manual scan rather than a lookbehind regex: lookbehind
     * is a parse-time syntax error in Safari below 16.4, which would throw
     * while loading this file and take the whole app down on older iPhones
     * — exactly the devices a student on a budget is likely to be using.
     */
    sentences: function (text) {
      var src = String(text || '');
      var out = [];
      var start = 0;
      for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        var isBreak = ch === '\n' || ch === '\r';
        var isStop = '.!?。？！'.indexOf(ch) !== -1;
        /* A terminator ends the sentence only when whitespace or the end of
           the text follows it, so "1,000,000" and "iros.go.kr" stay whole. */
        var endsHere = isBreak ||
          (isStop && (i + 1 >= src.length || /\s/.test(src[i + 1])));
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
     * Match `combos`: groups of terms that must ALL appear in the SAME sentence.
     * This catches Korean conjugation variants ("미루라고" / "미뤄주세요") without
     * a single broad keyword that would fire on innocent text, since a term like
     * "전입신고" is only a signal next to "미뤄" or "나중".
     * Returns the matched terms of the first matching group, or null.
     */
    matchCombos: function (combos, sents) {
      var self = this;
      for (var c = 0; c < combos.length; c++) {
        var group = combos[c];
        for (var s = 0; s < sents.length; s++) {
          var norm = this.normalize(sents[s]);
          var all = group.every(function (term) {
            return norm.indexOf(self.normalize(term)) !== -1;
          });
          if (all) return { terms: group, sentence: sents[s] };
        }
      }
      return null;
    },

    /**
     * Character ranges in `text` that correspond to the matched terms.
     *
     * Matching happens on a whitespace-stripped copy, so a keyword like
     * "오늘 안 하면" matches the text "오늘안하면" — meaning the matched
     * substring often does not literally appear in the original. To
     * highlight it we keep an index map from each normalized character
     * back to its position in the original string, then translate the
     * match offsets through it.
     *
     * Returns non-overlapping ranges sorted by start: [{start, end}].
     */
    ranges: function (text, terms) {
      var src = String(text || '');
      var norm = '';
      var map = [];
      for (var i = 0; i < src.length; i++) {
        var ch = src[i];
        if (/\s/.test(ch) || /[\u200b-\u200d\ufeff]/.test(ch)) continue;
        norm += ch.toLowerCase();
        map.push(i);
      }
      if (!norm) return [];

      var found = [];
      terms.forEach(function (term) {
        var t = String(term || '').toLowerCase().replace(/\s+/g, '');
        if (t.length < 2) return;
        var from = 0, at;
        while ((at = norm.indexOf(t, from)) !== -1) {
          found.push({ start: map[at], end: map[at + t.length - 1] + 1 });
          from = at + t.length;
        }
      });
      if (!found.length) return [];

      /* Merge overlaps so two terms hitting the same span mark it once. */
      found.sort(function (a, b) { return a.start - b.start; });
      var merged = [found[0]];
      for (var k = 1; k < found.length; k++) {
        var last = merged[merged.length - 1];
        if (found[k].start <= last.end) last.end = Math.max(last.end, found[k].end);
        else merged.push(found[k]);
      }
      return merged;
    },

    /** Find the first sentence containing any of the given raw keywords. */
    findQuote: function (sents, keywords) {
      for (var i = 0; i < sents.length; i++) {
        var norm = this.normalize(sents[i]);
        for (var k = 0; k < keywords.length; k++) {
          if (norm.indexOf(this.normalize(keywords[k])) !== -1) {
            var s = sents[i];
            return s.length > 220 ? s.slice(0, 217) + '…' : s;
          }
        }
      }
      return null;
    },

    /**
     * Analyze free text plus optional context.
     * ctx: {deposit, rent, market, who} — all numbers in 10k won units.
     * docRisks: [{id, weight, label}] from the document checklist.
     */
    analyze: function (text, ctx, docRisks) {
      ctx = ctx || {};
      docRisks = docRisks || [];
      var self = this;
      var patterns = (this.data && this.data.patterns) || [];
      var th = (this.data && this.data.thresholds) || { caution: 15, high: 35, veryHigh: 60 };
      var norm = this.normalize(text);
      var sents = this.sentences(text);
      var matches = [];

      patterns.forEach(function (p) {
        var kw = []
          .concat((p.keywords && p.keywords.ko) || [])
          .concat((p.keywords && p.keywords.en) || []);
        var hit = kw.filter(function (k) { return norm.indexOf(self.normalize(k)) !== -1; });
        var quote = hit.length ? self.findQuote(sents, hit) : null;

        if (p.combos) {
          var combo = self.matchCombos(p.combos, sents);
          if (combo) {
            combo.terms.forEach(function (t) { if (hit.indexOf(t) === -1) hit.push(t); });
            if (!quote) {
              quote = combo.sentence.length > 220
                ? combo.sentence.slice(0, 217) + '…'
                : combo.sentence;
            }
          }
        }

        if (!hit.length && p.regex) {
          try {
            if (new RegExp(p.regex, 'i').test(text)) hit = [p.regex];
          } catch (e) { /* bad regex in data — ignore */ }
        }
        if (!hit.length) return;

        matches.push({
          pattern: p,
          hits: hit,
          quote: quote,
          quoteRanges: quote ? self.ranges(quote, hit) : [],
          informational: !!(p.keywords && p.keywords.requiresCompanion)
        });
      });

      /* Informational-only patterns (e.g. the word "고시원") score nothing
         unless a real signal was also found. */
      var realCount = matches.filter(function (m) { return !m.informational; }).length;

      var score = 0;
      matches.forEach(function (m) {
        if (m.informational && realCount === 0) { m.points = 0; return; }
        m.points = m.informational ? 3 : m.pattern.severity * 5;
        score += m.points;
      });

      docRisks.forEach(function (d) { score += d.weight; });

      /* Deposit-to-value ratio. */
      var ratio = null;
      var deposit = Number(ctx.deposit) || 0;
      var market = Number(ctx.market) || 0;
      if (deposit > 0 && market > 0) {
        ratio = Math.round((deposit / market) * 1000) / 10;
        if (ratio >= 80) score += 25;
        else if (ratio >= 70) score += 15;
      }

      score = Math.min(100, score);

      var level = 'safe';
      if (score >= th.veryHigh) level = 'veryhigh';
      else if (score >= th.high) level = 'high';
      else if (score >= th.caution) level = 'caution';

      /* Follow-up questions, de-duplicated, from the matched categories. */
      var cats = {};
      matches.forEach(function (m) {
        if (m.informational && realCount === 0) return;
        cats[m.pattern.category] = true;
      });
      var lang = (global.I18n && I18n.lang) || 'ko';
      var questions = [];
      Object.keys(cats).forEach(function (c) {
        var set = NEXT_QUESTIONS[c];
        if (!set) return;
        (set[lang] || set.ko).forEach(function (q) {
          if (questions.indexOf(q) === -1) questions.push(q);
        });
      });

      matches.sort(function (a, b) { return b.pattern.severity - a.pattern.severity; });

      return {
        score: score,
        level: level,
        matches: matches,
        docRisks: docRisks,
        questions: questions,
        ratio: ratio,
        hasText: norm.length > 0
      };
    }
  };

  global.Analyzer = Analyzer;
})(window);
