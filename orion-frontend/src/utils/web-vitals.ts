// ============================================================
// Web Vitals Collector — Core Web Vitals (Plan 32)
// Collects LCP, CLS, INP, FID, FCP, TTFB
// Sends metrics via Beacon API or fetch to API_BASE_URL + /performance/vitals
import { API_BASE_URL } from '@/api/client';
import { useAuthStore } from '@/stores/authStore';

// Type declarations for Performance APIs
interface LCPEntry extends PerformanceEntry {
  renderTime: number;
  loadTime: number;
  size: number;
  url?: string;
  element?: HTMLElement;
}

interface LSInput {
  hadRecentInput: boolean;
}

interface CLSEntry extends PerformanceEntry, LSInput {
  value: number;
  sources?: Array<{ node: Node }>;
}

interface INPEntry extends PerformanceEntry {
  duration: number;
  blockingTime?: number;
}

interface FIDEntry extends PerformanceEntry {
  processingStart: number;
}

interface PaintEntry extends PerformanceEntry {
  name: string;
  startTime: number;
}

export type VitalsMetricType =
  | 'LCP'
  | 'CLS'
  | 'INP'
  | 'FID'
  | 'FCP'
  | 'TTFB'
  | 'TBT'
  | 'FMP'
  | 'TTI';

export interface WebVital {
  name: VitalsMetricType;
  value: number;
  delta?: number;
  timestamp: number;
  rating: 'good' | 'needs-improvement' | 'poor';
  deltaValue?: number;
  navigationType?: string;
  id?: string;
  loadState?: string;
  url?: string;
  element?: string;
  interactionType?: string;
  interactionDuration?: number;
  interactionTarget?: string;
}

export interface WebVitalsReport {
  vitals: WebVital[];
  pageLoad: PageLoadMetrics;
  userAgent: string;
  pageUrl: string;
  timestamp: string;
  sessionId: string;
}

export interface PageLoadMetrics {
  domContentLoaded: number;
  load: number;
  interactive: number;
  firstContentfulPaint: number;
  largestContentfulPaint: number;
  cumulativeLayoutShift: number;
  timeToFirstByte: number;
}

const THRESHOLDS: Record<string, [number, number]> = {
  LCP: [2500, 4000],
  FID: [100, 300],
  CLS: [0.1, 0.25],
  INP: [200, 500],
  FCP: [1800, 3000],
  TTFB: [800, 1800],
};

export function getMetricRating(name: VitalsMetricType, value: number): 'good' | 'needs-improvement' | 'poor' {
  const thresholds = THRESHOLDS[name] ?? [2500, 4000];
  if (value <= thresholds[0]) return 'good';
  if (value <= thresholds[1]) return 'needs-improvement';
  return 'poor';
}

export class WebVitalsCollector {
  private observer: PerformanceObserver | null = null;
  private cls: number = 0;
  private fid: number = -1;
  private inp: number = -1;
  private ttfb: number = -1;
  private onVital: ((vital: WebVital) => void) | null = null;
  private metrics: WebVital[] = [];

  constructor() {}

  onVitalReport(handler: (vital: WebVital) => void): void {
    this.onVital = handler;
  }

  start(): void {
    this.collectTTFB();
    this.collectLCP();
    this.collectCLS();
    this.collectINP();
    this.collectFID();
    this.collectFCP();
  }

  stop(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
  }

  getMetrics(): WebVital[] {
    return [...this.metrics];
  }

  buildReport(): WebVitalsReport {
    const pageLoad = this.collectPageLoadMetrics();
    return {
      vitals: [...this.metrics],
      pageLoad,
      userAgent: navigator.userAgent,
      pageUrl: window.location.href,
      timestamp: new Date().toISOString(),
      sessionId: this.getSessionId(),
    };
  }

  private pushMetric(vital: WebVital): void {
    this.metrics.push(vital);
    this.onVital?.(vital);
  }

  private collectTTFB(): void {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return;

    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    if (navEntries.length > 0) {
      const nav = navEntries[0];
      const ttfb = (nav.responseStart ?? 0) - (nav.requestStart ?? 0);
      if (ttfb > 0) {
        this.ttfb = ttfb;
        this.pushMetric({
          name: 'TTFB',
          value: ttfb,
          timestamp: nav.responseStart ?? 0,
          rating: getMetricRating('TTFB', ttfb),
          navigationType: nav.type,
        });
      }
    }
  }

