export function readStorage(key, fallback) {
  try { const value = localStorage.getItem('palamedes:' + key); return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}
export function writeStorage(key, value) {
  try { localStorage.setItem('palamedes:' + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function download(name, content, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
