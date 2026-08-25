// ============================================================
// Plan 32 — Web Vitals 性能监控
// ============================================================
// 优先级: P1
// 来源: 全量代码扫描发现 — 前端无 web-vitals 集成
// 本地证据:
//   - grep -rl "web-vitals" orion-frontend/src/ → 空
//   - package.json 无 web-vitals 依赖
//   - 后端 prometheus.go (149行) 已有 HTTP 指标采集
// 技术约束: React 18, Vite 5, TypeScript
// 依赖: web-vitals (^4.2.0)
// ============================================================

import type { Metric, CLSMetric, LCPMetric, FIDMetric, INPMetric, TTFBMetric } from 'web-vitals';

// --- Types ---

export interface WebVitalReport {
  name: string;
  value: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  pathname: string;
  sessionId: string;
  timestamp: number;
  // 附加信息
  entries?: PerformanceEntry[];
  navigationType?: string;
  // 用户信息 (可选)
  tenantId?: string;
  userId?: string;
}

export interface WebVitalsConfig {
  // 上报 URL (后端接收端点)
  endpoint?: string;
  // 是否在开发环境打印
  debug?: boolean;
  // 批量上报间隔 (ms)
  batchInterval?: number;
  // 批量上报最大数量
  batchSize?: number;
  // 会话 ID (用于关联同一页面的多个指标)
  sessionId?: string;
  // 用户信息
  tenantId?: string;
  userId?: string;
}

// --- Web Vitals Collector ---

class WebVitalsCollector {
  private config: WebVitalsConfig;
  private batch: WebVitalReport[] = [];
  private batchTimer: ReturnType<typeof setInterval> | null = null;
  private sessionId: string;

  constructor(config: WebVitalsConfig = {}) {
    this.config = {
      endpoint: '/api/v1/metrics/web-vitals',
      debug: import.meta.env?.DEV ?? false,
      batchInterval: 5000,
      batchSize: 10,
      ...config,
    };
    this.sessionId = config.sessionId ?? this.generateSessionId();
  }

  // 生成会话 ID
  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  // 收集指标
  collect(metric: Metric): void {
    const report: WebVitalReport = {
      name: metric.name,
      value: metric.value,
      rating: metric.rating,
      pathname: window.location.pathname,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      entries: metric.entries,
      navigationType: this.getNavigationType(),
      tenantId: this.config.tenantId,
      userId: this.config.userId,
    };

    if (this.config.debug) {
      console.log(`[WebVitals] ${metric.name}:`, metric.value, metric.rating, report);
    }

    this.batch.push(report);

    if (this.batch.length >= (this.config.batchSize ?? 10)) {
      this.flush();
    }
  }

  // 获取导航类型
  private getNavigationType(): string {
    const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return nav?.type ?? 'unknown';
  }

  // 批量上报
  async flush(): Promise<void> {
    if (this.batch.length === 0) return;

    const reports = [...this.batch];
    this.batch = [];

    try {
      // 使用 sendBeacon 优先 (不阻塞页面卸载)
      if (navigator.sendBeacon) {
        const blob = new Blob([JSON.stringify({ metrics: reports })], {
          type: 'application/json',
        });
        const sent = navigator.sendBeacon(this.config.endpoint!, blob);
        if (sent) return;
      }

      // Fallback: fetch with keepalive
      await fetch(this.config.endpoint!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ metrics: reports }),
        keepalive: true,
      });
    } catch (err) {
      if (this.config.debug) {
        console.warn('[WebVitals] Failed to send metrics:', err);
      }
      // 失败的指标放回批次 (最多保留 50 条)
      if (this.batch.length < 50) {
        this.batch.unshift(...reports);
      }
    }
  }

  // 启动定时批量上报
  startBatchTimer(): void {
    if (this.batchTimer) return;
    this.batchTimer = setInterval(() => this.flush(), this.config.batchInterval ?? 5000);
  }

  // 停止定时批量上报
  stopBatchTimer(): void {
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }
  }

  // 页面卸载时上报
  setupUnloadHandler(): void {
    window.addEventListener('pagehide', () => {
      this.flush();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.flush();
      }
    });
  }
}

// --- 初始化函数 ---

let collector: WebVitalsCollector | null = null;

/**
 * 初始化 Web Vitals 监控
 *
 * 使用方式:
 *
 * import { initWebVitals } from '@/lib/web-vitals';
 *
 * // 在 main.tsx 或 App.tsx 中调用
 * initWebVitals({
 *   tenantId: getCurrentTenantId(),
 *   userId: getCurrentUserId(),
 * });
 */
export function initWebVitals(config: WebVitalsConfig = {}): void {
  if (collector) return; // 防止重复初始化

  collector = new WebVitalsCollector(config);
  collector.startBatchTimer();
  collector.setupUnloadHandler();

  // 动态导入 web-vitals (按需加载)
  import('web-vitals').then(({ onCLS, onLCP, onFID, onINP, onTTFB }) => {
    onCLS((metric: CLSMetric) => collector!.collect(metric));
    onLCP((metric: LCPMetric) => collector!.collect(metric));
    onFID((metric: FIDMetric) => collector!.collect(metric));
    onINP((metric: INPMetric) => collector!.collect(metric));
    onTTFB((metric: TTFBMetric) => collector!.collect(metric));
  });

  if (config.debug) {
    console.log('[WebVitals] Initialized', { sessionId: collector['sessionId'] });
  }
}

/**
 * 手动上报指标 (用于自定义指标)
 */
export function reportMetric(name: string, value: number, rating: 'good' | 'needs-improvement' | 'poor' = 'good'): void {
  if (!collector) return;
  collector.collect({
    name,
    value,
    rating,
    entries: [],
    id: name,
    timestamp: Date.now(),
  } as unknown as Metric);
}

/**
 * 手动触发批量上报
 */
export function flushWebVitals(): void {
  if (!collector) return;
  collector.flush();
}

export { WebVitalsCollector };
export type { Metric };
