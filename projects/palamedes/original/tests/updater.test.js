import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { DAY_MS, shouldCheck, initialState, transition, isTrustedExternalUrl, resolveAssetPath } = require('../desktop/update-policy.cjs');

test('automatic update checks are limited to one attempt per 24h, including failures', () => {
  const now = 10 * DAY_MS;
  assert.equal(shouldCheck(null, now), true);
  assert.equal(shouldCheck(now, now + DAY_MS - 1), false);
  assert.equal(shouldCheck(now, now + DAY_MS), true);
  assert.equal(shouldCheck(now + DAY_MS, now), false, 'clock rollback must not cause a repeated automatic check');
  assert.equal(shouldCheck(now, now, true), true, 'explicit manual check bypasses the daily interval');
});

test('installation requires explicit approval followed by a completed download', () => {
  let s = transition(initialState(), 'check');
  s = transition(s, 'available');
  assert.throws(() => transition(s, 'install'), /not allowed/);
  assert.throws(() => transition(s, 'downloaded'), /not allowed/);
  s = transition(s, 'approve');
  assert.throws(() => transition(s, 'install'), /not allowed/);
  s = transition(s, 'downloaded');
  assert.equal(transition(s, 'install').status, 'installing');
});

test('cancel, dialog dismissal, and error revoke installation approval', () => {
  for (const event of ['cancel', 'reject', 'error']) for (const downloaded of [false, true]) {
    let s = transition(transition(transition(initialState(), 'check'), 'available'), 'approve');
    if (downloaded) s = transition(s, 'downloaded');
    s = transition(s, event);
    assert.equal(s.approved, false); assert.equal(s.downloaded, false);
    assert.throws(() => transition(s, 'downloaded'), /not allowed/);
    assert.throws(() => transition(s, 'install'), /not allowed/);
    s = transition(s, 'check');
    assert.equal(s.approved, false, 'a new session/check must obtain fresh approval');
  }
});

test('external navigation permits known HTTPS domains and rejects privileged or disguised URLs', () => {
  assert.equal(isTrustedExternalUrl('https://github.com/example/Palamedes/releases'), true);
  for (const url of ['file:///C:/Windows/system32/cmd.exe', 'javascript:alert(1)', 'https://github.com.evil.test/a', 'https://github.com@evil.test/a', 'http://github.com/a', 'https://github.com:8080/a', 'https://evil.test/a']) assert.equal(isTrustedExternalUrl(url), false, url);
});

test('loopback asset paths cannot escape the packaged dist directory', () => {
  const root = path.resolve('test-dist');
  assert.equal(resolveAssetPath(root, '/'), path.join(root, 'index.html'));
  assert.equal(resolveAssetPath(root, '/assets/app.js?x=1'), path.join(root, 'assets', 'app.js'));
  for (const target of ['/../../secret', '/%2e%2e/%2e%2e/secret', '/%00evil', '/%zz', 'not-absolute']) assert.equal(resolveAssetPath(root, target), null, target);
});
