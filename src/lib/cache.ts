// Simple in-memory TTL cache.
// - Per-process (per instance), acceptable for short TTLs
// - Never throws: all operations are wrapped safely
// - Zero external side effects
// - TTL-based invalidation at read time

type CacheEntry = {
  value: unknown;
  expiresAt: number;
};

const store: Map<string, CacheEntry> = new Map();

export function getCache<T = unknown>(key: string): T | undefined {
  try {
    const entry = store.get(key);
    if (!entry) return undefined;
    if (Date.now() >= entry.expiresAt) {
      // Expired; best-effort cleanup
      try {
        store.delete(key);
      } catch {}
      return undefined;
    }
    return entry.value as T;
  } catch {
    return undefined;
  }
}

export function setCache(key: string, value: unknown, ttlMs: number): void {
  try {
    if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
      // Remove on non-positive ttl
      try {
        store.delete(key);
      } catch {}
      return;
    }
    const expiresAt = Date.now() + ttlMs;
    store.set(key, { value, expiresAt });
  } catch {
    // Swallow errors to ensure "never throws"
  }
}

