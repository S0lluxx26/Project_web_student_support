/* Dedicated owner of model download, hashing and inference. Terminating this
 * worker cancels a session without keeping model inputs on the UI thread.
 * No user content is sent over the network; fetch is used only for model files. */
'use strict';
const CACHE_DIR = 'student-support-models-v1';
let runtime = null;
let modelConfig = null;
let hasherReady = null;

function progress(id, stage, loaded = 0, total = 0) {
  self.postMessage({ id, progress: { stage, loaded, total } });
}
async function newHasher() {
  if (!hasherReady) {
    hasherReady = Promise.resolve().then(() => {
      importScripts(new URL('../vendor/hash-wasm/sha256.umd.min.js', self.location.href).href);
    }).catch(error => { hasherReady = null; throw error; });
  }
  await hasherReady;
  return self.hashwasm.createSHA256();
}
async function verify(blob, model, id) {
  if (blob.size !== model.bytes) throw new Error('model-size');
  const hash = await newHasher();
  hash.init();
  const reader = blob.stream().getReader();
  let bytes = 0;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    hash.update(chunk.value);
    bytes += chunk.value.byteLength;
    progress(id, 'verifying', bytes, model.bytes);
  }
  if (hash.digest('hex') !== model.sha256) throw new Error('model-checksum');
}
async function directory() {
  if (!self.navigator.storage || !self.navigator.storage.getDirectory) throw new Error('storage-unavailable');
  return (await self.navigator.storage.getDirectory()).getDirectoryHandle(CACHE_DIR, { create: true });
}
async function acquire(model, id) {
  if (!Number.isSafeInteger(model.bytes) || model.bytes <= 0 || model.bytes > 700000000 ||
      !/^[a-f0-9]{64}$/.test(model.sha256)) throw new Error('model-config');
  if (model.file) {
    await verify(model.file, model, id);
    return { blob: model.file, source: 'local-file' };
  }
  const dir = await directory();
  const filename = model.sha256 + '.gguf';
  const handle = await dir.getFileHandle(filename, { create: true });
  const cached = await handle.getFile();
  if (cached.size === model.bytes) {
    try {
      await verify(cached, model, id);
      return { blob: cached, source: 'verified-cache' };
    } catch (error) {
      if (error.message !== 'model-checksum') throw error;
    }
  }
  const space = await self.navigator.storage.estimate();
  if (space.quota && space.quota - (space.usage || 0) < model.bytes + 16000000) {
    throw new Error('storage-full');
  }
  const response = await fetch(model.url, { credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
  if (!response.ok || !response.body) throw new Error('model-download');
  const writer = await handle.createWritable();
  const hash = await newHasher();
  hash.init();
  let bytes = 0;
  let closed = false;
  try {
    const reader = response.body.getReader();
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > model.bytes) { await reader.cancel(); throw new Error('model-size'); }
      hash.update(chunk.value);
      await writer.write(chunk.value);
      progress(id, 'downloading', bytes, model.bytes);
    }
    if (bytes !== model.bytes) throw new Error('model-size');
    if (hash.digest('hex') !== model.sha256) throw new Error('model-checksum');
    await writer.close();
    closed = true;
    return { blob: await handle.getFile(), source: 'download' };
  } finally {
    if (!closed) {
      try { await writer.abort(); } catch (_) { /* worker may have been canceled */ }
      try { await dir.removeEntry(filename); } catch (_) { /* no usable cache marker is created */ }
    }
  }
}
async function load(model, id) {
  const started = performance.now();
  const acquired = await acquire(model, id);
  progress(id, 'loading');
  const mod = await import(new URL('../vendor/wllama/wllama.esm.js', self.location.href).href);
  runtime = new mod.Wllama({ default: new URL('../vendor/wllama/wllama.wasm', self.location.href).href }, {
    allowOffline: true, suppressNativeLog: true,
    logger: { debug() {}, log() {}, info() {}, warn() {}, error() {} }
  });
  const threads = self.crossOriginIsolated ? Math.min(4, self.navigator.hardwareConcurrency || 1) : 1;
  await runtime.loadModel([acquired.blob], {
    n_ctx: model.contextTokens, n_parallel: 1, n_batch: 128, n_ubatch: 128,
    n_threads: threads, n_gpu_layers: 0, ctx_shift: false,
    default_template_kwargs: { enable_thinking: false }
  });
  modelConfig = model;
  return { source: acquired.source, loadMs: Math.round(performance.now() - started), threads,
    mode: threads > 1 ? 'wasm-cpu-multithread' : 'wasm-cpu-singlethread' };
}
async function generate(payload, id) {
  if (!runtime || !modelConfig) throw new Error('model-not-loaded');
  const started = performance.now();
  let firstTokenMs = null;
  let content = '';
  let usage = null;
  let finishReason = null;
  await runtime.createChatCompletion({
    messages: payload.messages, stream: true, stream_options: { include_usage: true },
    max_tokens: payload.maxTokens, temperature: 0.2, seed: 42,
    cache_prompt: false, chat_template_kwargs: { enable_thinking: false },
    response_format: { type: 'json_schema', json_schema: { name: 'explanation', strict: true, schema: payload.schema } },
    onData(chunk) {
      if (chunk.usage) usage = chunk.usage;
      const choice = chunk.choices && chunk.choices[0];
      if (!choice) return;
      if (choice.finish_reason) finishReason = choice.finish_reason;
      const delta = choice.delta && choice.delta.content;
      if (delta) {
        if (firstTokenMs === null) firstTokenMs = Math.round(performance.now() - started);
        content += delta;
        // Only progress reaches the UI; incomplete/unvalidated prose does not.
        progress(id, 'generating', content.length, 0);
      }
    }
  });
  return { text: content, usage, finishReason, firstTokenMs, generationMs: Math.round(performance.now() - started) };
}
self.onmessage = async function (event) {
  const { id, type, payload } = event.data;
  try {
    let value;
    if (type === 'load') value = await load(payload, id);
    else if (type === 'generate') value = await generate(payload, id);
    else if (type === 'remove-cache') {
      const root = await self.navigator.storage.getDirectory();
      try { await root.removeEntry(CACHE_DIR, { recursive: true }); }
      catch (error) { if (error.name !== 'NotFoundError') throw error; }
      value = true;
    } else throw new Error('unknown-worker-request');
    self.postMessage({ id, value });
  } catch (error) {
    self.postMessage({ id, error: error && error.message || 'model-failed' });
  }
};
