type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

// Cleanup entries older than their window to prevent unbounded growth
function cleanup() {
  const now = Date.now();
  store.forEach((entry, key) => {
    if (now > entry.resetAt) store.delete(key);
  });
}

/**
 * Returns { limited: true } if the key has exceeded maxRequests within windowMs.
 * Otherwise increments counter and returns { limited: false, remaining }.
 */
export function rateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): { limited: boolean; remaining: number; resetAt: number } {
  cleanup();
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { limited: false, remaining: maxRequests - 1, resetAt: entry.resetAt };
  }

  entry.count += 1;
  if (entry.count > maxRequests) {
    return { limited: true, remaining: 0, resetAt: entry.resetAt };
  }

  return { limited: false, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
