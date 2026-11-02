import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

function jsxFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? jsxFiles(full) : entry.name.endsWith('.jsx') ? [full] : [];
  });
}

test('every JSX module compiles and passes the JavaScript parser, including regex literals', () => {
  const root = fileURLToPath(new URL('../src', import.meta.url));
  const files = jsxFiles(root);
  assert.ok(files.length > 0);
  for (const file of files) {
    const result = transformSync(readFileSync(file, 'utf8'), { loader: 'jsx', format: 'cjs', jsx: 'automatic', logLevel: 'silent' });
    assert.doesNotThrow(() => new vm.Script(result.code, { filename: file }), path.relative(root, file));
  }
});
