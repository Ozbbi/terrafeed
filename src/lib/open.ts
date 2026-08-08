import { isTauri } from './net';

/**
 * Opens a source article. In the packaged app the default is a Terrafeed reader
 * window, so following a story does not mean leaving the dashboard; the system
 * browser stays available for anyone who prefers their own bookmarks and
 * extensions. In a plain browser both paths collapse to a new tab.
 */
export async function openArticle(
  url: string,
  title?: string,
  mode: 'in-app' | 'system' = 'in-app',
): Promise<void> {
  if (!url) return;

  if (isTauri()) {
    const { invoke } = await import('@tauri-apps/api/core');
    if (mode === 'in-app') {
      try {
        await invoke('open_reader', { url, title: title ?? null });
        return;
      } catch {
        // Window creation can fail (blocked URL, webview error) — fall through
        // to the system browser rather than swallowing the click.
      }
    }
    const { openUrl } = await import('@tauri-apps/plugin-opener');
    await openUrl(url);
    return;
  }

  window.open(url, '_blank', 'noreferrer');
}
