type Entry = { count: number; resetAt: number };

const windows = new Map<string, Entry>();

export function checkRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = windows.get(key);

  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    if (windows.size > 10_000) {
      windows.forEach((entry, storedKey) => {
        if (entry.resetAt <= now) windows.delete(storedKey);
      });
    }
    return { allowed: true, retryAfter: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfter: 0 };
}
