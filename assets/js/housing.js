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
    lastResult: null,

    init: function (docsData) {
      this.docs = docsData;
      this.renderDocs();
      this.bind();
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
        if (idx === 0) d.open = true;

        var checksHtml = (doc.questions || []).map(function (q) {
          return '<label class="check">' +
            '<input type="checkbox" data-doc-risk="' + q.id + '" data-weight="' + q.weight + '">' +
            '<span>' + esc(pick(q.q)) + '</span></label>';
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

    collectDocRisks: function () {
      var pick = I18n.pick.bind(I18n);
      var byId = {};
      (this.docs.documents || []).forEach(function (doc) {
        (doc.questions || []).forEach(function (q) { byId[q.id] = pick(q.q); });
      });
      var out = [];
      Array.prototype.forEach.call(
        document.querySelectorAll('[data-doc-risk]:checked'),
        function (cb) {
          var id = cb.getAttribute('data-doc-risk');
          out.push({ id: id, weight: Number(cb.getAttribute('data-weight')) || 10, label: byId[id] || id });
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
        var ctx = {
          deposit: num('ctx-deposit'),
          rent: num('ctx-rent'),
          market: num('ctx-market'),
          who: (document.getElementById('ctx-who') || {}).value
        };
        self.lastResult = Analyzer.analyze(text, ctx, docRisks);
        self.lastCtx = ctx;
        self.renderResult();
        global.App.gotoStep(3);
      });

      on('btn-copy', 'click', function () {
        copyText(self.reportText(), 'result.copied');
      });

      on('btn-print', 'click', function () { global.print(); });
    },

    renderResult: function () {
      var r = this.lastResult;
      var root = document.getElementById('result-root');
      if (!r || !root) return;
      var t = I18n.t.bind(I18n), pick = I18n.pick.bind(I18n);
      var html = '';

      html += '<div class="score-card lv-' + r.level + '">' +
        '<div class="score-dial">' + r.score + '</div>' +
        '<div class="score-text">' +
          '<h2>' + esc(t('result.level.' + r.level)) + '</h2>' +
          '<p>' + esc(t('result.level.' + r.level + '.msg')) + '</p>' +
          '<p class="score-meta">' + esc(t('result.score')) + ': ' + r.score + ' / 100</p>' +
        '</div></div>';

      if (r.ratio !== null) {
        var warn = r.ratio >= 70;
        html += '<div class="panel ' + (warn ? 'panel-warn' : 'panel-ok') + '">' +
          '<h3 class="h3">' + esc(t('result.ltv')) + '</h3>' +
          '<p>' + esc(t('result.ltv.body', { pct: r.ratio })) + '</p>' +
          '<p>' + esc(t(warn ? 'result.ltv.warn' : 'result.ltv.ok')) + '</p></div>';
      }

      if (r.docRisks.length) {
        html += '<h2 class="h3">' + esc(t('result.docsignals')) + '</h2><div class="panel panel-warn"><ul class="bullets">' +
          r.docRisks.map(function (d) { return '<li>' + esc(d.label) + '</li>'; }).join('') +
          '</ul></div>';
      }

      var scored = r.matches.filter(function (m) { return m.points > 0; });
      if (scored.length) {
        html += '<h2 class="h3">' + esc(t('result.signals')) + ' (' + scored.length + ')</h2>';
        scored.forEach(function (m) {
          var p = m.pattern;
          html += '<div class="signal sev-' + p.severity + '">' +
            '<h3>' + esc(pick(p.title)) +
              '<span class="sev-badge">' + esc(t('common.severity')) + ' ' + p.severity + '/5</span></h3>' +
            (m.quote ? '<span class="quote">“' + esc(m.quote) + '”</span>' : '') +
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
      L.push(t('result.level') + ': ' + t('result.level.' + r.level) + ' (' + r.score + '/100)');
      L.push(t('result.level.' + r.level + '.msg'));
      if (r.ratio !== null) {
        L.push('');
        L.push(t('result.ltv') + ': ' + t('result.ltv.body', { pct: r.ratio }));
      }
      if (r.docRisks.length) {
        L.push('');
        L.push('## ' + t('result.docsignals'));
        r.docRisks.forEach(function (d) { L.push('- ' + d.label); });
      }
      var scored = r.matches.filter(function (m) { return m.points > 0; });
      if (scored.length) {
        L.push('');
        L.push('## ' + t('result.signals'));
        scored.forEach(function (m) {
          L.push('');
          L.push('### [' + m.pattern.severity + '/5] ' + pick(m.pattern.title));
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
      this.renderDocs();
      if (this.lastResult) {
        this.lastResult = Analyzer.analyze(
          (document.getElementById('chat-input') || {}).value || '',
          this.lastCtx || {},
          this.collectDocRisks()
        );
        this.renderResult();
      }
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
  function num(id) {
    var e = document.getElementById(id);
    return e && e.value !== '' ? Number(e.value) : 0;
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
  function toast(msg) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function () { el.remove(); }, 2000);
  }

  global.Util = { esc: esc, on: on, show: show, hide: hide, copyText: copyText, toast: toast };
  global.Housing = Housing;
})(window);
