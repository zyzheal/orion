// ============================================================
// 请求取消管理器 (Plan 01 — API Client 增强)
// 基于 AbortController，支持按 URL、Tag、全部取消
// ============================================================

type PendingRequest = {
  url: string;
  controller: AbortController;
  tag?: string;
  id: symbol;
};

const pendingRequests = new Map<symbol, PendingRequest>();

function trackRequest(controller: AbortController, url: string, tag?: string): symbol {
  const id = Symbol(`req-${url}`);
  pendingRequests.set(id, { url, controller, tag, id });
  return id;
}

function release(id: symbol): void {
  pendingRequests.delete(id);
}

/** 取消单个请求（按 ID） */
export const cancelRequest = (id: symbol): boolean => {
  const req = pendingRequests.get(id);
  if (req) {
    req.controller.abort();
    pendingRequests.delete(id);
    return true;
  }
  return false;
};

/** 按 Tag 取消一组请求（如同一页面的多个请求） */
export const cancelByTag = (tag: string): number => {
  let count = 0;
  pendingRequests.forEach((req, id) => {
    if (req.tag === tag) {
      req.controller.abort();
      pendingRequests.delete(id);
      count++;
    }
  });
  return count;
};

/** 按 URL 取消（同一 URL 的所有进行中的请求） */
export const cancelByUrl = (url: string): number => {
  let count = 0;
  pendingRequests.forEach((req, id) => {
    if (req.url === url) {
      req.controller.abort();
      pendingRequests.delete(id);
      count++;
    }
  });
  return count;
};

/** 取消全部请求 */
export const cancelAll = (): number => {
  const count = pendingRequests.size;
  pendingRequests.forEach((req) => {
    req.controller.abort();
  });
  pendingRequests.clear();
  return count;
};

/** 路由切换时取消全部 */
export const onRouteChange = (): void => {
  cancelAll();
};

/** 获取当前活跃请求数量（用于 debug） */
export const activeCount = (): number => pendingRequests.size;

/** 获取 request config 的 AbortSignal —— 供拦截器使用 */
export const getAbortConfig = (url: string, tag?: string): {
  signal: AbortSignal;
  _cancelId: symbol;
  _release: () => void;
} => {
  const controller = new AbortController();
  const id = trackRequest(controller, url, tag);
  return {
    signal: controller.signal,
    _cancelId: id,
    _release: () => release(id),
  };
};

export function createRequestCanceller() {
  return {
    cancelRequest,
    cancelByTag,
    cancelAll,
    onRouteChange,
    cancelByUrl,
    activeCount,
  };
}
