// Version is checked against the DB on every read, including cache hits. TTL is
// only an eviction policy. Never use this cache for auth contexts or Responses.
export interface ContentVersion {
  revision: string;
  now: string;
}
export function createVersionedCache(maxBytes = 4 * 1024 * 1024) {
  const entries = new Map<
    string,
    { value: unknown; size: number; expires: number }
  >();
  const pending = new Map<string, Promise<unknown>>();
  let bytes = 0;
  function remove(key: string) {
    bytes -= entries.get(key)?.size ?? 0;
    entries.delete(key);
  }
  return async function read<T>(
    key: string,
    version: () => Promise<ContentVersion>,
    load: (version: ContentVersion) => Promise<T>,
  ): Promise<T> {
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = await version();
      const cacheKey = JSON.stringify([key, before.revision]);
      for (const [key, entry] of entries)
        if (entry.expires <= Date.now()) remove(key);
      const cached = entries.get(cacheKey);
      if (cached) {
        entries.delete(cacheKey);
        entries.set(cacheKey, cached);
        return cached.value as T;
      }
      let job = pending.get(cacheKey) as Promise<T | undefined> | undefined;
      if (!job) {
        if (pending.size >= 64) throw new Error('Content read queue is full');
        job = (async () => {
          const value = await load(before);
          const after = await version();
          // A racing write or publication boundary must not label old data
          // with a newer revision. Retry; never serve the obsolete snapshot.
          if (before.revision !== after.revision) return undefined;
          const size = JSON.stringify(value).length * 2;
          if (size <= maxBytes) {
            remove(cacheKey);
            entries.set(cacheKey, {
              value,
              size,
              expires: Date.now() + 60_000,
            });
            bytes += size;
            while (entries.size > 32 || bytes > maxBytes)
              remove(entries.keys().next().value!);
          }
          return value;
        })();
        pending.set(cacheKey, job);
      }
      let value;
      try {
        value = await job;
      } finally {
        if (pending.get(cacheKey) === job) pending.delete(cacheKey);
      }
      if (value !== undefined) return value;
    }
    throw new Error('Content changed repeatedly during read');
  };
}
