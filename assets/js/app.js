/* app.js — data loading, hash router, step navigation, language wiring */
(function (global) {
  'use strict';

  var App = {
    ready: false,

    boot: function () {
      var files = ['data/i18n.json', 'data/patterns.json', 'data/documents.json', 'data/goshiwon.json'];
      Promise.all(files.map(function (f) {
        return fetch(f, { cache: 'no-cache' }).then(function (r) {
          if (!r.ok) throw new Error(f + ': HTTP ' + r.status);
          return r.json();
        });
      })).then(function (res) {
        I18n.load(res[0]);
        Analyzer.load(res[1]);
        I18n.apply();
        Housing.init(res[2]);
        Goshiwon.init(res[3]);
        App.bind();
        App.route();
        App.ready = true;
        document.body.setAttribute('data-ready', 'true');
      }).catch(function (err) {
        console.error(err);
        var m = document.getElementById('main');
        if (m) {
          m.insertAdjacentHTML('afterbegin',
            '<div class="panel panel-danger"><p>데이터를 불러올 수 없습니다. 페이지를 새로고침해 주세요.<br>' +
            'Could not load site data. Please reload the page.</p></div>');
        }
      });
    },

    bind: function () {
      var self = this;

      document.getElementById('lang-toggle').addEventListener('click', function () {
        I18n.toggle();
      });

      I18n.onChange(function () {
        I18n.apply();
        Housing.refresh();
        Goshiwon.refresh();
      });

      /* Step buttons inside the housing flow. */
      document.addEventListener('click', function (e) {
        var h = e.target.closest('[data-goto-step]');
        if (h) { self.gotoStep(Number(h.getAttribute('data-goto-step'))); return; }
        var g = e.target.closest('[data-gosi-step]');
        if (g) { self.gotoGosiStep(Number(g.getAttribute('data-gosi-step'))); }
      });

      global.addEventListener('hashchange', function () { self.route(); });
    },

    route: function () {
      var hash = (global.location.hash || '#/').replace(/^#/, '');
      var view = 'home';
      if (hash.indexOf('/housing') === 0) view = 'housing';
      else if (hash.indexOf('/goshiwon') === 0) view = 'goshiwon';

      ['home', 'housing', 'goshiwon'].forEach(function (v) {
        var el = document.getElementById('view-' + v);
        if (el) el.hidden = (v !== view);
      });

      if (view === 'housing') this.gotoStep(1, true);
      if (view === 'goshiwon') this.gotoGosiStep(1, true);
      global.scrollTo({ top: 0, behavior: 'auto' });
    },

    gotoStep: function (n, silent) {
      [1, 2, 3].forEach(function (i) {
        var pane = document.getElementById('housing-step-' + i);
        if (pane) pane.hidden = (i !== n);
      });
      Array.prototype.forEach.call(
        document.querySelectorAll('#housing-steps li'),
        function (li) {
          var s = Number(li.getAttribute('data-step'));
          li.classList.toggle('is-active', s === n);
          li.classList.toggle('is-done', s < n);
        }
      );
      if (!silent) global.scrollTo({ top: 0, behavior: 'smooth' });
    },

    gotoGosiStep: function (n, silent) {
      [1, 2, 3, 4].forEach(function (i) {
        var pane = document.getElementById('gosi-step-' + i);
        if (pane) pane.hidden = (i !== n);
      });
      if (!silent) global.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  global.App = App;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.boot(); });
  } else {
    App.boot();
  }
})(window);
