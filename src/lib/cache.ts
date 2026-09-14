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
// [Reason] Per-key generation counters prevent stale cache-miss writes from overwriting delta updates
const writeVersions: Map<string, number> = new Map();

export function getCacheWriteVersion(key: string): number {
  try {
    return writeVersions.get(key) ?? 0;
  } catch {
    return 0;
  }
}

export function bumpCacheWriteVersion(key: string): void {
  try {
    writeVersions.set(key, (writeVersions.get(key) ?? 0) + 1);
  } catch {
    // Never throw from cache helpers
  }
}

// [Reason] Test helper to reset in-memory cache state between unit tests
export function resetCacheStoreForTests(): void {
  try {
    store.clear();
    writeVersions.clear();
  } catch {
    // Never throw from cache helpers
  }
}

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

