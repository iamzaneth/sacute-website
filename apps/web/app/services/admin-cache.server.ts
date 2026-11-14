// Process-local snapshots only. Call after requireAdmin on every request.
// Never cache auth decisions, cookies, Responses or editor form data.
type Entry = { value: unknown; expires: number; size: number };
const entries = new Map<string, Entry>();
const pending = new Map<string, Promise<unknown>>();
const maxEntries = 32;
const maxBytes = 4 * 1024 * 1024;
let bytes = 0;
let generation = 0;
function remove(key: string) {
  bytes -= entries.get(key)?.size ?? 0;
  entries.delete(key);
}
export function clearAdminCache() {
  generation++;
  entries.clear();
  pending.clear();
  bytes = 0;
}
export async function adminMutation<T>(mutate: () => Promise<T>): Promise<T> {
  clearAdminCache();
  try {
    return await mutate();
  } finally {
    // A read racing the write cannot repopulate an obsolete snapshot.
    clearAdminCache();
  }
}
export function readAdminCache<T>(
  userId: string,
  writesEnabled: boolean,
  resource: string,
  read: () => Promise<T>,
): Promise<T> {
  const key = JSON.stringify([userId, writesEnabled, resource]);
  const now = Date.now();
  for (const [key, entry] of entries) if (entry.expires <= now) remove(key);
  const cached = entries.get(key);
  if (cached) {
    entries.delete(key);
    entries.set(key, cached);
    return Promise.resolve(cached.value as T);
  }
  const inflight = pending.get(key);
  if (inflight) return inflight as Promise<T>;
  const version = generation;
  const job = Promise.resolve()
    .then(read)
    .then((value) => {
      const size = JSON.stringify(value).length * 2;
      if (version === generation && size <= maxBytes) {
        remove(key);
        entries.set(key, { value, size, expires: Date.now() + 15_000 });
        bytes += size;
        while (entries.size > maxEntries || bytes > maxBytes)
          remove(entries.keys().next().value!);
      }
      return value;
    })
    .finally(() => {
      if (pending.get(key) === job) pending.delete(key);
    });
  pending.set(key, job);
  return job;
}
