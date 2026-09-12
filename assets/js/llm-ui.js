/* Optional explanation UI. Neither model nor inference runtime loads at boot. */
(function (global) {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var t = function (key, vars) { return I18n.t(key, vars); };
  var UI = {
    report: null, revision: 0, busy: false, ready: false,
    init: function () {
      if (this.bound) return;
      this.bound = true;
      this.access = LLM.experimental && LLM.support().usable;
      $('llm-panel').hidden = !LLM.experimental;
      var self = this;
      $('llm-enable').addEventListener('change', function () {
        this.checked = self.access && this.checked;
        LLM.enabled = this.checked;
        if (!this.checked) self.stop(true);
        self.update();
      });
      $('llm-download').addEventListener('click', function () { self.load(); });
      $('llm-file').addEventListener('change', function () {
        var file = this.files[0]; this.value = '';
        if (file) self.load(file);
      });
      $('llm-generate').addEventListener('click', function () { self.generate(); });
      $('llm-cancel').addEventListener('click', function () { self.stop(true); self.status('llm.stopped'); });
      $('llm-unload').addEventListener('click', function () { self.stop(true); self.status('llm.unloaded'); });
      $('llm-finding').addEventListener('change', function () {
        if (self.busy) self.stop(true);
        self.revision++; self.clearDraft(); self.update();
      });
      $('llm-remove-cache').addEventListener('click', function () {
        self.stop(true);
        var rev = self.revision;
        self.busy = true; self.update();
        LLM.removeCachedModel().then(function () {
          if (rev === self.revision) self.status('llm.cacheRemoved');
        }).catch(function () {
          if (rev === self.revision) self.status('llm.cacheError');
        }).finally(function () {
          if (rev === self.revision) { self.busy = false; self.update(); }
        });
      });
      I18n.onChange(function () { self.update(); });
      this.update();
    },
    setReport: function (result, lang) {
      this.stop(true);
      // Explain existing reviewed rule guidance. No transcript or identifier
      // is needed for this feature; never silently truncate a conversation.
      this.report = LLM.inputFrom(result, '', lang);
      var select = $('llm-finding');
      select.replaceChildren();
      this.report.findings.forEach(function (finding) {
        var option = document.createElement('option');
        option.value = finding.id; option.textContent = finding.title;
        select.appendChild(option);
      });
      this.status(this.report.findings.length ? 'llm.idle' : 'llm.noFindings');
      this.update();
    },
    reset: function () {
      this.stop(true); this.report = null; LLM.enabled = false;
      $('llm-enable').checked = false;
      $('llm-panel').open = false;
      $('llm-finding').replaceChildren();
      this.status('llm.idle'); this.update();
    },
    clearDraft: function () {
      $('llm-draft-content').replaceChildren();
      $('llm-draft').hidden = true;
    },
    stop: function (unload) {
      this.revision++;
      LLM.cancel();
      if (unload) LLM.unload();
      this.busy = false; this.ready = !!LLM.loaded;
      this.clearDraft(); this.update();
    },
    status: function (key, vars) { $('llm-status').textContent = t(key, vars); },
    update: function () {
      if (!$('llm-enable')) return;
      var enabled = this.access && $('llm-enable').checked;
      $('llm-enable').disabled = !this.access;
      $('llm-device-note').textContent = t(LLM.isMobileDevice() ? 'llm.mobileDisabled' :
        this.access ? 'llm.desktopCost' : 'llm.unavailable');
      var findings = !!(this.report && this.report.findings.length);
      $('llm-options').hidden = !enabled;
      $('llm-download').disabled = !enabled || this.busy || this.ready;
      $('llm-file').disabled = !enabled || this.busy || this.ready;
      $('llm-generate').disabled = !enabled || !this.ready || this.busy || !findings;
      $('llm-cancel').hidden = !this.busy;
      $('llm-unload').hidden = !this.ready;
      $('llm-remove-cache').disabled = this.busy;
      $('llm-finding').disabled = !findings || this.busy;
      $('llm-options').setAttribute('aria-busy', this.busy ? 'true' : 'false');
      $('llm-size').textContent = (LLM.MODELS[0].bytes / 1000000).toFixed(1) + ' MB';
    },
    load: function (file) {
      if (!this.access || !LLM.enabled || this.busy) return;
      var cap = LLM.capabilities();
      if (!cap.usable) { this.status('llm.unavailable'); return; }
      var self = this, rev = ++this.revision;
      var model = Object.assign({}, LLM.MODELS[0]);
      if (file) model.file = file;
      this.busy = true; this.clearDraft(); this.update(); this.status('llm.loading');
      if (global.OCR) OCR.release();
      var job = LLM.newJob();
      LLM.load(model, function (loaded, total, phase) {
        if (rev !== self.revision) return;
        var keys = { downloading: 'llm.downloading', verifying: 'llm.verifying', loading: 'llm.loading' };
        self.status(keys[phase] || 'llm.loading', { pct: total ? Math.round(loaded / total * 100) : 0 });
      }, job).then(function () {
        if (rev !== self.revision) return;
        self.ready = true;
        self.status('llm.ready', { threads: LLM.stats && LLM.stats.threads || 1 });
      }).catch(function (error) {
        if (rev !== self.revision) return;
        self.ready = false;
        self.error(error);
      }).finally(function () {
        if (rev === self.revision) { self.busy = false; self.update(); }
      });
    },
    error: function (error) {
      var message = error && error.message;
      var keys = { 'model-size': 'llm.wrongFile', 'model-checksum': 'llm.wrongFile',
        'storage-unavailable': 'llm.storageUnavailable', 'storage-full': 'llm.storageFull',
        'input-too-long': 'llm.inputLong', 'no-findings': 'llm.noFindings', 'model-timeout': 'llm.timeout' };
      this.status(error && error.cancelled ? 'llm.stopped' : keys[message] || 'llm.failed');
    },
    generate: function () {
      if (!this.access || !LLM.enabled || !this.ready || this.busy || !this.report) return;
      var selected = $('llm-finding').value;
      var finding = this.report.findings.find(function (f) { return f.id === selected; });
      if (!finding) return;
      var input = Object.assign({}, this.report, { findings: [finding], transcript: '' });
      var self = this, rev = ++this.revision;
      var job = LLM.newJob();
      this.busy = true; this.clearDraft(); this.status('llm.generating'); this.update();
      LLM.generate(input, job).then(function (result) {
        if (rev !== self.revision) return;
        if (!result.ok) { self.status('llm.rejected'); return; }
        var root = $('llm-draft-content');
        var summary = document.createElement('p'); summary.textContent = result.value.summary; root.appendChild(summary);
        result.value.points.forEach(function (point) {
          var box = document.createElement('div');
          var title = document.createElement('strong'); title.textContent = finding.title;
          var p = document.createElement('p'); p.textContent = point.why;
          box.append(title, p); root.appendChild(box);
        });
        result.value.ask.forEach(function (ask) {
          var p = document.createElement('p'); p.textContent = t('llm.question') + ' ' + ask; root.appendChild(p);
        });
        $('llm-draft').hidden = false;
        self.status('llm.done');
      }).catch(function (error) {
        if (rev === self.revision) self.error(error);
      }).finally(function () {
        if (rev === self.revision) { self.busy = false; self.ready = !!LLM.loaded; self.update(); }
      });
    }
  };
  global.LLMUI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
