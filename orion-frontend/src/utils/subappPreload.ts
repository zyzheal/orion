/**
 * 子应用预加载工具
 *
 * 功能：
 * - 通过 hover 菜单项预加载子应用 remoteEntry.js
 * - 通过 idle 时间预加载关键子应用
 * - 复用 PreloadStrategy 实现并发控制
 */

import { getPreloadStrategy } from '@orion-mf/core';

// 已预加载的子应用集合（避免重复加载）
const prefetchedApps = new Set<string>();

// 正在预加载的 Promise 映射（避免并发重复请求）
const prefetchingPromises = new Map<string, Promise<void>>();

/**
 * 预加载子应用 remoteEntry.js（不挂载到 DOM）
 *
 * 原理：动态创建 script 标签加载 remoteEntry.js，
 * 浏览器缓存后，后续 loadSubApp 时会命中缓存，加速加载。
 */
export function prefetchSubAppRemoteEntry(
  appKey: string,
  remoteEntryUrl: string
): Promise<void> {
  if (prefetchedApps.has(appKey)) {
    return Promise.resolve();
  }

  if (prefetchingPromises.has(appKey)) {
    return prefetchingPromises.get(appKey)!;
  }

  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = remoteEntryUrl;
    script.async = true;
    script.crossOrigin = 'anonymous';

    script.onload = () => {
      prefetchedApps.add(appKey);
      console.log(`[SubAppPreload] ${appKey} remoteEntry prefetched from ${remoteEntryUrl}`);
      // 清理 script 标签，避免 DOM 污染
      script.remove();
      resolve();
    };

    script.onerror = () => {
      console.warn(`[SubAppPreload] ${appKey} prefetch failed: ${remoteEntryUrl}`);
      script.remove();
      reject(new Error(`Prefetch failed for ${appKey}`));
    };

    document.head.appendChild(script);
  });

  prefetchingPromises.set(appKey, promise);

  // 完成后清理 promise 映射
  promise.finally(() => {
    prefetchingPromises.delete(appKey);
  });

  return promise;
}

/**
 * 使用 PreloadStrategy 预加载子应用
 */
export function prefetchSubApp(
  appKey: string,
  remoteEntryUrl: string,
  options?: { mode?: 'idle' | 'visible' | 'now' }
): void {
  const strategy = getPreloadStrategy();
  const loader = () => prefetchSubAppRemoteEntry(appKey, remoteEntryUrl);

  switch (options?.mode) {
    case 'now':
      strategy.prefetchNow(appKey, loader);
      break;
    case 'idle':
      strategy.prefetchOnIdle(appKey, loader);
      break;
    case 'visible':
      strategy.prefetchOnVisible(appKey, loader);
      break;
    default:
      strategy.prefetch(appKey, loader);
  }
}

/**
 * 批量预加载多个子应用
 */
export function prefetchSubAppsBatch(
  apps: Array<{ key: string; remoteEntry: string }>,
  options?: { mode?: 'idle' | 'now' }
): void {
  for (const app of apps) {
    if (!prefetchedApps.has(app.key)) {
      prefetchSubApp(app.key, app.remoteEntry, { mode: options?.mode || 'idle' });
    }
  }
}

/**
 * 清除预加载缓存（用于测试或强制刷新）
 */
export function clearPrefetchCache(): void {
  prefetchedApps.clear();
  prefetchingPromises.clear();
}

/**
 * 获取预加载状态
 */
export function getPrefetchStatus(): { prefetched: string[]; prefetching: string[] } {
  return {
    prefetched: Array.from(prefetchedApps),
    prefetching: Array.from(prefetchingPromises.keys()),
  };
}
