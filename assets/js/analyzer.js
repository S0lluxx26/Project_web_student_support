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
    lexicon: null,

    load: function (data) { this.data = data; return this; },

    /**
     * Optional second pass. Keyword and combo matching catches the wordings
     * we have seen; concept matching (detector.js) catches the ones we
     * haven't, by looking for the TACTIC rather than the phrasing. Loading
     * it is optional so the engine still works if the file is missing.
     */
    loadFuzzy: function (lex) { this.lexicon = lex; return this; },

    /* A value is usable only if it is a finite number >= 0. Everything else
       — null, '', NaN, Infinity, a negative — means "not supplied". */
    _usable: function (v) {
      return typeof v === 'number' && isFinite(v) && v >= 0;
    },

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

    /**
     * An excerpt centred on the evidence.
     *
     * The old version returned the first 217 characters of the sentence,
     * which meant a match late in a long message was reported with the
     * matched words cropped out — a warning whose quoted proof did not
     * contain the thing being warned about. The window now follows the
     * match, and the caller re-derives highlight ranges against the excerpt.
     */
    excerpt: function (text, terms, budget) {
      budget = budget || 220;
      var src = String(text || '');
      if (src.length <= budget) return src;

      var hit = this.ranges(src, terms)[0];
      if (!hit) return src.slice(0, budget - 1) + '…';

      var span = hit.end - hit.start;
      var pad = Math.max(0, Math.floor((budget - span) / 2));
      var start = Math.max(0, hit.start - pad);
      var end = Math.min(src.length, start + budget);
      start = Math.max(0, Math.min(start, end - budget));

      return (start > 0 ? '…' : '') + src.slice(start, end) +
             (end < src.length ? '…' : '');
    },

    /** Find the first sentence containing any of the given raw keywords. */
    findQuote: function (sents, keywords) {
      for (var i = 0; i < sents.length; i++) {
        var norm = this.normalize(sents[i]);
        for (var k = 0; k < keywords.length; k++) {
          if (norm.indexOf(this.normalize(keywords[k])) !== -1) {
            return this.excerpt(sents[i], keywords);
          }
        }
      }
      return null;
    },

    /**
     * Should this match survive, given who said it and how?
     *
     * Returns null to keep the match, or a string reason to drop it. The
     * reasons are kept rather than silently discarded so the report can
     * explain why something was NOT flagged when a user expects it.
     */
    gate: function (pattern, message, convo) {
      if (!message) return null;
      var C = global.Conversation;
      if (!C) return null;

      /* The tenant's own words are not evidence about the counterparty,
         unless they are reporting what the counterparty said. */
      if (!C.countsAsCounterparty(message)) return 'own-side';

      /* Asking whether a risk applies is not evidence that it does. */
      if (message.act === 'question' &&
          !(pattern.id.indexOf('pay-') === 0 && C.isPaymentRequest(message.text))) return 'question';

      /*
       * A refusal by the speaker is the opposite of a demand — but only for
       * patterns that describe a demand. "그런 거 따지면 계약 못 해요" carries a
       * refusal marker (못 해요) while being the counterparty dismissing a
       * question about the register, which is the risk itself rather than the
       * absence of one. Patterns whose subject is the other side's rhetoric
       * set `refusalGate: false` and opt out.
       */
      if (message.act === 'refusal' && pattern.refusalGate !== false) return 'refusal';

      /* An explicit denial voids patterns whose whole claim is that the
         risk is PRESENT. It must not void patterns where the reassurance
         itself is the signal — "근저당 있는데 문제없어요" affirms the lien and
         dismisses its consequence, which is precisely the tactic. */
      if (pattern.deniable && message.act === 'denial') {
        var n = this.normalize(message.text);
        var affirms = ['있습니다', '있어요', '있는데', '잡혀', '설정되', '걸려',
                       'there is a', 'there are', 'has a'];
        var affirmed = affirms.some(function (a) {
          return n.indexOf(this.normalize(a)) !== -1;
        }, this);
        if (!affirmed) return 'denied';
      }

      /* A pattern may name phrases that describe the correct situation. */
      var sup = pattern.suppressedBy;
      if (sup) {
        var nt = this.normalize(message.text);
        var forms = [].concat(sup.ko || [], sup.en || []);
        for (var i = 0; i < forms.length; i++) {
          if (nt.indexOf(this.normalize(forms[i])) !== -1) return 'stated-correct';
        }

        /*
         * Some reassurances only reassure depending on who is speaking. "제
         * 명의 계좌로 보내주세요" from the OWNER means the account matches the
         * register, which is exactly right; from the AGENT it means the deposit
         * is going into the agent's own name, which is the classic version of
         * this fraud. A speaker-blind suppressor silently cancelled the second
         * case — found when demo/run-demo.mjs put a real screenshot through and
         * the agent's request produced nothing. Hence `suppressedBy.bySpeaker`:
         * the phrase excuses the pattern only from the listed speakers.
         */
        /*
         * Some reassurances are made once and cover the whole conversation.
         * An agent who explains that a trust-owned flat needs the trustee's
         * written consent, and points the deposit at the trust's own account,
         * has handled the single most dangerous thing about that property
         * correctly — but says so in a DIFFERENT message from the one that
         * mentions the trust, so a per-message suppressor never sees it and
         * the correct behaviour is reported as a strong warning. `anywhere`
         * is checked against everything the counterparty said.
         */
        if (sup.anywhere && convo) {
          var anyForms = [].concat(sup.anywhere.ko || [], sup.anywhere.en || []);
          for (var k = 0; k < anyForms.length; k++) {
            if (convo.indexOf(this.normalize(anyForms[k])) !== -1) return 'stated-correct';
          }
        }

        var by = sup.bySpeaker;
        if (by) {
          for (var role in by) {
            if (!Object.prototype.hasOwnProperty.call(by, role)) continue;
            if (message.speaker !== role) continue;
            var roleForms = [].concat(by[role].ko || [], by[role].en || []);
            for (var j = 0; j < roleForms.length; j++) {
              if (nt.indexOf(this.normalize(roleForms[j])) !== -1) return 'stated-correct';
            }
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
    analyze: function (text, ctx, docRisks, opts) {
      ctx = ctx || {};
      docRisks = docRisks || [];
      opts = opts || {};
      var self = this;
      var patterns = (this.data && this.data.patterns) || [];
      var th = (this.data && this.data.thresholds) || { caution: 15, high: 35, veryHigh: 60 };
      var isUsable = this._usable;
      var matches = [];

      /* Matching happens per message so that WHO said it and HOW can gate
         the result. Without a message model, "Tenant: I will not pay now"
         is indistinguishable from a landlord demanding payment. */
      var messages = global.Conversation ? Conversation.parse(text) : [];

      /* A speaker the user corrected outranks anything we inferred. */
      if (opts.speakers) {
        messages.forEach(function (m) {
          if (opts.speakers[m.id]) {
            m.speaker = opts.speakers[m.id];
            m.speakerConfirmed = true;
          }
        });
      }
      var suppressed = [];

      /* Sentences come from message BODIES, never the raw paste.
         Splitting the raw text left the speaker label attached — a quote
         of "집주인: 제 명의 계좌로…" could not be matched back to its own
         message, so the gate silently never ran on it. Deriving sentences
         from message text also stops a label like "집주인:" from matching
         a keyword such as "집주인 대신". */
      var sents = [];
      var sentOwner = [];
      if (messages.length) {
        messages.forEach(function (m) {
          self.sentences(m.text).forEach(function (sent) {
            sents.push(sent);
            sentOwner.push(m);
          });
        });
      } else {
        sents = this.sentences(text);
        sentOwner = sents.map(function () { return null; });
      }

      /* Evidence coverage counts message bodies, excluding speaker labels. */
      var analysisText = messages.length
        ? messages.map(function (m) { return m.text; }).join('\n')
        : text;
      var norm = this.normalize(analysisText);

      /* Preserve ownership directly. Never find an owner by searching quote
         text: identical sentences can come from different speakers, and a
         shortened excerpt is not a reliable identity. Gate each candidate
         before deduplication, so a benign first occurrence cannot hide a later
         demand. Speech acts are local to the sentence being quoted. */
      var candidates = sents.map(function (sentence, i) {
        var owner = sentOwner[i];
        return { sentence: sentence, message: owner && Object.assign({}, owner, {
          text: sentence,
          act: Conversation.speechAct(sentence),
          reported: Conversation.isReported(sentence)
        }) };
      });
      var trustConflict = candidates.some(function (c) {
        if (c.message && !Conversation.countsAsCounterparty(c.message)) return false;
        var n = self.normalize(c.sentence);
        return /동의(?:서)?.{0,12}(?:없이|없|필요없|나중|안받|받지)|(?:without|no).*consent|consent.*(?:notneeded|unnecessary|later)/i.test(n);
      });
      /* Cross-message reassurance must come from a counterparty statement,
         not a tenant's wish or a question asking whether consent exists. */
      var counterpartyText = trustConflict ? '' : self.normalize(candidates.filter(function (c) {
        return c.message && Conversation.countsAsCounterparty(c.message) &&
          c.message.act !== 'question' && c.message.act !== 'refusal';
      }).map(function (c) { return c.sentence; }).join(' '));
      var accepted = {};
      function accept(p, terms, candidate, fuzzy, ruleTitle) {
        if (accepted[p.id]) return;
        var msg = candidate.message;
        var blocked = self.gate(p, msg, counterpartyText);
        if (blocked) {
          suppressed.push({ patternId: p.id, reason: blocked,
            speaker: msg ? msg.speaker : 'unknown' });
          return;
        }
        var quote = self.excerpt(candidate.sentence, terms);
        accepted[p.id] = true;
        matches.push({ pattern: p, hits: terms, quote: quote,
          quoteRanges: self.ranges(quote, terms),
          speaker: msg ? msg.speaker : 'unknown', reported: !!(msg && msg.reported),
          informational: !!(p.keywords && p.keywords.requiresCompanion),
          fuzzy: !!fuzzy, ruleTitle: ruleTitle });
      }
      patterns.forEach(function (p) {
        var keywords = [].concat((p.keywords && p.keywords.ko) || [], (p.keywords && p.keywords.en) || []);
        candidates.forEach(function (candidate) {
          if (accepted[p.id]) return;
          var cn = self.normalize(candidate.sentence);
          var terms = keywords.filter(function (term) { return cn.indexOf(self.normalize(term)) !== -1; });
          var combo = p.combos && self.matchCombos(p.combos, [candidate.sentence]);
          if (combo) combo.terms.forEach(function (term) { if (terms.indexOf(term) === -1) terms.push(term); });
          if (!terms.length && p.regex) {
            try { if (new RegExp(p.regex, 'i').test(candidate.sentence)) terms = [p.regex]; } catch (_) {}
          }
          if (terms.length) accept(p, terms, candidate, false);
        });
      });
      if (this.lexicon && global.Detector) {
        var byId = {};
        patterns.forEach(function (p) { byId[p.id] = p; });
        candidates.forEach(function (candidate) {
          Detector.matchRules(candidate.sentence, self.lexicon.lexicon, self.lexicon.rules).forEach(function (hit) {
            var p = byId[hit.rule.patternId];
            if (p) accept(p, hit.terms, candidate, true, hit.rule.title);
          });
        });
      }

      /* Informational-only patterns (e.g. the word "고시원") score nothing
         unless a real signal was also found. */
      var realCount = matches.filter(function (m) { return !m.informational; }).length;

      var score = 0;
      matches.forEach(function (m) {
        if (m.informational && realCount === 0) { m.points = 0; return; }
        m.points = m.informational ? 3
          : Math.round(m.pattern.severity * (m.fuzzy ? 4 : 5));
        score += m.points;
      });

      docRisks.forEach(function (d) { score += d.weight; });

      /* ------------------------------------------------------------------
         Exposure ratio.

         What decides whether a deposit is recoverable at auction is not the
         deposit against market value, it is EVERYTHING RANKING AHEAD OF IT
         plus the deposit:

             (선순위 채권최고액 + 보증금) ÷ 시세

         The deposit-only figure was actively dangerous: a 2억 deposit on a
         3억 property reads 66.7% — under the 70% threshold, rendered in the
         green panel — while a 2억 senior mortgage puts true exposure at 133%.

         So the lien is required. When it is unknown we return a ratio of
         null and a reason, and the view shows the formula instead of a
         number. A missing input must never become a reassuring output.
         ------------------------------------------------------------------ */
      var ratio = null;
      var ratioBasis = null;
      var deposit = isUsable(ctx.deposit) ? ctx.deposit : null;
      var market = isUsable(ctx.market) && ctx.market > 0 ? ctx.market : null;
      var lien = isUsable(ctx.lien) ? ctx.lien : null;

      if (deposit === null || market === null) {
        ratioBasis = 'no-values';
      } else if (lien === null) {
        ratioBasis = 'no-lien';       /* we will not guess that it is zero */
      } else {
        ratio = Math.round(((lien + deposit) / market) * 1000) / 10;
        ratioBasis = 'full';
        if (ratio >= 80) score += 25;
        else if (ratio >= 70) score += 15;
      }

      score = Math.min(100, score);

      /* ------------------------------------------------------------------
         A clean result has to be EARNED.

         A keyword engine can prove the presence of a known tactic. It can
         never prove absence of fraud — so "we found nothing" is only
         meaningful when there was enough to look at. Two characters of chat
         used to return the same verdict as a fully checked conversation.

         Below the evidence floor the answer is `insufficient`, which says
         plainly that the input was too thin to judge.
         ------------------------------------------------------------------ */
      var EVIDENCE_CHARS = 60;   /* about three sentences of Korean, which is dense */
      var EVIDENCE_CHECKS = 3;   /* or a meaningful pass over the documents */
      /* An explicit "아니오" is evidence too — the user looked and found
         nothing. Counting only risks meant a careful check that came back
         clean looked identical to no check at all. */
      var answered = opts.answered || docRisks.length;
      var enoughEvidence =
        norm.length >= EVIDENCE_CHARS || answered >= EVIDENCE_CHECKS;

      /* ------------------------------------------------------------------
         The verdict comes from the EVIDENCE, not from a running total.

         Summing keyword hits meant a single explicit "전입신고 하지 마세요" —
         a direct instruction to skip the one step that protects the deposit
         — scored 25 and landed in the same generic "caution" bucket as two
         vague matches, because `high` began at 35. Severity now sets an
         action priority per signal, and one `strong` signal is enough.

         The numeric score is kept for diagnostics and tuning, but it is no
         longer what decides what the user is told.
         ------------------------------------------------------------------ */
      var scored = matches.filter(function (m) { return m.points > 0; });
      scored.forEach(function (m) {
        var sev = m.pattern.severity || 0;
        m.priority = sev >= 5 ? 'strong' : (sev >= 3 ? 'review' : 'info');
        /* Reported speech is real evidence, but one step removed from
           being observed, so it does not on its own reach `strong`. */
        if (m.reported && m.priority === 'strong') m.priority = 'review';
      });

      /* A ticked document risk is evidence in exactly the same sense as a
         matched message, and must reach the verdict. Feeding it only into
         the hidden score meant answering 예 to "신탁 기재가 있습니까" — on its
         own a reason to stop — left the verdict reading "no known signals". */
      docRisks.forEach(function (d) {
        d.priority = d.weight >= 30 ? 'strong' : (d.weight >= 20 ? 'review' : 'info');
      });

      var strong = scored.filter(function (m) { return m.priority === 'strong'; }).length +
                   docRisks.filter(function (d) { return d.priority === 'strong'; }).length;
      var review = scored.filter(function (m) { return m.priority === 'review'; }).length +
                   docRisks.filter(function (d) { return d.priority === 'review'; }).length;

      var level;
      if (strong >= 1 || score >= th.veryHigh) level = 'veryhigh';
      else if (review >= 2 || score >= th.high) level = 'high';
      else if (review >= 1 || scored.length >= 1 || score >= th.caution) level = 'caution';
      else level = enoughEvidence ? 'safe' : 'insufficient';

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
        messages: messages,
        suppressed: suppressed,
        priorities: { strong: strong, review: review },
        /* The public-facing state. `level` stays for internal tuning and for
           the CSS class, but what the user is told comes from this, which
           names an outcome rather than a severity band. */
        assessment: (function () {
          var found = scored.length + docRisks.length;
          if (!enoughEvidence && !found) return 'insufficient_information';
          if (strong >= 1) return 'strong_warning_signals';
          if (found) return 'needs_review';
          return 'no_known_signals';
        })(),
        ratioBasis: ratioBasis,
        evidence: { chars: norm.length, checks: answered,
                    risks: docRisks.length, enough: enoughEvidence },
        hasText: norm.length > 0
      };
    }
  };

  global.Analyzer = Analyzer;
})(window);
