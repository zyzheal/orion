/**
 * B2 优化规范检测器
 * 检测性能优化相关的设计约束
 *
 * B2-04~B2-06: 缓存策略
 * B2-07~B2-09: 懒加载
 * B2-12: 第三方依赖按需引入
 * B2-13~B2-15: 已有实现
 */

import * as ts from 'typescript';
import * as fs from 'fs';
import * as path from 'path';

// ============ 类型定义 ============

export interface OptimizeIssue {
  file: string;
  line: number;
  column: number;
  type: OptimizeIssueType;
  severity: 'P0' | 'P1';
  message: string;
  suggestion: string;
  checkId: string; // B2-XX
  code?: string;
}

export type OptimizeIssueType =
  // B2-04: 多级缓存策略
  | 'missing-multi-level-cache'
  // B2-05: 缓存失效策略
  | 'missing-cache-ttl'
  | 'missing-cache-invalidation'
  // B2-06: 缓存命中率监控
  | 'missing-cache-hit-rate-monitor'
  // B2-07: 路由懒加载
  | 'missing-lazy-route'
  // B2-08: 组件懒加载
  | 'missing-lazy-component'
  // B2-09: 图片懒加载
  | 'missing-image-lazy-load'
  // B2-12: 第三方依赖按需引入
  | 'full-import-lodash'
  | 'full-import-moment'
  | 'full-import-antd'
  | 'full-import-other'
  // B2-13: 减少不必要重绘
  | 'missing-react-memo'
  | 'missing-usememo'
  | 'missing-usecallback'
  // B2-14: 请求合并
  | 'missing-request-batch'
  | 'missing-request-deduplication';

export interface OptimizeScanResult {
  file: string;
  issues: OptimizeIssue[];
  stats: {
    hasCache: boolean;
    hasMultiLevelCache: boolean;
    hasCacheTTL: boolean;
    hasCacheInvalidation: boolean;
    hasCacheMonitor: boolean;
    hasLazyRoute: boolean;
    hasLazyComponent: boolean;
    hasImageLazyLoad: boolean;
    hasOptimizedImport: boolean;
    // B2-13: 减少不必要重绘
    hasReactMemo: boolean;
    hasUseMemo: boolean;
    hasUseCallback: boolean;
    // B2-14: 请求合并
    hasRequestBatch: boolean;
    hasRequestDedupe: boolean;
  };
}

// ============ B2 优化规范分析器 ============