  private collectLCP(): void {
    if (typeof performance === 'undefined' || typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries() as LCPEntry[];
      const last = entries[entries.length - 1];
      if (last) {
        const lcp = last.renderTime > 0 ? last.renderTime : last.startTime;
        this.pushMetric({
          name: 'LCP',
          value: lcp,
          timestamp: lcp,
          rating: getMetricRating('LCP', lcp),
          element: this.getElementSelector(last.element),
          url: last.url,
          navigationType: this.getNavigationType(),
        });
      }
    });

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true });
    } catch (_e) {}

    const entries = performance.getEntriesByType('largest-contentful-paint') as LCPEntry[];
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      const lcp = last.renderTime > 0 ? last.renderTime : last.startTime;
      this.pushMetric({
        name: 'LCP',
        value: lcp,
        timestamp: lcp,
        rating: getMetricRating('LCP', lcp),
        element: this.getElementSelector(last.element),
        url: last.url,
        navigationType: this.getNavigationType(),
      });
    }
  }

  private collectCLS(): void {
    if (typeof performance === 'undefined' || typeof PerformanceObserver === 'undefined') return;

    let clsValue = 0;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as CLSEntry[]) {
        if (!entry.hadRecentInput) {
          clsValue += entry.value;
          this.pushMetric({
            name: 'CLS',
            value: clsValue,
            delta: entry.value,
            timestamp: entry.startTime,
            rating: getMetricRating('CLS', clsValue),
          });
        }
      }
    });

    try {
      observer.observe({ type: 'layout-shift', buffered: true });
    } catch (_e) {}

    const entries = performance.getEntriesByType('layout-shift') as CLSEntry[];
    for (const entry of entries) {
      if (!entry.hadRecentInput) {
        clsValue += entry.value;
      }
    }
    if (clsValue > 0) {
      this.cls = clsValue;
      this.pushMetric({
        name: 'CLS',
        value: clsValue,
        timestamp: Date.now(),
        rating: getMetricRating('CLS', clsValue),
      });
    }
  }

  private collectINP(): void {
    if (typeof performance === 'undefined' || typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as INPEntry[]) {
        const duration = (entry as INPEntry).duration ?? 0;
        if (duration > this.inp) {
          this.inp = duration;
          this.pushMetric({
            name: 'INP',
            value: duration,
            timestamp: entry.startTime,
            rating: getMetricRating('INP', duration),
            interactionDuration: duration,
            interactionType: 'other',
          });
        }
      }
    });

    try {
      observer.observe({ type: 'longtask', buffered: true });
    } catch (_e) {
      this.collectFID();
    }
  }

  private collectFID(): void {
    if (typeof performance === 'undefined' || typeof PerformanceObserver === 'undefined') return;

    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as FIDEntry[]) {
        if (this.fid < 0) {
          const firstInput = (entry as FIDEntry).processingStart - entry.startTime;
          this.fid = firstInput;
          const itype = entry.name === 'click' || entry.name === 'keydown' ? 'pointer' : 'keyboard';
          this.pushMetric({
            name: 'FID',
            value: firstInput,
            timestamp: entry.startTime,
            rating: getMetricRating('FID', firstInput),
            interactionType: itype,
          });
        }
      }
    });

    try {
      observer.observe({ type: 'first-input', buffered: true });
    } catch (_e) {}
  }

  private collectFCP(): void {
    if (typeof performance === 'undefined') return;

    const entries = performance.getEntriesByType('paint') as PaintEntry[];
    for (const entry of entries) {
      if (entry.name === 'first-contentful-paint') {
        const fcp = entry.startTime;
        this.pushMetric({
          name: 'FCP',
          value: fcp,
          timestamp: fcp,
          rating: getMetricRating('FCP', fcp),
          navigationType: this.getNavigationType(),
          loadState: 'first-contentful-paint',
        });
        break;
      }
    }
  }

  private collectPageLoadMetrics(): PageLoadMetrics {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) {
      return {
        domContentLoaded: 0, load: 0, interactive: 0,
        firstContentfulPaint: 0, largestContentfulPaint: 0,
        cumulativeLayoutShift: this.cls,
        timeToFirstByte: this.ttfb >= 0 ? this.ttfb : 0,
      };
    }

    const navEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    const paintEntries = performance.getEntriesByType('paint') as PaintEntry[];
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint') as LCPEntry[];

    const nav = navEntries[0] || null;
    const fcp = paintEntries.find(e => e.name === 'first-contentful-paint') || null;
    const lcp = lcpEntries.length > 0 ? lcpEntries[lcpEntries.length - 1] : null;

    return {
      domContentLoaded: nav?.domContentLoadedEventEnd ?? 0,
      load: nav?.loadEventEnd ?? 0,
      interactive: nav?.domInteractive ?? 0,
      firstContentfulPaint: fcp?.startTime ?? 0,
      largestContentfulPaint: lcp ? (lcp.renderTime > 0 ? lcp.renderTime : lcp.startTime) : 0,
      cumulativeLayoutShift: this.cls,
      timeToFirstByte: this.ttfb >= 0 ? this.ttfb : ((nav?.responseStart ?? 0) - (nav?.requestStart ?? 0)),
    };
  }

  private getNavigationType(): string {
    if (typeof performance === 'undefined' || !performance.getEntriesByType) return 'navigate';
    const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
    return entries[0]?.type || 'navigate';
  }

  private getElementSelector(element?: HTMLElement): string {
    if (!element) return '';
    if (element.id) return `#${element.id}`;
    if (element.className && typeof element.className === 'string') return `.${element.className.split(' ')[0]}`;
    return element.tagName.toLowerCase();
  }

  private getSessionId(): string {
    if (typeof sessionStorage !== 'undefined') {
      let sid = sessionStorage.getItem('orion:sessionId');
      if (!sid) {
        sid = crypto.randomUUID();
        sessionStorage.setItem('orion:sessionId', sid);
      }
      return sid;
    }
    return crypto.randomUUID();
  }
}

export const webVitalsCollector = new WebVitalsCollector();

export async function reportWebVitals(collector: WebVitalsCollector): Promise<void> {
  const report = collector.buildReport();
  if (!report.vitals.length && !report.pageLoad.domContentLoaded && !report.pageLoad.load) {
    return; // Nothing to report
  }

  try {
    const authStore = useAuthStore.getState();
    const token = await authStore.getToken();
    await fetch(`${API_BASE_URL}/performance/vitals`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(report),
      keepalive: true,
    });
  } catch (_e) {
    if (navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(report)], { type: 'application/json' });
      navigator.sendBeacon(`${API_BASE_URL}/performance/vitals`, blob);
    }
  }
}
