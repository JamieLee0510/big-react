// 收集任務回調，然後一次執行，類似防抖/節流
let syncQueue: ((...args: any) => void)[] | null = null;

// 正在沖洗同步任務回調的flag
let isFlushingSyncQueue = false;

/**
 * 調度同步任務回調函數
 * @param callback
 */
export function scheduleSyncCallback(callback: (...args: any) => void) {
  if (syncQueue === null) {
    syncQueue = [callback];
  } else {
    syncQueue.push(callback);
  }
}

export function flushSyncCallbacks() {
  if (!isFlushingSyncQueue && syncQueue) {
    isFlushingSyncQueue = true;
    try {
      syncQueue.forEach((callback) => callback());
    } catch (e) {
      if (__DEV__) {
        console.error("flushSyncCallback error:", e);
      }
    } finally {
      isFlushingSyncQueue = false;
      syncQueue = null;
    }
  }
}
