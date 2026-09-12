/* Shared, local-only theme preference. Apply before CSS to avoid a flash. */
(function () {
  'use strict';
  var key = 'shsa.theme', saved = null;
  var media = window.matchMedia('(prefers-color-scheme: dark)');
  try { saved = localStorage.getItem(key); } catch (_) {}
  function apply() {
    var dark = saved === 'dark' || (saved !== 'light' && media.matches);
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.setAttribute('aria-pressed', String(dark));
      button.textContent = document.documentElement.lang === 'ko' ? '어두운 화면' : 'Dark mode';
    });
  }
  apply();
  document.addEventListener('DOMContentLoaded', function () {
    apply();
    document.querySelectorAll('[data-theme-toggle]').forEach(function (button) {
      button.addEventListener('click', function () {
        saved = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        try { localStorage.setItem(key, saved); } catch (_) {}
        apply();
      });
    });
    new MutationObserver(apply).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  });
  if (media.addEventListener) media.addEventListener('change', apply);
  window.addEventListener('storage', function (event) { if (event.key === key) { saved = event.newValue; apply(); } });
})();
