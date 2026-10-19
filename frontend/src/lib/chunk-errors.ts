/**
 * Failed lazy-chunk loads. After a redeploy the old JavaScript files are gone,
 * so opening a page from an already-loaded tab fails with one of these messages
 * (Chrome, Safari, Firefox). The fix is always the same: reload the page.
 */
const CHUNK_ERROR = /dynamically imported module|importing a module script failed|ChunkLoadError|Loading chunk .* failed/i

export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.name} ${error.message}` : typeof error === 'string' ? error : ''
  return CHUNK_ERROR.test(message)
}

const RELOAD_KEY = 'siam-bean:chunk-reload-at'
const RELOAD_WINDOW_MS = 10_000

/**
 * Vite fires `vite:preloadError` when a chunk fails to load. Reload once to pick up the new
 * version. If it fails again within 10 s the reload did not help, so we let the error reach the
 * error boundary instead of looping.
 */
export function installChunkReload(target: Window = window, now: () => number = Date.now): void {
  target.addEventListener('vite:preloadError', (event) => {
    try {
      const last = Number(target.sessionStorage.getItem(RELOAD_KEY) ?? 0)
      if (now() - last < RELOAD_WINDOW_MS) return
      target.sessionStorage.setItem(RELOAD_KEY, String(now()))
    } catch {
      return // no sessionStorage (private mode): show the error boundary instead of risking a loop
    }
    event.preventDefault()
    target.location.reload()
  })
}
