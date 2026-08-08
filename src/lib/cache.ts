/** In-memory TTL cache with request de-duplication, so several panels can ask
 *  for the same feed in the same tick without hammering the upstream host. */

interface Entry<T> {
  value?: T;
  expires: number;
  inflight?: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();

export async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;

  if (hit?.inflight) return hit.inflight;
  if (hit && hit.value !== undefined && hit.expires > now) return hit.value;

  const inflight = load()
    .then((value) => {
      store.set(key, { value, expires: Date.now() + ttlMs });
      return value;
    })
    .catch((error) => {
      // Serve stale data rather than blanking a layer on a transient failure.
      if (hit?.value !== undefined) {
        store.set(key, { value: hit.value, expires: Date.now() + 30_000 });
        return hit.value;
      }
      store.delete(key);
      throw error;
    });

  store.set(key, { ...hit, expires: hit?.expires ?? 0, inflight } as Entry<unknown>);
  return inflight;
}

export function invalidate(prefix?: string): void {
  if (!prefix) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}
