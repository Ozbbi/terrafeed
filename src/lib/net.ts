/** Single outbound-HTTP entry point: Rust command in the app, dev proxy in the browser. */

export interface NetResponse {
  status: number;
  ok: boolean;
  contentType: string;
  body: string;
  finalUrl: string;
}

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;

interface RustResponse {
  status: number;
  ok: boolean;
  content_type: string;
  body: string;
  final_url: string;
}

export async function netGet(
  url: string,
  opts: { accept?: string; headers?: [string, string][] } = {},
): Promise<NetResponse> {
  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    const raw = await invoke<RustResponse>('net_get', {
      req: { url, accept: opts.accept ?? null, headers: opts.headers ?? [] },
    });
    return {
      status: raw.status,
      ok: raw.ok,
      contentType: raw.content_type,
      body: raw.body,
      finalUrl: raw.final_url,
    };
  }

  const response = await fetch(`/__proxy?url=${encodeURIComponent(url)}`);
  const payload = await response.json();
  if (payload.error) throw new Error(payload.error);
  return payload as NetResponse;
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await netGet(url, { accept: 'application/json' });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return JSON.parse(res.body) as T;
}

export async function getText(url: string, accept = 'text/plain, */*'): Promise<string> {
  const res = await netGet(url, { accept });
  if (!res.ok) throw new Error(`HTTP ${res.status} — ${url}`);
  return res.body;
}

export async function getXml(url: string): Promise<Document> {
  const text = await getText(url, 'application/rss+xml, application/xml, text/xml, */*');
  const doc = new DOMParser().parseFromString(text, 'text/xml');
  if (doc.querySelector('parsererror')) {
    // Some feeds serve almost-XML; retry the lenient HTML parser before giving up.
    const html = new DOMParser().parseFromString(text, 'text/html');
    if (html.querySelector('item, entry')) return html as unknown as Document;
    throw new Error(`unparseable feed — ${url}`);
  }
  return doc;
}
