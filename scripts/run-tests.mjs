import { spawnSync } from 'node:child_process';
import { ROOT } from './serve-site.mjs';
const suites = ['test-analyzer.js', 'test-detector.js', 'test-data.js', 'test-ocr.js', 'test-llm.js', 'test-learning-cases.js'];
for (const suite of suites) {
  const result = spawnSync(process.execPath, ['scripts/' + suite], { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
