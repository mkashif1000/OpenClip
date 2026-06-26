/**
 * Stale-deploy chunk-load detection.
 *
 * Vite content-hashes its output bundles. When the user has an old tab open
 * and we redeploy, the old asset URLs (referenced by the old index.html) get
 * replaced on the CDN — any subsequent dynamic `import()` for those old
 * hashes fails with "error loading dynamically imported module: <url>".
 *
 * Vite emits a `vite:preloadError` window event when this happens. We catch
 * it (and individual `import()` failures) and surface a clear "App updated"
 * banner instead of a raw error blob.
 */

export function isChunkLoadError(err: unknown): boolean {
  if (!err) return false;
  const msg = (err as { message?: string })?.message ?? String(err);
  return (
    /dynamically imported module/i.test(msg) ||
    /failed to fetch/i.test(msg) ||
    /loading chunk/i.test(msg) ||
    /loading css chunk/i.test(msg) ||
    /import.*failed/i.test(msg)
  );
}

/**
 * Wrap a dynamic-import call. On failure, re-throws a `ChunkLoadError` that
 * components can detect with isChunkLoadError() and show a clean reload UI.
 */
export async function safeImport<T>(loader: () => Promise<T>, label = 'module'): Promise<T> {
  try {
    return await loader();
  } catch (err) {
    if (isChunkLoadError(err)) {
      // Signal the global banner so any other in-flight UI also reflects the
      // stale-deploy state.
      window.dispatchEvent(new CustomEvent('app:chunk-reload-required', { detail: { label } }));
    }
    throw err;
  }
}

let reloading = false;
export function reloadForUpdate(): void {
  if (reloading) return;
  reloading = true;
  // Strip cache by appending a buster — most browsers honor this.
  const url = new URL(window.location.href);
  url.searchParams.set('_v', String(Date.now()));
  window.location.replace(url.toString());
}
