import { processViolationFollowups } from '@packages/utils/product-moderation';
export function startModerationWorker() {
  let busy = false;
  const timer = setInterval(async () => {
    if (busy) return;
    busy = true;
    try { await processViolationFollowups(); }
    catch { console.error('Product violation follow-up is pending retry'); }
    finally { busy = false; }
  }, 3000);
  timer.unref(); return timer;
}
