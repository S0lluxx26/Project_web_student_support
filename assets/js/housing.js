/* housing.js — independent-housing flow: document checklist, analysis, report */
(function (global) {
  'use strict';

  var SAMPLE = {
    ko: '안녕하세요, 어제 보신 원룸 문의 주셔서 연락드려요.\n' +
        '오늘 가계약금 100만원만 먼저 입금해주시면 방 잡아드릴게요. 다른 분도 보고 계셔서 오늘 안 하면 어려워요.\n' +
        '등기부등본은 계약할 때 보여드릴 테니 걱정 마세요. 사진은 찍지 마시고요.\n' +
        '집주인이 해외에 계셔서 제가 대신 계약합니다. 위임장은 나중에 드릴게요.\n' +
        '근저당 2억 있는데 잔금 받아서 바로 갚을 거니까 괜찮아요.\n' +
        '입금은 제 개인 계좌로 보내주시면 됩니다. 그리고 대출 때문에 전입신고는 한 달만 미뤄주세요.',
    en: 'Hi, following up on the one-room you saw yesterday.\n' +
        'If you pay now — just a 1,000,000 won deposit first — I will hold the room. Someone else is looking at it, so today only.\n' +
        'I will show you the property register when we sign, so don\'t worry. Please don\'t photograph anything.\n' +
        'The owner is abroad so I am signing on behalf of the owner; power of attorney later.\n' +
        'There is a mortgage on it but I will clear it later with your money, so it is fine.\n' +
        'Send it to my personal account. And please delay the move-in report for a month because of my loan.'
  };

  var Housing = {
    docs: null,
    files: {},
    photoUrls: [],
    lastResult: null,

    init: function (docsData) {
      this.docs = docsData;
      this.renderDocs();
      this.renderContract();
      this.bind();
    },

    /* ---------- step 3: contract photo + guided checklist ---------- */
    renderContract: function () {
      var cc = this.docs.contractChecklist;
      var root = document.getElementById('contract-checks');
      var intro = document.getElementById('contract-intro');
      if (!cc || !root) return;
      var pick = I18n.pick.bind(I18n);
      if (intro) intro.textContent = pick(cc.intro);
      root.innerHTML = (cc.items || []).map(function (it) {
        return Housing.answerRow(it.id, it.weight, pick(it.q),
                                 it.hint ? pick(it.hint) : null);
      }).join('');
    },

    bindContractPhoto: function () {
      var self = this;
      var input = document.getElementById('contract-photo');
      var out = document.getElementById('contract-preview');
      if (!input || !out) return;
      input.addEventListener('change', function () {
        /* Object URLs are revoked before rebuilding so repeated picks
           don't leak. Nothing is read, parsed or uploaded — the photo is
           only shown so the user can read their own contract on screen. */
        self.photoUrls.forEach(function (u) { URL.revokeObjectURL(u); });
        self.photoUrls = [];
        out.innerHTML = '';
        Array.prototype.forEach.call(input.files || [], function (f) {
          if (!/^image\//.test(f.type)) return;
          var url = URL.createObjectURL(f);
          self.photoUrls.push(url);
          var fig = document.createElement('figure');
          fig.className = 'photo';
          fig.innerHTML = '<img src="' + url + '" alt="">' +
            '<figcaption>' + esc(f.name) + '</figcaption>';
          out.appendChild(fig);
        });
      });
    },

    /**
     * Re-rendering a list replaces its DOM, which would silently discard
     * whatever the user had ticked, expanded or attached. Every render path
     * therefore snapshots that state first and restores it afterwards —
     * losing a ticked risk would quietly lower the score the user is
     * relying on.
     */
    snapshotState: function () {
      var checked = {};
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-doc-answer]:checked'),
        function (r) { checked[r.getAttribute('data-doc-answer')] = r.value; }
      );
      var open = {};
      Array.prototype.forEach.call(
        document.querySelectorAll('details.doc[open]'),
        function (d) { if (d.dataset.docId) open[d.dataset.docId] = true; }
      );
      return { checked: checked, open: open };
    },

    restoreState: function (snap) {
      if (!snap) return;
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-doc-answer]'),
        function (r) {
          var want = snap.checked[r.getAttribute('data-doc-answer')] || 'unknown';
          r.checked = (r.value === want);
        }
      );
      Array.prototype.forEach.call(
        document.querySelectorAll('details.doc'),
        function (d) { if (snap.open[d.dataset.docId]) d.open = true; }
      );
      /* Attached file names live only in our own map — the File objects
         cannot be re-assigned to a fresh <input type="file">. */
      var self = this;
      Object.keys(this.files).forEach(function (id) {
        var out = document.querySelector('[data-file-names="' + id + '"]');
        if (out && self.files[id] && self.files[id].length) {
          out.textContent = '✓ ' + self.files[id].join(', ');
        }
      });
    },

    /* ---------- step 1: documents ---------- */
    renderDocs: function () {
      var root = document.getElementById('doc-list');
      if (!root) return;
      var t = I18n.t.bind(I18n), pick = I18n.pick.bind(I18n);
      root.innerHTML = '';

      (this.docs.documents || []).forEach(function (doc, idx) {
        var d = document.createElement('details');
        d.className = 'doc';
        d.dataset.docId = doc.id;
        if (idx === 0) d.open = true;

        var checksHtml = (doc.questions || []).map(function (q) {
          return Housing.answerRow(q.id, q.weight, pick(q.q));
        }).join('');

        var checkItems = (pick(doc.check) || []).map(function (c) {
          return '<li>' + esc(c) + '</li>';
        }).join('');

        d.innerHTML =
          '<summary><span class="tag ' + (doc.required ? 'tag-req' : 'tag-opt') + '">' +
            esc(t(doc.required ? 'housing.docs.required' : 'housing.docs.optional')) +
          '</span><span>' + esc(pick(doc.name)) + '</span></summary>' +
          '<div class="doc-body">' +
            '<p>' + esc(pick(doc.desc)) + '</p>' +
            '<dl><dt>' + esc(t('housing.docs.where')) + '</dt><dd>' + esc(pick(doc.where)) + '</dd></dl>' +
            '<dl><dt>' + esc(t('housing.docs.check')) + '</dt>' +
              '<dd><ul class="bullets">' + checkItems + '</ul></dd></dl>' +
            (checksHtml
              ? '<dl><dt>' + esc(t('housing.docs.questions')) + '</dt>' +
                '<dd><div class="checks">' + checksHtml + '</div></dd></dl>'
              : '') +
            '<div class="file-row"><label>' + esc(t('housing.docs.attach')) +
              '<input type="file" multiple data-doc-file="' + esc(doc.id) + '"></label>' +
              '<div class="file-names" data-file-names="' + esc(doc.id) + '"></div>' +
            '</div>' +
          '</div>';
        root.appendChild(d);
      });

      /* File inputs: never uploaded anywhere — we only read name and size. */
      var self = this;
      Array.prototype.forEach.call(root.querySelectorAll('[data-doc-file]'), function (input) {
        input.addEventListener('change', function () {
          var id = input.getAttribute('data-doc-file');
          var names = Array.prototype.map.call(input.files || [], function (f) {
            return f.name + ' (' + Math.round(f.size / 1024) + ' KB)';
          });
          self.files[id] = names;
          var out = root.querySelector('[data-file-names="' + id + '"]');
          if (out) out.textContent = names.length ? '✓ ' + names.join(', ') : '';
        });
      });
    },

    /**
     * One question, four answers.
     *
     * An unticked checkbox conflated two very different states: "I checked
     * and it's fine" and "I haven't looked". The first is evidence; the
     * second is a gap in coverage. Only an explicit 예 counts as a risk, and
     * 모름 is the default so nothing is assumed on the user's behalf.
     */
    answerRow: function (id, weight, question, hint) {
      var t = I18n.t.bind(I18n);
      var opts = ['yes', 'no', 'na', 'unknown'];
      return '<div class="answer" role="group" aria-labelledby="q-' + esc(id) + '">' +
        '<p class="answer-q" id="q-' + esc(id) + '">' + esc(question) + '</p>' +
        (hint ? '<p class="check-hint-text">' + esc(hint) + '</p>' : '') +
        '<div class="answer-opts">' + opts.map(function (v) {
          return '<label class="answer-opt opt-' + v + '">' +
            '<input type="radio" name="ans-' + esc(id) + '" value="' + v + '"' +
            ' data-doc-answer="' + esc(id) + '" data-weight="' + weight + '"' +
            (v === 'unknown' ? ' checked' : '') + '>' +
            '<span>' + esc(t('answer.' + v)) + '</span></label>';
        }).join('') + '</div></div>';
    },

    /** Every answered question, including the ones answered "no". */
    collectDocAnswers: function () {
      var out = {};
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-doc-answer]:checked'),
        function (r) { out[r.getAttribute('data-doc-answer')] = r.value; }
      );
      return out;
    },

    collectDocRisks: function () {
      var pick = I18n.pick.bind(I18n);
      var byId = {};
      (this.docs.documents || []).forEach(function (doc) {
        (doc.questions || []).forEach(function (q) { byId[q.id] = pick(q.q); });
      });
      ((this.docs.contractChecklist || {}).items || []).forEach(function (it) {
        byId[it.id] = pick(it.q);
      });
      var out = [];
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-doc-answer]:checked'),
        function (r) {
          if (r.value !== 'yes') return;   /* 아니오 / 해당없음 / 모름 are not risks */
          var id = r.getAttribute('data-doc-answer');
          out.push({ id: id, weight: Number(r.getAttribute('data-weight')) || 10,
                     label: byId[id] || id });
        }
      );
      return out;
    },

    /* ---------- step 2 + 3: analysis and report ---------- */
    bind: function () {
      var self = this;

      on('btn-sample', 'click', function () {
        var ta = document.getElementById('chat-input');
        ta.value = SAMPLE[I18n.lang] || SAMPLE.ko;
        ta.focus();
      });

      on('btn-clear', 'click', function () {
        document.getElementById('chat-input').value = '';
        hide('chat-error');
      });

      on('btn-analyze', 'click', function () {
        var text = (document.getElementById('chat-input').value || '').trim();
        var docRisks = self.collectDocRisks();
        if (!text && !docRisks.length) {
          show('chat-error');
          return;
        }
        hide('chat-error');
        self.runAnalysis();
        global.App.gotoStep(3);
      });

      on('btn-to-result', 'click', function () {
        self.runAnalysis();
        global.App.gotoStep(4);
      });

      this.bindContractPhoto();

      /* Copy and share open a preview first. Nothing leaves the device
         until the user has seen exactly what would leave. */
      on('btn-copy', 'click', function () { self.openExport('copy'); });

      on('btn-print', 'click', function () { global.print(); });

      if (global.navigator && navigator.share) {
        var shareBtn = document.getElementById('btn-share');
        if (shareBtn) {
          shareBtn.hidden = false;
          shareBtn.addEventListener('click', function () { self.openExport('share'); });
        }
      }

      /* ---- the landing-page checker: paste, press, read the report ---- */
      on('btn-home-analyze', 'click', function () {
        var ta = document.getElementById('home-chat');
        var text = (ta && ta.value || '').trim();
        if (!text) { show('home-chat-error'); if (ta) ta.focus(); return; }
        hide('home-chat-error');

        /* Carry the text into the conversation step so the two inputs are
           one input, and every later edit happens in one place. */
        var target = document.getElementById('chat-input');
        if (target) target.value = ta.value;

        var type = document.querySelector('[name="home-housing-type"]:checked');
        self.housingType = type ? type.value : 'unknown';

        self.runAnalysis();
        global.location.hash = '#/housing/result';
      });

      on('btn-home-clear', 'click', function () {
        var ta = document.getElementById('home-chat');
        if (ta) { ta.value = ''; ta.focus(); }
        hide('home-chat-error');
      });

      on('btn-home-example', 'click', function () { self.offerExample(); });
      on('btn-reset', 'click', function () { self.resetSession(); });

      /* Speaker corrections re-run the analysis against the same text. */
      document.addEventListener('change', function (e) {
        if (e.target && e.target.matches('[data-speaker-for]')) self.speakerEdited = true;
      });
      document.addEventListener('click', function (e) {
        var b = e.target.closest && e.target.closest('#btn-apply-speakers');
        if (b) { self.applySpeakers(); }
      });
    },

    /** Load one of the fictional examples, confirming before overwriting. */
    offerExample: function () {
      var self = this;
      var list = (this.examples && this.examples.examples) || [];
      if (!list.length) return;
      var ta = document.getElementById('home-chat');
      var pick = I18n.pick.bind(I18n);

      var host = document.getElementById('example-picker');
      if (host) { host.remove(); return; }

      host = document.createElement('div');
      host.id = 'example-picker';
      host.className = 'panel panel-muted';
      host.innerHTML = '<h3 class="h4">' + esc(I18n.t('example.pick')) + '</h3>' +
        '<div class="actions">' + list.map(function (ex) {
          return '<button class="btn btn-ghost btn-sm" type="button" data-example="' +
            esc(ex.id) + '">' + esc(pick(ex.label)) + '</button>';
        }).join('') + '</div>';

      var anchor = document.getElementById('btn-home-example');
      anchor.parentNode.parentNode.insertBefore(host, anchor.parentNode.nextSibling);

      host.addEventListener('click', function (e) {
        var b = e.target.closest('[data-example]');
        if (!b) return;
        var ex = list.filter(function (x) { return x.id === b.getAttribute('data-example'); })[0];
        if (!ex) return;
        /* Never silently discard something the user typed. */
        if (ta.value.trim() && !global.confirm(I18n.t('example.replace'))) return;
        ta.value = pick(ex.text);
        host.remove();
        ta.focus();
      });
    },

    /**
     * Clear the whole session, not just the visible textarea.
     *
     * "Clear text" empties one field. This releases everything derived from
     * the user's input: attached file names, contract photo object URLs,
     * every ticked check, the context numbers and the computed report. On a
     * shared machine the difference matters.
     */
    resetSession: function () {
      ['home-chat', 'chat-input', 'ctx-deposit', 'ctx-market', 'ctx-lien'].forEach(function (id) {
        var e = document.getElementById(id);
        if (e) e.value = '';
      });
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-doc-answer]'),
        function (r) { r.checked = (r.value === 'unknown'); }
      );
      Array.prototype.forEach.call(
        document.querySelectorAll('input[type=file]'),
        function (f) { try { f.value = ''; } catch (err) { /* older browsers */ } }
      );
      this.photoUrls.forEach(function (u) { URL.revokeObjectURL(u); });
      this.photoUrls = [];
      this.files = {};
      this.lastResult = null;
      this.lastCtx = null;
      this.badNumbers = [];
      this.speakerOverrides = {};

      var prev = document.getElementById('contract-preview');
      if (prev) prev.innerHTML = '';
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-file-names]'),
        function (n) { n.textContent = ''; }
      );
      var root = document.getElementById('result-root');
      if (root) root.innerHTML = '';
      hide('chat-error'); hide('home-chat-error');
      toast(I18n.t('reset.done'));
    },

    /** Re-analyze after the user corrects who said what. */
    applySpeakers: function () {
      var self = this;
      this.speakerOverrides = this.speakerOverrides || {};
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-speaker-for]'),
        function (sel) { self.speakerOverrides[sel.getAttribute('data-speaker-for')] = sel.value; }
      );
      this.runAnalysis();
      var root = document.getElementById('result-root');
      if (root) root.focus();
    },

    /** Re-read every input and recompute. Safe to call repeatedly. */
    runAnalysis: function () {
      var text = (document.getElementById('chat-input') || {}).value || '';
      var ctx = {
        deposit: numOrNull('ctx-deposit'),
        rent: numOrNull('ctx-rent'),
        market: numOrNull('ctx-market'),
        lien: numOrNull('ctx-lien'),
        who: (document.getElementById('ctx-who') || {}).value
      };
      var docRisks = this.collectDocRisks();
      this.lastCtx = ctx;
      this.badNumbers = invalidNumericFields();
      var answers = this.collectDocAnswers();
      var answered = Object.keys(answers).filter(function (k) {
        return answers[k] !== 'unknown';
      }).length;
      this.lastResult = Analyzer.analyze(text.trim(), ctx, docRisks,
                                         { speakers: this.speakerOverrides || {},
                                           answered: answered });
      this.lastResult.docAnswers = answers;
      this.lastResult.answered = answered;
      /* "Nothing was entered" and "what you entered looks clean" are very
         different messages. Conflating them hands a reassuring verdict to
         someone who has not actually been checked. */
      /* "Empty" means the user gave us nothing to look at — not that we
         found nothing. Answering 아니오 to every question IS input, and
         measuring emptiness by risks alone discarded a careful clean check
         as if the user had done nothing. */
      this.lastResult.empty = !text.trim() && answered === 0;
      this.renderResult();
      return this.lastResult;
    },

    /**
     * Export preview: show what would leave the device, with obvious
     * identifiers already masked, and let the user edit before sending.
     *
     * `mode` is 'copy' or 'share'. The redaction is best effort — it cannot
     * reliably find a Korean personal name — so the preview is editable and
     * says so rather than implying the text is now safe.
     */
    openExport: function (mode) {
      var self = this;
      var t = I18n.t.bind(I18n);
      var raw = this.reportText();
      var red = global.Redact ? Redact.apply(raw) : { text: raw, found: [] };

      var old = document.getElementById('export-preview');
      if (old) old.remove();

      var box = document.createElement('div');
      box.id = 'export-preview';
      box.className = 'panel export-preview no-print';
      box.innerHTML =
        '<h3 class="h3">' + esc(t('export.title')) + '</h3>' +
        '<p class="field-hint">' + esc(t('export.body')) + '</p>' +
        (red.found.length
          ? '<p class="field-hint export-found">' + esc(t('export.masked')) + ' ' +
            red.found.map(function (f) {
              return esc(I18n.pick(f.label)) + ' ' + f.count;
            }).join(' · ') + '</p>'
          : '<p class="field-hint">' + esc(t('export.nothing')) + '</p>') +
        '<label class="field"><span class="field-label">' + esc(t('export.editable')) +
          '</span><textarea id="export-text" rows="12"></textarea></label>' +
        '<div class="actions">' +
          '<button class="btn btn-primary" type="button" id="export-go">' +
            esc(t(mode === 'share' ? 'export.share' : 'export.copy')) + '</button>' +
          '<button class="btn btn-ghost" type="button" id="export-raw">' +
            esc(t('export.unmasked')) + '</button>' +
          '<button class="btn btn-ghost" type="button" id="export-cancel">' +
            esc(t('export.cancel')) + '</button>' +
        '</div>';

      var root = document.getElementById('result-root');
      root.parentNode.insertBefore(box, root.nextSibling);
      var ta = document.getElementById('export-text');
      ta.value = red.text;
      ta.focus();

      box.querySelector('#export-cancel').addEventListener('click', function () {
        box.remove();
        var back = document.getElementById('btn-copy');
        if (back) back.focus();
      });

      box.querySelector('#export-raw').addEventListener('click', function (e) {
        /* Deliberately including a detail is a legitimate choice — the user
           may need the account number in the very message they are asking
           someone else about. It just has to be a choice. */
        ta.value = raw;
        e.target.disabled = true;
        ta.focus();
      });

      box.querySelector('#export-go').addEventListener('click', function () {
        var text = ta.value;
        if (mode === 'share' && global.navigator && navigator.share) {
          navigator.share({ title: I18n.t('share.title'), text: text })
            .then(function () { box.remove(); })
            .catch(function (err) {
              if (err && err.name !== 'AbortError') copyText(text, 'result.copied');
            });
        } else {
          copyText(text, 'result.copied');
          box.remove();
        }
      });
    },

    /** Escape the quote, then wrap the matched ranges in <mark>. */
    markQuote: function (quote, rangeList) {
      if (!rangeList || !rangeList.length) return esc(quote);
      var out = '', prev = 0;
      rangeList.forEach(function (g) {
        out += esc(quote.slice(prev, g.start)) +
               '<mark>' + esc(quote.slice(g.start, g.end)) + '</mark>';
        prev = g.end;
      });
      return out + esc(quote.slice(prev));
    },

    renderResult: function () {
      var r = this.lastResult;
      var root = document.getElementById('result-root');
      if (!r || !root) return;
      var t = I18n.t.bind(I18n), pick = I18n.pick.bind(I18n);
      var self = this;
      var html = '';

      if (r.empty) {
        root.innerHTML =
          '<div class="panel panel-warn"><h2 class="h3">' + esc(t('result.empty.title')) +
          '</h2><p>' + esc(t('result.empty.body')) + '</p>' +
          '<div class="actions"><button class="btn btn-primary btn-sm" type="button" ' +
          'data-goto-step="2">' + esc(t('result.empty.cta')) + '</button>' +
          '<button class="btn btn-ghost btn-sm" type="button" data-goto-step="1">' +
          esc(t('result.empty.cta2')) + '</button></div></div>' +
          '<div class="panel panel-before"><h2 class="h3">' +
          esc(t('result.before.title')) + '</h2><ol class="numbered">' +
          ['result.before.1', 'result.before.2', 'result.before.3', 'result.before.4']
            .map(function (k) { return '<li>' + esc(t(k)) + '</li>'; }).join('') +
          '</ol></div>';
        return;
      }

      /* ---- 1. Summary: what to do, not what a rule weighed ---------- */
      var a = r.assessment || 'no_known_signals';
      var scoredList = r.matches.filter(function (m) { return m.points > 0; });
      var findings = scoredList.length + r.docRisks.length;
      html += '<div class="verdict v-' + esc(a) + '">' +
        '<h2>' + esc(t('assess.' + a)) + '</h2>' +
        '<p class="verdict-count">' +
          esc(findings ? t('summary.count', { n: findings }) : t('summary.none')) +
        '</p>' +
        '<p>' + esc(t('assess.' + a + '.msg')) + '</p>' +
      '</div>';

      /* ---- 2. Coverage: what the verdict is actually based on -------- */
      var unknownSpeakers = (r.messages || []).filter(function (m) {
        return m.speaker === 'unknown';
      }).length;
      var cov = [];
      cov.push(t('coverage.messages', { n: (r.messages || []).length }));
      if (unknownSpeakers) cov.push(t('coverage.unknown', { n: unknownSpeakers }));
      if (r.answered) {
        cov.push(t('coverage.answered', { n: r.answered }));
        cov.push(t('coverage.docrisks', { n: r.docRisks.length }));
      } else {
        cov.push(t('coverage.nodocs'));
      }
      if (r.suppressed && r.suppressed.length) {
        cov.push(t('coverage.suppressed', { n: r.suppressed.length }));
      }
      html += '<div class="panel panel-muted coverage"><h3 class="h4">' +
        esc(t('coverage.title')) + '</h3><ul class="bullets">' +
        cov.map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
        '</ul>';

      /* Speaker correction lives here because it is a coverage problem:
         an unknown speaker is a limit on what can be concluded. */
      if (unknownSpeakers && (r.messages || []).length <= 40) {
        html += '<details class="speakers"><summary>' + esc(t('speakers.title')) +
          '</summary><p class="field-hint">' + esc(t('speakers.body')) + '</p>' +
          (r.messages || []).map(function (m) {
            return '<label class="speaker-row">' +
              '<select data-speaker-for="' + esc(m.id) + '">' +
                ['unknown', 'landlord', 'agent', 'manager', 'tenant'].map(function (role) {
                  return '<option value="' + role + '"' +
                    (m.speaker === role ? ' selected' : '') + '>' +
                    esc(t('result.speaker.' + role)) + '</option>';
                }).join('') +
              '</select>' +
              '<span class="speaker-text">' + esc(m.text.slice(0, 90)) +
              (m.text.length > 90 ? '…' : '') + '</span></label>';
          }).join('') +
          '<div class="actions"><button class="btn btn-primary btn-sm" type="button" ' +
          'id="btn-apply-speakers">' + esc(t('speakers.apply')) + '</button></div></details>';
      }
      html += '</div>';

      /* ---- 3. What to do regardless of the verdict --------------------
         Shown on every result, including a clean one. "No known signals" is
         exactly when someone is most likely to skip these four steps. */
      html += '<div class="panel panel-before"><h2 class="h3">' +
        esc(t('result.before.title')) + '</h2><ol class="numbered">' +
        ['result.before.1', 'result.before.2', 'result.before.3', 'result.before.4']
          .map(function (k) { return '<li>' + esc(t(k)) + '</li>'; }).join('') +
        '</ol></div>';

      if (r.ratioBasis === 'full' && r.ratio !== null) {
        var warn = r.ratio >= 70;
        html += '<div class="panel ' + (warn ? 'panel-warn' : 'panel-ok') + '">' +
          '<h3 class="h3">' + esc(t('result.ltv')) + '</h3>' +
          '<p><strong>' + esc(t('result.ltv.body', { pct: r.ratio })) + '</strong></p>' +
          '<p>' + esc(t(warn ? 'result.ltv.warn' : 'result.ltv.ok')) + '</p></div>';
      } else if (r.ratioBasis === 'no-lien') {
        html += '<div class="panel panel-warn">' +
          '<h3 class="h3">' + esc(t('result.ltv.unknown')) + '</h3>' +
          '<p>' + esc(t('result.ltv.unknown.body')) + '</p>' +
          '<p class="do">' + esc(t('result.ltv.unknown.how')) + '</p></div>';
      }

      if (this.badNumbers && this.badNumbers.length) {
        html += '<p class="error">' + esc(t('result.badnum')) + '</p>';
      }

      if (r.docRisks.length) {
        html += '<h2 class="h3">' + esc(t('result.docsignals')) + '</h2><div class="panel panel-warn"><ul class="bullets">' +
          r.docRisks.map(function (d) { return '<li>' + esc(d.label) + '</li>'; }).join('') +
          '</ul></div>';
      }

      var scored = r.matches.filter(function (m) { return m.points > 0; });
      if (scored.length) {
        html += '<h2 class="h3">' + esc(t('result.evidence.title')) + '</h2>';
        scored.forEach(function (m) {
          var p = m.pattern;
          html += '<div class="signal sev-' + p.severity + '">' +
            '<h3>' + esc(pick(p.title)) +
              '<span class="sev-badge pri-' + esc(m.priority || 'info') + '">' +
                esc(t('result.priority.' + (m.priority || 'info'))) + '</span>' +
              (m.speaker && m.speaker !== 'unknown'
                ? '<span class="sev-badge">' + esc(t('result.speaker.' + m.speaker)) + '</span>' : '') +
              (m.reported ? '<span class="sev-badge">' + esc(t('result.reported')) + '</span>' : '') +
              (m.fuzzy ? '<span class="fuzzy-badge">' + esc(t('result.fuzzy')) + '</span>' : '') +
            '</h3>' +
            (m.quote
              ? '<span class="quote">“' + self.markQuote(m.quote, m.quoteRanges) + '”</span>'
              : '') +
            '<p class="label">' + esc(t('result.why')) + '</p><p>' + esc(pick(p.why)) + '</p>' +
            '<p class="label">' + esc(t('result.action')) + '</p><p class="do">' + esc(pick(p.action)) + '</p>' +
          '</div>';
        });
      }

      if (r.questions.length) {
        html += '<h2 class="h3">' + esc(t('result.nextq')) + '</h2><ol class="q-list">' +
          r.questions.map(function (q) { return '<li><span>' + esc(q) + '</span></li>'; }).join('') +
          '</ol>';
      }

      html += '<p class="note">' + esc(t('footer.disclaimer')) + '</p>';
      root.innerHTML = html;
    },

    reportText: function () {
      var r = this.lastResult;
      if (!r) return '';
      var t = I18n.t.bind(I18n), pick = I18n.pick.bind(I18n);
      var L = [];
      L.push('# ' + t('site.title') + ' — ' + t('result.heading'));
      L.push(new Date().toLocaleString());
      L.push('');
      /* Screen and export must state the same thing. The empty case used to
         render an insufficient-information panel on screen while exporting
         "No known signals (0/100)" — a completed-assessment claim about a
         conversation that was never analysed. One branch now serves both. */
      if (r.empty) {
        L.push(t('result.empty.title'));
        L.push(t('result.empty.body'));
        L.push('');
        L.push('## ' + t('result.before.title'));
        ['result.before.1', 'result.before.2', 'result.before.3', 'result.before.4']
          .forEach(function (k, i) { L.push((i + 1) + '. ' + t(k)); });
        L.push('');
        L.push(t('footer.disclaimer'));
        return L.join('\n');
      }

      var a = r.assessment || 'no_known_signals';
      var n = r.matches.filter(function (m) { return m.points > 0; }).length +
              r.docRisks.length;
      L.push(t('assess.' + a));
      L.push(n ? t('summary.count', { n: n }) : t('summary.none'));
      L.push(t('assess.' + a + '.msg'));
      L.push('');
      L.push('## ' + t('coverage.title'));
      L.push('- ' + t('coverage.messages', { n: (r.messages || []).length }));
      var unknown = (r.messages || []).filter(function (m) {
        return m.speaker === 'unknown';
      }).length;
      if (unknown) L.push('- ' + t('coverage.unknown', { n: unknown }));
      L.push('- ' + (r.answered
        ? t('coverage.answered', { n: r.answered }) + ', ' +
          t('coverage.docrisks', { n: r.docRisks.length })
        : t('coverage.nodocs')));
      L.push('');
      L.push('## ' + t('result.before.title'));
      ['result.before.1', 'result.before.2', 'result.before.3', 'result.before.4']
        .forEach(function (k, i) { L.push((i + 1) + '. ' + t(k)); });

      if (r.ratioBasis === 'full' && r.ratio !== null) {
        L.push('');
        L.push(t('result.ltv') + ': ' + t('result.ltv.body', { pct: r.ratio }));
      } else if (r.ratioBasis === 'no-lien') {
        L.push('');
        L.push(t('result.ltv.unknown') + ' — ' + t('result.ltv.unknown.how'));
      }
      if (r.docRisks.length) {
        L.push('');
        L.push('## ' + t('result.docsignals'));
        r.docRisks.forEach(function (d) { L.push('- ' + d.label); });
      }
      var scored = r.matches.filter(function (m) { return m.points > 0; });
      if (scored.length) {
        L.push('');
        L.push('## ' + t('result.evidence.title'));
        scored.forEach(function (m) {
          L.push('');
          L.push('### [' + (m.priority || 'info') + '] ' + pick(m.pattern.title) +
                 (m.reported ? ' (' + t('result.reported') + ')' : ''));
          if (m.quote) L.push('> ' + m.quote);
          L.push(t('result.why') + ': ' + pick(m.pattern.why));
          L.push(t('result.action') + ': ' + pick(m.pattern.action));
        });
      }
      if (r.questions.length) {
        L.push('');
        L.push('## ' + t('result.nextq'));
        r.questions.forEach(function (q, i) { L.push((i + 1) + '. ' + q); });
      }
      L.push('');
      L.push(t('footer.disclaimer'));
      return L.join('\n');
    },

    /* Re-render both steps after a language switch. */
    refresh: function () {
      var snap = this.snapshotState();
      this.renderDocs();
      this.renderContract();
      this.restoreState(snap);
      if (this.lastResult) this.runAnalysis();
    }
  };

  /* ---------- small helpers shared with goshiwon.js ---------- */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function on(id, ev, fn) {
    var el = document.getElementById(id);
    if (el) el.addEventListener(ev, fn);
  }
  function show(id) { var e = document.getElementById(id); if (e) e.hidden = false; }
  function hide(id) { var e = document.getElementById(id); if (e) e.hidden = true; }
  /**
   * Read a numeric field as either a finite non-negative number or null.
   *
   * null means "not supplied" and is deliberately distinct from 0 — for the
   * senior-debt field, "I don't know" and "there is no lien" lead to
   * completely different advice, and collapsing them to 0 is what made the
   * old deposit-only ratio dangerous.
   *
   * Anything that is not a finite number >= 0 (a negative, 1e999, a value a
   * browser lets through) returns null rather than silently becoming 0.
   */
  function numOrNull(id) {
    var e = document.getElementById(id);
    if (!e || e.value === '' || e.value == null) return null;
    var v = Number(e.value);
    if (!isFinite(v) || v < 0) return null;
    return v;
  }

  /** Which numeric fields hold a value the browser accepted but we cannot use. */
  function invalidNumericFields() {
    return ['ctx-deposit', 'ctx-rent', 'ctx-market', 'ctx-lien'].filter(function (id) {
      var e = document.getElementById(id);
      if (!e || e.value === '') return false;
      var v = Number(e.value);
      return !isFinite(v) || v < 0;
    });
  }
  function copyText(text, toastKey) {
    var done = function () { toast(I18n.t(toastKey)); };
    if (global.navigator && navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    } else { fallback(); }
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { /* ignore */ }
      document.body.removeChild(ta);
    }
  }
  /**
   * Native share sheet where the browser has one (phones), clipboard
   * otherwise. `btn` is revealed only when sharing is actually available,
   * so desktop users don't get a button that silently does nothing.
   */
  function enableShare(btnId, getText) {
    var btn = document.getElementById(btnId);
    if (!btn) return;
    if (!(global.navigator && navigator.share)) return;
    btn.hidden = false;
    btn.addEventListener('click', function () {
      var text = getText();
      if (!text) return;
      navigator.share({ title: I18n.t('share.title'), text: text })
        .catch(function (err) {
          /* AbortError just means the user dismissed the sheet. */
          if (err && err.name !== 'AbortError') copyText(text, 'result.copied');
        });
    });
  }

  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
  }

  global.Util = {
    esc: esc, on: on, show: show, hide: hide,
    copyText: copyText, toast: toast, enableShare: enableShare
  };
  global.Housing = Housing;
})(window);
