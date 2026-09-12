/* goshiwon.js — visit-first flow, condition questionnaire, question generator */
(function (global) {
  'use strict';

  var Goshiwon = {
    data: null,
    answers: { needs: [] },
    generated: null,

    init: function (data) {
      this.data = data;
      this.renderVisit();
      this.renderConditions();
      this.renderDeposit();
      this.bind();
    },

    renderVisit: function () {
      var ul = document.getElementById('visit-checklist');
      if (!ul) return;
      ul.innerHTML = (I18n.pick(this.data.visitChecklist) || [])
        .map(function (s) { return '<li>' + Util.esc(s) + '</li>'; }).join('');
    },

    renderDeposit: function () {
      var ol = document.getElementById('deposit-advice');
      if (!ol) return;
      ol.innerHTML = (I18n.pick(this.data.depositAdvice) || [])
        .map(function (s) { return '<li>' + Util.esc(s) + '</li>'; }).join('');
    },

    renderConditions: function () {
      var root = document.getElementById('gosi-conditions');
      if (!root) return;
      var pick = I18n.pick.bind(I18n);
      var self = this;
      root.innerHTML = (this.data.conditions || []).map(function (c) {
        var opts = (c.options || []).map(function (o) {
          var checked = c.type === 'multi'
            ? (self.answers.needs.indexOf(o.value) !== -1)
            : (self.answers[c.id] === o.value);
          return '<label class="opt">' +
            '<input type="' + (c.type === 'multi' ? 'checkbox' : 'radio') + '"' +
              ' name="gosi-' + Util.esc(c.id) + '"' +
              ' value="' + Util.esc(o.value) + '"' +
              (checked ? ' checked' : '') + '>' +
            '<span>' + Util.esc(pick(o.label)) + '</span></label>';
        }).join('');
        return '<fieldset><legend>' + Util.esc(pick(c.label)) + '</legend>' +
          '<div class="opt-grid">' + opts + '</div></fieldset>';
      }).join('');
    },

    readAnswers: function () {
      var a = { needs: [] };
      (this.data.conditions || []).forEach(function (c) {
        var inputs = document.querySelectorAll('[name="gosi-' + c.id + '"]:checked');
        if (c.type === 'multi') {
          a[c.id] = Array.prototype.map.call(inputs, function (i) { return i.value; });
        } else {
          a[c.id] = inputs.length ? inputs[0].value : null;
        }
      });
      if (!Array.isArray(a.needs)) a.needs = [];
      this.answers = a;
      return a;
    },

    /** Select conditional question blocks whose `when` clause matches the answers. */
    generate: function () {
      var a = this.readAnswers();
      var lang = I18n.lang;
      var qs = this.data.questions || {};
      var universal = (qs.universal && (qs.universal[lang] || qs.universal.ko)) || [];
      var conditional = [];

      (qs.conditional || []).forEach(function (block) {
        var matched = Object.keys(block.when || {}).some(function (key) {
          var want = block.when[key];
          var got = a[key];
          if (Array.isArray(got)) return got.some(function (g) { return want.indexOf(g) !== -1; });
          return got !== null && got !== undefined && want.indexOf(got) !== -1;
        });
        if (!matched) return;
        (block[lang] || block.ko || []).forEach(function (q) {
          if (conditional.indexOf(q) === -1 && universal.indexOf(q) === -1) conditional.push(q);
        });
      });

      this.generated = { universal: universal, conditional: conditional };
      return this.generated;
    },

    renderQuestions: function () {
      var root = document.getElementById('gosi-questions');
      var g = this.generated;
      if (!root || !g) return;
      var t = I18n.t.bind(I18n);
      var html = '<div class="q-group"><h3 class="h3">' + Util.esc(t('gosi.q.universal')) + '</h3><ol class="q-list">' +
        g.universal.map(function (q) { return '<li><span>' + Util.esc(q) + '</span></li>'; }).join('') +
        '</ol></div>';
      if (g.conditional.length) {
        html += '<div class="q-group"><h3 class="h3">' + Util.esc(t('gosi.q.conditional')) + '</h3><ol class="q-list">' +
          g.conditional.map(function (q) { return '<li><span>' + Util.esc(q) + '</span></li>'; }).join('') +
          '</ol></div>';
      }
      root.innerHTML = html;
    },

    questionsText: function () {
      var g = this.generated;
      if (!g) return '';
      var t = I18n.t.bind(I18n);
      var L = [t('gosi.q.heading'), ''];
      var n = 1;
      L.push('[' + t('gosi.q.universal') + ']');
      g.universal.forEach(function (q) { L.push((n++) + '. ' + q); });
      if (g.conditional.length) {
        L.push('');
        L.push('[' + t('gosi.q.conditional') + ']');
        g.conditional.forEach(function (q) { L.push((n++) + '. ' + q); });
      }
      return L.join('\n');
    },

    bind: function () {
      var self = this;

      Util.on('btn-can-visit', 'click', function () {
        Util.show('can-visit-msg');
        document.getElementById('can-visit-msg').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });

      Util.on('btn-cannot-visit', 'click', function () { global.App.gotoGosiStep(2); });
      Util.on('btn-visit-to-deposit', 'click', function () { global.App.gotoGosiStep(4); });

      Util.on('btn-gen-questions', 'click', function () {
        self.generate();
        self.renderQuestions();
        global.App.gotoGosiStep(3);
      });

      Util.on('btn-to-deposit', 'click', function () { global.App.gotoGosiStep(4); });
      Util.on('btn-copy-questions', 'click', function () {
        Util.copyText(self.questionsText(), 'result.copied');
      });
      Util.on('btn-print-questions', 'click', function () { global.print(); });
      Util.enableShare('btn-share-questions', function () { return self.questionsText(); });
      Util.on('btn-print-deposit', 'click', function () { global.print(); });
    },

    refresh: function () {
      if (!this.data) return;   /* never initialised: its data file failed */
      /* Read the DOM back into `answers` first: re-rendering the fieldsets
         discards the radio/checkbox state, and `answers` is otherwise only
         refreshed when the user presses Generate. */
      if (document.querySelector('#gosi-conditions input')) this.readAnswers();
      this.renderVisit();
      this.renderDeposit();
      this.renderConditions();
      if (this.generated) { this.generate(); this.renderQuestions(); }
    }
  };

  global.Goshiwon = Goshiwon;
})(window);
