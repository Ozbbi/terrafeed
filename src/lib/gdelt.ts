import { getJson } from './net';

/**
 * Serialising gate for GDELT.
 *
 * The API answers `429 Please limit requests to one every 5 seconds` and does it
 * with an HTTP 200-shaped body, so a parallel fan-out silently returns nothing
 * useful rather than failing loudly. Every GDELT call in the app goes through
 * here: one at a time, spaced past the documented limit.
 *
 * The cost is latency on a background poll — four themed queries take about
 * twenty seconds — which nobody watches, against the alternative of three of the
 * four coming back empty.
 */

const MIN_GAP_MS = 5_500;

let chain: Promise<unknown> = Promise.resolve();
let lastStartedAt = 0;

export function gdeltJson<T>(url: string): Promise<T> {
  const run = async (): Promise<T> => {
    const wait = MIN_GAP_MS - (Date.now() - lastStartedAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastStartedAt = Date.now();

    const data = await getJson<T>(url);
    // A throttled response parses as JSON-ish but carries no articles; treat it
    // as the failure it is so the cache does not memoise an empty answer.
    if (typeof data === 'string' && /limit requests/i.test(data)) {
      throw new Error('GDELT rate limit');
    }
    return data;
  };

  const next = chain.then(run, run);
  // Keep the chain alive after a rejection, but hand the rejection to the caller.
  chain = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}
