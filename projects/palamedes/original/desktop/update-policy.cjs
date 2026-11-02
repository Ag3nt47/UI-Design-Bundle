const path = require('node:path');
const DAY_MS = 24 * 60 * 60 * 1000;

function shouldCheck(lastAttemptAt, now = Date.now(), manual = false) {
  if (!Number.isFinite(now) || now < 0) return false;
  if (manual) return true;
  if (lastAttemptAt === null || lastAttemptAt === undefined) return true;
  if (!Number.isFinite(lastAttemptAt) || lastAttemptAt < 0) return true;
  return now - lastAttemptAt >= DAY_MS;
}

function initialState() { return { status: 'idle', approved: false, downloaded: false }; }

/** There is deliberately no transition from available/downloaded straight to
 * installation without the approval recorded in this process/session. */
function transition(current, event) {
  const state = { ...current };
  if (event === 'check') return { status: 'checking', approved: false, downloaded: false };
  if (event === 'cancel' || event === 'error' || event === 'reject') return { status: event === 'error' ? 'error' : 'cancelled', approved: false, downloaded: false };
  if (event === 'not-available' && state.status === 'checking') return { status: 'up-to-date', approved: false, downloaded: false };
  if (event === 'available' && state.status === 'checking') return { status: 'available', approved: false, downloaded: false };
  if (event === 'approve' && state.status === 'available') return { status: 'downloading', approved: true, downloaded: false };
  if (event === 'downloaded' && state.status === 'downloading' && state.approved) return { status: 'downloaded', approved: true, downloaded: true };
  if (event === 'install' && state.status === 'downloaded' && state.approved && state.downloaded) return { status: 'installing', approved: true, downloaded: true };
  throw new Error(`Update action ${event} is not allowed while ${state.status}.`);
}

const EXTERNAL_DOMAINS = ['github.com', 'github.io', 'mathjs.org', 'nerdamer.com', 'katex.org', 'projectnaptha.com', 'hpcalcs.com', 'ti.com', 'casio.com', 'casio-intl.com', 'electronjs.org', 'electron.build', 'nodejs.org', 'openai.com', 'wikipedia.org', 'openstax.org', 'khanacademy.org', 'mit.edu'];
function isTrustedExternalUrl(raw) {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443') && EXTERNAL_DOMAINS.some(domain => url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch { return false; }
}

function resolveAssetPath(root, requestPath) {
  let decoded;
  try { decoded = decodeURIComponent(requestPath.split('?')[0]); } catch { return null; }
  if (!decoded.startsWith('/') || decoded.includes('\0')) return null;
  const target = path.resolve(root, `.${decoded === '/' ? '/index.html' : decoded}`);
  const relative = path.relative(root, target);
  return relative.startsWith('..') || path.isAbsolute(relative) ? null : target;
}

module.exports = { DAY_MS, shouldCheck, initialState, transition, isTrustedExternalUrl, resolveAssetPath };
