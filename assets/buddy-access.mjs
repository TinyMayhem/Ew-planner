// A private edit token is a bearer credential. Keep it only on the member's own device.
export const BUDDY_ACCESS_KEY = 'utw-buddy-edit-access-v1';
const validToken = token => typeof token === 'string' && /^[A-Za-z0-9_-]{30,100}$/.test(token);

export function editTokenFromHash(hash) {
  try {
    const token = new URLSearchParams(String(hash || '').replace(/^#/, '')).get('edit');
    return validToken(token) ? token : null;
  } catch { return null; }
}
export function readRememberedToken(storage) {
  try {
    const token = storage?.getItem(BUDDY_ACCESS_KEY);
    return validToken(token) ? token : null;
  } catch { return null; }
}
export function rememberToken(storage, token) {
  if (!storage || !validToken(token)) return false;
  try {
    storage.setItem(BUDDY_ACCESS_KEY, token);
    return readRememberedToken(storage) === token;
  } catch { return false; }
}
export function forgetRememberedToken(storage) {
  try { storage?.removeItem(BUDDY_ACCESS_KEY); } catch {}
}
