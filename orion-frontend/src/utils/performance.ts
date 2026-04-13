/**
 * Performance Optimizations - 性能工具函数
 * TASK-907: 前端性能优化
 */

/**
 * 防抖函数
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      func(...args);
    };

    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(later, wait);
  };
}

/**
 * 节流函数
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): T {
  let inThrottle: boolean;

  return function (this: any, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  } as T;
}

/**
 * 请求动画帧节流
 */
export function rafThrottle<T extends (...args: any[]) => any>(func: T): T {
  let rafId: number | null = null;

  return function (this: any, ...args: Parameters<T>) {
    if (rafId !== null) return;

    rafId = requestAnimationFrame(() => {
      func.apply(this, args);
      rafId = null;
    });
  } as T;
}

/**
 * 内存清理工具
 */
export class MemoryCleaner {
  private cleaners: (() => void)[] = [];

  /**
   * 注册清理函数
   */
  register(cleaner: () => void): void {
    this.cleaners.push(cleaner);
  }

  /**
   * 执行所有清理
   */
  cleanup(): void {
    this.cleaners.forEach((cleaner) => cleaner());
    this.cleaners = [];
  }
}

/**
 * 大数据数组分片处理
 */
export async function processInChunks<T, R>(
  data: T[],
  processor: (chunk: T[]) => Promise<R[]>,
  chunkSize: number = 100
): Promise<R[]> {
  const results: R[] = [];

  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    const chunkResults = await processor(chunk);
    results.push(...chunkResults);

    // 让出主线程
    if (i + chunkSize < data.length) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
  }

  return results;
}

/**
 * 图片懒加载优化
 */
export function lazyLoadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * 计算渲染性能指标
 */
export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  longTasks: number;
}

let frameCount = 0;
let lastTime = performance.now();
let longTasks = 0;

// 监听长任务
if (typeof PerformanceObserver !== 'undefined') {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      if (entry.duration >= 50) {
        longTasks++;
      }
    }
  });
  try {
    observer.observe({ entryTypes: ['longtask'] });
  } catch (e) {
    // 不支持长任务 API
  }
}

/**
 * 获取当前 FPS
 */
export function getCurrentFPS(): number {
  const now = performance.now();
  frameCount++;

  if (now - lastTime >= 1000) {
    const fps = Math.round((frameCount * 1000) / (now - lastTime));
    frameCount = 0;
    lastTime = now;
    return fps;
  }
  return 0;
}

/**
 * 获取性能指标
 */
export function getPerformanceMetrics(): PerformanceMetrics {
  const fps = getCurrentFPS();
  return {
    fps,
    frameTime: fps > 0 ? Math.round(1000 / fps) : 0,
    longTasks,
  };
}