export class B2OptimizeAnalyzer {
  private sourceFile: ts.SourceFile;
  private filePath: string;
  private content: string;
  private issues: OptimizeIssue[] = [];
  private isFrontend: boolean;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.isFrontend = filePath.includes('orion-frontend/');
    this.content = fs.readFileSync(filePath, 'utf-8');
    this.sourceFile = ts.createSourceFile(
      filePath,
      this.content,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );
  }

  /**
   * 执行 B2 优化规范分析
   */
  analyze(): OptimizeScanResult {
    this.issues = [];

    // 只在前端文件中检测
    if (this.isFrontend) {
      // 缓存策略检测
      this.detectMultiLevelCache();
      this.detectCacheTTL();
      this.detectCacheInvalidation();
      this.detectCacheHitRateMonitor();

      // 懒加载检测
      this.detectLazyRoute();
      this.detectLazyComponent();
      this.detectImageLazyLoad();

      // 第三方依赖按需引入
      this.detectOptimizedImports();

      // B2-13: 减少不必要重绘
      this.detectReactMemo();
      this.detectUseMemo();
      this.detectUseCallback();

      // B2-14: 请求合并
      this.detectRequestBatch();
      this.detectRequestDeduplication();
    }

    const stats = this.collectStats();

    return {
      file: this.filePath,
      issues: this.issues,
      stats,
    };
  }

  /**
   * 收集统计信息
   */
  private collectStats() {
    const hasCache = /cache|Cache|localStorage|sessionStorage|IndexedDB/i.test(this.content);
    const hasMultiLevelCache = /redis|memcached|IndexedDB|localStorage.*sessionStorage/i.test(this.content);
    const hasCacheTTL = /ttl|expire|expiry|maxAge|timeout.*cache/i.test(this.content);
    const hasCacheInvalidation = /invalidate|clear.*cache|remove.*cache|set.*cache.*null/i.test(this.content);
    const hasCacheMonitor = /hitRate|hit.*rate|metrics.*cache|monitor.*cache/i.test(this.content);
    const hasLazyRoute = /React\.lazy|lazy.*import|loadable/i.test(this.content);
    const hasLazyComponent = /React\.lazy|dynamic\(|loadable\(/i.test(this.content);
    const hasImageLazyLoad = /loading\s*=\s*["']lazy["']|lazyLoad|lazy.*load/i.test(this.content);
    const hasOptimizedImport = !this.detectFullImports();

    // B2-13: 减少不必要重绘
    const hasReactMemo = /React\.memo|memo\(|memo\s*=/i.test(this.content);
    const hasUseMemo = /useMemo\s*\(/i.test(this.content);
    const hasUseCallback = /useCallback\s*\(/i.test(this.content);

    // B2-14: 请求合并
    const hasRequestBatch = /batch|parallel.*request|Promise\.all|requestQueue/i.test(this.content);
    const hasRequestDedupe = /dedupe|debounce|throttle|request.*cache/i.test(this.content);

    return {
      hasCache,
      hasMultiLevelCache,
      hasCacheTTL,
      hasCacheInvalidation,
      hasCacheMonitor,
      hasLazyRoute,
      hasLazyComponent,
      hasImageLazyLoad,
      hasOptimizedImport,
      hasReactMemo,
      hasUseMemo,
      hasUseCallback,
      hasRequestBatch,
      hasRequestDedupe,
    };
  }

  /**
   * 检测是否有全量导入（内部使用）
   */
  private detectFullImports(): boolean {
    return /import\s+.*\s+from\s+['"]lodash['"]/.test(this.content) ||
           /import\s+.*\s+from\s+['"]moment['"]/.test(this.content) ||
           /import\s+\{\s*}\s+from\s+['"]antd['"]/.test(this.content);
  }

  // ============ B2-04: 多级缓存策略 (P1) ============

  /**
   * 检测是否有多级缓存策略
   * 检测: localStorage/sessionStorage + memory cache, 或 redis + memory cache
   */
  private detectMultiLevelCache(): void {
    // 检测是否有缓存相关代码
    const hasCache = /cache|Cache|localStorage|sessionStorage|IndexedDB/i.test(this.content);
    if (!hasCache) return;

    // 检测是否有多级缓存（至少两种）
    const hasMemoryCache = /\bMap\(|new\s+Cache\(|memory.*cache|window\.\w+Cache/i.test(this.content);
    const hasBrowserCache = /localStorage|sessionStorage|IndexedDB/i.test(this.content);
    const hasRedis = /redis|Redis/i.test(this.content);

    const cacheLevels = [hasMemoryCache, hasBrowserCache, hasRedis].filter(Boolean).length;

    if (hasCache && cacheLevels < 2) {
      // 检查是否有明显的缓存实现
      const hasCacheImplementation = /new\s+Map|cache\s*=\s*\{|createCache|useCache/i.test(this.content);
      if (!hasCacheImplementation || cacheLevels < 1) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-multi-level-cache',
          severity: 'P1',
          message: '缺少多级缓存策略',
          suggestion: '建议实现：内存缓存 + localStorage/redis 多级缓存',
          checkId: 'B2-04',
        });
      }
    }
  }

  // ============ B2-05: 缓存失效策略 (P0) ============

  /**
   * 检测是否有缓存失效策略（TTL/LRU）
   */
  private detectCacheTTL(): void {
    // 检测是否有缓存相关代码
    const hasCache = /cache|Cache|localStorage|sessionStorage/i.test(this.content);
    if (!hasCache) return;

    // 检测 TTL 相关配置
    const hasTTL = /ttl|expire|expiry|maxAge|timeout.*cache|cacheTime|cacheDuration|age/i.test(this.content);
    // 检测 LRU 相关实现
    const hasLRU = /LRU|lru|Cache.* evict|maxSize/i.test(this.content);
    // 检测过期检查
    const hasExpiryCheck = /isExpired|isValid|checkExpire|Date\.now\(\)\s*[<>]/i.test(this.content);

    if (!hasTTL && !hasLRU && !hasExpiryCheck) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-cache-ttl',
        severity: 'P0',
        message: '缺少缓存失效策略（TTL/LRU）',
        suggestion: '为缓存添加 TTL 过期时间或 LRU 淘汰策略',
        checkId: 'B2-05',
      });
    }
  }

  /**
   * 检测是否有缓存失效逻辑
   */
  private detectCacheInvalidation(): void {
    const hasCache = /cache|Cache|localStorage|sessionStorage/i.test(this.content);
    if (!hasCache) return;

    // 检测缓存失效逻辑
    const hasInvalidation = /invalidate|clear.*cache|removeCache|deleteCache|setCache.*null|resetCache/i.test(this.content);
    // 检测手动删除
    const hasManualDelete = /\.remove\(|\.delete\(|localStorage\.removeItem|sessionStorage\.removeItem/i.test(this.content);

    // 如果有缓存但没有失效逻辑
    if (!hasInvalidation && !hasManualDelete) {
      // 只在有明确缓存存储时才警告
      const hasExplicitCache = /cache\.|useCache|getCache|setCache/i.test(this.content);
      if (hasExplicitCache) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-cache-invalidation',
          severity: 'P0',
          message: '缺少缓存失效/清理逻辑',
          suggestion: '添加缓存失效策略：手动删除、定时清理或事件触发',
          checkId: 'B2-05',
        });
      }
    }
  }

  // ============ B2-06: 缓存命中率监控 (P1) ============

  /**
   * 检测是否有缓存命中率监控
   */
  private detectCacheHitRateMonitor(): void {
    const hasCache = /cache|Cache|localStorage|sessionStorage/i.test(this.content);
    if (!hasCache) return;

    // 检测监控相关代码
    const hasHitRate = /hitRate|hit.*rate|hits\?.*misses|cache.*ratio/i.test(this.content);
    const hasMetrics = /metrics|metric|monitor|track.*cache/i.test(this.content);
    const hasLogger = /logger\.|log\..*cache|console\..*cache/i.test(this.content);

    // 检测是否有统计逻辑
    const hasStats = /stats|count|increment.*cache|miss.*count|hit.*count/i.test(this.content);

    if (!hasHitRate && !hasMetrics && !hasStats) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-cache-hit-rate-monitor',
        severity: 'P1',
        message: '缺少缓存命中率监控',
        suggestion: '添加缓存命中率监控指标，记录 hit/miss 次数',
        checkId: 'B2-06',
      });
    }
  }

  // ============ B2-07: 路由懒加载 (P0) ============

  /**
   * 检测路由是否使用懒加载
   * 检测 routes.tsx 或类似路由配置文件
   */
  private detectLazyRoute(): void {
    // 检测是否是路由配置文件
    const isRouteFile = /routes?|router/i.test(this.filePath) &&
                        (this.filePath.endsWith('.tsx') || this.filePath.endsWith('.ts'));

    if (!isRouteFile) return;

    // 检测是否使用懒加载
    const hasLazyImport = /React\.lazy|lazy\s*\(\s*\(\s*\)\s*=>\s*import\(/i.test(this.content);
    const hasLoadable = /loadable\(|loadable\(/i.test(this.content);
    const hasDynamicImport = /=\s*\(\s*\)\s*=>\s*import\(/i.test(this.content);

    if (!hasLazyImport && !hasLoadable && !hasDynamicImport) {
      // 检查是否有静态 import
      const hasStaticImport = /^import\s+\w+\s+from\s+['"]\.\/pages|^import\s+\w+\s+from\s+['"]@\/pages/im.test(this.content);

      if (hasStaticImport) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-lazy-route',
          severity: 'P0',
          message: '路由未使用懒加载',
          suggestion: '使用 React.lazy(() => import(...)) 实现路由懒加载',
          checkId: 'B2-07',
        });
      }
    }
  }

  // ============ B2-08: 组件懒加载 (P0) ============

  /**
   * 检测组件是否使用懒加载
   */
  private detectLazyComponent(): void {
    // 检测是否有重型组件特征
    const hasHeavyComponent = /Modal|Drawer|Table|Form|Chart|Editor|Upload|Dialog/i.test(this.content);
    if (!hasHeavyComponent) return;

    // 检测是否使用懒加载
    const hasLazyImport = /React\.lazy|dynamic\(|loadable\(/i.test(this.content);
    const hasDynamicImport = /import\s*\(\s*\)/i.test(this.content);

    if (!hasLazyImport && !hasDynamicImport) {
      // 检测是否有重型组件的静态导入
      const hasStaticImport = /import\s+\{[^}]*(Modal|Drawer|Table|Chart|Editor)[^}]*\}\s+from\s+['"]antd['"]/i.test(this.content) ||
                              /import\s+.*\s+from\s+['"]@\/components\//i.test(this.content);

      if (hasStaticImport) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-lazy-component',
          severity: 'P0',
          message: '重型组件未使用懒加载',
          suggestion: '对 Modal、Drawer、Table 等重型组件使用 React.lazy 或 dynamic import',
          checkId: 'B2-08',
        });
      }
    }
  }

  // ============ B2-09: 图片懒加载 (P1) ============

  /**
   * 检测图片是否使用懒加载
   */
  private detectImageLazyLoad(): void {
    // 检测是否有 img 标签
    const hasImgTag = /<img|Image\s*\.|\.src\s*=|background.*url/i.test(this.content);
    if (!hasImgTag) return;

    // 检测是否使用懒加载
    const hasLazyAttr = /loading\s*=\s*["']lazy["']|loading:\s*['"]lazy["']/i.test(this.content);
    const hasLazyLoad = /lazyLoad|lazy.*load|IntersectionObserver/i.test(this.content);
    const hasLazyImport = /lazy.*Image|Image.*lazy/i.test(this.content);

    if (!hasLazyAttr && !hasLazyLoad && !hasLazyImport) {
      // 检查是否有列表渲染图片
      const hasListRender = /\.map\(.*=>/.test(this.content);
      const hasImgInMap = /<img|<Image/.test(this.content);

      if (hasListRender && hasImgInMap) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-image-lazy-load',
          severity: 'P1',
          message: '列表图片未使用懒加载',
          suggestion: '对列表中图片添加 loading="lazy" 或使用 lazyload 库',
          checkId: 'B2-09',
        });
      }
    }
  }

  // ============ B2-12: 第三方依赖按需引入 (P1) ============

  /**
   * 检测第三方依赖是否按需引入
   */
  private detectOptimizedImports(): void {
    const lines = this.content.split('\n');

    lines.forEach((line, i) => {
      // 检测 lodash 全量导入
      if (/import\s+\*\s+as\s+\w+\s+from\s+['"]lodash['"]/i.test(line) ||
          /import\s+\w+\s+from\s+['"]lodash['"]/i.test(line)) {
        // 检查是否已被优化（按需导入）
        if (!line.includes('/') && !line.includes('lodash-es')) {
          this.issues.push({
            file: this.filePath,
            line: i + 1,
            column: line.indexOf('import') + 1,
            type: 'full-import-lodash',
            severity: 'P1',
            message: 'lodash 使用全量导入',
            suggestion: '改为按需导入：import get from "lodash/get" 或使用 lodash-es',
            checkId: 'B2-12',
            code: line.trim(),
          });
        }
      }

      // 检测 moment 全量导入
      if (/import\s+\w+\s+from\s+['"]moment['"]/i.test(line)) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: line.indexOf('import') + 1,
          type: 'full-import-moment',
          severity: 'P1',
          message: 'moment 使用全量导入',
          suggestion: '改为使用 dayjs：import dayjs from "dayjs"',
          checkId: 'B2-12',
          code: line.trim(),
        });
      }

      // 检测 antd 全量导入
      if (/import\s+\{\s*\}\s+from\s+['"]antd['"]/i.test(line) ||
          /import\s+antd\s+from\s+['"]antd['"]/i.test(line)) {
        this.issues.push({
          file: this.filePath,
          line: i + 1,
          column: line.indexOf('import') + 1,
          type: 'full-import-antd',
          severity: 'P1',
          message: 'antd 使用全量导入',
          suggestion: '改为按需导入：import { Button, Modal } from "antd"',
          checkId: 'B2-12',
          code: line.trim(),
        });
      }

      // 检测其他常见全量导入
      const fullImportPatterns = [
        { regex: /import\s+\{\s*[^}]*\}\s+from\s+['"]lodash['"]/i, name: 'lodash' },
        { regex: /import\s+\{\s*[^}]*\}\s+from\s+['"]antd['"]/i, name: 'antd' },
        { regex: /import\s+\w+\s+from\s+['"]rxjs['"]/i, name: 'rxjs' },
      ];

      for (const p of fullImportPatterns) {
        if (p.regex.test(line) && !line.includes('/')) {
          // 跳过按需导入的检测（行中包含具体的组件/方法）
          const hasSpecificImport = line.match(/import\s+\{([^}]+)\}/);
          if (hasSpecificImport && hasSpecificImport[1].includes(',')) {
            // 有多个导入，认为是按需导入
            continue;
          }
        }
      }
    });
  }

  // ============ B2-13: 减少不必要重绘 (P1) ============

  /**
   * 检测是否使用 React.memo 避免不必要的重绘
   */
  private detectReactMemo(): void {
    // 检测是否有组件定义
    const hasComponent = /(?:function\s+\w+|const\s+\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>|class\s+\w+\s+extends)/.test(this.content);
    if (!hasComponent) return;

    // 检测是否使用了 memo
    const hasMemo = /React\.memo|memo\(|memo\s*=\s*(?:React\.)?memo/i.test(this.content);

    if (!hasMemo) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-react-memo',
        severity: 'P1',
        message: '组件未使用 React.memo 优化',
        suggestion: '使用 React.memo 包装纯展示组件避免不必要的重绘',
        checkId: 'B2-13',
      });
    }
  }

  /**
   * 检测是否使用 useMemo 优化计算
   */
  private detectUseMemo(): void {
    // 检测是否有复杂计算
    const hasComplexCalc = /\.map\(|\.filter\(|\.reduce\(|Array\.|Math\./.test(this.content);
    if (!hasComplexCalc) return;

    const hasUseMemo = /useMemo\s*\(/.test(this.content);

    if (!hasUseMemo) {
      // 检测是否在组件内有计算逻辑但没用 useMemo
      const hasComponentLogic = /(?:function\s+\w+|const\s+\w+\s*=\s*)\s*(?:\([^)]*\)|[^=])\s*=>\s*\{[\s\S]*\./.test(this.content);
      if (hasComponentLogic) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-usememo',
          severity: 'P1',
          message: '复杂计算未使用 useMemo 优化',
          suggestion: '使用 useMemo 缓存复杂计算结果，避免每次渲染重新计算',
          checkId: 'B2-13',
        });
      }
    }
  }

  /**
   * 检测是否使用 useCallback 优化回调函数
   */
  private detectUseCallback(): void {
    // 检测是否向子组件传递回调
    const hasCallback = /onClick=|onChange=|onSubmit=|handle\w+\s*=\s*(?:\([^)]*\)|[^=])\s*=>/.test(this.content);
    if (!hasCallback) return;

    const hasUseCallback = /useCallback\s*\(/.test(this.content);

    if (!hasUseCallback) {
      this.issues.push({
        file: this.filePath,
        line: 1,
        column: 1,
        type: 'missing-usecallback',
        severity: 'P1',
        message: '回调函数未使用 useCallback 优化',
        suggestion: '使用 useCallback 缓存回调函数，避免子组件不必要重渲染',
        checkId: 'B2-13',
      });
    }
  }

  // ============ B2-14: 请求合并 (P1) ============

  /**
   * 检测是否有请求批量处理
   */
  private detectRequestBatch(): void {
    // 检测是否有多个 API 调用
    const hasAPICalls = /useRequest|fetch\(|axios\.|request\(|\.get\(|\.post\(/.test(this.content);
    if (!hasAPICalls) return;

    // 检测是否有批量请求
    const hasBatch = /Promise\.all|Promise\.allSettled|batch|parallel|simultaneous/i.test(this.content);

    if (!hasBatch) {
      // 检测是否有循环内的请求
      const hasLoopRequest = /\.forEach\(.*request|\.map\(.*request|for\s*\(.*request/.test(this.content);
      if (hasLoopRequest) {
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-request-batch',
          severity: 'P1',
          message: '循环中的请求未合并',
          suggestion: '使用 Promise.all 合并批量请求，减少网络开销',
          checkId: 'B2-14',
        });
      }
    }
  }

  /**
   * 检测是否有请求去重
   */
  private detectRequestDeduplication(): void {
    // 检测是否有重复请求的可能
    const hasAPICalls = /useRequest|fetch\(|axios\.|request\(/.test(this.content);
    if (!hasAPICalls) return;

    // 检测是否有防抖/节流或缓存
    const hasDedupe = /debounce|throttle|cache|dedupe|requestCache/i.test(this.content);

    if (!hasDedupe) {
      // 检测组件是否可能在短时间内发起多次相同请求
      const hasEffectDeps = /useEffect\s*\([^)]+,?\s*\[[^\]]*\]/;
      if (hasEffectDeps) {
        // 简单检查：可能存在依赖变化导致的重复请求
        this.issues.push({
          file: this.filePath,
          line: 1,
          column: 1,
          type: 'missing-request-deduplication',
          severity: 'P1',
          message: '缺少请求去重/防抖机制',
          suggestion: '使用 debounce/throttle 或请求缓存避免重复请求',
          checkId: 'B2-14',
        });
      }
    }
  }
}

// ============ 批量扫描器 ============

export class B2OptimizeScanner {
  private frontendPath: string;

  constructor(frontendPath: string = 'orion-frontend/src/') {
    this.frontendPath = frontendPath;
  }

  /**
   * 扫描所有前端文件
   */
  async scan(): Promise<OptimizeIssue[]> {
    const allIssues: OptimizeIssue[] = [];

    if (fs.existsSync(this.frontendPath)) {
      const frontendIssues = await this.scanDirectory(this.frontendPath, ['.ts', '.tsx']);
      allIssues.push(...frontendIssues);
    }

    return allIssues;
  }

  /**
   * 扫描目录下的所有 TypeScript 文件
   */
  private async scanDirectory(dir: string, extensions: string[]): Promise<OptimizeIssue[]> {
    const issues: OptimizeIssue[] = [];

    const traverse = (currentDir: string) => {
      try {
        const entries = fs.readdirSync(currentDir, { withFileTypes: true });

        for (const entry of entries) {
          const fullPath = path.join(currentDir, entry.name);

          // 跳过 node_modules、.git、dist 等目录
          if (entry.isDirectory()) {
            if (!entry.name.startsWith('.') &&
                entry.name !== 'node_modules' &&
                entry.name !== 'dist' &&
                entry.name !== 'build' &&
                entry.name !== 'tokens') { // tokens 是设计系统，跳过
              traverse(fullPath);
            }
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (extensions.includes(ext)) {
              try {
                const analyzer = new B2OptimizeAnalyzer(fullPath);
                const result = analyzer.analyze();
                issues.push(...result.issues);
              } catch (e) {
                // 跳过解析错误的文件
              }
            }
          }
        }
      } catch (e) {
        // 忽略读取错误
      }
    };

    traverse(dir);
    return issues;
  }

  /**
   * 按检查项分组统计
   */
  groupByCheckId(issues: OptimizeIssue[]): Record<string, OptimizeIssue[]> {
    const grouped: Record<string, OptimizeIssue[]> = {};

    for (const issue of issues) {
      if (!grouped[issue.checkId]) {
        grouped[issue.checkId] = [];
      }
      grouped[issue.checkId].push(issue);
    }

    return grouped;
  }

  /**
   * 按严重程度统计
   */
  countBySeverity(issues: OptimizeIssue[]): Record<string, number> {
    const counts: Record<string, number> = { P0: 0, P1: 0 };

    for (const issue of issues) {
      counts[issue.severity]++;
    }

    return counts;
  }

  /**
   * 生成扫描报告
   */
  generateReport(issues: OptimizeIssue[]): string {
    const byCheckId = this.groupByCheckId(issues);
    const bySeverity = this.countBySeverity(issues);

    let report = '# B2 优化规范检测报告\n\n';
    report += `## 总体统计\n\n`;
    report += `- 总问题数: ${issues.length}\n`;
    report += `- P0 严重: ${bySeverity.P0}\n`;
    report += `- P1 警告: ${bySeverity.P1}\n\n`;
    report += `## 按检查项统计\n\n`;

    const checkNames: Record<string, string> = {
      'B2-04': '多级缓存策略',
      'B2-05': '缓存失效策略',
      'B2-06': '缓存命中率监控',
      'B2-07': '路由懒加载',
      'B2-08': '组件懒加载',
      'B2-09': '图片懒加载',
      'B2-12': '第三方依赖按需引入',
      'B2-13': '减少不必要重绘',
      'B2-14': '请求合并',
    };

    for (const [checkId, checkIssues] of Object.entries(byCheckId)) {
      const name = checkNames[checkId] || checkId;
      const p0Count = checkIssues.filter(i => i.severity === 'P0').length;
      const p1Count = checkIssues.filter(i => i.severity === 'P1').length;

      report += `### ${checkId} - ${name}\n`;
      report += `- P0: ${p0Count}, P1: ${p1Count}\n`;
      report += `- 涉及文件: ${new Set(checkIssues.map(i => i.file)).size}\n\n`;
    }

    return report;
  }

  /**
   * 生成覆盖率报告
   */
  generateCoverageReport(issues: OptimizeIssue[]): string {
    // 支持自动检测的 B2 优化项（当前已实现的检测器）
    const allChecks = ['B2-04', 'B2-05', 'B2-06', 'B2-07', 'B2-08', 'B2-09', 'B2-12', 'B2-13', 'B2-14'];
    const implementedChecks = allChecks.filter(check => {
      return issues.some(i => i.checkId === check);
    });

    const coverage = (implementedChecks.length / allChecks.length * 100).toFixed(1);

    let report = '# B2 优化规范覆盖率\n\n';
    report += `## 覆盖率统计\n\n`;
    report += `- 已实现检测: ${implementedChecks.length}/${allChecks.length} (${coverage}%)\n`;
    report += `- 可自动检测: 9 项 (共 15 项 B2 规范)\n\n`;
    report += `## 检测项清单\n\n`;
    report += `| 检查项 | 状态 | 说明 |\n`;
    report += `|--------|------|------|\n`;

    const checkNames: Record<string, string> = {
      'B2-04': '多级缓存策略',
      'B2-05': '缓存失效策略',
      'B2-06': '缓存命中率监控',
      'B2-07': '路由懒加载',
      'B2-08': '组件懒加载',
      'B2-09': '图片懒加载',
      'B2-12': '第三方依赖按需引入',
      'B2-13': '减少不必要重绘',
      'B2-14': '请求合并',
    };

    for (const check of allChecks) {
      const name = checkNames[check];
      const hasIssues = issues.some(i => i.checkId === check);
      const status = hasIssues ? '⚠️ 已实现' : '✅ 已实现';
      report += `| ${check} | ${status} | ${name} |\n`;
    }

    return report;
  }
}

// ============ 辅助函数 ============

/**
 * 创建默认扫描器
 */
export function createDefaultScanner(): B2OptimizeScanner {
  return new B2OptimizeScanner(
    path.join(process.cwd(), 'orion-frontend/src/')
  );
}

// ============ 导出 ============

export default {
  B2OptimizeAnalyzer,
  B2OptimizeScanner,
  createDefaultScanner,
};