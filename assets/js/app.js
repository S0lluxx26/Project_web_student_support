/* app.js — data loading, hash router, step navigation, language wiring */
(function (global) {
  'use strict';

  var App = {
    ready: false,

    /* Core files the app cannot run without, and optional ones that power a
       single feature. A failure in `goshiwon.json` used to take down the
       whole application, because everything was loaded in one Promise.all. */
    CORE: ['data/i18n.json', 'data/patterns.json', 'data/documents.json'],
    OPTIONAL: ['data/goshiwon.json', 'data/lexicon.json', 'data/examples.json'],

    fetchJson: function (file) {
      var controller = new AbortController();
      var timer = global.setTimeout(function () { controller.abort(); }, 8000);
      /* Every failure path must name the file. A network rejection throws a
         bare "Failed to fetch" with no URL, so the error the user sees said
         nothing about which resource was missing. */
      return fetch(file, { cache: 'no-cache', signal: controller.signal })
        .catch(function (err) {
          throw new Error(file + ': ' + (err && err.message || 'network error'));
        })
        .then(function (r) {
          if (!r.ok) throw new Error(file + ': HTTP ' + r.status);
          return r.json().catch(function () {
            throw new Error(file + ': invalid JSON');
          });
        }).finally(function () { global.clearTimeout(timer); });
    },

    boot: function () {
      var self = this;
      this.degraded = [];

      Promise.all(this.CORE.map(function (f) { return self.fetchJson(f); }))
        .then(function (core) {
          I18n.load(core[0]);
          Analyzer.load(core[1]);
          I18n.apply();

          /* Optional resources settle independently: one failure disables
             its own feature and says so, rather than blanking the app. */
          return Promise.all(self.OPTIONAL.map(function (f) {
            return self.fetchJson(f).catch(function (err) {
              console.error(err);
              self.degraded.push(f);
              return null;
            });
          })).then(function (extra) {
            return { core: core, extra: extra };
          });
        })
        .then(function (all) {
          var goshiwon = all.extra[0], lexicon = all.extra[1], examples = all.extra[2];

          if (lexicon) Analyzer.loadFuzzy(lexicon);
          Housing.examples = examples;
          Housing.init(all.core[2]);
          if (goshiwon) Goshiwon.init(goshiwon);

          self.bind();
          self.route();
          self.ready = true;
          document.body.setAttribute('data-ready', 'true');
          if (self.degraded.length) self.showDegraded();
        })
        .catch(function (err) {
          console.error(err);
          self.showFatal(err);
        });
    },

    /**
     * A core file failed. Say which one, stop pretending the controls work,
     * and offer a retry — the usual cause is a dropped connection, not a
     * broken build.
     */
    showFatal: function (err) {
      var self = this;
      var m = document.getElementById('main');
      if (!m) return;
      document.body.setAttribute('data-ready', 'failed');
      Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) {
        v.hidden = true;
      });
      var box = document.createElement('div');
      box.className = 'panel panel-danger';
      box.setAttribute('role', 'alert');
      box.innerHTML =
        '<h2 class="h3">앱을 불러오지 못했습니다 · Could not load the app</h2>' +
        '<p>필요한 파일을 불러오지 못해 분석을 시작할 수 없습니다.<br>' +
        'A required file could not be loaded, so nothing can be analysed.</p>' +
        '<p class="note"><code></code></p>' +
        '<div class="actions"><button class="btn btn-primary" type="button" ' +
        'id="btn-retry-boot">다시 시도 · Retry</button></div>';
      box.querySelector('code').textContent = String(err && err.message || err);
      m.insertBefore(box, m.firstChild);
      var btn = box.querySelector('#btn-retry-boot');
      btn.addEventListener('click', function () {
        box.remove();
        document.body.removeAttribute('data-ready');
        self.boot();
      });
      btn.focus();
    },

    /** An optional file failed: name the feature that is now unavailable. */
    showDegraded: function () {
      var m = document.getElementById('main');
      if (!m) return;
      var box = document.createElement('div');
      box.className = 'panel panel-warn no-print';
      box.setAttribute('role', 'status');
      var names = this.degraded.map(function (f) {
        return f.replace('data/', '').replace('.json', '');
      }).join(', ');
      box.innerHTML = '<p>일부 기능을 불러오지 못했습니다 (' + names + '). ' +
        '대화 분석은 정상적으로 동작합니다.<br>' +
        'Some features could not be loaded (' + names + '). ' +
        'Conversation checking still works.</p>';
      m.insertBefore(box, m.firstChild);
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
        self.syncActionBar();
      });

      /* Rotating the phone or switching language changes the bar's height. */
      var resizeTimer = null;
      global.addEventListener('resize', function () {
        global.clearTimeout(resizeTimer);
        resizeTimer = global.setTimeout(function () { self.syncActionBar(); }, 120);
      });
      global.addEventListener('orientationchange', function () {
        global.setTimeout(function () { self.syncActionBar(); }, 250);
      });

      /* Step buttons inside the housing flow. */
      document.addEventListener('click', function (e) {
        var h = e.target.closest('[data-goto-step]');
        if (h) { self.gotoStep(Number(h.getAttribute('data-goto-step'))); return; }
        var g = e.target.closest('[data-gosi-step]');
        if (g) { self.gotoGosiStep(Number(g.getAttribute('data-gosi-step'))); }
      });

      global.addEventListener('hashchange', function () {
        /* A hash we wrote ourselves has already been applied. */
        if (self.suppressRoute) { self.suppressRoute = false; return; }
        self.route();
      });
    },

    /* Step names in the URL, so a step survives a reload, a language switch
       and the back button. Without this the router reset the step to 0
       immediately after any code-driven navigation. */
    STEP_NAMES: ['start', 'documents', 'conversation', 'contract', 'result'],

    stepFromHash: function (hash) {
      var part = hash.split('/')[2];
      if (!part) return null;
      var i = this.STEP_NAMES.indexOf(part);
      return i === -1 ? null : i;
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

      if (view === 'housing') {
        var step = this.stepFromHash(hash);
        this.gotoStep(step === null ? 0 : step, true);
      }
      if (view === 'goshiwon') this.gotoGosiStep(1, true);
      if (view === 'home') this.syncActionBar();

      /* Move focus to the new heading so a keyboard or screen-reader user
         lands where the content changed, not back at the top of the tab
         order. */
      this.focusView(view);
      global.scrollTo({ top: 0, behavior: 'auto' });
    },

    focusView: function (view) {
      var el = document.getElementById('view-' + view);
      if (!el) return;
      var h = el.querySelector('h1');
      if (!h) return;
      if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
      /* Deferred so the pane is visible before focus moves. */
      global.setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 0);
    },

    gotoStep: function (n, silent) {
      // A direct entry from the landing page must reveal the housing view too.
      // The hash event below is suppressed because this navigation is applied
      // synchronously, so it cannot be relied on to reveal the parent later.
      if (!silent) {
        ['home', 'housing', 'goshiwon'].forEach(function (view) {
          var el = document.getElementById('view-' + view);
          if (el) el.hidden = view !== 'housing';
        });
      }
      /* The result is derived from every input across steps 1-3, so it is
         recomputed whenever it is opened — including by a rail jump that
         skips the analyze button. */
      if (n === 4 && global.Housing && Housing.runAnalysis) Housing.runAnalysis();

      [0, 1, 2, 3, 4].forEach(function (i) {
        var pane = document.getElementById('housing-step-' + i);
        if (pane) pane.hidden = (i !== n);
      });
      /* The rail is meaningless on the entry gate — there is no step yet. */
      var rail = document.getElementById('housing-steps');
      if (rail) rail.hidden = (n === 0);
      Array.prototype.forEach.call(
        document.querySelectorAll('#housing-steps li'),
        function (li) {
          var s = Number(li.getAttribute('data-step'));
          var active = s === n;
          li.classList.toggle('is-active', active);
          li.classList.toggle('is-visited', s < n);
          var btn = li.querySelector('button');
          if (btn) {
            /* aria-current tells a screen reader which step it is on; the
               visual highlight alone says nothing. */
            if (active) btn.setAttribute('aria-current', 'step');
            else btn.removeAttribute('aria-current');
          }
        }
      );
      this.syncActionBar();

      /* Keep the URL truthful. `silent` means we were called BY the router,
         so rewriting the hash there would loop. */
      if (!silent) {
        var want = '#/housing/' + this.STEP_NAMES[n];
        if (global.location.hash !== want) {
          this.suppressRoute = true;
          global.location.hash = want;
        }
        global.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },

    gotoGosiStep: function (n, silent) {
      [1, 2, 3, 4].forEach(function (i) {
        var pane = document.getElementById('gosi-step-' + i);
        if (pane) pane.hidden = (i !== n);
      });
      this.syncActionBar();
      if (!silent) global.scrollTo({ top: 0, behavior: 'smooth' });
    },

    /**
     * On phones `.actions-sticky` is a fixed bar at the bottom of the screen,
     * so the page needs bottom padding — but only while a visible pane
     * actually has one. Mark the body accordingly.
     */
    syncActionBar: function () {
      var bars = document.querySelectorAll('.actions-sticky');
      var active = null;
      Array.prototype.forEach.call(bars, function (bar) {
        /* getClientRects, not offsetParent: a position:fixed element
           always reports a null offsetParent even while on screen. */
        if (bar.getClientRects().length > 0) active = bar;

        /* Stack when two or more buttons carry sentence-length labels —
           side by side they would wrap mid-word on a narrow screen. */
        var btns = bar.querySelectorAll('.btn');
        var longOnes = 0;
        Array.prototype.forEach.call(btns, function (b) {
          if ((b.textContent || '').trim().length > 12) longOnes++;
        });
        bar.classList.toggle('is-stacked', btns.length > 1 && longOnes >= 2);
      });

      document.body.classList.toggle('has-actionbar', !!active);
      if (active) {
        document.body.style.setProperty(
          '--actionbar-h', Math.ceil(active.getBoundingClientRect().height) + 'px');
      } else {
        document.body.style.removeProperty('--actionbar-h');
      }
    }
  };

  global.App = App;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { App.boot(); });
  } else {
    App.boot();
  }
})(window);
