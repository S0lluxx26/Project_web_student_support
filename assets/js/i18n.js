/* i18n.js — language loading and DOM translation */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'shsa.lang';
  var SUPPORTED = ['ko', 'en'];

  var I18n = {
    lang: 'ko',
    strings: {},
    listeners: [],

    detect: function () {
      var saved = null;
      try { saved = localStorage.getItem(STORAGE_KEY); } catch (e) { /* private mode */ }
      if (saved && SUPPORTED.indexOf(saved) !== -1) return saved;
      var nav = (global.navigator && (navigator.language || navigator.userLanguage)) || 'ko';
      return nav.toLowerCase().indexOf('ko') === 0 ? 'ko' : 'en';
    },

    load: function (strings) {
      this.strings = strings || {};
      this.lang = this.detect();
      return this.lang;
    },

    /** Translate a key; falls back to the other language, then the key itself. */
    t: function (key, vars) {
      var table = this.strings[this.lang] || {};
      var out = table[key];
      if (out === undefined) {
        var other = this.lang === 'ko' ? 'en' : 'ko';
        out = (this.strings[other] || {})[key];
      }
      if (out === undefined) return key;
      if (vars) {
        out = out.replace(/\{(\w+)\}/g, function (m, name) {
          return vars[name] !== undefined ? vars[name] : m;
        });
      }
      return out;
    },

    /** Pick the right half of a {ko, en} object. */
    pick: function (obj) {
      if (obj === null || obj === undefined) return '';
      if (typeof obj === 'string') return obj;
      var v = obj[this.lang];
      if (v === undefined || v === null) v = obj[this.lang === 'ko' ? 'en' : 'ko'];
      return v === undefined || v === null ? '' : v;
    },

    set: function (lang) {
      if (SUPPORTED.indexOf(lang) === -1) return;
      this.lang = lang;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch (e) { /* ignore */ }
      this.apply();
      this.listeners.forEach(function (fn) { try { fn(lang); } catch (e) { console.error(e); } });
    },

    toggle: function () { this.set(this.lang === 'ko' ? 'en' : 'ko'); },

    onChange: function (fn) { this.listeners.push(fn); },

    /** Apply translations to every [data-i18n] / [data-i18n-ph] node in a root. */
    apply: function (root) {
      var scope = root || document;
      var self = this;
      Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n]'), function (el) {
        el.textContent = self.t(el.getAttribute('data-i18n'));
      });
      Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-ph]'), function (el) {
        el.setAttribute('placeholder', self.t(el.getAttribute('data-i18n-ph')));
      });
      Array.prototype.forEach.call(scope.querySelectorAll('[data-i18n-aria]'), function (el) {
        el.setAttribute('aria-label', self.t(el.getAttribute('data-i18n-aria')));
      });
      if (!root) {
        document.documentElement.setAttribute('lang', this.lang);
        var title = this.t('site.title');
        if (title && title !== 'site.title') document.title = title;
      }
    }
  };

  global.I18n = I18n;
})(window);
