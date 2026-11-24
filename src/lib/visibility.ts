/**
 * Run `task` every `intervalMs` while the page is visible. Ticks are skipped while the
 * tab is hidden; on return the task runs once at once if a tick was missed.
 */
export function everyWhileVisible(task: () => void, intervalMs: number) {
  let lastRun = Date.now();
  const run = () => { lastRun = Date.now(); task(); };
  const timer = window.setInterval(() => { if (!document.hidden) run(); }, intervalMs);
  const onVisibilityChange = () => { if (!document.hidden && Date.now() - lastRun >= intervalMs) run(); };
  document.addEventListener("visibilitychange", onVisibilityChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onVisibilityChange);
  };
}
