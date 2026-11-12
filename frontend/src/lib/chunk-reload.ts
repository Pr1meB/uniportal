/**
 * A dropped connection while the browser downloads a page's JavaScript shows up
 * as a ChunkLoadError. Reloading fetches it again; the guard stops a reload loop
 * if the network is really down.
 */
const KEY = "uemp-chunk-reload";

export function isChunkLoadError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | null;
  const text = `${e?.name ?? ""} ${e?.message ?? ""}`;
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module/i.test(text);
}

/** Reloads the page once per 30 seconds. Returns false when it already tried. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < 30_000) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    // storage blocked: still reload, the browser will stop a tight loop itself
  }
  window.location.reload();
  return true;
}
