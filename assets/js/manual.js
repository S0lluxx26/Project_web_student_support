/* The guide loads no OCR or LLM runtime. Its captures are static, dated evidence. */
(function () {
  'use strict';
  var saved; try { saved = localStorage.getItem('shsa.lang'); } catch (_) {}
  var lang = saved === 'ko' || saved === 'en' ? saved : /^ko/i.test(navigator.language) ? 'ko' : 'en';
  var records;
  function render() {
    document.documentElement.lang = lang;
    document.title = lang === 'ko' ? '데모 · 사용법 | 학생 주거 안전 도우미' : 'Demo & user guide | Student Housing Safety Assistant';
    document.getElementById('manual-language').textContent = lang === 'ko' ? 'English' : '한국어';
    if (!records) return;
    ['pressure', 'ordinary'].forEach(function (id) {
      var item = records.cases.find(function (c) { return c.id === id; });
      var labels = lang === 'ko' ? {strong_warning_signals:'뚜렷한 위험 신호',needs_review:'확인 필요',no_known_signals:'알려진 위험 신호 없음',insufficient_information:'정보 부족'} :
        {strong_warning_signals:'Strong warning signals',needs_review:'Needs review',no_known_signals:'No known signals',insufficient_information:'Insufficient information'};
      document.getElementById(id + '-outcome').textContent = labels[item.assessment] + ' · ' + item.signals.length + (lang === 'ko' ? '개 신호. 실제 OCR 결과를 검토한 뒤 분석한 기록입니다.' : ' signals. Recorded after reviewing the actual OCR output.');
    });
  }
  document.getElementById('manual-language').addEventListener('click', function () {
    lang = lang === 'ko' ? 'en' : 'ko';
    try { localStorage.setItem('shsa.lang', lang); } catch (_) {}
    render();
  });
  render();
  fetch('assets/manual/cases.json').then(function (res) { if (!res.ok) throw new Error('capture record unavailable'); return res.json(); })
    .then(function (data) { records = data; render(); }).catch(function () { /* Captures and instructions still work. */ });
})();
