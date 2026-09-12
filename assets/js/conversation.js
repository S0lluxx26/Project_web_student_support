/* ==========================================================================
   conversation.js — turn pasted text into messages with speakers
   ==========================================================================

   The analyzer used to receive one undifferentiated string, which is the
   root cause of a whole class of false positives:

     "Tenant: I will not pay now."        -> flagged as payment pressure
     "Tenant: Is insurance possible?"     -> flagged as insurance refused

   A tenant asking a question or refusing to pay is the opposite of a
   warning sign, but a substring search cannot tell the difference. So the
   unit of analysis becomes a MESSAGE, carrying who said it and what kind of
   utterance it is.

   Three things are derived here, and all three are explicitly uncertain by
   default — an unlabeled line is `unknown`, never `landlord`, because
   guessing the speaker is how you manufacture evidence:

     speaker  tenant | landlord | agent | manager | unknown
     act      demand | question | denial | refusal | statement
     reported whether the speaker is quoting someone else

   Reported speech matters: "집주인이 전입신고 하지 말라고 했어요" is spoken by
   the tenant but is evidence about the landlord. It is kept, and marked as
   reported rather than directly observed.
   ========================================================================== */

(function (global) {
  'use strict';

  /* Speaker labels as they appear in real pastes and KakaoTalk exports. */
  var ROLE_LABELS = [
    { role: 'landlord', forms: ['집주인', '임대인', '건물주', '주인', '소유자', 'landlord', 'owner', 'lessor'] },
    { role: 'agent',    forms: ['중개사', '부동산', '공인중개사', '중개인', 'agent', 'broker', 'realtor'] },
    { role: 'manager',  forms: ['관리자', '관리인', '총무', '원장', 'manager', 'admin'] },
    { role: 'tenant',   forms: ['세입자', '임차인', '학생', '저', '나', '본인', 'tenant', 'me', 'i', 'student', 'renter'] }
  ];

  /* Phrases that mark the sentence as a report of what someone else said. */
  var REPORTED = [
    '라고 했', '라고 하', '라고 함', '라고 해', '하라고', '래요', '랍니다', '한대요', '했대',
    '라던데', '라고 들었', '말씀하셨', '하셨어요', '하셨습니다', '요구했', '요구하셨',
    'told me', 'said that', 'says that', 'asked me to', 'wants me to', 'is asking me to',
    'he said', 'she said', 'they said', 'according to'
  ];

  /* Questions: Korean interrogative endings plus the obvious punctuation. */
  var QUESTION = [
    '나요', '까요', '가요', '는지', '는가', '습니까', '입니까', '있나', '되나', '될까',
    '어때', '어떻게', '뭔가요', '맞나', '맞죠', '인가요'
  ];

  /* First-person refusals — the speaker declining, not demanding. */
  var REFUSAL = [
    '안 할게', '안할게', '못 해', '못해', '안 하겠', '안하겠', '거절', '싫습니다', '싫어요',
    '안 보낼', '안보낼', '못 보내', '못보내', '안 내겠', '하지 않겠',
    'i will not', "i won't", 'i refuse', 'i am not going to',
    "i'm not going to", 'i cannot', 'i can not'
  ];

  /* Assertions that something does NOT exist / IS permitted. These are the
     opposite of the risk the pattern describes, and must suppress it. */
  var DENIAL = [
    '없습니다', '없어요', '없고', '없으며', '아닙니다', '아니에요', '아니라', '해당 없',
    '문제없', '문제 없', '가능합니다', '가능해요', '가능한가', '가능합니까', '됩니다', '돼요',
    'there is no', 'there are no', 'no problem with', 'is possible', 'are possible',
    'is available', 'is fine', 'not a problem', 'without any'
  ];

  var Conversation = {

    roleLabels: ROLE_LABELS,

    /** Normalize for matching: fold case, drop spacing. */
    _norm: function (s) {
      return String(s == null ? '' : s).toLowerCase().replace(/\s+/g, '');
    },

    _any: function (normText, list) {
      for (var i = 0; i < list.length; i++) {
        if (normText.indexOf(this._norm(list[i])) !== -1) return list[i];
      }
      return null;
    },

    /**
     * Map a speaker label to a role. Longest form first so "공인중개사"
     * doesn't resolve via "중개사" into a different bucket by accident, and
     * so the short tenant aliases ("저", "나") cannot swallow longer names.
     */
    roleFor: function (label) {
      var n = this._norm(label);
      if (!n) return 'unknown';
      var best = null;
      ROLE_LABELS.forEach(function (entry) {
        entry.forms.forEach(function (f) {
          var nf = f.toLowerCase().replace(/\s+/g, '');
          // A personal name containing "i", "me" or "나" is not a role.
          // Permit explicit compound labels such as "집주인 김씨" only for
          // descriptive role names; personal aliases must match exactly.
          var escaped = f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          var descriptive = nf.length > 2;
          var boundary = new RegExp('(^|[\\s(\\[])(?:' + escaped + ')(?=$|[\\s)\\]님:：-])', 'i');
          if (n === nf || (descriptive && boundary.test(String(label))) ||
              (nf === '부동산' && /^[가-힣]{1,10}부동산$/.test(n))) {
            if (!best || nf.length > best.len) best = { role: entry.role, len: nf.length };
          }
        });
      });
      return best ? best.role : 'unknown';
    },

    /**
     * Split raw text into messages.
     *
     * Recognised shapes, in order of specificity:
     *   [이름] [오후 3:21] 내용      KakaoTalk export
     *   2026. 9. 12. 오후 3:21, 이름 : 내용
     *   집주인: 내용                 plain label
     *   내용                        unlabeled -> speaker unknown
     *
     * A line that does not announce a speaker continues the previous
     * message, so a multi-line message stays one message.
     */
    parse: function (text) {
      var lines = String(text || '').split(/\r\n|\r|\n/);
      var messages = [];
      var offset = 0;
      var self = this;

      lines.forEach(function (line, idx) {
        var lineStart = offset;
        offset += line.length + 1;                 /* +1 for the newline */

        var trimmed = line.trim();
        if (!trimmed) return;

        var label = null, body = null, bodyOffset = 0;

        /* [이름] [오후 3:21] 내용 */
        var kakao = trimmed.match(/^\[([^\]]{1,40})\]\s*\[([^\]]{1,30})\]\s*([\s\S]*)$/);
        if (kakao) {
          label = kakao[1];
          body = kakao[3];
          bodyOffset = line.indexOf(body, line.indexOf(kakao[2]));
        }

        /* 2026. 9. 12. 오후 3:21, 이름 : 내용 */
        var dated = null;
        if (!kakao) {
          dated = trimmed.match(/^[\d.\s:]+(?:오전|오후|am|pm)?[\d\s:]*,\s*([^:]{1,40}?)\s*:\s*([\s\S]*)$/i);
          if (dated) {
            label = dated[1];
            body = dated[2];
            bodyOffset = line.indexOf(body);
          }
        }

        /* 집주인: 내용 — but not a bare URL or a time like "3:21 ..." */
        if (label === null) {
          var plain = trimmed.match(/^([^:：]{1,24})\s*[:：]\s*([\s\S]*)$/);
          if (plain && !/^https?$/i.test(plain[1]) && !/^\d{1,2}$/.test(plain[1].trim())) {
            label = plain[1];
            body = plain[2];
            bodyOffset = line.indexOf(body);
          }
        }

        if (label !== null && body !== null && body.trim()) {
          var m = self._make(messages.length, self.roleFor(label), label.trim(),
                             body.trim(), lineStart + Math.max(bodyOffset, 0));
          /* A timestamped export marks message boundaries unambiguously, so
             a following unlabelled line is a wrap of this message. A plain
             "집주인: …" paste gives no such guarantee. */
          m.strictFormat = !!(kakao || dated);
          messages.push(m);
          return;
        }

        /* A line only continues the previous message when that message
           announced a speaker — a labelled message can wrap onto further
           lines. Two consecutive UNLABELLED lines are two messages: in a
           pasted chat each line is its own turn, and merging them hid
           separate statements behind a single speaker selector. */
        var prev = messages[messages.length - 1];
        if (prev && prev.strictFormat && label === null) {
          prev.text += '\n' + trimmed;
          prev.act = self.speechAct(prev.text);
          prev.reported = self.isReported(prev.text);
          return;
        }
        messages.push(self._make(messages.length, 'unknown', null, trimmed,
                                 lineStart + (line.length - line.trimStart().length)));
      });

      return messages;
    },

    _make: function (i, role, label, text, offset) {
      return {
        id: 'm' + i,
        speaker: role,
        speakerLabel: label,
        speakerConfirmed: role !== 'unknown',
        text: text,
        offset: offset,
        act: this.speechAct(text),
        reported: this.isReported(text)
      };
    },

    /** Is this message quoting what someone else said or demanded? */
    isReported: function (text) {
      return !!this._any(this._norm(text), REPORTED);
    },

    /**
     * Classify the utterance. Order matters: a question mark beats an
     * imperative reading, and an explicit denial beats a plain statement.
     */
    speechAct: function (text) {
      var raw = String(text || '').trim();
      var n = this._norm(raw);

      if (this.isQuestion(raw)) return 'question';
      if (this._any(n, REFUSAL)) return 'refusal';
      if (this.denialPhrase(raw)) return 'denial';
      return 'statement';
    },

    /**
     * A question ends interrogatively. Searching the whole string matched
     * "사람이니까요" via the ending "까요" and classified a plain statement as
     * a question — so only the tail of the text is considered.
     */
    isQuestion: function (text) {
      var raw = String(text || '').trim();
      if (/[?？]\s*$/.test(raw)) return true;

      /* Only the final clause can make the whole message a question. */
      var lastClause = raw.split(/[.!。\n]/).filter(function (x) { return x.trim(); }).pop() || raw;
      var tail = this._norm(lastClause).slice(-8);

      /* -(으)니까(요) is causal, not interrogative. Without this exclusion
         "제가 믿을 만한 사람이니까요" ends in "까요" and the whole message —
         an insurance refusal — was dismissed as a question. */
      if (/니까요?$/.test(tail)) return false;

      return !!this._any(tail, QUESTION);
    },

    /** A polite request is still a demand when it explicitly asks the other
     * person to transfer money. A tenant's own request is gated separately. */
    isPaymentRequest: function (text) {
      var n = this._norm(text);
      return /(?:입금|송금|이체)해주(?:시|실|겠|세|면)|(?:계약금|보증금|돈|가계약금).*?(?:보내|넣어)주(?:시|실|겠|세|면)/.test(n) ||
        /\b(?:can|could|would|will)\s+you\s+(?:please\s+)?(?:pay\b|(?:send|transfer)\b.{0,50}\b(?:deposit|money|payment|funds|fee|sum)\b)/i.test(text);
    },

    /**
     * The denial phrase that fired, or null.
     *
     * "환불은 절대 안 됩니다" contains "됩니다", but it prohibits rather than
     * denies — reading it as a denial suppressed the very signal it is. So a
     * marker immediately preceded by a negator does not count.
     */
    denialPhrase: function (text) {
      var n = this._norm(text);
      var self = this;
      for (var i = 0; i < DENIAL.length; i++) {
        var form = self._norm(DENIAL[i]);
        var at = n.indexOf(form);
        while (at !== -1) {
          var before = n.slice(Math.max(0, at - 2), at);
          if (!/안$|못$|잘$/.test(before)) return DENIAL[i];
          at = n.indexOf(form, at + 1);
        }
      }
      return null;
    },

    /**
     * Would a risk signal spoken by this speaker be evidence about the
     * other side? A tenant's own words are evidence only when they are
     * reporting what the landlord or agent said.
     */
    countsAsCounterparty: function (message) {
      if (!message) return false;
      if (message.speaker === 'tenant') return !!message.reported;
      return true;   /* landlord, agent, manager, or unknown */
    }
  };

  global.Conversation = Conversation;
  if (typeof module !== 'undefined' && module.exports) module.exports = Conversation;
})(typeof window !== 'undefined' ? window : globalThis);
